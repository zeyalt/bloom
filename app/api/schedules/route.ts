import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const activityId = searchParams.get("activity_id");
    const activeOnly = searchParams.get("active") !== "false";

    const where: any = {};
    if (activityId) where.activityId = activityId;
    if (activeOnly) where.isActive = true;

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        activity: {
          include: {
            category: true,
            child: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(serialize(schedules));
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

// Compute minutes between two "HH:MM" times; null if either missing/invalid
function minutesBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null;
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const startTime = body.start_time || body.startTime;
    const endTime = body.end_time || body.endTime || null;
    const providedDuration = body.duration_minutes || body.durationMinutes;
    const schedule = await prisma.schedule.create({
      data: {
        activityId: body.activity_id || body.activityId,
        dayOfWeek: body.day_of_week ?? body.dayOfWeek,
        startTime: startTime,
        endTime: endTime,
        durationMinutes: providedDuration || minutesBetween(startTime, endTime),
        location: body.location || null,
        isActive: body.is_active !== undefined ? body.is_active : body.isActive !== undefined ? body.isActive : true,
        effectiveFrom: body.effective_from ? new Date(body.effective_from) : null,
        effectiveUntil: body.effective_until ? new Date(body.effective_until) : null,
        notes: body.notes,
      },
    });
    return NextResponse.json(serialize(schedule), { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}
