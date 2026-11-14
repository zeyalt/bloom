// Server-side validation for /api/school-notes.
import { parseDay } from "./goal-queries";

/** Shared validation for create and edit. Returns Prisma data or an error message. */
export function parseSchoolNote(body: Record<string, unknown>) {
  const date = parseDay(body.date);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim().slice(0, 120) : null;
  if (!date) return "date must be YYYY-MM-DD";
  if (!text) return "Write the feedback first.";
  if (text.length > 5000) return "That’s too long (5,000 characters at most).";
  return { date, text, source };
}
