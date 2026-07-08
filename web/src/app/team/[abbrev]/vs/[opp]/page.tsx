import Link from "next/link";
import { notFound } from "next/navigation";
import { FormChart } from "@/components/charts";
import { StatTile, dir, pctDelta } from "@/components/stat-tile";
import { TeamLogo } from "@/components/team-logo";
import { getTeam, teamVsTeamGames } from "@/lib/db";
import { teamOutlook } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const TYPE_FILTERS = [
  { key: "all", label: "All games", gameType: null },
  { key: "regular", label: "Regular season", gameType: 2 },
  { key: "playoffs", label: "Playoffs", gameType: 3 },
] as const;

const LAST_N_OPTIONS = [5, 10, 20] as const;

function isIsoDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function TeamVsTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ abbrev: string; opp: string }>;
  searchParams: Promise<{ type?: string; last?: string; from?: string; to?: string }>;
}) {
  const [{ abbrev, opp }, { type, last, from, to }] = await Promise.all([params, searchParams]);
  const filter = TYPE_FILTERS.find((f) => f.key === type) ?? TYPE_FILTERS[0];
  const fromDate = isIsoDate(from) ? from : undefined;
  const toDate = isIsoDate(to) ? to : undefined;
  const lastN =
    !fromDate && !toDate && last && LAST_N_OPTIONS.includes(Number(last) as 5 | 10 | 20)
      ? Number(last)
      : undefined;

  const [teamA, teamB] = await Promise.all([getTeam(abbrev), getTeam(opp)]);
  if (!teamA || !teamB || teamA.abbrev === teamB.abbrev) notFound();
  const a = String(teamA.abbrev);
  const b = String(teamB.abbrev);

  const allGames = await teamVsTeamGames(a, b, filter.gameType);
  let games = allGames;
  const totalMeetings = games.length;
  if (fromDate) games = games.filter((g) => String(g.game_date) >= fromDate);
  if (toDate) games = games.filter((g) => String(g.game_date) <= toDate);
  if (lastN) games = games.slice(-lastN);

  const aWins = games.filter((g) => Number(g.gf) > Number(g.ga)).length;
  const bWins = games.filter((g) => Number(g.gf) < Number(g.ga)).length;
  const gfTotal = games.reduce((s, g) => s + Number(g.gf), 0);
  const gaTotal = games.reduce((s, g) => s + Number(g.ga), 0);
  const playoffCount = games.filter((g) => Number(g.game_type) === 3).length;

  const outlook = await teamOutlook(a, b, {
    aWins: allGames.filter((g) => Number(g.gf) > Number(g.ga)).length,
    games: allGames.length,
  });

  const query = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { type: filter.key === "all" ? undefined : filter.key, last, from: fromDate, to: toDate, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  const rangeLabel = lastN
    ? `last ${lastN} meetings`
    : fromDate || toDate
      ? `${fromDate ?? "…"} to ${toDate ?? "…"}`
      : "all time";

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
          Showing {games.length} of {totalMeetings} meetings · {filter.label.toLowerCase()} · {rangeLabel}
          {filter.gameType === null && playoffCount > 0
            ? ` (${games.length - playoffCount} regular season, ${playoffCount} playoffs)`
            : ""}
        </p>
      </section>

      <div className="filter-row flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={query({ type: f.key === "all" ? undefined : f.key })}
            className={`filter-pill${f.key === filter.key ? " active" : ""}`}
          >
            {f.label}
          </Link>
        ))}
        <span className="filter-divider" />
        <Link
          href={query({ last: undefined, from: undefined, to: undefined })}
          className={`filter-pill${!lastN && !fromDate && !toDate ? " active" : ""}`}
        >
          All time
        </Link>
        {LAST_N_OPTIONS.map((n) => (
          <Link
            key={n}
            href={query({ last: String(n), from: undefined, to: undefined })}
            className={`filter-pill${lastN === n ? " active" : ""}`}
          >
            Last {n}
          </Link>
        ))}
        <form method="GET" className="filter-range-form">
          {filter.key !== "all" && <input type="hidden" name="type" value={filter.key} />}
          <input type="date" name="from" defaultValue={fromDate ?? ""} aria-label="From date" />
          <span style={{ color: "var(--ink-muted)" }}>–</span>
          <input type="date" name="to" defaultValue={toDate ?? ""} aria-label="To date" />
          <button type="submit" className={`filter-pill${fromDate || toDate ? " active" : ""}`}>
            Apply
          </button>
        </form>
      </div>

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
              <FormChart data={games} dataKey="gf" name={`${a} goals`} window={5} />
            </div>
            <div>
              <h2 className="font-medium mb-2">{b} goals by meeting</h2>
              <FormChart data={games} dataKey="ga" name={`${b} goals`} window={5} />
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
