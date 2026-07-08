import Link from "next/link";
import { notFound } from "next/navigation";
import { FormChart, SavePctChart } from "@/components/charts";
import { FilterRow, applyRange, parseFilters, type FilterParams } from "@/components/filters";
import { StatTile } from "@/components/stat-tile";
import { TeamLogo } from "@/components/team-logo";
import {
  getPlayer,
  goalieAllGames,
  goalieVsTeams,
  seasonSummaries,
  skaterAllGames,
  skaterVsTeams,
} from "@/lib/db";
import { birthdayInfo, fetchPlayerLanding, fetchPlayerNews, nearMilestones } from "@/lib/nhl";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(Number(id));
  if (!player) return { title: "NHL Trends" };
  const landing = await fetchPlayerLanding(Number(id));
  const c = landing?.careerTotals?.regularSeason;
  const line = c ? `${c.gamesPlayed} GP · ${c.goals} G · ${c.assists} A · ${c.points} P` : "";
  return {
    title: `${player.full_name} — NHL Trends`,
    description: `${player.full_name} (${player.team_abbrev ?? "NHL"}): recent form, career vs. every team, matchup outlooks. ${line}`,
    openGraph: landing?.headshot ? { images: [landing.headshot] } : undefined,
  };
}

function fmtSeason(s: number) {
  const str = String(s);
  return `${str.slice(0, 4)}-${str.slice(6)}`;
}

