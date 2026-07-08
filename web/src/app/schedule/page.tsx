import Link from "next/link";
import { TeamLogo } from "@/components/team-logo";
import { fetchScheduleWeek } from "@/lib/nhl";

export const dynamic = "force-dynamic";

function isIsoDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const start = isIsoDate(week) ? week : new Date().toISOString().slice(0, 10);
  const days = await fetchScheduleWeek(start);
  const totalGames = days.reduce((s, d) => s + d.games.length, 0);

  return (
    <>
      <section className="card">
        <h1 className="text-xl font-semibold">Schedule</h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          Week of {fmtDay(start)} · game times ET · click a matchup for the head-to-head page
        </p>
      </section>

      <div className="filter-row">
        <Link href={`/schedule?week=${shiftDays(start, -7)}`} className="filter-pill">
          ← Previous week
        </Link>
        <Link href="/schedule" className="filter-pill">
          This week
        </Link>
        <Link href={`/schedule?week=${shiftDays(start, 7)}`} className="filter-pill">
          Next week →
        </Link>
      </div>

      {totalGames === 0 ? (
        <section className="card">
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            No games scheduled this week. During the offseason the league schedule usually
            appears in mid-July — this page fills in automatically once it&apos;s published.
          </p>
        </section>
      ) : (
        days
          .filter((d) => d.games.length > 0)
          .map((day) => (
            <section className="card" key={day.date}>
              <h2 className="font-medium mb-2">{fmtDay(day.date)}</h2>
              <ul className="flex flex-col gap-1.5">
                {day.games.map((g) => (
                  <li key={g.id} className="text-sm flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/team/${g.homeTeam.abbrev}/vs/${g.awayTeam.abbrev}`}
                      className="inline-flex items-center gap-1.5 plain-link"
                    >
                      <TeamLogo abbrev={g.awayTeam.abbrev} size={20} />
                      {g.awayTeam.abbrev}
                      <span style={{ color: "var(--ink-muted)" }}>@</span>
                      <TeamLogo abbrev={g.homeTeam.abbrev} size={20} />
                      {g.homeTeam.abbrev}
                    </Link>
                    <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                      {g.gameState === "FUT" || g.gameState === "PRE"
                        ? fmtTimeET(g.startTimeUTC)
                        : `Final ${g.awayTeam.score ?? ""}–${g.homeTeam.score ?? ""}`}
                      {g.gameType === 3 ? " · Playoffs" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </>
  );
}
