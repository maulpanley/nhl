import { cookies } from "next/headers";

export type Tier = "free" | "paid";

/** Whether the visitor can see paid features (predictions, Best Bets).
 *
 * The paywall has a master switch: until billing is wired up
 * (PAYWALL_ENABLED !== "true") everything is unlocked, so the public site is
 * unchanged and predictions stay free. In that mode a `preview=locked` cookie
 * still lets us see the locked/tease UI for development.
 *
 * Once billing is live, this reads the signed-in user's subscription — added
 * in the Auth.js + Stripe phase. */
export async function getTier(): Promise<Tier> {
  const jar = await cookies();
  if (process.env.PAYWALL_ENABLED !== "true") {
    return jar.get("preview")?.value === "locked" ? "free" : "paid";
  }
  // TODO(billing): look up the session user's subscription_status here.
  return jar.get("tier")?.value === "paid" ? "paid" : "free";
}
