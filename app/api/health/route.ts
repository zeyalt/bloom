import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const children = await prisma.child.findMany({ take: 1 });

    return NextResponse.json({
      status: "ok",
      message: "Database connection successful",
      data: children,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: "Health check failed",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
