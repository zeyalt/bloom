import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const child = await prisma.child.update({
      where: { id },
      data: {
        name: body.name,
        nickname: body.nickname,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        school: body.school,
        colorCode: body.colorCode,
        avatarEmoji: body.avatarEmoji,
      },
    });
    return NextResponse.json(child);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update child" },
      { status: 500 }
    );
  }
}
