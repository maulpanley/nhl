"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { TeamLogo } from "@/components/team-logo";

type Fav = {
  players: { player_id: number; full_name: string; team_abbrev: string | null; milestone: string | null }[];
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
          Tap ☆ Favorite on any player or team page to pin it here — and we&apos;ll email you
          when a favorite player nears a career milestone.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="font-medium mb-1">Your favorites</h2>
      <p className="text-xs mb-3" style={{ color: "var(--ink-muted)" }}>
        We&apos;ll email you when a favorite player nears a career milestone.
      </p>
      {fav.teams.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {fav.teams.map((t) => (
            <Link key={t.abbrev} href={`/team/${t.abbrev}`} className="fav-chip">
              <TeamLogo abbrev={t.abbrev} size={18} />
              {t.full_name}
            </Link>
          ))}
        </div>
      )}
      {fav.players.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {fav.players.map((p) => (
            <li key={p.player_id} className="flex items-center gap-2 text-sm">
              {p.team_abbrev ? <TeamLogo abbrev={p.team_abbrev} size={18} /> : null}
              <Link href={`/player/${p.player_id}`} className="plain-link">
                {p.full_name}
              </Link>
              {p.milestone && (
                <span className="milestone-chip" style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}>
                  🏒 {p.milestone}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
