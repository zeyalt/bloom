import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const log = await prisma.attendanceLog.update({
      where: { id },
      data: {
        // Prisma in this project rejects scalar FK writes (activityId/childId)
        // on update — must go through the relation with connect.
        activity: body.activity_id ? { connect: { id: body.activity_id } } : undefined,
        child: body.child_id ? { connect: { id: body.child_id } } : undefined,
        date: body.date ? new Date(body.date) : undefined,
        status: body.status ?? undefined,
        startTime: body.start_time !== undefined ? body.start_time : undefined,
        endTime: body.end_time !== undefined ? body.end_time : undefined,
        sentBy: body.sent_by !== undefined ? body.sent_by : undefined,
        instructorName: body.instructor_name !== undefined ? body.instructor_name : undefined,
        lessonType: body.lesson_type !== undefined ? body.lesson_type : undefined,
        location: body.location !== undefined ? body.location : undefined,
        absenceReason: body.absence_reason !== undefined ? body.absence_reason : undefined,
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
    return NextResponse.json(serialize(log));
  } catch (err) {
    console.error("PATCH attendance-log failed:", err);
    return NextResponse.json(
      { error: "Failed to update attendance log" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.attendanceLog.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete attendance log" },
      { status: 500 }
    );
  }
}
