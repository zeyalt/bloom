import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const childId = searchParams.get("child_id");
    const status = searchParams.get("status");

    const where: any = {};
    if (childId) where.childId = childId;
    if (status) where.status = status;

    const activities = await prisma.activity.findMany({
      where,
      include: {
        category: true,
        child: true,
      },
      orderBy: [{ status: "asc" }, { institution: "asc" }],
    });

    return NextResponse.json(serialize(activities));
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const activity = await prisma.activity.create({
      data: {
        childId: body.child_id || body.childId,
        categoryId: body.category_id || body.categoryId,
        activityName: body.activity_name || body.activityName || null,
        institution: body.institution,
        instructorName: body.instructor_name || body.instructorName,
        status: body.status || "active",
        startDate: body.start_date ? new Date(body.start_date) : (body.startDate ? new Date(body.startDate) : null),
        endDate: body.end_date ? new Date(body.end_date) : (body.endDate ? new Date(body.endDate) : null),
        notes: body.notes,
      },
      include: {
        category: true,
        child: true,
      },
    });
    return NextResponse.json(serialize(activity), { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create activity" },
      { status: 500 }
    );
  }
}
