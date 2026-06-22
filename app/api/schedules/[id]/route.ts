import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        activityId: body.activity_id || body.activityId,
        dayOfWeek: body.day_of_week || body.dayOfWeek,
        startTime: body.start_time || body.startTime,
        endTime: body.end_time || body.endTime,
        durationMinutes: body.duration_minutes || body.durationMinutes,
        location: body.location,
        isActive: body.is_active !== undefined ? body.is_active : body.isActive,
        effectiveFrom: body.effective_from ? new Date(body.effective_from) : undefined,
        effectiveUntil: body.effective_until ? new Date(body.effective_until) : undefined,
        notes: body.notes,
      },
    });
    return NextResponse.json(serialize(schedule));
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.schedule.delete({
      where: { id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 }
    );
  }
}
