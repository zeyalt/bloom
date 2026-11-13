import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest, parseDay } from "@/lib/goal-queries";

export const dynamic = "force-dynamic";

const TIERS = ["must", "practice", "free"];
const SOURCES = ["routine", "prep", "goal", "oneoff"];

/** Saved day lists from `from` to `to` (YYYY-MM-DD, inclusive; default: just `date`). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const from = parseDay(url.searchParams.get("from") ?? date);
    const to = parseDay(url.searchParams.get("to") ?? date);
    if (!from || !to) return badRequest("give date, or from and to, as YYYY-MM-DD");
    const plans = await prisma.dayPlan.findMany({ where: { date: { gte: from, lte: to } } });
    return NextResponse.json(serialize(plans));
  } catch (err) {
    console.error("GET day-plans failed:", err);
    return NextResponse.json({ error: "Failed to fetch day lists" }, { status: 500 });
  }
}

/** Saves (replaces) a child's list for a day. Body: { child_id, date, items: PlannedTask[] }. */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const date = parseDay(body.date);
    if (!body.child_id || !date || !Array.isArray(body.items)) return badRequest("child_id, date and items are required");
    const items = [];
    for (const i of body.items) {
      const ok = i && typeof i.key === "string" && i.key && typeof i.title === "string" && i.title.trim()
        && TIERS.includes(i.tier) && i.source && SOURCES.includes(i.source.kind);
      if (!ok) return badRequest("each item needs key, title, tier (must, practice, free) and source");
      items.push({
        key: i.key.slice(0, 100), title: i.title.trim().slice(0, 255), tier: i.tier,
        source: { kind: i.source.kind, label: typeof i.source.label === "string" ? i.source.label.slice(0, 255) : null },
      });
    }
    const plan = await prisma.dayPlan.upsert({
      where: { childId_date: { childId: body.child_id, date } },
      create: { childId: body.child_id, date, items },
      update: { items },
    });
    return NextResponse.json(serialize(plan));
  } catch (err) {
    console.error("PUT day-plan failed:", err);
    return NextResponse.json({ error: "Failed to save the day list" }, { status: 500 });
  }
}
