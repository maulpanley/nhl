"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/favorites-actions";

/** Labeled star toggle that explains the payoff (milestone alerts). `refId`
    (not `ref`, which is reserved) is the player_id or team abbrev. */
export function FavoriteButton({
  kind,
  refId,
  initial,
  signedIn,
}: {
  kind: "player" | "team";
  refId: string;
  initial: boolean;
  signedIn: boolean;
}) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  const text = !signedIn
    ? "Favorite for milestone alerts"
    : fav
      ? "Favorited — milestone alerts on"
      : "Favorite for milestone alerts";

  return (
    <button
      type="button"
      className={`fav-btn${fav ? " on" : ""}`}
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
      <span aria-hidden="true">{fav ? "★" : "☆"}</span>
      {text}
    </button>
  );
}
