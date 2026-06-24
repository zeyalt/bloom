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

// Display date compactly as "24/05/26"
export function formatDateShort(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd/MM/yy");
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
    return `${display}:${min} ${period}`;
  } catch {
    return timeStr;
  }
}

// Merge class names (lightweight clsx)
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Hex color → rgba with opacity
export function hexToRgba(hex: string, opacity: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Get current year
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

// Calculate attendance rate
export function calcAttendanceRate(attended: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((attended / total) * 100);
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
