import Link from "next/link";
import { notFound } from "next/navigation";
import { FormChart, SavePctChart } from "@/components/charts";
import { TeamLogo } from "@/components/team-logo";
import {
  getPlayer,
  getTeam,
  goalieVsTeamGames,
  skaterVsTeamGames,
} from "@/lib/db";
import { goalieOutlook, skaterOutlook } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const TYPE_FILTERS = [
  { key: "all", label: "All games", gameType: null },
  { key: "regular", label: "Regular season", gameType: 2 },
  { key: "playoffs", label: "Playoffs", gameType: 3 },
] as const;

function StatTile({
  label,
  value,
  delta,
  deltaDir,
  highlight,
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: "up" | "down" | "flat";
  highlight?: boolean;
}) {
  return (
    <div className={`stat-tile${highlight ? " highlight" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta ? (
        <div className={`delta${deltaDir === "up" ? " up" : deltaDir === "down" ? " down" : ""}`}>
          {delta}
        </div>
      ) : null}
    </div>
  );
}

function pctDelta(idx: number, vs: string) {
  const pct = Math.round((idx - 1) * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% ${vs}`;
}

function dir(idx: number, upIsGood = true): "up" | "down" | "flat" {
  if (Math.abs(idx - 1) < 0.02) return "flat";
  return (idx > 1) === upIsGood ? "up" : "down";
}

function sum(rows: Record<string, unknown>[], key: string) {
  return rows.reduce((a, r) => a + Number(r[key] ?? 0), 0);
}

function fmtToi(seconds: unknown) {
  if (seconds == null) return "—";
  const s = Number(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const LAST_N_OPTIONS = [5, 10, 20] as const;

function isIsoDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function PlayerVsTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; team: string }>;
  searchParams: Promise<{ type?: string; last?: string; from?: string; to?: string }>;
}) {
  const [{ id, team }, { type, last, from, to }] = await Promise.all([params, searchParams]);
  const filter = TYPE_FILTERS.find((f) => f.key === type) ?? TYPE_FILTERS[0];
  const fromDate = isIsoDate(from) ? from : undefined;
  const toDate = isIsoDate(to) ? to : undefined;
  // A date range and "last N" are mutually exclusive; the range wins.
  const lastN =
    !fromDate && !toDate && last && LAST_N_OPTIONS.includes(Number(last) as 5 | 10 | 20)
      ? Number(last)
      : undefined;

  const [player, opponent] = await Promise.all([getPlayer(Number(id)), getTeam(team)]);
  if (!player || !opponent) notFound();
  const isGoalie = player.position === "G";

  const [allGames, outlook] = await Promise.all([
    isGoalie
      ? goalieVsTeamGames(player.player_id, String(opponent.abbrev), filter.gameType)
      : skaterVsTeamGames(player.player_id, String(opponent.abbrev), filter.gameType),
    isGoalie
      ? goalieOutlook(player.player_id, String(opponent.abbrev))
      : skaterOutlook(player.player_id, String(opponent.abbrev)),
  ]);
  let games = allGames;
  const totalMeetings = games.length;
  if (fromDate) games = games.filter((g) => String(g.game_date) >= fromDate);
  if (toDate) games = games.filter((g) => String(g.game_date) <= toDate);
  if (lastN) games = games.slice(-lastN);
  const playoffCount = games.filter((g) => Number(g.game_type) === 3).length;

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
          <Link href={`/player/${player.player_id}`} className="plain-link">
            {player.full_name}
          </Link>
        </p>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <TeamLogo abbrev={String(opponent.abbrev)} size={34} />
          vs. {opponent.full_name}
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
        {isGoalie ? (
          <>
            <StatTile label="Shots against" value={sum(games, "shots_against").toLocaleString()} />
            <StatTile label="Saves" value={sum(games, "saves").toLocaleString()} />
            <StatTile label="Goals against" value={sum(games, "goals_against")} />
            <StatTile
              label="Save %"
              value={
                sum(games, "shots_against") > 0
                  ? (sum(games, "saves") / sum(games, "shots_against")).toFixed(3)
                  : "—"
              }
            />
          </>
        ) : (
          <>
            <StatTile label="Goals" value={sum(games, "goals")} />
            <StatTile label="Assists" value={sum(games, "assists")} />
            <StatTile label="Points" value={sum(games, "points")} />
            <StatTile label="Shots on goal" value={sum(games, "sog").toLocaleString()} />
          </>
        )}
      </div>

      {outlook && (
        <section className="card">
          <h2 className="font-medium mb-1">Matchup outlook</h2>
          <p className="text-xs mb-3" style={{ color: "var(--ink-muted)" }}>
            Experimental v0 — small samples are shrunk toward the player&apos;s baseline before
            use, so a handful of games only nudges the numbers.
          </p>
          <div className="tile-row">
            {outlook.kind === "skater" ? (
              <>
                <StatTile
                  label="Baseline P/GP"
                  value={outlook.baselinePpg.toFixed(2)}
                  delta="last 2 seasons"
                />
                <StatTile
                  label="Form (last 10)"
                  value={(outlook.baselinePpg * outlook.formIdx).toFixed(2)}
                  delta={pctDelta(outlook.formIdx, "vs baseline")}
                  deltaDir={dir(outlook.formIdx)}
                />
                <StatTile
                  label={`Edge vs ${opponent.abbrev}`}
                  value={(outlook.baselinePpg * outlook.edgeIdx).toFixed(2)}
                  delta={pctDelta(outlook.edgeIdx, `over ${outlook.samples.vsGp} games`)}
                  deltaDir={dir(outlook.edgeIdx)}
                />
                <StatTile
                  label={`${opponent.abbrev} defense`}
                  value={`${(outlook.oppDefIdx * 100).toFixed(0)}`}
                  delta={pctDelta(outlook.oppDefIdx, "GA vs league (last 20)")}
                  deltaDir={dir(outlook.oppDefIdx)}
                />
                <StatTile
                  label="Expected points"
                  value={outlook.expectedPoints.toFixed(2)}
                  delta="next meeting"
                  highlight
                />
              </>
            ) : (
              <>
                <StatTile
                  label="Baseline SV%"
                  value={outlook.baselineSvPct.toFixed(3)}
                  delta="last 2 seasons"
                />
                <StatTile
                  label="Form (last 10)"
                  value={(outlook.baselineSvPct * outlook.formIdx).toFixed(3)}
                  delta={pctDelta(outlook.formIdx, "vs baseline")}
                  deltaDir={dir(outlook.formIdx)}
                />
                <StatTile
                  label={`SV% vs ${opponent.abbrev}`}
                  value={(outlook.baselineSvPct * outlook.edgeIdx).toFixed(3)}
                  delta={pctDelta(outlook.edgeIdx, `on ${outlook.samples.vsSa} shots`)}
                  deltaDir={dir(outlook.edgeIdx)}
                />
                <StatTile
                  label={`${opponent.abbrev} offense`}
                  value={`${(outlook.oppOffIdx * 100).toFixed(0)}`}
                  delta={pctDelta(outlook.oppOffIdx, "GF vs league (last 20)")}
                  deltaDir={dir(outlook.oppOffIdx, false)}
                />
              </>
            )}
          </div>
        </section>
      )}

      {games.length > 0 && (
        <section className="card">
          {isGoalie ? (
            <>
              <h2 className="font-medium mb-2">Save % by meeting</h2>
              <SavePctChart data={games} />
              <h2 className="font-medium mb-2 mt-5">Goals against by meeting</h2>
              <FormChart data={games} dataKey="goals_against" name="Goals against" window={5} />
            </>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-medium mb-2">Points by meeting</h2>
                <FormChart data={games} dataKey="points" name="Points" window={5} />
              </div>
              <div>
                <h2 className="font-medium mb-2">Goals by meeting</h2>
                <FormChart data={games} dataKey="goals" name="Goals" window={5} />
              </div>
              <div>
                <h2 className="font-medium mb-2">Shots on goal by meeting</h2>
                <FormChart data={games} dataKey="sog" name="Shots on goal" window={5} />
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
                <th>Date</th><th>Type</th><th>Venue</th><th>SA</th><th>Saves</th><th>GA</th><th>SV%</th><th>Result</th>
              </tr>
            ) : (
              <tr>
                <th>Date</th><th>Type</th><th>Venue</th><th>G</th><th>A</th><th>P</th><th>SOG</th><th>Hits</th><th>TOI</th>
              </tr>
            )}
          </thead>
          <tbody>
            {games.map((g) => (
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
