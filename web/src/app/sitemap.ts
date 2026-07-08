import type { MetadataRoute } from "next";
import { activeTeams, allPlayerIds } from "@/lib/db";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://nhl-trends.vercel.app";
  const [teams, players] = await Promise.all([activeTeams(), allPlayerIds()]);
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/schedule`, changeFrequency: "daily", priority: 0.9 },
    ...teams.map((t) => ({
      url: `${base}/team/${t.abbrev}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...players.map((p) => ({
      url: `${base}/player/${p.player_id}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
