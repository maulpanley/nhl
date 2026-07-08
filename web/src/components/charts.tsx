"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* Dataviz method notes:
   - bars ≤24px, 4px rounded data-end square at baseline; lines 2px; dots r≥4
     with a 2px surface ring; hairline grid, recessive axes
   - crosshair tooltip listing every series at the X; values lead, names follow
   - single series → no legend (title names it); two series → HTML legend
   - text wears text tokens; series color only on marks and keys */

type Row = Record<string, unknown>;

const AXIS_TICK = { fill: "var(--ink-muted)", fontSize: 11 } as const;

/** Season-or-shorter ranges (≤ 82 games) get vertical labels showing (nearly)
    every game; longer ranges keep recessive, auto-thinned horizontal ticks. */
function xAxisRotation(count: number): {
  interval: number | undefined;
  angle: number;
  textAnchor: "middle" | "end";
  axisHeight: number;
  extraHeight: number;
  minTickGap: number;
} {
  if (count > 82) {
    return { interval: undefined, angle: 0, textAnchor: "middle", axisHeight: 30, extraHeight: 0, minTickGap: 64 };
  }
  // Show every label up to ~41; above that, thin evenly so labels stay legible.
  const interval = count <= 41 ? 0 : Math.ceil(count / 41) - 1;
  return { interval, angle: -90, textAnchor: "end", axisHeight: 88, extraHeight: 66, minTickGap: 0 };
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

/** Axis/tooltip labels like "3/8/26 @DAL" or "3/8/26 vs FLA". Opponent comes
    from each row's `opp`, or `fixedOpp` on vs-pages where it's constant. */
function makeGameLabeler(data: Row[], fixedOpp?: string) {
  const byDate = new Map<string, string>();
  for (const r of data) {
    const date = String(r.game_date);
    const opp = (r.opp as string | undefined) ?? fixedOpp;
    if (opp && r.is_home != null) {
      byDate.set(date, `${shortDate(date)} ${r.is_home ? "vs " : "@"}${opp}`);
    } else {
      byDate.set(date, shortDate(date));
    }
  }
  return (d: string) => byDate.get(d) ?? shortDate(d);
}

function VizTooltip({
  active,
  payload,
  label,
  fmt,
  fmtLabel,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color?: string; stroke?: string; fill?: string }[];
  label?: string;
  fmt?: (v: number) => string;
  fmtLabel?: (d: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="viz-tooltip">
      <div className="viz-tooltip-label">
        {typeof label === "string" ? (fmtLabel ? fmtLabel(label) : shortDate(label)) : label}
      </div>
      {payload.map((p) => (
        <div className="viz-tooltip-row" key={p.name}>
          <span className="viz-key" style={{ background: p.stroke ?? p.fill ?? p.color }} />
          <strong>{fmt ? fmt(p.value) : p.value}</strong>
          <span className="name">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Per-game bars + k-game rolling average line. Two series → legend. */
export function FormChart({
  data,
  dataKey,
  name,
  window = 5,
  height = 220,
  fixedOpp,
}: {
  data: Row[];
  dataKey: string;
  name: string;
  window?: number;
  height?: number;
  fixedOpp?: string;
}) {
  const labelFor = makeGameLabeler(data, fixedOpp);
  // Long ranges keep per-game bars (they read like volume bars under the
  // trend), but drop the rounded caps and widen the rolling window.
  const dense = data.length > 120;
  const effWindow = dense ? Math.max(window, 10) : window;
  const rows = data.map((r, i) => {
    const slice = data.slice(Math.max(0, i - effWindow + 1), i + 1);
    const avg = slice.reduce((a, s) => a + Number(s[dataKey] ?? 0), 0) / slice.length;
    return { ...r, rolling: Math.round(avg * 100) / 100 };
  });
  const rollingName = `${effWindow}-game avg`;
  const rot = xAxisRotation(data.length);
  return (
    <div>
      <div className="viz-legend">
        <span className="entry">
          <span className="viz-key swatch" style={{ background: "var(--series-1)" }} />
          {name}
        </span>
        <span className="entry">
          <span className="viz-key" style={{ background: "var(--series-3)" }} />
          {rollingName}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height + rot.extraHeight}>
        <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="game_date"
            tick={AXIS_TICK}
            tickFormatter={labelFor}
            tickLine={false}
            axisLine={{ stroke: "var(--axis)" }}
            interval={rot.interval}
            angle={rot.angle}
            textAnchor={rot.textAnchor}
            height={rot.axisHeight}
            minTickGap={rot.minTickGap}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            content={<VizTooltip fmtLabel={labelFor} />}
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
          />
          <Bar
            isAnimationActive={false}
            dataKey={dataKey}
            name={name}
            fill="var(--series-1)"
            fillOpacity={dense ? 0.55 : 1}
            maxBarSize={24}
            radius={dense ? 0 : [4, 4, 0, 0]}
          />
          <Line
            isAnimationActive={false}
            dataKey="rolling"
            name={rollingName}
            stroke="var(--series-3)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={false}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Save % per game — line with surface-ringed dots. One series → no legend. */
export function SavePctChart({
  data,
  height = 220,
  fixedOpp,
}: {
  data: Row[];
  height?: number;
  fixedOpp?: string;
}) {
  const fmt = (v: number) => v.toFixed(3);
  const dense = data.length > 60;
  const labelFor = makeGameLabeler(data, fixedOpp);
  const rot = xAxisRotation(data.length);
  return (
    <ResponsiveContainer width="100%" height={height + rot.extraHeight}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="game_date"
          tick={AXIS_TICK}
          tickFormatter={labelFor}
          tickLine={false}
          axisLine={{ stroke: "var(--axis)" }}
          interval={rot.interval}
          angle={rot.angle}
          textAnchor={rot.textAnchor}
          height={rot.axisHeight}
          minTickGap={rot.minTickGap}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          domain={[0.7, 1]}
          tickFormatter={fmt}
        />
        <Tooltip
          content={<VizTooltip fmt={fmt} fmtLabel={labelFor} />}
          cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
        />
        <Line
          isAnimationActive={false}
          dataKey="save_pct"
          name="Save %"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          type="monotone"
          dot={dense ? false : { r: 4, fill: "var(--series-1)", stroke: "var(--surface-1)", strokeWidth: 2 }}
          activeDot={{ r: 5, stroke: "var(--surface-1)", strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
