import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest, parseDay } from "@/lib/goal-queries";
import { TIERS } from "@/lib/my-day-queries";

export const dynamic = "force-dynamic";

/** Ticks from `from` to `to` (YYYY-MM-DD, inclusive; default: just `date`, or today). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const from = parseDay(url.searchParams.get("from") ?? date);
    const to = parseDay(url.searchParams.get("to") ?? date);
    if (!from || !to) return badRequest("give date, or from and to, as YYYY-MM-DD");
    const childId = url.searchParams.get("child_id");
    const ticks = await prisma.taskTick.findMany({
      where: { date: { gte: from, lte: to }, ...(childId ? { childId } : {}) },
      orderBy: { doneAt: "asc" },
    });
    return NextResponse.json(serialize(ticks));
  } catch (err) {
    console.error("GET ticks failed:", err);
    return NextResponse.json({ error: "Failed to fetch ticks" }, { status: 500 });
  }
}

/**
 * Ticks a task. Idempotent: ticking something already ticked keeps the original time.
 * Body: { child_id, date, item_key, title, tier, done_at?, skipped?, by? } — done_at defaults to
 * now; skipped (homework only) records a parent's "No homework this time"; by is who ticked
 * it, "child" (the default, the tablet) or "parent" (Home).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const date = parseDay(body.date);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const itemKey = typeof body.item_key === "string" ? body.item_key : "";
    if (!body.child_id || !date || !itemKey || !title) return badRequest("child_id, date, item_key and title are required");
    const tierOk = body.tier === "homework" || (TIERS.includes(body.tier) && body.tier !== "anchor");
    if (!tierOk) return badRequest("tier must be must, practice, free or homework");
    const skipped = body.tier === "homework" && body.skipped === true;
    const doneAt = body.done_at ? new Date(body.done_at) : new Date();
    if (Number.isNaN(doneAt.getTime())) return badRequest("done_at must be a timestamp");
    if (body.by !== undefined && body.by !== "child" && body.by !== "parent") return badRequest("by must be child or parent");
    const by = body.by ?? "child";

    const tick = await prisma.taskTick.upsert({
      where: { childId_date_itemKey: { childId: body.child_id, date, itemKey } },
      create: { childId: body.child_id, date, itemKey, title, tier: body.tier, doneAt, skipped, by },
      update: body.skipped === undefined ? {} : { skipped },
    });
    return NextResponse.json(serialize(tick), { status: 201 });
  } catch (err) {
    console.error("POST tick failed:", err);
    return NextResponse.json({ error: "Failed to save tick" }, { status: 500 });
  }
}

/** Unticks. Query: ?child_id=&date=&item_key= — succeeds even if it wasn't ticked. */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const date = parseDay(url.searchParams.get("date"));
    const childId = url.searchParams.get("child_id");
    const itemKey = url.searchParams.get("item_key");
    if (!childId || !date || !itemKey) return badRequest("child_id, date and item_key are required");
    await prisma.taskTick.deleteMany({ where: { childId, date, itemKey } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE tick failed:", err);
    return NextResponse.json({ error: "Failed to remove tick" }, { status: 500 });
  }
}
