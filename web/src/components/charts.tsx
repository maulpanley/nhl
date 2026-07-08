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

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

function VizTooltip({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color?: string; stroke?: string; fill?: string }[];
  label?: string;
  fmt?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="viz-tooltip">
      <div className="viz-tooltip-label">{typeof label === "string" ? shortDate(label) : label}</div>
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
}: {
  data: Row[];
  dataKey: string;
  name: string;
  window?: number;
  height?: number;
}) {
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
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="game_date"
            tick={AXIS_TICK}
            tickFormatter={shortDate}
            tickLine={false}
            axisLine={{ stroke: "var(--axis)" }}
            minTickGap={40}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<VizTooltip />} cursor={{ stroke: "var(--axis)", strokeWidth: 1 }} />
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

/** Single metric per meeting — bars over time. One series → no legend. */
export function MeetingBarChart({
  data,
  dataKey,
  name,
  height = 200,
}: {
  data: Row[];
  dataKey: string;
  name: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
        <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="game_date"
          tick={AXIS_TICK}
          tickFormatter={shortDate}
          tickLine={false}
          axisLine={{ stroke: "var(--axis)" }}
          minTickGap={40}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<VizTooltip />} cursor={{ stroke: "var(--axis)", strokeWidth: 1 }} />
        <Bar isAnimationActive={false} dataKey={dataKey} name={name} fill="var(--series-1)" maxBarSize={24} radius={[4, 4, 0, 0]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Save % per game — line with surface-ringed dots. One series → no legend. */
export function SavePctChart({ data, height = 220 }: { data: Row[]; height?: number }) {
  const fmt = (v: number) => v.toFixed(3);
  const dense = data.length > 60;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="game_date"
          tick={AXIS_TICK}
          tickFormatter={shortDate}
          tickLine={false}
          axisLine={{ stroke: "var(--axis)" }}
          minTickGap={40}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          domain={[0.7, 1]}
          tickFormatter={fmt}
        />
        <Tooltip content={<VizTooltip fmt={fmt} />} cursor={{ stroke: "var(--axis)", strokeWidth: 1 }} />
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
