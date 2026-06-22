import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const dob = body.date_of_birth ?? body.dateOfBirth ?? null;
    const child = await prisma.child.update({
      where: { id },
      data: {
        name: body.name,
        nickname: body.nickname,
        dateOfBirth: dob ? new Date(dob) : null,
        school: body.school,
        colorCode: body.color_code || body.colorCode,
        avatarEmoji: body.avatar_emoji || body.avatarEmoji,
        avatarKey: body.avatar_key ?? body.avatarKey,
      },
    });
    return NextResponse.json(serialize(child));
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update child" },
      { status: 500 }
    );
  }
}
