// Server-side helpers shared by the /api/goals routes.
import type { Prisma } from "@prisma/client";

/** Every goal response carries its checkpoints (plan order) and entries (oldest first). */
export const GOAL_INCLUDE = {
  checkpoints: {
    orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
    include: { focus: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  },
  entries: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
} satisfies Prisma.GoalInclude;

export const GOAL_KINDS = ["milestone", "measured"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" → Date at UTC midnight (how every DATE column in Bloom is written). */
export function parseDay(value: unknown): Date | null {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}
