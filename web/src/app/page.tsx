import Link from "next/link";
import { TeamLogo } from "@/components/team-logo";
import { UpcomingGames } from "@/components/upcoming-games";
import { activeTeams, dbCounts, topScorers } from "@/lib/db";

// Data changes nightly; rebuild the page at most every 30 minutes.
export const revalidate = 1800;

export default async function Home() {
  const [counts, teams, scorers] = await Promise.all([dbCounts(), activeTeams(), topScorers(10)]);

  return (
    <>
      <section className="card">
        <h1 className="text-xl font-semibold mb-1">Find a player</h1>
        <p className="text-sm mb-3" style={{ color: "var(--ink-2)" }}>
          {Number(counts.games).toLocaleString()} games · {Number(counts.stat_lines).toLocaleString()}{" "}
          stat lines · {Number(counts.players).toLocaleString()} players since 2015-16
        </p>
        <form method="GET" action="/search" className="flex gap-2">
          <input
            type="text"
            name="q"
            placeholder="Player name — e.g. Hughes, McDavid…"
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--axis)", background: "var(--surface-1)" }}
          />
          <button
            type="submit"
            className="rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ background: "var(--series-1)" }}
          >
            Search
          </button>
        </form>
      </section>

      <UpcomingGames />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card">
          <h2 className="font-medium mb-2">Top scorers — latest season</h2>
          <table className="stat-table">
            <thead>
              <tr>
                <th>Player</th><th>Team</th><th>GP</th><th>G</th><th>A</th><th>P</th>
              </tr>
            </thead>
            <tbody>
              {scorers.map((p) => (
                <tr key={String(p.player_id)}>
                  <td>
                    <Link href={`/player/${p.player_id}`}>{String(p.full_name)}</Link>
                  </td>
                  <td>{String(p.team_abbrev ?? "—")}</td>
                  <td>{String(p.gp)}</td>
                  <td>{String(p.goals)}</td>
                  <td>{String(p.assists)}</td>
                  <td>{String(p.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 className="font-medium mb-2">Teams</h2>
          <ul className="text-sm columns-2" style={{ columnGap: "1rem" }}>
            {teams.map((t) => (
              <li key={String(t.abbrev)} className="py-0.5">
                <Link href={`/team/${t.abbrev}`} className="plain-link inline-flex items-center gap-1.5">
                  <TeamLogo abbrev={String(t.abbrev)} size={18} />
                  {String(t.full_name)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
