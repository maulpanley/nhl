import type { Metadata } from "next";
import Link from "next/link";
import { searchPlayers } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Search — NHL Trends" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const hits = q ? await searchPlayers(q) : [];

  return (
    <>
      <section className="card">
        <h1 className="text-xl font-semibold mb-3">Find a player</h1>
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

      {q && (
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
