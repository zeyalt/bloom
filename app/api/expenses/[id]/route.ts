import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        // Relations must be set via connect (scalar FK writes are rejected on update).
        child: (body.child_id || body.childId) ? { connect: { id: body.child_id || body.childId } } : undefined,
        category: (body.category_id || body.categoryId) ? { connect: { id: body.category_id || body.categoryId } } : undefined,
        activity: (body.activity_id || body.activityId) ? { connect: { id: body.activity_id || body.activityId } } : undefined,
        institution: body.institution !== undefined ? body.institution : undefined,
        description: body.description !== undefined ? (body.description || "") : undefined,
        amount: body.amount !== undefined ? parseFloat(body.amount) : undefined,
        paymentDate: (body.payment_date || body.paymentDate) ? new Date(body.payment_date || body.paymentDate) : undefined,
        paidBy: (body.paid_by !== undefined || body.paidBy !== undefined) ? (body.paid_by ?? body.paidBy) : undefined,
        year: body.year !== undefined ? body.year : undefined,
        termStartDate: body.term_start_date !== undefined ? (body.term_start_date ? new Date(body.term_start_date) : null) : undefined,
        termEndDate: body.term_end_date !== undefined ? (body.term_end_date ? new Date(body.term_end_date) : null) : undefined,
        numLessons: body.num_lessons !== undefined ? (body.num_lessons ? parseInt(body.num_lessons) : null) : undefined,
      },
      include: {
        child: true,
        category: true,
      },
    });
    return NextResponse.json(serialize(expense));
  } catch (err) {
    console.error("PATCH expense failed:", err);
    return NextResponse.json(
      { error: "Failed to update expense" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.expense.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete expense" },
      { status: 500 }
    );
  }
}
