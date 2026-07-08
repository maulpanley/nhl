"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

function fmtSeason(s: number) {
  const str = String(s);
  return `${str.slice(0, 4)}-${str.slice(6)}`;
}

/** Season dropdown. Selecting a season scopes to it and clears any last-N /
    date-range so you see the whole season; other filters (type, venue) stay. */
export function SeasonSelect({ seasons }: { seasons: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("season") ?? "";
  return (
    <select
      aria-label="Season"
      className="filter-select"
      defaultValue={current}
      onChange={(e) => {
        const params = new URLSearchParams(Array.from(sp.entries()));
        if (e.target.value) params.set("season", e.target.value);
        else params.delete("season");
        params.delete("last");
        params.delete("from");
        params.delete("to");
        const q = params.toString();
        router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
      }}
    >
      <option value="">All seasons</option>
      {seasons.map((s) => (
        <option key={s} value={String(s)}>
          {fmtSeason(s)}
        </option>
      ))}
    </select>
  );
}
