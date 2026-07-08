import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeam, teamRecentGames, teamTopScorers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ abbrev: string }> }) {
  const { abbrev } = await params;
  const team = await getTeam(abbrev);
  if (!team) notFound();
  const teamId = Number(team.team_id);

  const [recent, scorers] = await Promise.all([
    teamRecentGames(teamId),
    teamTopScorers(teamId),
  ]);

  return (
    <>
      <section className="card">
        <h1 className="text-xl font-semibold">{team.full_name}</h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {team.abbrev}
        </p>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="font-medium mb-2">Top scorers — latest season</h2>
        <table className="stat-table">
          <thead>
            <tr>
              <th>Player</th><th>Pos</th><th>GP</th><th>G</th><th>A</th><th>P</th><th>SOG</th>
            </tr>
          </thead>
          <tbody>
            {scorers.map((p) => (
              <tr key={String(p.player_id)}>
                <td>
                  <Link href={`/player/${p.player_id}`}>{String(p.full_name)}</Link>
                </td>
                <td>{String(p.position ?? "—")}</td>
                <td>{String(p.gp)}</td>
                <td>{String(p.goals)}</td>
                <td>{String(p.assists)}</td>
                <td>{String(p.points)}</td>
                <td>{String(p.sog)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="font-medium mb-2">Recent games</h2>
        <table className="stat-table">
          <thead>
            <tr>
              <th>Date</th><th>H/A</th><th>Opponent</th><th>Score</th><th>Result</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((g) => {
              const gf = Number(g.gf);
              const ga = Number(g.ga);
              return (
                <tr key={String(g.game_date) + String(g.opp)}>
                  <td>{String(g.game_date)}</td>
                  <td>{String(g.ha)}</td>
                  <td>{String(g.opp)}</td>
                  <td>
                    {gf}–{ga}
                  </td>
                  <td>{gf > ga ? "W" : gf < ga ? "L" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
