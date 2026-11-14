import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { GOAL_INCLUDE, badRequest, parseDay } from "@/lib/goal-queries";

/**
 * Replace a milestone goal's whole action plan (used by Save in the plan editor).
 * Body: { checkpoints: [{ id?, due_date, text, hit_date? }] } — an empty list clears the plan.
 * A row with an id updates that checkpoint in place, so its focus points are kept;
 * rows without an id are new; checkpoints left out are removed.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!Array.isArray(body.checkpoints)) return badRequest("checkpoints must be an array");
    if (body.checkpoints.length > 50) return badRequest("too many checkpoints");

    const rows: { id: string | null; dueDate: Date; text: string; hitDate: Date | null }[] = [];
    for (const c of body.checkpoints) {
      const dueDate = parseDay(c?.due_date);
      const text = typeof c?.text === "string" ? c.text.trim().slice(0, 500) : "";
      if (!dueDate || !text) return badRequest("each checkpoint needs due_date (YYYY-MM-DD) and text");
      const hitDate = c.hit_date ? parseDay(c.hit_date) : null;
      rows.push({ id: typeof c.id === "string" && c.id ? c.id : null, dueDate, text, hitDate });
    }
    rows.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const goal = await prisma.$transaction(async tx => {
      const existing = new Set((await tx.goalCheckpoint.findMany({ where: { goalId: id }, select: { id: true } })).map(c => c.id));
      const keep = rows.filter(r => r.id && existing.has(r.id)).map(r => r.id!);
      await tx.goalCheckpoint.deleteMany({ where: { goalId: id, id: { notIn: keep } } });
      for (const [i, r] of rows.entries()) {
        const data = { dueDate: r.dueDate, text: r.text, hitDate: r.hitDate, sortOrder: i };
        if (r.id && existing.has(r.id)) await tx.goalCheckpoint.update({ where: { id: r.id }, data });
        else await tx.goalCheckpoint.create({ data: { goalId: id, ...data } });
      }
      return tx.goal.findUniqueOrThrow({ where: { id }, include: GOAL_INCLUDE });
    });
    return NextResponse.json(serialize(goal));
  } catch (err) {
    console.error("PUT goal plan failed:", err);
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }
}
