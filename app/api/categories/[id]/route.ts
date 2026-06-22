import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const category = await prisma.activityCategory.update({
      where: { id },
      data: {
        name: body.name,
        colorCode: body.color_code || body.colorCode,
        icon: body.icon,
      },
    });
    return NextResponse.json(serialize(category));
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}
