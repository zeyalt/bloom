import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await prisma.activityCategory.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(serialize(categories));
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const category = await prisma.activityCategory.create({
      data: {
        name: body.name,
        colorCode: body.color_code || body.colorCode,
        icon: body.icon,
      },
    });
    return NextResponse.json(serialize(category), { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
