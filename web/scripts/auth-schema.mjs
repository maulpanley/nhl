// Creates the Auth.js (@auth/pg-adapter) tables plus our own user columns.
// Run once:  node --env-file=.env.local scripts/auth-schema.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    "emailVerified" TIMESTAMPTZ,
    image TEXT,
    tier TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    id_token TEXT,
    scope TEXT,
    session_state TEXT,
    token_type TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL,
    "sessionToken" VARCHAR(255) NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS verification_token (
    identifier TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    token TEXT NOT NULL,
    PRIMARY KEY (identifier, token)
  )`,
  // Favorites (Phase 4 personalization). player_id null => team favorite.
  `CREATE TABLE IF NOT EXISTS favorites (
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    ref TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY ("userId", kind, ref)
  )`,
  // One row per milestone alert already emailed, so we never re-send the same one.
  `CREATE TABLE IF NOT EXISTS milestone_alerts (
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL,
    stat TEXT NOT NULL,
    milestone INTEGER NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY ("userId", player_id, stat, milestone)
  )`,
];

for (const stmt of statements) {
  await sql.query(stmt);
  console.log("ok:", stmt.split("\n")[0]);
}
console.log("auth schema ready");
