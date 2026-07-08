import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type PlayerHit = {
  player_id: number;
  full_name: string;
  position: string | null;
  team_abbrev: string | null;
  games: number;
};

export async function searchPlayers(q: string): Promise<PlayerHit[]> {
  // Token-based: any token may match, ranked by how many do — so a query like
  // "nathan mackinnon" still finds a not-yet-enriched "N. MacKinnon".
  const tokens = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (tokens.length === 0) return [];
  return (await sql`
    SELECT p.player_id, p.full_name, p.position, t.abbrev AS team_abbrev,
           (SELECT COUNT(*) FROM skater_game_stats s WHERE s.player_id = p.player_id)
           + (SELECT COUNT(*) FROM goalie_game_stats g WHERE g.player_id = p.player_id) AS games,
           (SELECT COUNT(*) FROM unnest(${tokens}::text[]) tok
             WHERE p.full_name ILIKE '%' || tok || '%') AS score
    FROM players p
    LEFT JOIN teams t ON t.team_id = p.current_team_id
    WHERE EXISTS (SELECT 1 FROM unnest(${tokens}::text[]) tok
                  WHERE p.full_name ILIKE '%' || tok || '%')
    ORDER BY score DESC, games DESC
    LIMIT 25
  `) as PlayerHit[];
}

export async function getPlayer(playerId: number) {
  const rows = await sql`
    SELECT p.player_id, p.full_name, p.position, t.abbrev AS team_abbrev, t.full_name AS team_name
    FROM players p
    LEFT JOIN teams t ON t.team_id = p.current_team_id
    WHERE p.player_id = ${playerId}
  `;
  return rows[0] ?? null;
}

export async function getTeam(abbrev: string) {
  const rows = await sql`SELECT team_id, abbrev, full_name FROM teams WHERE abbrev = ${abbrev.toUpperCase()}`;
  return rows[0] ?? null;
}

/** Most recent N games for a skater, oldest first (chart-ready). */
export async function skaterRecentGames(playerId: number, n = 25) {
  return (await sql`
    SELECT * FROM (
      SELECT s.game_date::text, t.abbrev AS opp, s.is_home, s.goals, s.assists, s.points,
             s.sog, s.hits, s.pim, s.plus_minus, s.toi_seconds, s.season, s.game_type
      FROM skater_game_stats s JOIN teams t ON t.team_id = s.opponent_team_id
      WHERE s.player_id = ${playerId}
      ORDER BY s.game_date DESC LIMIT ${n}
    ) sub ORDER BY game_date ASC
  `) as Record<string, never>[];
}

export async function goalieRecentGames(playerId: number, n = 25) {
  return (await sql`
    SELECT * FROM (
      SELECT g.game_date::text, t.abbrev AS opp, g.is_home, g.shots_against, g.saves,
             g.goals_against, g.save_pct, g.decision, g.starter, g.season, g.game_type
      FROM goalie_game_stats g JOIN teams t ON t.team_id = g.opponent_team_id
      WHERE g.player_id = ${playerId}
      ORDER BY g.game_date DESC LIMIT ${n}
    ) sub ORDER BY game_date ASC
  `) as Record<string, never>[];
}

/** Career aggregates split by opponent — the vs-team index on a player page. */
export async function skaterVsTeams(playerId: number) {
  return await sql`
    SELECT t.abbrev AS opp, t.full_name AS opp_name, COUNT(*) AS games,
           SUM(s.goals) AS goals, SUM(s.assists) AS assists, SUM(s.points) AS points,
           SUM(s.sog) AS sog,
           ROUND(AVG(s.points)::numeric, 2) AS ppg
    FROM skater_game_stats s JOIN teams t ON t.team_id = s.opponent_team_id
    WHERE s.player_id = ${playerId}
    GROUP BY 1, 2 ORDER BY points DESC, games DESC
  `;
}

export async function goalieVsTeams(playerId: number) {
  return await sql`
    SELECT t.abbrev AS opp, t.full_name AS opp_name, COUNT(*) AS games,
           SUM(g.saves) AS saves, SUM(g.shots_against) AS shots_against,
           SUM(g.goals_against) AS goals_against,
           ROUND((SUM(g.saves)::numeric / NULLIF(SUM(g.shots_against), 0)), 3) AS save_pct,
           SUM(CASE WHEN g.decision = 'W' THEN 1 ELSE 0 END) AS wins
    FROM goalie_game_stats g JOIN teams t ON t.team_id = g.opponent_team_id
    WHERE g.player_id = ${playerId}
    GROUP BY 1, 2 ORDER BY games DESC
  `;
}

/** Every meeting between a skater and one opponent, oldest first. */
export async function skaterVsTeamGames(playerId: number, teamId: number) {
  return (await sql`
    SELECT s.game_date::text, s.season, s.game_type, s.is_home,
           s.goals, s.assists, s.points, s.sog, s.hits, s.pim, s.toi_seconds
    FROM skater_game_stats s
    WHERE s.player_id = ${playerId} AND s.opponent_team_id = ${teamId}
    ORDER BY s.game_date ASC
  `) as Record<string, never>[];
}

