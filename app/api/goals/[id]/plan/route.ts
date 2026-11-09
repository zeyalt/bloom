import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { GOAL_INCLUDE, badRequest, parseDay } from "@/lib/goal-queries";

/**
 * Replace a milestone goal's whole action plan (used by Save in the plan editor).
 * Body: { checkpoints: [{ due_date, text, hit_date? }] } — an empty list clears the plan.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!Array.isArray(body.checkpoints)) return badRequest("checkpoints must be an array");
    if (body.checkpoints.length > 50) return badRequest("too many checkpoints");

    const rows: { dueDate: Date; text: string; hitDate: Date | null }[] = [];
    for (const c of body.checkpoints) {
      const dueDate = parseDay(c?.due_date);
      const text = typeof c?.text === "string" ? c.text.trim().slice(0, 500) : "";
      if (!dueDate || !text) return badRequest("each checkpoint needs due_date (YYYY-MM-DD) and text");
      const hitDate = c.hit_date ? parseDay(c.hit_date) : null;
      rows.push({ dueDate, text, hitDate });
    }
    rows.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const goal = await prisma.$transaction(async tx => {
      await tx.goalCheckpoint.deleteMany({ where: { goalId: id } });
      if (rows.length) {
        await tx.goalCheckpoint.createMany({
          data: rows.map((r, i) => ({ goalId: id, dueDate: r.dueDate, text: r.text, hitDate: r.hitDate, sortOrder: i })),
        });
      }
      return tx.goal.findUniqueOrThrow({ where: { id }, include: GOAL_INCLUDE });
    });
    return NextResponse.json(serialize(goal));
  } catch (err) {
    console.error("PUT goal plan failed:", err);
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }
}
