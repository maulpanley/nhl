import Link from "next/link";
import { notFound } from "next/navigation";
import { MeetingBarChart, SavePctChart } from "@/components/charts";
import { TeamLogo } from "@/components/team-logo";
import {
  getPlayer,
  getTeam,
  goalieVsTeamGames,
  skaterVsTeamGames,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPE_FILTERS = [
  { key: "all", label: "All games", gameType: null },
  { key: "regular", label: "Regular season", gameType: 2 },
  { key: "playoffs", label: "Playoffs", gameType: 3 },
] as const;

function fmtToi(seconds: unknown) {
  if (seconds == null) return "—";
  const s = Number(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default async function PlayerVsTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; team: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ id, team }, { type }] = await Promise.all([params, searchParams]);
  const filter = TYPE_FILTERS.find((f) => f.key === type) ?? TYPE_FILTERS[0];

  const [player, opponent] = await Promise.all([getPlayer(Number(id)), getTeam(team)]);
  if (!player || !opponent) notFound();
  const isGoalie = player.position === "G";

  const games = isGoalie
    ? await goalieVsTeamGames(player.player_id, Number(opponent.team_id), filter.gameType)
    : await skaterVsTeamGames(player.player_id, Number(opponent.team_id), filter.gameType);
  const playoffCount = games.filter((g) => Number(g.game_type) === 3).length;

  return (
    <>
      <section className="card">
        <p className="text-sm">
          <Link href={`/player/${player.player_id}`} className="plain-link">
            {player.full_name}
          </Link>
        </p>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <TeamLogo abbrev={String(opponent.abbrev)} size={34} />
          vs. {opponent.full_name}
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {games.length} meetings
          {filter.gameType === null && playoffCount > 0
            ? ` (${games.length - playoffCount} regular season, ${playoffCount} playoffs)`
            : ` (${filter.label.toLowerCase()})`}
        </p>
      </section>

      <div className="filter-row">
        {TYPE_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "?" : `?type=${f.key}`}
            className={`filter-pill${f.key === filter.key ? " active" : ""}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {games.length > 0 && (
        <section className="card">
          {isGoalie ? (
            <>
              <h2 className="font-medium mb-2">Save % by meeting</h2>
              <SavePctChart data={games} />
              <h2 className="font-medium mb-2 mt-5">Goals against by meeting</h2>
              <MeetingBarChart data={games} dataKey="goals_against" name="Goals against" />
            </>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-medium mb-2">Points by meeting</h2>
                <MeetingBarChart data={games} dataKey="points" name="Points" />
              </div>
              <div>
                <h2 className="font-medium mb-2">Goals by meeting</h2>
                <MeetingBarChart data={games} dataKey="goals" name="Goals" />
              </div>
              <div>
                <h2 className="font-medium mb-2">Shots on goal by meeting</h2>
                <MeetingBarChart data={games} dataKey="sog" name="Shots on goal" />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card overflow-x-auto">
        <h2 className="font-medium mb-2">Every meeting</h2>
        <table className="stat-table">
          <thead>
            {isGoalie ? (
              <tr>
                <th>Date</th><th>Type</th><th>Venue</th><th>SA</th><th>Saves</th><th>GA</th><th>SV%</th><th>Result</th>
              </tr>
            ) : (
              <tr>
                <th>Date</th><th>Type</th><th>Venue</th><th>G</th><th>A</th><th>P</th><th>SOG</th><th>Hits</th><th>TOI</th>
              </tr>
            )}
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={String(g.game_date)}>
                <td>{String(g.game_date)}</td>
                <td>
                  {Number(g.game_type) === 3 ? (
                    <span className="type-badge playoffs">Playoffs</span>
                  ) : (
                    <span className="type-badge">Regular</span>
                  )}
                </td>
                <td>{g.is_home ? "Home" : "Away"}</td>
                {isGoalie ? (
                  <>
                    <td>{String(g.shots_against)}</td>
                    <td>{String(g.saves)}</td>
                    <td>{String(g.goals_against)}</td>
                    <td>{g.save_pct == null ? "—" : Number(g.save_pct).toFixed(3)}</td>
                    <td>{String(g.decision ?? "—")}</td>
                  </>
                ) : (
                  <>
                    <td>{String(g.goals)}</td>
                    <td>{String(g.assists)}</td>
                    <td>{String(g.points)}</td>
                    <td>{String(g.sog)}</td>
                    <td>{String(g.hits)}</td>
                    <td>{fmtToi(g.toi_seconds)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
