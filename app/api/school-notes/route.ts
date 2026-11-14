import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest } from "@/lib/goal-queries";
import { parseSchoolNote } from "@/lib/school-notes-queries";

export const dynamic = "force-dynamic";

/** Every school note, newest first (all children; the Journal filters). */
export async function GET() {
  try {
    const notes = await prisma.schoolNote.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
    return NextResponse.json(serialize(notes));
  } catch (err) {
    console.error("GET school-notes failed:", err);
    return NextResponse.json({ error: "Failed to fetch school feedback" }, { status: 500 });
  }
}

/** Body: { child_id, date, source?, text } */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.child_id) return badRequest("child_id is required");
    const data = parseSchoolNote(body);
    if (typeof data === "string") return badRequest(data);
    const note = await prisma.schoolNote.create({ data: { childId: body.child_id, ...data } });
    return NextResponse.json(serialize(note), { status: 201 });
  } catch (err) {
    console.error("POST school-note failed:", err);
    return NextResponse.json({ error: "Couldn’t save the feedback" }, { status: 500 });
  }
}
