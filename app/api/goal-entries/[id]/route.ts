import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest, parseDay, parseNumber } from "@/lib/goal-queries";

/** Fix an update or reading. Body (all optional): { date, note, value } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: { date?: Date; note?: string | null; value?: number | null } = {};
    if (body.date !== undefined) {
      const d = parseDay(body.date);
      if (!d) return badRequest("date must be YYYY-MM-DD");
      data.date = d;
    }
    if (body.note !== undefined) data.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    if (body.value !== undefined) {
      if (body.value === null) data.value = null;
      else {
        const n = parseNumber(body.value);
        if (n === null) return badRequest("value must be a number");
        data.value = n;
      }
    }
    const entry = await prisma.goalEntry.update({ where: { id }, data });
    return NextResponse.json(serialize(entry));
  } catch (err) {
    console.error("PATCH goal entry failed:", err);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.goalEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE goal entry failed:", err);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
