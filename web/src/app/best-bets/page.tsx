import Link from "next/link";
import { TeamLogo } from "@/components/team-logo";
import { teamOutlook } from "@/lib/metrics";
import { fetchScheduleWeek, type ScheduleGame } from "@/lib/nhl";
import { getTier } from "@/lib/tier";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Best Bets — NHL Trends",
  description: "The day's biggest projected matchup edges, ranked.",
};

function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

async function rankGame(g: ScheduleGame) {
  const home = g.homeTeam.abbrev;
  const away = g.awayTeam.abbrev;
  const outlook = await teamOutlook(home, away, { aWins: 0, games: 0 }).catch(() => null);
  if (!outlook) return null;
  const margin = outlook.expectedA - outlook.expectedB; // + = home favored
  const favorite = margin >= 0 ? home : away;
  return {
    id: g.id,
    home,
    away,
    favorite,
    expHome: outlook.expectedA,
    expAway: outlook.expectedB,
    edge: Math.abs(margin),
  };
}

export default async function BestBetsPage() {
  const tier = await getTier();

  if (tier !== "paid") {
    return (
      <section className="card locked-wrap">
        <h1 className="text-xl font-semibold mb-1">Best Bets</h1>
        <p className="text-sm mb-4" style={{ color: "var(--ink-2)" }}>
          Every game on the slate, ranked by the model&apos;s projected edge — biggest
          mismatches first, with an expected score for each. Updated daily.
        </p>
        <div className="locked-blur" aria-hidden="true">
          <table className="stat-table">
            <thead>
              <tr><th>Matchup</th><th>Projected favorite</th><th>Expected score</th><th>Edge</th></tr>
            </thead>
            <tbody>
              {["ADM @ TBD", "XXX @ YYY", "ZZZ @ WWW"].map((m) => (
                <tr key={m}>
                  <td>{m}</td><td>•••</td><td>•.• – •.•</td><td>+•.•</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="locked-overlay">
          <div className="locked-cta">
            <div className="lock-title">🔒 Best Bets is a Pro feature</div>
            <Link href="/pricing" className="btn-primary">Unlock Best Bets</Link>
          </div>
        </div>
      </section>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const week = await fetchScheduleWeek(today);
  const day = week.find((d) => d.date >= today && d.games.length > 0);
  const ranked = day
    ? (await Promise.all(day.games.map(rankGame))).filter((r) => r !== null).sort((x, y) => y!.edge - x!.edge)
    : [];

  return (
    <>
      <section className="card">
        <h1 className="text-xl font-semibold mb-1">Best Bets</h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {day
            ? `${fmtDay(day.date)} · ${ranked.length} games ranked by projected edge`
            : "The day's biggest projected matchup edges, ranked."}
        </p>
      </section>

      {ranked.length === 0 ? (
        <section className="card">
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            No games scheduled right now. Best Bets fills in automatically once the NHL
            publishes the upcoming schedule (typically mid-July for the new season).
          </p>
        </section>
      ) : (
        <section className="card overflow-x-auto">
          <table className="stat-table">
            <thead>
              <tr>
                <th>Matchup</th><th>Projected favorite</th><th>Expected score (H–A)</th><th>Edge</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r!.id}>
                  <td>
                    <Link href={`/team/${r!.home}/vs/${r!.away}`} className="inline-flex items-center gap-1.5">
                      <TeamLogo abbrev={r!.away} size={18} />
                      {r!.away}
                      <span style={{ color: "var(--ink-muted)" }}>@</span>
                      <TeamLogo abbrev={r!.home} size={18} />
                      {r!.home}
                    </Link>
                  </td>
                  <td className="inline-flex items-center gap-1.5">
                    <TeamLogo abbrev={r!.favorite} size={18} />
                    {r!.favorite}
                  </td>
                  <td>{r!.expHome.toFixed(1)} – {r!.expAway.toFixed(1)}</td>
                  <td>+{r!.edge.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs mt-2" style={{ color: "var(--ink-muted)" }}>
            Experimental v0 model. For entertainment/analysis — not betting advice.
          </p>
        </section>
      )}
    </>
  );
}
