import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json(schedules);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const schedule = await prisma.schedule.create({
      data: {
        activityId: body.activity_id || body.activityId,
        dayOfWeek: body.day_of_week || body.dayOfWeek,
        startTime: body.start_time || body.startTime,
        endTime: body.end_time || body.endTime,
        durationMinutes: body.duration_minutes || body.durationMinutes,
        location: body.location,
        isActive: body.is_active !== undefined ? body.is_active : body.isActive !== undefined ? body.isActive : true,
        effectiveFrom: body.effective_from ? new Date(body.effective_from) : null,
        effectiveUntil: body.effective_until ? new Date(body.effective_until) : null,
        notes: body.notes,
      },
    });
    return NextResponse.json(schedule, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}
