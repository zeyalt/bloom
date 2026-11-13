import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Removes a one-off task and its tick, so it disappears from that day entirely. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const task = await prisma.oneOffTask.findUnique({ where: { id } });
    if (task) {
      await prisma.$transaction([
        prisma.taskTick.deleteMany({ where: { childId: task.childId, itemKey: `oneoff:${id}` } }),
        prisma.oneOffTask.delete({ where: { id } }),
      ]);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE one-off-task failed:", err);
    return NextResponse.json({ error: "Couldn't remove the task" }, { status: 500 });
  }
}
