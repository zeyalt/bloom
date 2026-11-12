import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest } from "@/lib/goal-queries";
import { parseUserDay } from "@/lib/my-day-queries";

export const dynamic = "force-dynamic";

/** Every calendar day — a few dozen rows a year, so the client keeps them all. */
export async function GET() {
  try {
    const days = await prisma.calendarDay.findMany({ orderBy: [{ startDate: "asc" }, { kind: "asc" }] });
    return NextResponse.json(serialize(days));
  } catch (err) {
    console.error("GET calendar-days failed:", err);
    return NextResponse.json({ error: "Failed to fetch calendar days" }, { status: 500 });
  }
}

/** A day you add by hand: { calendar_id?, start_date, end_date?, kind, title, ends_at?, levels? } */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = parseUserDay(body);
    if (typeof data === "string") return badRequest(data);
    const created = await prisma.calendarDay.create({ data: { ...data, source: "you" } });
    return NextResponse.json(serialize(created), { status: 201 });
  } catch (err) {
    console.error("POST calendar-day failed:", err);
    return NextResponse.json({ error: "Failed to add calendar day" }, { status: 500 });
  }
}
