import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { GOAL_INCLUDE, badRequest, parseDay, parseNumber } from "@/lib/goal-queries";

/** Body (all optional): { title, target_date, target_value, unit, achieved_date (YYYY-MM-DD | null) } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return badRequest("title cannot be empty");
      data.title = title;
    }
    if (body.target_date !== undefined) {
      const d = parseDay(body.target_date);
      if (!d) return badRequest("target_date must be YYYY-MM-DD");
      data.targetDate = d;
    }
    if (body.target_value !== undefined) {
      const n = parseNumber(body.target_value);
      if (n === null) return badRequest("target_value must be a number");
      data.targetValue = n;
    }
    if (body.unit !== undefined) data.unit = typeof body.unit === "string" ? body.unit.trim() : null;
    if (body.achieved_date !== undefined) {
      if (body.achieved_date === null) data.achievedDate = null;
      else {
        const d = parseDay(body.achieved_date);
        if (!d) return badRequest("achieved_date must be YYYY-MM-DD or null");
        data.achievedDate = d;
      }
    }

    const goal = await prisma.goal.update({ where: { id }, data, include: GOAL_INCLUDE });
    return NextResponse.json(serialize(goal));
  } catch (err) {
    console.error("PATCH goal failed:", err);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.goal.delete({ where: { id } }); // checkpoints + entries cascade
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE goal failed:", err);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
