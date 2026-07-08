import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { favoritePlayers, favoriteTeams } from "@/lib/db";
import { fetchPlayerLanding, nearMilestones } from "@/lib/nhl";

// Signed-in user's favorites, used by the client widget on the (static) home
// page. Players are enriched with their nearest career milestone so the payoff
// of favoriting is visible in-app, not just via email.
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ players: [], teams: [] });

  const [players, teams] = await Promise.all([favoritePlayers(userId), favoriteTeams(userId)]);

  const enriched = await Promise.all(
    players.map(async (p) => {
      const landing = await fetchPlayerLanding(Number(p.player_id));
      const career = landing?.careerTotals?.regularSeason;
      const nearest = career ? nearMilestones(career)[0] : undefined;
      const milestone = nearest
        ? `${nearest.away} ${nearest.stat === "games" ? (nearest.away === 1 ? "game" : "games") : nearest.stat} to ${nearest.next.toLocaleString()}`
        : null;
      return { ...p, milestone };
    }),
  );

  return NextResponse.json({ players: enriched, teams });
}
