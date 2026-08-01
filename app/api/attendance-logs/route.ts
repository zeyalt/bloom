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
    // `limit=all` returns every matching row — used by views that must show a
    // complete history (Attendance). Any other value keeps the default cap.
    const limitParam = url.searchParams.get("limit");
    const take = limitParam === "all" ? undefined : parseInt(limitParam || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: any = {};
    if (childId) where.childId = childId;
    if (activityId) where.activityId = activityId;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    // Scalars only. The activity (with its category) and the child used to be
    // embedded on every row, repeating the same handful of objects hundreds of
    // times — ~1.4 KB per row. Both are already cached client-side by their own
    // endpoints, so `useAttendanceLogs` re-attaches them by id after fetching.
    const data = await prisma.attendanceLog.findMany({
      where,
      orderBy: { date: "desc" },
      take,
      skip: offset,
    });

    // An unlimited query already knows its own total; only a windowed one needs
    // the extra round trip.
    const count = take === undefined
      ? data.length
      : await prisma.attendanceLog.count({ where });

    return NextResponse.json(serialize({ data, count }));
  } catch {
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
        endTime: body.end_time !== undefined ? body.end_time : (body.endTime || null),
        durationMinutes: body.duration_minutes ? parseInt(body.duration_minutes) : null,
        status: body.status,
        sentBy: body.sent_by || body.sentBy || null,
        fetcher: body.fetcher || null,
        instructorName: body.instructor_name || body.instructorName || null,
        lessonType: body.lesson_type || body.lessonType || null,
        location: body.location || null,
        absenceReason: body.absence_reason || body.absenceReason || null,
        lessonNumber: body.lesson_number ? (parseInt(body.lesson_number) || null) : null,
        level: body.level || null,
        learned: body.learned || null,
        diaryNotes: body.diary_notes || body.diaryNotes || null,
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
  } catch {
    return NextResponse.json(
      { error: "Failed to create attendance log" },
      { status: 500 }
    );
  }
}