export async function goalieVsTeamGames(playerId: number, teamId: number) {
  return (await sql`
    SELECT g.game_date::text, g.season, g.game_type, g.is_home,
           g.shots_against, g.saves, g.goals_against, g.save_pct, g.decision, g.starter
    FROM goalie_game_stats g
    WHERE g.player_id = ${playerId} AND g.opponent_team_id = ${teamId}
    ORDER BY g.game_date ASC
  `) as Record<string, never>[];
}

export async function seasonSummaries(playerId: number, isGoalie: boolean) {
  if (isGoalie) {
    return await sql`
      SELECT season, COUNT(*) AS games,
             SUM(saves) AS saves, SUM(shots_against) AS shots_against,
             ROUND((SUM(saves)::numeric / NULLIF(SUM(shots_against), 0)), 3) AS save_pct,
             SUM(CASE WHEN decision = 'W' THEN 1 ELSE 0 END) AS wins
      FROM goalie_game_stats WHERE player_id = ${playerId} AND game_type = 2
      GROUP BY season ORDER BY season DESC
    `;
  }
  return await sql`
    SELECT season, COUNT(*) AS games, SUM(goals) AS goals, SUM(assists) AS assists,
           SUM(points) AS points, SUM(sog) AS sog
    FROM skater_game_stats WHERE player_id = ${playerId} AND game_type = 2
    GROUP BY season ORDER BY season DESC
  `;
}

/** Teams active in the most recent season on record. */
export async function activeTeams() {
  return await sql`
    WITH latest AS (SELECT MAX(season) AS season FROM games)
    SELECT t.team_id, t.abbrev, t.full_name
    FROM teams t
    WHERE t.team_id IN (
      SELECT home_team_id FROM games, latest WHERE games.season = latest.season
      UNION
      SELECT away_team_id FROM games, latest WHERE games.season = latest.season
    )
    ORDER BY t.full_name
  `;
}

/** Top scorers in the most recent season with ingested games. */
export async function topScorers(limit = 10) {
  return await sql`
    WITH latest AS (SELECT MAX(season) AS season FROM skater_game_stats)
    SELECT p.player_id, p.full_name, t.abbrev AS team_abbrev,
           COUNT(*) AS gp, SUM(s.goals) AS goals, SUM(s.assists) AS assists,
           SUM(s.points) AS points
    FROM skater_game_stats s
    JOIN latest ON s.season = latest.season
    JOIN players p ON p.player_id = s.player_id
    LEFT JOIN teams t ON t.team_id = p.current_team_id
    GROUP BY p.player_id, p.full_name, t.abbrev
    ORDER BY points DESC, goals DESC
    LIMIT ${limit}
  `;
}

/** A team's games in the latest season, newest first, with result. */
export async function teamRecentGames(teamId: number, n = 20) {
  return await sql`
    SELECT g.game_date::text, g.game_type,
           CASE WHEN g.home_team_id = ${teamId} THEN 'H' ELSE 'A' END AS ha,
           opp.abbrev AS opp,
           CASE WHEN g.home_team_id = ${teamId} THEN g.home_score ELSE g.away_score END AS gf,
           CASE WHEN g.home_team_id = ${teamId} THEN g.away_score ELSE g.home_score END AS ga
    FROM games g
    JOIN teams opp ON opp.team_id =
      CASE WHEN g.home_team_id = ${teamId} THEN g.away_team_id ELSE g.home_team_id END
    WHERE (g.home_team_id = ${teamId} OR g.away_team_id = ${teamId})
      AND g.ingested_at IS NOT NULL
    ORDER BY g.game_date DESC
    LIMIT ${n}
  `;
}

/** A team's top scorers in the latest season. */
export async function teamTopScorers(teamId: number, limit = 15) {
  return await sql`
    WITH latest AS (SELECT MAX(season) AS season FROM skater_game_stats WHERE team_id = ${teamId})
    SELECT p.player_id, p.full_name, p.position,
           COUNT(*) AS gp, SUM(s.goals) AS goals, SUM(s.assists) AS assists,
           SUM(s.points) AS points, SUM(s.sog) AS sog
    FROM skater_game_stats s
    JOIN latest ON s.season = latest.season
    JOIN players p ON p.player_id = s.player_id
    WHERE s.team_id = ${teamId}
    GROUP BY p.player_id, p.full_name, p.position
    ORDER BY points DESC, goals DESC
    LIMIT ${limit}
  `;
}

export async function dbCounts() {
  const rows = await sql`
    SELECT (SELECT COUNT(*) FROM games WHERE ingested_at IS NOT NULL) AS games,
           (SELECT COUNT(*) FROM players) AS players,
           (SELECT COUNT(*) FROM skater_game_stats) AS stat_lines
  `;
  return rows[0];
}
