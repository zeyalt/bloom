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
