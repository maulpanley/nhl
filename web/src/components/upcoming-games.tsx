import Link from "next/link";
import { TeamLogo } from "@/components/team-logo";
import { teamOutlook } from "@/lib/metrics";
import { fetchScheduleWeek, type ScheduleGame } from "@/lib/nhl";

function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtTimeET(utc: string): string {
  return new Date(utc).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

async function gameRow(g: ScheduleGame) {
  const home = g.homeTeam.abbrev;
  const away = g.awayTeam.abbrev;
  // Expected score for the pairing (H2H term not needed for the score itself).
  const outlook = await teamOutlook(home, away, { aWins: 0, games: 0 }).catch(() => null);
  return { g, home, away, outlook };
}

/** The next slate of games (today or the first upcoming day with games),
    each with an expected score, linking to the head-to-head page. */
export async function UpcomingGames() {
  const today = new Date().toISOString().slice(0, 10);
  const week = await fetchScheduleWeek(today);
  const day = week.find((d) => d.date >= today && d.games.length > 0);
  if (!day) return null;

  const rows = await Promise.all(day.games.slice(0, 16).map(gameRow));

  return (
    <section className="card">
      <h2 className="font-medium mb-2">
        {day.date === today ? "Tonight's games" : `Next games — ${fmtDay(day.date)}`}
      </h2>
      <table className="stat-table">
        <thead>
          <tr>
            <th>Matchup</th>
            <th>Time (ET)</th>
            <th>Expected score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ g, home, away, outlook }) => (
            <tr key={g.id}>
              <td>
                <Link href={`/team/${home}/vs/${away}`} className="inline-flex items-center gap-1.5">
                  <TeamLogo abbrev={away} size={18} />
                  {away}
                  <span style={{ color: "var(--ink-muted)" }}>@</span>
                  <TeamLogo abbrev={home} size={18} />
                  {home}
                </Link>
              </td>
              <td>{fmtTimeET(g.startTimeUTC)}</td>
              <td>
                {outlook ? `${outlook.expectedB.toFixed(1)}–${outlook.expectedA.toFixed(1)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs mt-2" style={{ color: "var(--ink-muted)" }}>
        Expected score: away–home, from each side&apos;s last-20 scoring rates vs. league average.{" "}
        <Link href="/schedule" className="plain-link">
          Full schedule →
        </Link>
      </p>
    </section>
  );
}
