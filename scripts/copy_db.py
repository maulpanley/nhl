"""Bulk-copy all tables from one database to another (e.g. local SQLite -> Neon).

Usage:
    uv run python scripts/copy_db.py sqlite:///nhl.db "$DATABASE_URL"

Truncates each destination table, then streams rows in batches. Order respects
no FKs (schema declares none), so table order is arbitrary.
"""

from __future__ import annotations

import sys

from sqlalchemy import create_engine, select

from nhl_ingest import db

BATCH = 5000


def main() -> None:
    src_url, dst_url = sys.argv[1], sys.argv[2]
    if dst_url.startswith("postgresql://"):
        dst_url = dst_url.replace("postgresql://", "postgresql+psycopg://", 1)
    src = create_engine(src_url)
    dst = create_engine(dst_url)
    db.init_db(dst)

    tables = [db.teams, db.players, db.games, db.skater_game_stats, db.goalie_game_stats, db.raw_boxscores]
    for table in tables:
        with src.connect() as sconn, dst.begin() as dconn:
            dconn.execute(table.delete())
            result = sconn.execution_options(stream_results=True).execute(select(table))
            copied = 0
            while True:
                rows = result.fetchmany(BATCH)
                if not rows:
                    break
                dconn.execute(table.insert(), [dict(r._mapping) for r in rows])
                copied += len(rows)
                print(f"\r{table.name}: {copied:,}", end="", flush=True)
        print(f"\r{table.name}: {copied:,} rows copied")


if __name__ == "__main__":
    main()
