import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const childId = url.searchParams.get("child_id");
    const activityId = url.searchParams.get("activity_id");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: any = {};
    if (childId) where.childId = childId;
    if (activityId) where.activityId = activityId;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

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

    return NextResponse.json(serialize({ data, count }));
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
        startTime: body.start_time || body.startTime || null,
        durationMinutes: body.duration_minutes ? parseInt(body.duration_minutes) : null,
        status: body.status,
        sentBy: body.sent_by || body.sentBy || null,
        instructorName: body.instructor_name || body.instructorName || null,
        lessonNumber: body.lesson_number ? (parseInt(body.lesson_number) || null) : null,
        level: body.level || null,
        location: body.location || null,
        diaryNotes: body.diary_notes || body.diaryNotes || null,
        absenceReason: body.absence_reason || body.absenceReason || null,
        remarks: body.remarks || null,
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
    return NextResponse.json(serialize(log), { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create attendance log" },
      { status: 500 }
    );
  }
}
