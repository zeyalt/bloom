import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const log = await prisma.attendanceLog.update({
      where: { id },
      data: {
        activityId: body.activity_id || body.activityId,
        childId: body.child_id || body.childId,
        date: body.date ? new Date(body.date) : undefined,
        status: body.status,
        startTime: body.start_time || body.startTime || null,
        durationMinutes: body.duration_minutes ? parseInt(body.duration_minutes) : null,
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
        activity: { include: { category: true } },
        child: true,
      },
    });
    return NextResponse.json(serialize(log));
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update attendance log" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.attendanceLog.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete attendance log" },
      { status: 500 }
    );
  }
}
