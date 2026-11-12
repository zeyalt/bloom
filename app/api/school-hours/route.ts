import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest } from "@/lib/goal-queries";
import { optionalText, parseTime } from "@/lib/my-day-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.schoolHours.findMany({ orderBy: [{ childId: "asc" }, { dayOfWeek: "asc" }] });
    return NextResponse.json(serialize(rows));
  } catch (err) {
    console.error("GET school-hours failed:", err);
    return NextResponse.json({ error: "Failed to fetch school hours" }, { status: 500 });
  }
}

/**
 * Saves a child's whole week in one go.
 * Body: { child_id, days: [{ day_of_week, is_school_day, start_time, end_time, after_school }] }
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const childId = body.child_id;
    if (!childId || !Array.isArray(body.days)) return badRequest("child_id and days are required");

    const days = [];
    for (const d of body.days) {
      const dow = Number(d.day_of_week);
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) return badRequest("day_of_week must be 0–6");
      const on = !!d.is_school_day;
      const start = parseTime(d.start_time);
      const end = parseTime(d.end_time);
      if (start === undefined || end === undefined) return badRequest("times must be HH:MM");
      if (on && start && end && end <= start) return badRequest("school must end after it starts");
      days.push({
        dayOfWeek: dow,
        isSchoolDay: on,
        startTime: on ? start : null,
        endTime: on ? end : null,
        afterSchool: on ? optionalText(d.after_school) ?? null : null,
      });
    }

    const rows = await prisma.$transaction(days.map(d =>
      prisma.schoolHours.upsert({
        where: { childId_dayOfWeek: { childId, dayOfWeek: d.dayOfWeek } },
        create: { childId, ...d },
        update: d,
      })
    ));
    return NextResponse.json(serialize(rows));
  } catch (err) {
    console.error("PUT school-hours failed:", err);
    return NextResponse.json({ error: "Failed to save school hours" }, { status: 500 });
  }
}
