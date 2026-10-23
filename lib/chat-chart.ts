// Chart specs the Chat agent can attach to an answer. The model fills these in via
// its show_chart tool; the client draws them in the app's own style.

export type ValueFormat = "currency" | "hours" | "number" | "percent";

export type ChartSpec =
  | { type: "stats"; title?: string; format: ValueFormat; stats: { label: string; value: number; note?: string }[] }
  | { type: "bar"; title: string; format: ValueFormat; items: { label: string; value: number; child?: string }[] }
  | { type: "donut"; title: string; format: ValueFormat; items: { label: string; value: number; child?: string }[] }
  | { type: "line"; title: string; format: ValueFormat; x: string[]; series: { name: string; values: number[]; child?: string }[] };

const FORMATS: ValueFormat[] = ["currency", "hours", "number", "percent"];
const MAX_POINTS = 40;

const str = (v: unknown, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function items(raw: unknown) {
  if (!Array.isArray(raw)) return null;
  const out = raw.slice(0, MAX_POINTS).flatMap(r => {
    const label = str(r?.label);
    const value = num(r?.value);
    return label && value !== undefined ? [{ label, value, child: str(r?.child) }] : [];
  });
  return out.length ? out : null;
}

/** Validate a show_chart tool input. Returns the spec, or an error message for the model. */
export function parseChartSpec(input: unknown): ChartSpec | string {
  const i = (input ?? {}) as Record<string, unknown>;
  const format = FORMATS.includes(i.format as ValueFormat) ? (i.format as ValueFormat) : "number";
  const title = str(i.title, 100);

  switch (i.type) {
    case "stats": {
      const stats = Array.isArray(i.stats)
        ? i.stats.slice(0, 6).flatMap(s => {
            const label = str(s?.label);
            const value = num(s?.value);
            return label && value !== undefined ? [{ label, value, note: str(s?.note, 60) }] : [];
          })
        : [];
      return stats.length ? { type: "stats", title, format, stats } : "stats needs 1–6 entries with a label and a numeric value.";
    }
    case "bar":
    case "donut": {
      const list = items(i.items);
      if (!list) return `${i.type} needs items: [{label, value}] with numeric values.`;
      if (!title) return `${i.type} needs a title.`;
      return { type: i.type, title, format, items: list };
    }
    case "line": {
      const x = Array.isArray(i.x) ? i.x.slice(0, MAX_POINTS).map(v => String(v).slice(0, 20)) : [];
      const series = Array.isArray(i.series)
        ? i.series.slice(0, 6).flatMap(s => {
            const name = str(s?.name);
            const values = Array.isArray(s?.values) ? s.values.slice(0, x.length).map((v: unknown) => num(v) ?? 0) : [];
            return name && values.length === x.length ? [{ name, values, child: str(s?.child) }] : [];
          })
        : [];
      if (x.length < 2 || !series.length) return "line needs x (2+ labels) and series whose values match x in length.";
      if (!title) return "line needs a title.";
      return { type: "line", title, format, x, series };
    }
    default:
      return "type must be one of: stats, bar, donut, line.";
  }
}

export function formatValue(v: number, format: ValueFormat): string {
  switch (format) {
    case "currency":
      return `$${v.toLocaleString("en-SG", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
    case "hours":
      return `${Number(v.toFixed(1))}h`;
    case "percent":
      return `${Math.round(v)}%`;
    default:
      return v.toLocaleString("en-SG", { maximumFractionDigits: 1 });
  }
}
