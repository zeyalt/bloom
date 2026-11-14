import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest, parseDay } from "@/lib/goal-queries";

export const dynamic = "force-dynamic";

/** Edit a focus point. Body: { text?, got_date?: "YYYY-MM-DD" | null } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: { text?: string; gotDate?: Date | null } = {};
    if (body.text !== undefined) {
      const text = typeof body.text === "string" ? body.text.trim().slice(0, 300) : "";
      if (!text) return badRequest("text can’t be empty");
      data.text = text;
    }
    if (body.got_date !== undefined) {
      if (body.got_date === null) data.gotDate = null;
      else {
        const d = parseDay(body.got_date);
        if (!d) return badRequest("got_date must be YYYY-MM-DD or null");
        data.gotDate = d;
      }
    }
    const focus = await prisma.goalFocus.update({ where: { id }, data });
    return NextResponse.json(serialize(focus));
  } catch (err) {
    console.error("PATCH goal focus failed:", err);
    return NextResponse.json({ error: "Couldn’t update the focus point" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.goalFocus.deleteMany({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE goal focus failed:", err);
    return NextResponse.json({ error: "Couldn’t remove the focus point" }, { status: 500 });
  }
}