function sum(rows: Record<string, unknown>[], key: string) {
  return rows.reduce((a, r) => a + Number(r[key] ?? 0), 0);
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FilterParams>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const player = await getPlayer(Number(id));
  if (!player) notFound();
  const isGoalie = player.position === "G";

  const state = parseFilters(sp, [10, 25, 82], { defaultLast: 25 });

  const [allGames, vsTeams, seasons, landing, news] = await Promise.all([
    isGoalie
      ? goalieAllGames(player.player_id, state.filter.gameType)
      : skaterAllGames(player.player_id, state.filter.gameType),
    isGoalie ? goalieVsTeams(player.player_id) : skaterVsTeams(player.player_id),
    seasonSummaries(player.player_id, isGoalie),
    fetchPlayerLanding(player.player_id),
    fetchPlayerNews(String(player.full_name)),
  ]);
  const games = applyRange(allGames, state);
  const seasonOptions = [...new Set(allGames.map((g) => Number(g.season)))].sort((a, b) => b - a);

  const career = landing?.careerTotals?.regularSeason;
  const milestones = career && !isGoalie ? nearMilestones(career) : [];
  const birthday = birthdayInfo(landing?.birthDate);

  return (
    <>
      <section className="card flex items-center gap-4">
        {landing?.headshot ? (
          // eslint-disable-next-line @next/next/no-img-element -- NHL CDN headshot
          <img
            src={landing.headshot}
            alt=""
            width={72}
            height={72}
            className="rounded-full"
            style={{ background: "var(--grid)" }}
          />
        ) : null}
        <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          {player.team_abbrev ? <TeamLogo abbrev={String(player.team_abbrev)} size={34} /> : null}
          {player.full_name}
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {isGoalie ? "Goalie" : player.position} · {player.team_name ?? player.team_abbrev ?? "—"}
        </p>
        {birthday && (
          <p className="text-sm mt-1" style={{ color: "var(--ink)" }}>
            {birthday.text}
          </p>
        )}
        </div>
      </section>

      {career && (
        <section className="card">
          <h2 className="font-medium mb-2">Career (regular season)</h2>
          <div className="tile-row">
            <div className="stat-tile">
              <div className="label">Games</div>
              <div className="value">{career.gamesPlayed.toLocaleString()}</div>
            </div>
            {!isGoalie && (
              <>
                <div className="stat-tile">
                  <div className="label">Goals</div>
                  <div className="value">{career.goals.toLocaleString()}</div>
                </div>
                <div className="stat-tile">
                  <div className="label">Assists</div>
                  <div className="value">{career.assists.toLocaleString()}</div>
                </div>
                <div className="stat-tile">
                  <div className="label">Points</div>
                  <div className="value">{career.points.toLocaleString()}</div>
                </div>
              </>
            )}
          </div>
          {milestones.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {milestones.map((m) => (
                <span key={m.stat} className="milestone-chip">
                  🏒 {m.away} {m.stat === "games" ? (m.away === 1 ? "game" : "games") : m.stat}{" "}
                  from career {m.stat === "games" ? "game" : m.stat.replace(/s$/, "")} #{m.next.toLocaleString()}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {news.length > 0 && (
        <section className="card">
          <h2 className="font-medium mb-2">In the news</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {news.map((n) => (
              <li key={n.link}>
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="plain-link">
                  {n.title}
                </a>
                <span className="text-xs ml-2" style={{ color: "var(--ink-muted)" }}>
                  {n.source}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="font-medium mb-1">Performance</h2>
        <p className="text-sm mb-3" style={{ color: "var(--ink-2)" }}>
          Showing {games.length.toLocaleString()} of {allGames.length.toLocaleString()} games ·{" "}
          {state.filter.label.toLowerCase()} · {state.venueLabel} · {state.rangeLabel}
        </p>
        <FilterRow state={state} seasons={seasonOptions} />
        {games.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: "var(--ink-muted)" }}>
            No games in this range.
          </p>
        ) : (
          <>
            <div className="tile-row mt-4 mb-5">
              <StatTile label="Games" value={games.length.toLocaleString()} />
              {isGoalie ? (
                <>
                  <StatTile label="Shots against" value={sum(games, "shots_against").toLocaleString()} />
                  <StatTile label="Saves" value={sum(games, "saves").toLocaleString()} />
                  <StatTile label="Goals against" value={sum(games, "goals_against").toLocaleString()} />
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
                  <StatTile label="Goals" value={sum(games, "goals").toLocaleString()} />
                  <StatTile label="Assists" value={sum(games, "assists").toLocaleString()} />
                  <StatTile label="Points" value={sum(games, "points").toLocaleString()} />
                  <StatTile label="Shots on goal" value={sum(games, "sog").toLocaleString()} />
                  <StatTile label="P/GP" value={(sum(games, "points") / games.length).toFixed(2)} />
                </>
              )}
            </div>
            {isGoalie ? (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-medium mb-2">Save % by game</h3>
                  <SavePctChart data={games} />
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Goals against by game</h3>
                  <FormChart data={games} dataKey="goals_against" name="Goals against" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-medium mb-2">Points by game</h3>
                  <FormChart data={games} dataKey="points" name="Points" />
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Shots on goal by game</h3>
                  <FormChart data={games} dataKey="sog" name="Shots on goal" />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="font-medium mb-2">Career vs. each team</h2>
        <p className="text-xs mb-2" style={{ color: "var(--ink-muted)" }}>
          Click a team for game-by-game history.
        </p>
        <table className="stat-table">
          <thead>
            {isGoalie ? (
              <tr>
                <th>Opponent</th><th>GP</th><th>W</th><th>SA</th><th>Saves</th><th>GA</th><th>SV%</th>
              </tr>
            ) : (
              <tr>
                <th>Opponent</th><th>GP</th><th>G</th><th>A</th><th>P</th><th>SOG</th><th>P/GP</th>
              </tr>
            )}
          </thead>
          <tbody>
            {vsTeams.map((r) => (
              <tr key={String(r.opp)}>
                <td>
                  <Link href={`/player/${player.player_id}/vs/${r.opp}`} className="inline-flex items-center gap-1.5">
                    <TeamLogo abbrev={String(r.opp)} size={18} />
                    {String(r.opp_name)}
                  </Link>
                </td>
                <td>{String(r.games)}</td>
                {isGoalie ? (
                  <>
                    <td>{String(r.wins)}</td>
                    <td>{String(r.shots_against)}</td>
                    <td>{String(r.saves)}</td>
                    <td>{String(r.goals_against)}</td>
                    <td>{r.save_pct == null ? "—" : Number(r.save_pct).toFixed(3)}</td>
                  </>
                ) : (
                  <>
                    <td>{String(r.goals)}</td>
                    <td>{String(r.assists)}</td>
                    <td>{String(r.points)}</td>
                    <td>{String(r.sog)}</td>
                    <td>{String(r.ppg)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="font-medium mb-2">Season by season (regular season)</h2>
        <table className="stat-table">
          <thead>
            {isGoalie ? (
              <tr><th>Season</th><th>GP</th><th>W</th><th>SA</th><th>Saves</th><th>SV%</th></tr>
            ) : (
              <tr><th>Season</th><th>GP</th><th>G</th><th>A</th><th>P</th><th>SOG</th></tr>
            )}
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={String(s.season)}>
                <td>{fmtSeason(Number(s.season))}</td>
                <td>{String(s.games)}</td>
                {isGoalie ? (
                  <>
                    <td>{String(s.wins)}</td>
                    <td>{String(s.shots_against)}</td>
                    <td>{String(s.saves)}</td>
                    <td>{s.save_pct == null ? "—" : Number(s.save_pct).toFixed(3)}</td>
                  </>
                ) : (
                  <>
                    <td>{String(s.goals)}</td>
                    <td>{String(s.assists)}</td>
                    <td>{String(s.points)}</td>
                    <td>{String(s.sog)}</td>
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
