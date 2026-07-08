/** Live NHL API + news lookups for player pages. Cached via Next fetch cache
    so we never hammer the upstream: landing 6h, news 30min. */

export type CareerTotals = {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
};

export type PlayerLanding = {
  headshot?: string;
  birthDate?: string;
  birthCity?: string;
  birthCountry?: string;
  heightInInches?: number;
  weightInPounds?: number;
  careerTotals?: { regularSeason?: CareerTotals; playoffs?: CareerTotals };
  draftDetails?: { year?: number; teamAbbrev?: string; round?: number; overallPick?: number };
};

export async function fetchPlayerLanding(playerId: number): Promise<PlayerLanding | null> {
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/player/${playerId}/landing`, {
      next: { revalidate: 21600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PlayerLanding;
  } catch {
    return null;
  }
}

export type ScheduleGame = {
  id: number;
  startTimeUTC: string;
  gameState: string;
  gameType: number;
  awayTeam: { abbrev: string; score?: number };
  homeTeam: { abbrev: string; score?: number };
};
export type ScheduleDay = { date: string; games: ScheduleGame[] };

export async function fetchScheduleWeek(startDate: string): Promise<ScheduleDay[]> {
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${startDate}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.gameWeek ?? []) as ScheduleDay[];
  } catch {
    return [];
  }
}

export type NewsItem = { title: string; link: string; source: string; pubDate: string };

function decodeEntities(s: string) {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim()) : "";
}

export async function fetchPlayerNews(fullName: string, limit = 5): Promise<NewsItem[]> {
  try {
    const q = encodeURIComponent(`"${fullName}" NHL`);
    const res = await fetch(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split("<item>").slice(1, limit + 1);
    return items
      .map((chunk) => ({
        title: tag(chunk, "title"),
        link: tag(chunk, "link"),
        source: tag(chunk, "source"),
        pubDate: tag(chunk, "pubDate"),
      }))
      .filter((i) => i.title && i.link);
  } catch {
    return [];
  }
}

export type Milestone = { stat: string; current: number; next: number; away: number };

/** Next round-number milestones (multiples of 100; games also 500/1000-style)
    within `window` of the current total. */
export function nearMilestones(totals: CareerTotals, window = 10): Milestone[] {
  const defs: { stat: string; value: number }[] = [
    { stat: "games", value: totals.gamesPlayed },
    { stat: "goals", value: totals.goals },
    { stat: "assists", value: totals.assists },
    { stat: "points", value: totals.points },
  ];
  const out: Milestone[] = [];
  for (const { stat, value } of defs) {
    if (!Number.isFinite(value) || value < 40) continue; // milestones start mattering near 100
    const next = Math.ceil((value + 1) / 100) * 100;
    const away = next - value;
    if (away <= window) out.push({ stat, current: value, next, away });
  }
  return out.sort((a, b) => a.away - b.away);
}

export function birthdayInfo(birthDate?: string): { text: string; today: boolean } | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), m - 1, d);
  const next = thisYear >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
    ? thisYear
    : new Date(now.getFullYear() + 1, m - 1, d);
  const days = Math.round((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
  const turns = next.getFullYear() - y;
  if (days === 0) return { text: `🎂 Birthday today — turns ${turns}`, today: true };
  if (days <= 14) return { text: `🎂 Birthday in ${days} day${days === 1 ? "" : "s"} (turns ${turns})`, today: false };
  return null;
}
