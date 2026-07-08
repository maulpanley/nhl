"""Ingestion orchestration: teams, season game lists, boxscores, enrichment."""

from __future__ import annotations

import gzip
import json
import logging
from datetime import date, datetime, timezone

from sqlalchemy import Engine, func, select

from . import db, parse
from .api import NHLApi

log = logging.getLogger("nhl_ingest")

# Boxscore gameState values that mean the game is over and stats are final.
FINAL_STATES = {"OFF", "FINAL"}


def sync_teams(engine: Engine, api: NHLApi) -> int:
    rows = [
        {
            "team_id": t["id"],
            "abbrev": t["triCode"],
            "full_name": t["fullName"],
            "franchise_id": t.get("franchiseId"),
        }
        for t in api.teams()
    ]
    with engine.begin() as conn:
        db.upsert(conn, db.teams, rows)
    return len(rows)


def sync_season_games(engine: Engine, api: NHLApi, season: int) -> int:
    """Upsert the season's game list (ids, dates, teams, scores) from stats REST."""
    rows = [parse.parse_season_game(g) for g in api.season_games(season)]
    with engine.begin() as conn:
        db.upsert(
            conn,
            db.games,
            rows,
            # never clobber ingested_at, which only ingest_boxscore sets
            update_columns=["game_date", "home_score", "away_score", "game_state_id"],
        )
    return len(rows)


def pending_game_ids(engine: Engine, season: int | None = None, limit: int | None = None) -> list[int]:
    """Games that have started (date <= today) but have no ingested boxscore yet."""
    stmt = (
        select(db.games.c.game_id)
        .where(db.games.c.ingested_at.is_(None))
        .where(db.games.c.game_date <= date.today())
        .order_by(db.games.c.game_date)
    )
    if season is not None:
        stmt = stmt.where(db.games.c.season == season)
    if limit is not None:
        stmt = stmt.limit(limit)
    with engine.connect() as conn:
        return [r[0] for r in conn.execute(stmt)]


def ingest_boxscore(engine: Engine, api: NHLApi, game_id: int, store_raw: bool = True) -> bool:
    """Fetch one boxscore and store its stat lines. Returns False if not final yet."""
    box = api.boxscore(game_id)
    if box.get("gameState") not in FINAL_STATES:
        log.info("game %s not final (state=%s), skipping", game_id, box.get("gameState"))
        return False
    player_rows, skater_rows, goalie_rows = parse.parse_boxscore(box)
    now = datetime.now(timezone.utc)
    with engine.begin() as conn:
        db.upsert(conn, db.players, player_rows, update_columns=["position", "current_team_id"])
        db.upsert(conn, db.skater_game_stats, skater_rows)
        db.upsert(conn, db.goalie_game_stats, goalie_rows)
        if store_raw:
            blob = gzip.compress(json.dumps(box, separators=(",", ":")).encode())
            db.upsert(conn, db.raw_boxscores, [{"game_id": game_id, "fetched_at": now, "data_gz": blob}])
        conn.execute(
            db.games.update()
            .where(db.games.c.game_id == game_id)
            .values(
                ingested_at=now,
                home_score=box["homeTeam"].get("score"),
                away_score=box["awayTeam"].get("score"),
            )
        )
    return True


def ingest_pending(
    engine: Engine,
    api: NHLApi,
    season: int | None = None,
    limit: int | None = None,
    store_raw: bool = True,
) -> tuple[int, int]:
    game_ids = pending_game_ids(engine, season=season, limit=limit)
    done = 0
    for i, game_id in enumerate(game_ids, 1):
        try:
            if ingest_boxscore(engine, api, game_id, store_raw=store_raw):
                done += 1
        except Exception:
            log.exception("failed to ingest game %s, continuing", game_id)
        if i % 50 == 0:
            log.info("progress: %d/%d boxscores", i, len(game_ids))
    return done, len(game_ids)


def backfill(
    engine: Engine,
    api: NHLApi,
    start_season: int,
    end_season: int,
    limit: int | None = None,
    store_raw: bool = True,
) -> None:
    season = start_season
    while season <= end_season:
        n = sync_season_games(engine, api, season)
        log.info("season %s: %d games listed", season, n)
        done, pending = ingest_pending(engine, api, season=season, limit=limit, store_raw=store_raw)
        log.info("season %s: ingested %d/%d pending boxscores", season, done, pending)
        season += 10001  # 20152016 -> 20162017


def current_season(today: date | None = None) -> int:
    """NHL seasons start in October; before that, the season is last year's."""
    today = today or date.today()
    start_year = today.year if today.month >= 9 else today.year - 1
    return start_year * 10000 + start_year + 1


def update(engine: Engine, api: NHLApi, store_raw: bool = True) -> tuple[int, int]:
    """Nightly job: refresh the current season's game list, ingest new finals."""
    season = current_season()
    try:
        sync_season_games(engine, api, season)
    except Exception:
        log.exception("season list refresh failed for %s (offseason?)", season)
    return ingest_pending(engine, api, store_raw=store_raw)


def enrich_players(engine: Engine, api: NHLApi, limit: int = 100) -> int:
    """Replace abbreviated boxscore names with full names from player landing pages."""
    stmt = (
        select(db.players.c.player_id)
        .where(db.players.c.enriched_at.is_(None))
        .order_by(db.players.c.player_id)
        .limit(limit)
    )
    with engine.connect() as conn:
        ids = [r[0] for r in conn.execute(stmt)]
    done = 0
    for player_id in ids:
        try:
            landing = api.player_landing(player_id)
        except Exception:
            log.exception("landing fetch failed for player %s", player_id)
            continue
        first = landing.get("firstName", {}).get("default", "")
        last = landing.get("lastName", {}).get("default", "")
        full_name = f"{first} {last}".strip()
        if not full_name:
            continue
        with engine.begin() as conn:
            conn.execute(
                db.players.update()
                .where(db.players.c.player_id == player_id)
                .values(
                    full_name=full_name,
                    position=landing.get("position"),
                    enriched_at=datetime.now(timezone.utc),
                )
            )
        done += 1
    return done


def counts(engine: Engine) -> dict[str, int]:
    out = {}
    with engine.connect() as conn:
        for table in (db.teams, db.players, db.games, db.skater_game_stats, db.goalie_game_stats, db.raw_boxscores):
            out[table.name] = conn.execute(select(func.count()).select_from(table)).scalar_one()
        out["games_ingested"] = conn.execute(
            select(func.count()).select_from(db.games).where(db.games.c.ingested_at.is_not(None))
        ).scalar_one()
    return out
