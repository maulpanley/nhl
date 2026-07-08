"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/favorites-actions";

/** Star toggle. `refId` (not `ref`, which is reserved) is the player_id or team
    abbrev. Signed-out users are sent to /signin. */
export function FavoriteButton({
  kind,
  refId,
  initial,
  signedIn,
  label,
}: {
  kind: "player" | "team";
  refId: string;
  initial: boolean;
  signedIn: boolean;
  label: string;
}) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  const title = signedIn
    ? fav
      ? `Remove ${label} from favorites`
      : `Add ${label} to favorites`
    : "Sign in to save favorites";

  return (
    <button
      type="button"
      className={`fav-btn${fav ? " on" : ""}`}
      title={title}
      aria-pressed={fav}
      disabled={pending}
      onClick={() => {
        if (!signedIn) {
          router.push("/signin");
          return;
        }
        start(async () => {
          const r = await toggleFavorite(kind, refId);
          if (r.needAuth) router.push("/signin");
          else if (r.ok) setFav(Boolean(r.favorited));
        });
      }}
    >
      {fav ? "★" : "☆"}
    </button>
  );
}
