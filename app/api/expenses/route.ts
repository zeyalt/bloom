import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const childId = url.searchParams.get("child_id");
    const year = url.searchParams.get("year");
    const paidBy = url.searchParams.get("paid_by");
    const limit = parseInt(url.searchParams.get("limit") || "200");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: any = {};
    if (childId) where.childId = childId;
    if (year) where.year = parseInt(year);
    if (paidBy) where.paidBy = paidBy;

    const [data, count] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          child: true,
          category: true,
        },
        orderBy: { paymentDate: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.expense.count({ where }),
    ]);

    return NextResponse.json({ data, count });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch expenses", data: [], count: 0 },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const expense = await prisma.expense.create({
      data: {
        childId: body.child_id || body.childId,
        categoryId: body.category_id || body.categoryId,
        activityId: body.activity_id || body.activityId,
        institution: body.institution,
        description: body.description,
        amount: parseFloat(body.amount),
        paymentDate: new Date(body.payment_date || body.paymentDate),
        paidBy: body.paid_by || body.paidBy,
        year: body.year,
        receiptNotes: body.receipt_notes || body.receiptNotes,
      },
      include: {
        child: true,
        category: true,
      },
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }
}
