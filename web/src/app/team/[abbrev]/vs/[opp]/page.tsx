import Link from "next/link";
import { notFound } from "next/navigation";
import { FormChart } from "@/components/charts";
import { FilterRow, applyRange, parseFilters, type FilterParams } from "@/components/filters";
import { StatTile, dir, pctDelta } from "@/components/stat-tile";
import { TeamLogo } from "@/components/team-logo";
import { getTeam, teamVsTeamGames } from "@/lib/db";
import { teamOutlook } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ abbrev: string; opp: string }>;
}) {
  const { abbrev, opp } = await params;
  const [teamA, teamB] = await Promise.all([getTeam(abbrev), getTeam(opp)]);
  if (!teamA || !teamB) return { title: "NHL Trends" };
  return {
    title: `${teamA.full_name} vs. ${teamB.full_name} — NHL Trends`,
    description: `Head-to-head history, expected score, and matchup outlook: ${teamA.full_name} vs. ${teamB.full_name}.`,
  };
}

export default async function TeamVsTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ abbrev: string; opp: string }>;
  searchParams: Promise<FilterParams>;
}) {
  const [{ abbrev, opp }, sp] = await Promise.all([params, searchParams]);
  const state = parseFilters(sp, [5, 10, 20], { noun: "meetings" });

  const [teamA, teamB] = await Promise.all([getTeam(abbrev), getTeam(opp)]);
  if (!teamA || !teamB || teamA.abbrev === teamB.abbrev) notFound();
  const a = String(teamA.abbrev);
  const b = String(teamB.abbrev);

  const allGames = await teamVsTeamGames(a, b, state.filter.gameType);
  const games = applyRange(allGames, state);
  const totalMeetings = allGames.length;

  const aWins = games.filter((g) => Number(g.gf) > Number(g.ga)).length;
  const bWins = games.filter((g) => Number(g.gf) < Number(g.ga)).length;
  const gfTotal = games.reduce((s, g) => s + Number(g.gf), 0);
  const gaTotal = games.reduce((s, g) => s + Number(g.ga), 0);
  const playoffCount = games.filter((g) => Number(g.game_type) === 3).length;

  const outlook = await teamOutlook(a, b, {
    aWins: allGames.filter((g) => Number(g.gf) > Number(g.ga)).length,
    games: allGames.length,
  });

  return (
    <>
      <section className="card">
        <p className="text-sm">
          <Link href={`/team/${a}`} className="plain-link">
            {teamA.full_name}
          </Link>
        </p>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <TeamLogo abbrev={a} size={34} />
          vs.
          <TeamLogo abbrev={b} size={34} />
          <Link href={`/team/${b}`} className="plain-link">
            {teamB.full_name}
          </Link>
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          Showing {games.length} of {totalMeetings} meetings · {state.filter.label.toLowerCase()} ·{" "}
          {state.venueLabel} · {state.rangeLabel}
          {state.filter.gameType === null && playoffCount > 0
            ? ` (${games.length - playoffCount} regular season, ${playoffCount} playoffs)`
            : ""}
        </p>
      </section>

      <FilterRow state={state} />

      <div className="tile-row">
        <StatTile label="Meetings" value={games.length} />
        <StatTile label={`${a} wins`} value={aWins} />
        <StatTile label={`${b} wins`} value={bWins} />
        <StatTile label={`${a} goals`} value={gfTotal.toLocaleString()} />
        <StatTile label={`${b} goals`} value={gaTotal.toLocaleString()} />
      </div>

      {outlook && (
        <section className="card">
          <h2 className="font-medium mb-1">Matchup outlook</h2>
          <p className="text-xs mb-3" style={{ color: "var(--ink-muted)" }}>
            Experimental v0 — offense/defense from each side&apos;s last 20 games vs. league
            average; head-to-head shrunk toward a coin flip; expected score dampened.
          </p>
          <div className="tile-row">
            <StatTile
              label={`${a} offense`}
              value={(outlook.offIdxA * 100).toFixed(0)}
              delta={pctDelta(outlook.offIdxA, "GF vs league (last 20)")}
              deltaDir={dir(outlook.offIdxA)}
            />
            <StatTile
              label={`${a} defense`}
              value={(outlook.defIdxA * 100).toFixed(0)}
              delta={pctDelta(outlook.defIdxA, "GA vs league (last 20)")}
              deltaDir={dir(outlook.defIdxA, false)}
            />
            <StatTile
              label={`${b} offense`}
              value={(outlook.offIdxB * 100).toFixed(0)}
              delta={pctDelta(outlook.offIdxB, "GF vs league (last 20)")}
              deltaDir={dir(outlook.offIdxB)}
            />
            <StatTile
              label={`${b} defense`}
              value={(outlook.defIdxB * 100).toFixed(0)}
              delta={pctDelta(outlook.defIdxB, "GA vs league (last 20)")}
              deltaDir={dir(outlook.defIdxB, false)}
            />
            <StatTile
              label={`H2H edge (${a})`}
              value={`${Math.round(outlook.h2hWinRate * 100)}%`}
              delta="shrunk win rate"
              deltaDir={dir(outlook.h2hWinRate / 0.5)}
            />
            <StatTile
              label="Expected score"
              value={`${outlook.expectedA.toFixed(1)}–${outlook.expectedB.toFixed(1)}`}
              delta={`${a} vs ${b}, next meeting`}
              highlight
            />
          </div>
        </section>
      )}

      {games.length > 0 && (
        <section className="card">
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-medium mb-2">{a} goals by meeting</h2>
              <FormChart data={games} dataKey="gf" name={`${a} goals`} window={5} fixedOpp={b} />
            </div>
            <div>
              <h2 className="font-medium mb-2">{b} goals by meeting</h2>
              <FormChart data={games} dataKey="ga" name={`${b} goals`} window={5} fixedOpp={b} />
            </div>
          </div>
        </section>
      )}

      <section className="card overflow-x-auto">
        <h2 className="font-medium mb-2">Every meeting</h2>
        <table className="stat-table">
          <thead>
            <tr>
              <th>Date</th><th>Type</th><th>Venue ({a})</th><th>Score ({a}–{b})</th><th>Winner</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => {
              const gf = Number(g.gf);
              const ga = Number(g.ga);
              return (
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
                  <td>
                    {gf}–{ga}
                  </td>
                  <td>{gf > ga ? a : gf < ga ? b : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
