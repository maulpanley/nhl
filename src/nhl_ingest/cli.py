"""Command line entry point: `nhl <command>` (or `uv run nhl <command>`)."""

from __future__ import annotations

import argparse
import logging

from . import db, ingest
from .api import NHLApi


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(prog="nhl", description="NHL data ingestion")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init-db", help="create tables")
    sub.add_parser("teams", help="sync team directory")
    sub.add_parser("stats", help="row counts per table")

    p = sub.add_parser("backfill", help="ingest historical seasons")
    p.add_argument("--start-season", type=int, default=20152016)
    p.add_argument("--end-season", type=int, default=20252026)
    p.add_argument("--limit", type=int, default=None, help="max boxscores per season (for testing)")
    p.add_argument("--no-raw", action="store_true", help="skip archiving raw boxscore JSON")

    p = sub.add_parser("update", help="nightly: refresh current season, ingest new finals")
    p.add_argument("--no-raw", action="store_true")

    p = sub.add_parser("enrich-players", help="fill in full player names")
    p.add_argument("--limit", type=int, default=100)

    args = parser.parse_args()
    engine = db.get_engine()
    api = NHLApi()

    if args.command == "init-db":
        db.init_db(engine)
        print(f"tables created on {engine.url.render_as_string(hide_password=True)}")
    elif args.command == "teams":
        n = ingest.sync_teams(engine, api)
        print(f"synced {n} teams")
    elif args.command == "backfill":
        db.init_db(engine)
        ingest.sync_teams(engine, api)
        ingest.backfill(
            engine,
            api,
            start_season=args.start_season,
            end_season=args.end_season,
            limit=args.limit,
            store_raw=not args.no_raw,
        )
    elif args.command == "update":
        db.init_db(engine)
        done, pending = ingest.update(engine, api, store_raw=not args.no_raw)
        print(f"ingested {done} of {pending} pending games")
    elif args.command == "enrich-players":
        n = ingest.enrich_players(engine, api, limit=args.limit)
        print(f"enriched {n} players")
    elif args.command == "stats":
        for name, count in ingest.counts(engine).items():
            print(f"{name:22s} {count:>10,}")


if __name__ == "__main__":
    main()
