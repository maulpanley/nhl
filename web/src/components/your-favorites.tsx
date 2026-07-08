"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { TeamLogo } from "@/components/team-logo";

type Fav = {
  players: { player_id: number; full_name: string; team_abbrev: string | null }[];
  teams: { abbrev: string; full_name: string }[];
};

/** Home-page widget for signed-in users. Fetches favorites client-side so the
    home page stays static. Renders nothing when signed out or empty. */
export function YourFavorites() {
  const { status } = useSession();
  const [fav, setFav] = useState<Fav | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/favorites")
      .then((r) => r.json())
      .then(setFav)
      .catch(() => setFav(null));
  }, [status]);

  if (status !== "authenticated" || !fav) return null;
  if (fav.players.length === 0 && fav.teams.length === 0) {
    return (
      <section className="card">
        <h2 className="font-medium mb-1">Your favorites</h2>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          Tap the ☆ on any player or team page to save it here.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="font-medium mb-2">Your favorites</h2>
      <div className="flex flex-wrap gap-2">
        {fav.teams.map((t) => (
          <Link key={t.abbrev} href={`/team/${t.abbrev}`} className="fav-chip">
            <TeamLogo abbrev={t.abbrev} size={18} />
            {t.full_name}
          </Link>
        ))}
        {fav.players.map((p) => (
          <Link key={p.player_id} href={`/player/${p.player_id}`} className="fav-chip">
            {p.team_abbrev ? <TeamLogo abbrev={p.team_abbrev} size={18} /> : null}
            {p.full_name}
          </Link>
        ))}
      </div>
    </section>
  );
}
