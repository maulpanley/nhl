import { NextResponse } from "next/server";
import { favoritePlayerSubscriptions, getPlayer, hasAlerted, recordAlert } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { fetchPlayerLanding, nearMilestones } from "@/lib/nhl";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE = "https://nhl-trends.vercel.app";

function statLabel(stat: string, milestone: number) {
  if (stat === "games") return `${milestone} career games`;
  return `${milestone} career ${stat}`;
}

/** Daily job: email each user when a favorited player is within ~10 of a
    round-number career milestone. Deduped via milestone_alerts.
    Triggered by Vercel Cron (Authorization: Bearer CRON_SECRET); ?dryRun=1
    reports what would send without emailing or recording. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(req.url).searchParams.has("dryRun");

  const subs = await favoritePlayerSubscriptions();
  // Fetch each distinct player's milestones once.
  const byPlayer = new Map<string, Awaited<ReturnType<typeof nearMilestones>>>();
  const names = new Map<string, string>();
  for (const playerId of new Set(subs.map((s) => s.player_id))) {
    const landing = await fetchPlayerLanding(Number(playerId));
    const career = landing?.careerTotals?.regularSeason;
    byPlayer.set(playerId, career ? nearMilestones(career) : []);
    const p = await getPlayer(Number(playerId));
    names.set(playerId, p ? String(p.full_name) : `Player ${playerId}`);
  }

  const planned: { email: string; player: string; text: string }[] = [];
  let sent = 0;

  for (const sub of subs) {
    const milestones = byPlayer.get(sub.player_id) ?? [];
    const name = names.get(sub.player_id)!;
    for (const m of milestones) {
      if (await hasAlerted(sub.user_id, sub.player_id, m.stat, m.next)) continue;
      const text = `${name} is ${m.away} ${m.stat === "games" ? (m.away === 1 ? "game" : "games") : m.stat} from ${statLabel(m.stat, m.next)}.`;
      planned.push({ email: sub.email, player: name, text });
      if (!dryRun) {
        await sendEmail(
          sub.email,
          `${name}: approaching ${statLabel(m.stat, m.next)}`,
          `<p>${text}</p><p><a href="${SITE}/player/${sub.player_id}">View ${name} on NHL Trends →</a></p>` +
            `<p style="color:#888;font-size:12px">You get this because ${name} is in your favorites.</p>`,
        );
        await recordAlert(sub.user_id, sub.player_id, m.stat, m.next);
        sent++;
      }
    }
  }

  return NextResponse.json({
    subscriptions: subs.length,
    playersChecked: byPlayer.size,
    alerts: dryRun ? planned : sent,
    dryRun,
  });
}
