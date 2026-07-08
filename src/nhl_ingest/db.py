"""Schema and engine. DATABASE_URL picks the backend:

- sqlite:///nhl.db (default, local dev)
- postgresql+psycopg://... (Neon/Supabase, production)

Stat rows denormalize game_date, season, opponent_team_id and is_home so the
website's core queries (player vs. team over time, rolling form) need no joins.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Engine,
    Float,
    Index,
    Integer,
    LargeBinary,
    MetaData,
    String,
    Table,
    create_engine,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

metadata = MetaData()

teams = Table(
    "teams",
    metadata,
    Column("team_id", Integer, primary_key=True),
    Column("abbrev", String(8), nullable=False),
    Column("full_name", String(64)),
    Column("franchise_id", Integer),
)

players = Table(
    "players",
    metadata,
    Column("player_id", Integer, primary_key=True),
    Column("full_name", String(80)),
    Column("position", String(4)),
    Column("current_team_id", Integer),
    Column("enriched_at", DateTime(timezone=True)),
)

games = Table(
    "games",
    metadata,
    Column("game_id", BigInteger, primary_key=True),
    Column("season", Integer, nullable=False),
    Column("game_type", Integer, nullable=False),  # 2=regular, 3=playoffs
    Column("game_date", Date, nullable=False),
    Column("home_team_id", Integer, nullable=False),
    Column("away_team_id", Integer, nullable=False),
    Column("home_score", Integer),
    Column("away_score", Integer),
    Column("game_state_id", Integer),
    Column("ingested_at", DateTime(timezone=True)),  # set once boxscore stats are stored
    Index("ix_games_season", "season"),
    Index("ix_games_game_date", "game_date"),
)

skater_game_stats = Table(
    "skater_game_stats",
    metadata,
    Column("game_id", BigInteger, primary_key=True),
    Column("player_id", Integer, primary_key=True),
    Column("team_id", Integer, nullable=False),
    Column("opponent_team_id", Integer, nullable=False),
    Column("is_home", Boolean, nullable=False),
    Column("game_date", Date, nullable=False),
    Column("season", Integer, nullable=False),
    Column("game_type", Integer, nullable=False),
    Column("position", String(4)),
    Column("goals", Integer),
    Column("assists", Integer),
    Column("points", Integer),
    Column("plus_minus", Integer),
    Column("pim", Integer),
    Column("sog", Integer),
    Column("hits", Integer),
    Column("blocked_shots", Integer),
    Column("power_play_goals", Integer),
    Column("giveaways", Integer),
    Column("takeaways", Integer),
    Column("faceoff_pct", Float),
    Column("shifts", Integer),
    Column("toi_seconds", Integer),
    Index("ix_skater_player_opponent", "player_id", "opponent_team_id"),
    Index("ix_skater_player_date", "player_id", "game_date"),
)

goalie_game_stats = Table(
    "goalie_game_stats",
    metadata,
    Column("game_id", BigInteger, primary_key=True),
    Column("player_id", Integer, primary_key=True),
    Column("team_id", Integer, nullable=False),
    Column("opponent_team_id", Integer, nullable=False),
    Column("is_home", Boolean, nullable=False),
    Column("game_date", Date, nullable=False),
    Column("season", Integer, nullable=False),
    Column("game_type", Integer, nullable=False),
    Column("shots_against", Integer),
    Column("saves", Integer),
    Column("goals_against", Integer),
    Column("save_pct", Float),
    Column("even_strength_goals_against", Integer),
    Column("power_play_goals_against", Integer),
    Column("shorthanded_goals_against", Integer),
    Column("pim", Integer),
    Column("toi_seconds", Integer),
    Column("starter", Boolean),
    Column("decision", String(4)),
    Index("ix_goalie_player_opponent", "player_id", "opponent_team_id"),
    Index("ix_goalie_player_date", "player_id", "game_date"),
)

# Gzipped raw boxscore JSON, kept so tables can be re-derived after schema
# changes without re-hitting the API. ~5 KB per game compressed.
raw_boxscores = Table(
    "raw_boxscores",
    metadata,
    Column("game_id", BigInteger, primary_key=True),
    Column("fetched_at", DateTime(timezone=True), nullable=False),
    Column("data_gz", LargeBinary, nullable=False),
)


def get_engine() -> Engine:
    load_dotenv()
    url = os.environ.get("DATABASE_URL", "sqlite:///nhl.db")
    # Neon/Supabase hand out postgresql:// URLs; force the psycopg3 driver.
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return create_engine(url)


def init_db(engine: Engine) -> None:
    metadata.create_all(engine)


def upsert(conn, table: Table, rows: list[dict], update_columns: list[str] | None = None) -> None:
    """Insert-or-update on primary key, for sqlite and postgresql.

    `update_columns` restricts which columns are overwritten on conflict
    (all non-PK columns by default) — e.g. player rows from boxscores must not
    clobber enriched full names with abbreviated ones.
    """
    if not rows:
        return
    insert = sqlite_insert if conn.dialect.name == "sqlite" else pg_insert
    pk_cols = [c.name for c in table.primary_key.columns]
    for row in rows:
        stmt = insert(table).values(**row)
        updatable = update_columns if update_columns is not None else [k for k in row if k not in pk_cols]
        update_cols = {k: stmt.excluded[k] for k in updatable if k in row}
        if update_cols:
            stmt = stmt.on_conflict_do_update(index_elements=pk_cols, set_=update_cols)
        else:
            stmt = stmt.on_conflict_do_nothing(index_elements=pk_cols)
        conn.execute(stmt)
