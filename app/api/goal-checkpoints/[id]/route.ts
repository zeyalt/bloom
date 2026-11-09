import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest, parseDay } from "@/lib/goal-queries";

/** Tick / untick a checkpoint. Body: { hit_date: "YYYY-MM-DD" | null } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    let hitDate: Date | null = null;
    if (body.hit_date !== null) {
      hitDate = parseDay(body.hit_date);
      if (!hitDate) return badRequest("hit_date must be YYYY-MM-DD or null");
    }
    const checkpoint = await prisma.goalCheckpoint.update({ where: { id }, data: { hitDate } });
    return NextResponse.json(serialize(checkpoint));
  } catch (err) {
    console.error("PATCH goal checkpoint failed:", err);
    return NextResponse.json({ error: "Failed to update checkpoint" }, { status: 500 });
  }
}
