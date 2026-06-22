import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const children = await prisma.child.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(serialize(children));
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch children" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const child = await prisma.child.create({
      data: {
        name: body.name,
        nickname: body.nickname,
        dateOfBirth: (body.date_of_birth || body.dateOfBirth) ? new Date(body.date_of_birth || body.dateOfBirth) : null,
        school: body.school,
        colorCode: body.color_code || body.colorCode,
        avatarEmoji: body.avatar_emoji || body.avatarEmoji,
        avatarKey: body.avatar_key ?? body.avatarKey,
      },
    });
    return NextResponse.json(serialize(child), { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create child" },
      { status: 500 }
    );
  }
}
