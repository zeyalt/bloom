import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { badRequest } from "@/lib/goal-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const calendars = await prisma.schoolCalendar.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json(serialize(calendars));
  } catch (err) {
    console.error("GET calendars failed:", err);
    return NextResponse.json({ error: "Failed to fetch calendars" }, { status: 500 });
  }
}

/** A custom calendar (a preschool, another school). Body: { name } */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return badRequest("name is required");
    const calendar = await prisma.schoolCalendar.create({ data: { name, kind: "custom" } });
    return NextResponse.json(serialize(calendar), { status: 201 });
  } catch (err) {
    console.error("POST calendar failed:", err);
    return NextResponse.json({ error: "Failed to create calendar" }, { status: 500 });
  }
}
