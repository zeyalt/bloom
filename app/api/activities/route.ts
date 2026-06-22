import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json(activities);
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
        institution: body.institution,
        instructorName: body.instructor_name || body.instructorName,
        status: body.status || "active",
        startDate: new Date(body.start_date || body.startDate),
        endDate: new Date(body.end_date || body.endDate),
        notes: body.notes,
      },
      include: {
        category: true,
        child: true,
      },
    });
    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create activity" },
      { status: 500 }
    );
  }
}
