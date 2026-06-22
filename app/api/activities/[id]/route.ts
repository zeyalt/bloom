import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const activity = await prisma.activity.update({
      where: { id },
      data: {
        childId: body.child_id || body.childId,
        categoryId: body.category_id || body.categoryId,
        institution: body.institution,
        instructorName: body.instructor_name || body.instructorName,
        status: body.status,
        startDate: body.start_date ? new Date(body.start_date) : undefined,
        endDate: body.end_date ? new Date(body.end_date) : undefined,
        notes: body.notes,
      },
      include: {
        category: true,
        child: true,
      },
    });
    return NextResponse.json(serialize(activity));
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update activity" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.activity.delete({
      where: { id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete activity" },
      { status: 500 }
    );
  }
}
