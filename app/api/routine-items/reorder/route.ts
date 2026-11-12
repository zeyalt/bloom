import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/goal-queries";

export const dynamic = "force-dynamic";

/** Body: { ids: string[] } — the new order; each item's sort_order becomes its position. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string") : [];
    if (!ids.length) return badRequest("ids is required");
    await prisma.$transaction(ids.map((id: string, i: number) =>
      prisma.routineItem.updateMany({ where: { id }, data: { sortOrder: i } })
    ));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST routine-items/reorder failed:", err);
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
