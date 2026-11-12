import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest } from "@/lib/goal-queries";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return badRequest("name is required");
    const calendar = await prisma.schoolCalendar.update({ where: { id }, data: { name } });
    return NextResponse.json(serialize(calendar));
  } catch (err) {
    console.error("PATCH calendar failed:", err);
    return NextResponse.json({ error: "Failed to update calendar" }, { status: 500 });
  }
}

/** Custom calendars only; children who followed it are left with no calendar. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cal = await prisma.schoolCalendar.findUnique({ where: { id } });
    if (!cal) return NextResponse.json({ success: true });
    if (cal.kind !== "custom") return badRequest("the MOE calendar can't be deleted");
    await prisma.schoolCalendar.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE calendar failed:", err);
    return NextResponse.json({ error: "Failed to delete calendar" }, { status: 500 });
  }
}
