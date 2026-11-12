import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest } from "@/lib/goal-queries";
import { parseRoutineItem } from "@/lib/my-day-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await prisma.routineItem.findMany({ orderBy: [{ childId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
    return NextResponse.json(serialize(items));
  } catch (err) {
    console.error("GET routine-items failed:", err);
    return NextResponse.json({ error: "Failed to fetch routines" }, { status: 500 });
  }
}

/** Body: { child_id, day_type, weekdays?, tier, title, at_time? } — added at the end of its list. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.child_id) return badRequest("child_id is required");
    const data = parseRoutineItem(body);
    if (typeof data === "string") return badRequest(data);
    const last = await prisma.routineItem.aggregate({ where: { childId: body.child_id }, _max: { sortOrder: true } });
    const item = await prisma.routineItem.create({
      data: { childId: body.child_id, ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    return NextResponse.json(serialize(item), { status: 201 });
  } catch (err) {
    console.error("POST routine-item failed:", err);
    return NextResponse.json({ error: "Failed to add routine item" }, { status: 500 });
  }
}
