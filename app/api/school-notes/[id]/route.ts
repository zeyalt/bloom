import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest } from "@/lib/goal-queries";
import { parseSchoolNote } from "@/lib/school-notes-queries";

export const dynamic = "force-dynamic";

/** Body: { child_id?, date, source?, text } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = parseSchoolNote(body);
    if (typeof data === "string") return badRequest(data);
    const note = await prisma.schoolNote.update({
      where: { id },
      data: { ...data, ...(typeof body.child_id === "string" && body.child_id ? { childId: body.child_id } : {}) },
    });
    return NextResponse.json(serialize(note));
  } catch (err) {
    console.error("PATCH school-note failed:", err);
    return NextResponse.json({ error: "Couldn’t update the feedback" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.schoolNote.deleteMany({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE school-note failed:", err);
    return NextResponse.json({ error: "Couldn’t remove the feedback" }, { status: 500 });
  }
}
