import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest } from "@/lib/goal-queries";
import { parseUserDay } from "@/lib/my-day-queries";

export const dynamic = "force-dynamic";

/** Only days you added can be changed; imported MOE and public-holiday days are fixed. */
async function ownDay(id: string) {
  const day = await prisma.calendarDay.findUnique({ where: { id } });
  if (day && day.source !== "you") return { day, error: badRequest("imported days can't be changed") };
  return { day, error: null };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { day, error } = await ownDay(id);
    if (error) return error;
    if (!day) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = parseUserDay(await req.json());
    if (typeof data === "string") return badRequest(data);
    const updated = await prisma.calendarDay.update({ where: { id }, data });
    return NextResponse.json(serialize(updated));
  } catch (err) {
    console.error("PATCH calendar-day failed:", err);
    return NextResponse.json({ error: "Failed to update calendar day" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await ownDay(id);
    if (error) return error;
    await prisma.calendarDay.deleteMany({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE calendar-day failed:", err);
    return NextResponse.json({ error: "Failed to delete calendar day" }, { status: 500 });
  }
}
