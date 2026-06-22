import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const childId = url.searchParams.get("child_id");

    const where: any = {};
    if (childId) where.childId = childId;

    const milestones = await prisma.milestone.findMany({
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
    });

    return NextResponse.json(milestones || []);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch milestones" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const milestone = await prisma.milestone.create({
      data: {
        activityId: body.activity_id || body.activityId,
        childId: body.child_id || body.childId,
        date: new Date(body.date),
        milestoneType: body.milestone_type || body.milestoneType,
        title: body.title,
        description: body.description,
        result: body.result,
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
    return NextResponse.json(milestone, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create milestone" },
      { status: 500 }
    );
  }
}
