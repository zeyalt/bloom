// Colour helpers for tinted cells (heatmaps): blend a colour onto the page and pick
// the text colour that actually reads on the result.

const SHEET = "#f7faf6"; // --sheet
const INK = "#1a2c22";   // --ink
const WHITE = "#ffffff";

function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** `color` laid over the sheet at `alpha` (0–1), as a solid hex. */
export function tint(color: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha));
  const c = rgb(color), s = rgb(SHEET);
  return toHex([0, 1, 2].map(i => c[i] * a + s[i] * (1 - a)) as [number, number, number]);
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Ink or white, whichever has more contrast on `background`. */
export function readableText(background: string): string {
  return contrast(background, WHITE) > contrast(background, INK) ? WHITE : INK;
}
