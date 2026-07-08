import Link from "next/link";
import { dbCounts, searchPlayers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [counts, hits] = await Promise.all([
    dbCounts(),
    q ? searchPlayers(q) : Promise.resolve(null),
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
    </>
  );
}
