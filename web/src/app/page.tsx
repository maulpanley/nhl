import Link from "next/link";
import { TeamLogo } from "@/components/team-logo";
import { activeTeams, dbCounts, searchPlayers, topScorers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [counts, hits, teams, scorers] = await Promise.all([
    dbCounts(),
    q ? searchPlayers(q) : Promise.resolve(null),
    activeTeams(),
    topScorers(10),
  ]);

  return (
    <>
      <section className="card">
        <h1 className="text-xl font-semibold mb-1">Find a player</h1>
        <p className="text-sm mb-3" style={{ color: "var(--ink-2)" }}>
          {Number(counts.games).toLocaleString()} games · {Number(counts.stat_lines).toLocaleString()}{" "}
          stat lines · {Number(counts.players).toLocaleString()} players
        </p>
        <form method="GET" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Player name — e.g. Hughes, McDavid…"
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--axis)", background: "var(--surface-1)" }}
            autoFocus
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

      {hits && (
        <section className="card">
          <h2 className="text-sm font-medium mb-2" style={{ color: "var(--ink-muted)" }}>
            {hits.length === 0 ? `No players matching “${q}”` : `Players matching “${q}”`}
          </h2>
          <table className="stat-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>Team</th>
                <th>Games in DB</th>
              </tr>
            </thead>
            <tbody>
              {hits.map((p) => (
                <tr key={p.player_id}>
                  <td>
                    <Link href={`/player/${p.player_id}`}>{p.full_name}</Link>
                  </td>
                  <td>{p.position}</td>
                  <td>{p.team_abbrev}</td>
                  <td>{Number(p.games).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

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
