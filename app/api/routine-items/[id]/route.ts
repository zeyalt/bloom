import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest } from "@/lib/goal-queries";
import { parseRoutineItem } from "@/lib/my-day-queries";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = parseRoutineItem(await req.json());
    if (typeof data === "string") return badRequest(data);
    const item = await prisma.routineItem.update({ where: { id }, data });
    return NextResponse.json(serialize(item));
  } catch (err) {
    console.error("PATCH routine-item failed:", err);
    return NextResponse.json({ error: "Failed to update routine item" }, { status: 500 });
  }
}

/** Past ticks keep their copied title, so the log still reads right after a delete. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.routineItem.deleteMany({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE routine-item failed:", err);
    return NextResponse.json({ error: "Failed to delete routine item" }, { status: 500 });
  }
}
