"""Turn NHL API payloads into rows for the tables in db.py."""

from __future__ import annotations

from datetime import date


def toi_to_seconds(toi: str | None) -> int | None:
    if not toi:
        return None
    minutes, _, seconds = toi.partition(":")
    return int(minutes) * 60 + int(seconds)


def parse_season_game(g: dict) -> dict:
    """Row for `games` from the stats REST /game endpoint."""
    return {
        "game_id": g["id"],
        "season": g["season"],
        "game_type": g["gameType"],
        "game_date": date.fromisoformat(g["gameDate"][:10]),
        "home_team_id": g["homeTeamId"],
        "away_team_id": g["visitingTeamId"],
        "home_score": g.get("homeScore"),
        "away_score": g.get("visitingScore"),
        "game_state_id": g.get("gameStateId"),
    }


def parse_boxscore(box: dict) -> tuple[list[dict], list[dict], list[dict]]:
    """Boxscore -> (player_rows, skater_rows, goalie_rows).

    Player names here are abbreviated ("Z. Benson"); the enrich step replaces
    them with full names from the player landing endpoint.
    """
    game_id = box["id"]
    season = box["season"]
    game_type = box["gameType"]
    game_date = date.fromisoformat(box["gameDate"])
    sides = {
        "homeTeam": (box["homeTeam"]["id"], box["awayTeam"]["id"], True),
        "awayTeam": (box["awayTeam"]["id"], box["homeTeam"]["id"], False),
    }

    player_rows: list[dict] = []
    skater_rows: list[dict] = []
    goalie_rows: list[dict] = []

    for side, (team_id, opponent_id, is_home) in sides.items():
        groups = box["playerByGameStats"][side]
        common = {
            "game_id": game_id,
            "team_id": team_id,
            "opponent_team_id": opponent_id,
            "is_home": is_home,
            "game_date": game_date,
            "season": season,
            "game_type": game_type,
        }
        for s in groups["forwards"] + groups["defense"]:
            player_rows.append(_player_row(s, team_id))
            skater_rows.append(
                common
                | {
                    "player_id": s["playerId"],
                    "position": s.get("position"),
                    "goals": s.get("goals"),
                    "assists": s.get("assists"),
                    "points": s.get("points"),
                    "plus_minus": s.get("plusMinus"),
                    "pim": s.get("pim"),
                    "sog": s.get("sog"),
                    "hits": s.get("hits"),
                    "blocked_shots": s.get("blockedShots"),
                    "power_play_goals": s.get("powerPlayGoals"),
                    "giveaways": s.get("giveaways"),
                    "takeaways": s.get("takeaways"),
                    "faceoff_pct": s.get("faceoffWinningPctg"),
                    "shifts": s.get("shifts"),
                    "toi_seconds": toi_to_seconds(s.get("toi")),
                }
            )
        for g in groups["goalies"]:
            player_rows.append(_player_row(g, team_id))
            goalie_rows.append(
                common
                | {
                    "player_id": g["playerId"],
                    "shots_against": g.get("shotsAgainst"),
                    "saves": g.get("saves"),
                    "goals_against": g.get("goalsAgainst"),
                    "save_pct": g.get("savePctg"),
                    "even_strength_goals_against": g.get("evenStrengthGoalsAgainst"),
                    "power_play_goals_against": g.get("powerPlayGoalsAgainst"),
                    "shorthanded_goals_against": g.get("shorthandedGoalsAgainst"),
                    "pim": g.get("pim"),
                    "toi_seconds": toi_to_seconds(g.get("toi")),
                    "starter": g.get("starter"),
                    "decision": g.get("decision"),
                }
            )
    return player_rows, skater_rows, goalie_rows


def _player_row(entry: dict, team_id: int) -> dict:
    return {
        "player_id": entry["playerId"],
        "full_name": entry.get("name", {}).get("default"),
        "position": entry.get("position"),
        "current_team_id": team_id,
    }
