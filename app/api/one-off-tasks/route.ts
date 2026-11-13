import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest, parseDay } from "@/lib/goal-queries";

export const dynamic = "force-dynamic";

const TIERS = ["must", "practice", "free"];

/** One-off tasks from `from` to `to` (YYYY-MM-DD, inclusive; default: just `date`), all children. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const from = parseDay(url.searchParams.get("from") ?? date);
    const to = parseDay(url.searchParams.get("to") ?? date);
    if (!from || !to) return badRequest("give date, or from and to, as YYYY-MM-DD");
    const tasks = await prisma.oneOffTask.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(serialize(tasks));
  } catch (err) {
    console.error("GET one-off-tasks failed:", err);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

/** Adds a task for one child on one date. Body: { child_id, date, title, tier }. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const date = parseDay(body.date);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!body.child_id || !date || !title) return badRequest("child_id, date and title are required");
    if (!TIERS.includes(body.tier)) return badRequest("tier must be must, practice or free");
    const task = await prisma.oneOffTask.create({
      data: { childId: body.child_id, date, title: title.slice(0, 255), tier: body.tier },
    });
    return NextResponse.json(serialize(task), { status: 201 });
  } catch (err) {
    console.error("POST one-off-task failed:", err);
    return NextResponse.json({ error: "Couldn't add the task" }, { status: 500 });
  }
}
