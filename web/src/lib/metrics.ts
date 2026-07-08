/** Matchup-outlook v0.
 *
 * Small-sample rates (last 10 games, career vs. one opponent) are mostly
 * noise, so every rate is shrunk toward a more reliable prior before use:
 *
 *   shrunk = (made + k * prior) / (tries + k)
 *
 * k is the prior's weight in "tries" (games or shots): the fewer real tries,
 * the closer the result stays to the prior.
 *
 * Skater expected points next meeting:
 *   baseline * sqrt(form) * sqrt(edge) * sqrt(oppDefense)
 * where each index is a ratio to baseline (or league average), and the
 * square root dampens each factor so no single small-sample signal dominates.
 */

import {
  goalieOutlookInputs,
  leagueGoalsPerTeamGame,
  skaterOutlookInputs,
  teamRecentGoalRates,
} from "./db";

function shrunkRate(made: number, tries: number, prior: number, k: number) {
  return (made + k * prior) / (tries + k);
}

export type SkaterOutlook = {
  kind: "skater";
  baselinePpg: number;
  formIdx: number;
  edgeIdx: number;
  oppDefIdx: number;
  expectedPoints: number;
  samples: { recentGp: number; last10Gp: number; vsGp: number; oppGames: number };
};

export type GoalieOutlook = {
  kind: "goalie";
  baselineSvPct: number;
  formIdx: number;
  edgeIdx: number;
  oppOffIdx: number;
  samples: { recentSa: number; last10Sa: number; vsSa: number; oppGames: number };
};

export async function skaterOutlook(
  playerId: number,
  opponentAbbrev: string,
): Promise<SkaterOutlook | null> {
  const [p, opp, league] = await Promise.all([
    skaterOutlookInputs(playerId, opponentAbbrev),
    teamRecentGoalRates(opponentAbbrev, 20),
    leagueGoalsPerTeamGame(),
  ]);
  const careerGp = Number(p.career_gp);
  if (careerGp < 10) return null; // not enough history to say anything

  const careerPpg = Number(p.career_pts) / careerGp;
  // Baseline: last two seasons, shrunk toward career (k = 20 games of prior).
  const baselinePpg = shrunkRate(Number(p.recent_pts), Number(p.recent_gp), careerPpg, 20);
  // Form: last 10 games, shrunk toward baseline (k = 5).
  const formPpg = shrunkRate(Number(p.last10_pts), Number(p.last10_gp), baselinePpg, 5);
  // Matchup edge: career vs. this opponent, shrunk toward baseline (k = 10).
  const vsPpg = shrunkRate(Number(p.vs_pts), Number(p.vs_gp), baselinePpg, 10);
  // Opponent defense: goals allowed per game (last 20) vs. league average.
  const oppGa = Number(opp.ga_per_game);
  const oppDefIdx = opp.games && oppGa > 0 && league > 0 ? oppGa / league : 1;

  const formIdx = formPpg / baselinePpg;
  const edgeIdx = vsPpg / baselinePpg;
  const expectedPoints =
    baselinePpg * Math.sqrt(formIdx) * Math.sqrt(edgeIdx) * Math.sqrt(oppDefIdx);

  return {
    kind: "skater",
    baselinePpg,
    formIdx,
    edgeIdx,
    oppDefIdx,
    expectedPoints,
    samples: {
      recentGp: Number(p.recent_gp),
      last10Gp: Number(p.last10_gp),
      vsGp: Number(p.vs_gp),
      oppGames: Number(opp.games),
    },
  };
}

export type TeamOutlook = {
  offIdxA: number;
  defIdxA: number;
  offIdxB: number;
  defIdxB: number;
  expectedA: number;
  expectedB: number;
  h2hWinRate: number; // A's shrunk head-to-head win rate
  league: number;
};

/** Team-vs-team outlook: recent scoring rates vs. league for both sides,
    expected score next meeting (dampened), and shrunk head-to-head record. */
export async function teamOutlook(
  abbrevA: string,
  abbrevB: string,
  h2h: { aWins: number; games: number },
): Promise<TeamOutlook | null> {
  const [a, b, league] = await Promise.all([
    teamRecentGoalRates(abbrevA, 20),
    teamRecentGoalRates(abbrevB, 20),
    leagueGoalsPerTeamGame(),
  ]);
  if (!Number(a.games) || !Number(b.games) || !league) return null;

  const offIdxA = Number(a.gf_per_game) / league;
  const defIdxA = Number(a.ga_per_game) / league;
  const offIdxB = Number(b.gf_per_game) / league;
  const defIdxB = Number(b.ga_per_game) / league;
  // Expected goals: league base scaled by my offense and their leakiness, dampened.
  const expectedA = league * Math.sqrt(offIdxA) * Math.sqrt(defIdxB);
  const expectedB = league * Math.sqrt(offIdxB) * Math.sqrt(defIdxA);
  // Head-to-head win rate shrunk toward a coin flip (k = 10 games of prior).
  const h2hWinRate = shrunkRate(h2h.aWins, h2h.games, 0.5, 10);

  return { offIdxA, defIdxA, offIdxB, defIdxB, expectedA, expectedB, h2hWinRate, league };
}

export async function goalieOutlook(
  playerId: number,
  opponentAbbrev: string,
): Promise<GoalieOutlook | null> {
  const [p, opp, league] = await Promise.all([
    goalieOutlookInputs(playerId, opponentAbbrev),
    teamRecentGoalRates(opponentAbbrev, 20),
    leagueGoalsPerTeamGame(),
  ]);
  const careerSa = Number(p.career_sa);
  if (careerSa < 300) return null;

  const careerSv = Number(p.career_sv) / careerSa;
  // Shots are the "tries" here, so prior weights are shot counts.
  const baselineSvPct = shrunkRate(Number(p.recent_sv), Number(p.recent_sa), careerSv, 600);
  const formSv = shrunkRate(Number(p.last10_sv), Number(p.last10_sa), baselineSvPct, 150);
  const vsSv = shrunkRate(Number(p.vs_sv), Number(p.vs_sa), baselineSvPct, 300);
  const oppGf = Number(opp.gf_per_game);
  const oppOffIdx = opp.games && oppGf > 0 && league > 0 ? oppGf / league : 1;

  return {
    kind: "goalie",
    baselineSvPct,
    formIdx: formSv / baselineSvPct,
    edgeIdx: vsSv / baselineSvPct,
    oppOffIdx,
    samples: {
      recentSa: Number(p.recent_sa),
      last10Sa: Number(p.last10_sa),
      vsSa: Number(p.vs_sa),
      oppGames: Number(opp.games),
    },
  };
}
