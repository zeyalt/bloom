import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const childId = url.searchParams.get("child_id");
    const activityId = url.searchParams.get("activity_id");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: any = {};
    if (childId) where.childId = childId;
    if (activityId) where.activityId = activityId;

    const [data, count] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        include: {
          activity: {
            include: {
              category: true,
            },
          },
          child: true,
        },
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.attendanceLog.count({ where }),
    ]);

    return NextResponse.json({ data, count });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch attendance logs", data: [], count: 0 },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const log = await prisma.attendanceLog.create({
      data: {
        activityId: body.activity_id || body.activityId,
        childId: body.child_id || body.childId,
        date: new Date(body.date),
        startTime: body.start_time || body.startTime,
        durationMinutes: body.duration_minutes || body.durationMinutes,
        status: body.status,
        sentBy: body.sent_by || body.sentBy,
        instructorName: body.instructor_name || body.instructorName,
        lessonNumber: body.lesson_number || body.lessonNumber,
        level: body.level,
        location: body.location,
        diaryNotes: body.diary_notes || body.diaryNotes,
        absenceReason: body.absence_reason || body.absenceReason,
        remarks: body.remarks,
      },
      include: {
        activity: {
          include: {
            category: true,
          },
        },
        child: true,
      },
    });
    return NextResponse.json(log, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create attendance log" },
      { status: 500 }
    );
  }
}
