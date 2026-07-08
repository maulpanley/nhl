import Link from "next/link";
import { notFound } from "next/navigation";
import { MeetingBarChart, SavePctChart } from "@/components/charts";
import {
  getPlayer,
  getTeam,
  goalieVsTeamGames,
  skaterVsTeamGames,
} from "@/lib/db";

export const dynamic = "force-dynamic";

function fmtToi(seconds: unknown) {
  if (seconds == null) return "—";
  const s = Number(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default async function PlayerVsTeamPage({
  params,
}: {
  params: Promise<{ id: string; team: string }>;
}) {
  const { id, team } = await params;
  const [player, opponent] = await Promise.all([getPlayer(Number(id)), getTeam(team)]);
  if (!player || !opponent) notFound();
  const isGoalie = player.position === "G";

  const games = isGoalie
    ? await goalieVsTeamGames(player.player_id, Number(opponent.team_id))
    : await skaterVsTeamGames(player.player_id, Number(opponent.team_id));

  return (
    <>
      <section className="card">
        <p className="text-sm">
          <Link href={`/player/${player.player_id}`} className="plain-link">
            {player.full_name}
          </Link>
        </p>
        <h1 className="text-xl font-semibold">vs. {opponent.full_name}</h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {games.length} meetings in database
        </p>
      </section>

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
                <th>Date</th><th>H/A</th><th>SA</th><th>Saves</th><th>GA</th><th>SV%</th><th>Result</th>
              </tr>
            ) : (
              <tr>
                <th>Date</th><th>H/A</th><th>G</th><th>A</th><th>P</th><th>SOG</th><th>Hits</th><th>TOI</th>
              </tr>
            )}
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={String(g.game_date)}>
                <td>{String(g.game_date)}</td>
                <td>{g.is_home ? "H" : "A"}</td>
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
