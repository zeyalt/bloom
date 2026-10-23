"use client";

import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChildren } from "@/lib/api-hooks";
import { formatValue, type ChartSpec, type ValueFormat } from "@/lib/chat-chart";

const DISPLAY_FONT = "var(--font-bricolage), ui-sans-serif, system-ui, sans-serif";
// Same palette as Analytics, for items that don't belong to a child.
const PALETTE = ["#2f6f4e", "#b45309", "#3d6b7a", "#6b5344", "#4a6741", "#8b5a2b", "#5c7a6a", "#1a2c22"];

const axisProps = {
  stroke: "var(--text-muted)",
  tick: { fontSize: 11, fill: "var(--text-muted)" } as const,
  tickLine: false,
  axisLine: false,
};

function useChildColor() {
  const { data: children = [] } = useChildren();
  return (name?: string) => (name ? children.find(c => c.name.toLowerCase() === name.toLowerCase())?.color_code : undefined);
}

function Frame({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="w-full border border-[var(--rule)] bg-[var(--sheet)] rounded-[var(--radius-md)] p-3.5">
      {title && <p className="text-sm font-semibold text-[var(--text-primary)] mb-2.5" style={{ fontFamily: DISPLAY_FONT }}>{title}</p>}
      {children}
    </div>
  );
}

function Tip({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color?: string; payload?: { fill?: string } }[]; label?: string; format: ValueFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-[var(--rule)] bg-[var(--sheet)] px-2.5 py-1.5 text-xs">
      {label != null && <p className="font-semibold text-[var(--text-primary)] mb-0.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 shrink-0" style={{ backgroundColor: p.color || p.payload?.fill }} />
          <span className="text-[var(--text-secondary)]">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-[var(--text-primary)]">{formatValue(p.value, format)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ChatChart({ spec }: { spec: ChartSpec }) {
  const childColor = useChildColor();
  const colorOf = (child: string | undefined, i: number) => childColor(child) ?? PALETTE[i % PALETTE.length];

  if (spec.type === "stats") {
    return (
      <Frame title={spec.title}>
        <div className={`grid gap-2.5 ${spec.stats.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {spec.stats.map(s => (
            <div key={s.label} className="rounded-[var(--radius-md)] bg-[var(--bg-secondary)] px-3 py-2.5">
              <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
              <p className="text-xl font-bold tabular-nums text-[var(--text-primary)] leading-tight mt-0.5" style={{ fontFamily: DISPLAY_FONT }}>
                {formatValue(s.value, spec.format)}
              </p>
              {s.note && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{s.note}</p>}
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  if (spec.type === "bar") {
    const max = Math.max(...spec.items.map(i => Math.abs(i.value)), 0);
    return (
      <Frame title={spec.title}>
        <div className="space-y-1">
          {spec.items.map((it, i) => {
            const color = childColor(it.child) ?? "var(--stem)";
            return (
              <div key={`${it.label}-${i}`} className="relative flex items-center h-7 rounded-[4px] bg-[var(--bg-secondary)] overflow-hidden" title={`${it.label} · ${formatValue(it.value, spec.format)}`}>
                <span
                  className="absolute inset-y-0 left-0 rounded-[4px]"
                  style={{ width: `${max > 0 ? (Math.abs(it.value) / max) * 100 : 0}%`, backgroundColor: `color-mix(in srgb, ${color} 35%, transparent)` }}
                />
                <span className="relative flex-1 min-w-0 px-2 text-xs text-[var(--text-primary)] truncate">{it.label}</span>
                <span className="relative shrink-0 pr-2 text-xs font-semibold tabular-nums text-[var(--text-primary)]">{formatValue(it.value, spec.format)}</span>
              </div>
            );
          })}
        </div>
      </Frame>
    );
  }

  if (spec.type === "donut") {
    const total = spec.items.reduce((s, i) => s + i.value, 0);
    const data = spec.items.map((it, i) => ({ name: it.label, value: it.value, fill: colorOf(it.child, i) }));
    return (
      <Frame title={spec.title}>
        <div className="flex items-center gap-4">
          <div className="relative w-28 h-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={34} outerRadius={54} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip content={<Tip format={spec.format} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs font-bold tabular-nums text-[var(--text-primary)]">{formatValue(total, spec.format)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            {data.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs min-w-0">
                <span className="w-2 h-2 shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="truncate text-[var(--text-secondary)]">{d.name}</span>
                <span className="ml-auto shrink-0 tabular-nums text-[var(--text-primary)]">
                  {formatValue(d.value, spec.format)}
                  <span className="text-[var(--text-muted)]"> · {total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Frame>
    );
  }

  // line
  const rows = spec.x.map((label, xi) => Object.fromEntries([["label", label], ...spec.series.map(s => [s.name, s.values[xi]])]));
  return (
    <Frame title={spec.title}>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={14} />
          <YAxis {...axisProps} width={48} tickFormatter={v => formatValue(v, spec.format)} />
          <Tooltip content={<Tip format={spec.format} />} />
          {spec.series.map((s, i) => {
            const color = colorOf(s.child, i);
            return <Line key={s.name} type="linear" dataKey={s.name} name={s.name} stroke={color} strokeWidth={2} dot={{ r: 1.75, fill: color, strokeWidth: 0 }} activeDot={{ r: 3.5 }} isAnimationActive={false} />;
          })}
        </LineChart>
      </ResponsiveContainer>
      {spec.series.length > 1 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {spec.series.map((s, i) => (
            <div key={s.name} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: colorOf(s.child, i) }} />
              <span className="text-[var(--text-secondary)]">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}
