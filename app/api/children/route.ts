import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const children = await prisma.child.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(children);
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
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        school: body.school,
        colorCode: body.colorCode,
        avatarEmoji: body.avatarEmoji,
      },
    });
    return NextResponse.json(child, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create child" },
      { status: 500 }
    );
  }
}
