import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest } from "@/lib/goal-queries";

export const dynamic = "force-dynamic";

/** Add a focus point under a checkpoint. Body: { text } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 300) : "";
    if (!text) return badRequest("text is required");
    const last = await prisma.goalFocus.aggregate({ where: { checkpointId: id }, _max: { sortOrder: true } });
    const focus = await prisma.goalFocus.create({
      data: { checkpointId: id, text, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    return NextResponse.json(serialize(focus), { status: 201 });
  } catch (err) {
    console.error("POST goal focus failed:", err);
    return NextResponse.json({ error: "Couldn’t add the focus point" }, { status: 500 });
  }
}
