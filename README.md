# nhl-data

Ingestion pipeline for an NHL analytics site: per-game skater and goalie stat
lines from the free official NHL APIs, stored so that "player X vs. team Y over
time", goalie-vs-opponent splits, and rolling-form trends are simple indexed
queries.

## How it works

1. `api.nhle.com/stats/rest/en/game` lists every game in a season (ids, dates,
   teams, scores) → `games` table.
2. `api-web.nhle.com/v1/gamecenter/{id}/boxscore` gives every player's stat
   line for a game → `skater_game_stats` / `goalie_game_stats`, denormalized
   with `game_date`, `season`, `opponent_team_id`, `is_home` so the website
   needs no joins for its core charts. Raw JSON is archived gzipped in
   `raw_boxscores` so tables can be rebuilt after schema changes without
   re-hitting the API.
3. Boxscores only carry abbreviated names ("Z. Benson"); `enrich-players`
   backfills full names from `/v1/player/{id}/landing`.

## Setup

Requires [uv](https://docs.astral.sh/uv/). `DATABASE_URL` selects the backend —
unset it for a local `nhl.db` SQLite file, or point it at Postgres
(Neon/Supabase) for production; see `.env.example`.

```sh
uv sync
uv run nhl init-db
uv run nhl backfill                 # all seasons 2015-16 .. 2025-26, ~2-3h polite pace
uv run nhl backfill --start-season 20242025 --end-season 20242025   # one season
uv run nhl enrich-players --limit 500
uv run nhl stats                    # row counts
uv run nhl update                   # nightly: ingest newly-final games
```

Backfill is resumable: it only fetches games not yet marked ingested, so
rerunning after an interruption picks up where it left off.

## Nightly refresh

`.github/workflows/nightly.yml` runs `nhl update` + `enrich-players` at
10:00 UTC daily. Set the `DATABASE_URL` repo secret to the production Postgres
connection string (`postgresql+psycopg://...?sslmode=require`).

## Example query

```sql
SELECT p.full_name, s.game_date, t.abbrev AS opponent, s.goals, s.assists, s.sog
FROM skater_game_stats s
JOIN players p ON p.player_id = s.player_id
JOIN teams t   ON t.team_id  = s.opponent_team_id
WHERE p.full_name = 'Jack Hughes' AND t.abbrev = 'BUF'
ORDER BY s.game_date;
```
