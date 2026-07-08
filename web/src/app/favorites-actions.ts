"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { addFavorite, isFavorite, removeFavorite } from "@/lib/db";

export type ToggleResult = { ok: boolean; favorited?: boolean; needAuth?: boolean };

/** Toggle a favorite for the signed-in user. Returns needAuth if not logged in. */
export async function toggleFavorite(
  kind: "player" | "team",
  ref: string,
  revalidate?: string,
): Promise<ToggleResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, needAuth: true };

  const has = await isFavorite(userId, kind, ref);
  if (has) await removeFavorite(userId, kind, ref);
  else await addFavorite(userId, kind, ref);

  if (revalidate) revalidatePath(revalidate);
  return { ok: true, favorited: !has };
}
