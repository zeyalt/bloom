import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest, parseDay, parseNumber } from "@/lib/goal-queries";

/** Add an update (note) or a reading (value). Body: { date, note? , value? } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const date = parseDay(body.date);
    if (!date) return badRequest("date must be YYYY-MM-DD");
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    const value = body.value !== undefined && body.value !== null ? parseNumber(body.value) : null;
    if (body.value !== undefined && body.value !== null && value === null) return badRequest("value must be a number");
    if (note === null && value === null) return badRequest("an entry needs a note or a value");

    const entry = await prisma.goalEntry.create({ data: { goalId: id, date, note, value } });
    return NextResponse.json(serialize(entry), { status: 201 });
  } catch (err) {
    console.error("POST goal entry failed:", err);
    return NextResponse.json({ error: "Failed to add entry" }, { status: 500 });
  }
}
