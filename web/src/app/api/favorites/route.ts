import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { favoritePlayers, favoriteTeams } from "@/lib/db";

// Signed-in user's favorites, used by the client widget on the (static) home
// page so the page itself stays cacheable.
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ players: [], teams: [] });
  const [players, teams] = await Promise.all([favoritePlayers(userId), favoriteTeams(userId)]);
  return NextResponse.json({ players, teams });
}
