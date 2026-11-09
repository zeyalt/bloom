import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { GOAL_INCLUDE, GOAL_KINDS, badRequest, parseDay, parseNumber } from "@/lib/goal-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const goals = await prisma.goal.findMany({
      include: GOAL_INCLUDE,
      orderBy: [{ targetDate: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(serialize(goals));
  } catch (err) {
    console.error("GET goals failed:", err);
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

/**
 * Body: { child_id, kind, title, target_date, unit?, target_value?, start_value?, start_date? }
 * A measured goal records start_value as its first reading.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const kind = body.kind;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const targetDate = parseDay(body.target_date);
    if (!body.child_id) return badRequest("child_id is required");
    if (!GOAL_KINDS.includes(kind)) return badRequest("kind must be milestone or measured");
    if (!title) return badRequest("title is required");
    if (!targetDate) return badRequest("target_date must be YYYY-MM-DD");

    let measured: { unit: string; targetValue: number; startValue: number; startDate: Date } | null = null;
    if (kind === "measured") {
      const unit = typeof body.unit === "string" ? body.unit.trim() : "";
      const targetValue = parseNumber(body.target_value);
      const startValue = parseNumber(body.start_value);
      const startDate = parseDay(body.start_date) ?? parseDay(new Date().toISOString().slice(0, 10))!;
      if (!unit || targetValue === null || startValue === null) {
        return badRequest("measured goals need unit, target_value and start_value");
      }
      measured = { unit, targetValue, startValue, startDate };
    }

    const goal = await prisma.goal.create({
      data: {
        childId: body.child_id,
        kind,
        title,
        targetDate,
        unit: measured?.unit ?? null,
        targetValue: measured?.targetValue ?? null,
        entries: measured ? { create: { date: measured.startDate, value: measured.startValue } } : undefined,
      },
      include: GOAL_INCLUDE,
    });
    return NextResponse.json(serialize(goal), { status: 201 });
  } catch (err) {
    console.error("POST goal failed:", err);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}
