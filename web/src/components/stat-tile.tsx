export function StatTile({
  label,
  value,
  delta,
  deltaDir,
  highlight,
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: "up" | "down" | "flat";
  highlight?: boolean;
}) {
  return (
    <div className={`stat-tile${highlight ? " highlight" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta ? (
        <div className={`delta${deltaDir === "up" ? " up" : deltaDir === "down" ? " down" : ""}`}>
          {delta}
        </div>
      ) : null}
    </div>
  );
}

export function pctDelta(idx: number, vs: string) {
  const pct = Math.round((idx - 1) * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% ${vs}`;
}

export function dir(idx: number, upIsGood = true): "up" | "down" | "flat" {
  if (Math.abs(idx - 1) < 0.02) return "flat";
  return (idx > 1) === upIsGood ? "up" : "down";
}
