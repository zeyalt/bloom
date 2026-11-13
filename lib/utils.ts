import { format, parseISO } from "date-fns";

// Format currency in SGD — always two decimal places (e.g. $1,253.00)
export function formatCurrency(amount: number): string {
  const formatted = amount.toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted}`;
}

// Display date as "24 May 2026"
export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "d MMM yyyy");
  } catch {
    return dateStr;
  }
}

// Format time "14:30:00" → "2:30 PM"
export function formatTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const min = m.padStart(2, "0");
    const period = hour >= 12 ? "PM" : "AM";
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${String(display).padStart(2, "0")}:${min} ${period}`;
  } catch {
    return timeStr;
  }
}

// Merge class names (lightweight clsx)
/** "1 session", "3 sessions". */
export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Get current year
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

// Calculate age from a date-of-birth string → "8 yrs 3 mos" (or "5 mos" under 1 year)
export function calcAge(dobStr: string): string {
  try {
    const dob = parseISO(dobStr);
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    if (now.getDate() < dob.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    if (years < 0) return "";
    if (years === 0) return `${months} mo${months === 1 ? "" : "s"}`;
    return `${years} yr${years === 1 ? "" : "s"} ${months} mo${months === 1 ? "" : "s"}`;
  } catch {
    return "";
  }
}

/**
 * Pulls a saved colour (a child's or a category's) into Bloom's muted range for charts:
 * the hue stays, so each series is still told apart, but saturation and lightness are
 * capped so the charts sit with the paper-and-ink palette instead of shouting over it.
 */
export function harmonize(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const L = (max + min) / 2;
  const S = d === 0 ? 0 : d / (1 - Math.abs(2 * L - 1));
  const s = Math.min(S, 0.46), l = Math.min(Math.max(L, 0.34), 0.5);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), mm = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + mm) * 255).toString(16).padStart(2, "0");
  return `#${to(r1)}${to(g1)}${to(b1)}`;
}
