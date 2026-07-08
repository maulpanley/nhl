import Link from "next/link";

export const TYPE_FILTERS = [
  { key: "all", label: "All games", gameType: null },
  { key: "regular", label: "Regular season", gameType: 2 },
  { key: "playoffs", label: "Playoffs", gameType: 3 },
] as const;

export type TypeFilter = (typeof TYPE_FILTERS)[number];

export type FilterParams = { type?: string; last?: string; from?: string; to?: string };

export type FilterState = {
  filter: TypeFilter;
  lastN?: number;
  fromDate?: string;
  toDate?: string;
  rangeLabel: string;
  lastOptions: readonly number[];
  noun: string;
  isDefault: boolean; // no explicit range params in the URL
  rawLast?: string; // the URL's own `last` value, preserved across type switches
};

function isIsoDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Parse type + range search params. `defaultLast` applies when the URL has
    no range at all (e.g. player pages default to last 25). */
export function parseFilters(
  sp: FilterParams,
  lastOptions: readonly number[],
  { noun = "games", defaultLast }: { noun?: string; defaultLast?: number } = {},
): FilterState {
  const filter = TYPE_FILTERS.find((f) => f.key === sp.type) ?? TYPE_FILTERS[0];
  const fromDate = isIsoDate(sp.from) ? sp.from : undefined;
  const toDate = isIsoDate(sp.to) ? sp.to : undefined;
  const isDefault = !fromDate && !toDate && !sp.last;
  let lastN =
    !fromDate && !toDate && sp.last && lastOptions.includes(Number(sp.last))
      ? Number(sp.last)
      : undefined;
  if (isDefault) lastN = defaultLast;
  // "last=all" (or any non-option) with no dates means all time.
  const rangeLabel = lastN
    ? `last ${lastN} ${noun}`
    : fromDate || toDate
      ? `${fromDate ?? "…"} to ${toDate ?? "…"}`
      : "all time";
  return { filter, lastN, fromDate, toDate, rangeLabel, lastOptions, noun, isDefault, rawLast: sp.last };
}

export function buildQuery(s: FilterState, overrides: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  const merged = {
    type: s.filter.key === "all" ? undefined : s.filter.key,
    last: s.rawLast,
    from: s.fromDate,
    to: s.toDate,
    ...overrides,
  };
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  const str = p.toString();
  return str ? `?${str}` : "?";
}

/** Apply the date-range / last-N slice to rows already filtered by game type
    (rows must be oldest-first with a game_date field). */
export function applyRange<T extends { game_date?: unknown }>(rows: T[], s: FilterState): T[] {
  let out = rows;
  if (s.fromDate) out = out.filter((r) => String(r.game_date) >= s.fromDate!);
  if (s.toDate) out = out.filter((r) => String(r.game_date) <= s.toDate!);
  if (s.lastN) out = out.slice(-s.lastN);
  return out;
}

export function FilterRow({ state }: { state: FilterState }) {
  const allTimeActive = !state.lastN && !state.fromDate && !state.toDate;
  return (
    <div className="filter-row flex-wrap">
      {TYPE_FILTERS.map((f) => (
        <Link
          key={f.key}
          href={buildQuery({ ...state, filter: f }, {})}
          className={`filter-pill${f.key === state.filter.key ? " active" : ""}`}
        >
          {f.label}
        </Link>
      ))}
      <span className="filter-divider" />
      <Link
        href={buildQuery(state, { last: "0", from: undefined, to: undefined })}
        className={`filter-pill${allTimeActive ? " active" : ""}`}
      >
        All time
      </Link>
      {state.lastOptions.map((n) => (
        <Link
          key={n}
          href={buildQuery(state, { last: String(n), from: undefined, to: undefined })}
          className={`filter-pill${state.lastN === n ? " active" : ""}`}
        >
          Last {n}
        </Link>
      ))}
      <form method="GET" className="filter-range-form">
        {state.filter.key !== "all" && <input type="hidden" name="type" value={state.filter.key} />}
        <input type="date" name="from" defaultValue={state.fromDate ?? ""} aria-label="From date" />
        <span style={{ color: "var(--ink-muted)" }}>–</span>
        <input type="date" name="to" defaultValue={state.toDate ?? ""} aria-label="To date" />
        <button type="submit" className={`filter-pill${state.fromDate || state.toDate ? " active" : ""}`}>
          Apply
        </button>
      </form>
    </div>
  );
}
