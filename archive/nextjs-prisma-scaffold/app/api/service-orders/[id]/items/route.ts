import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound, handleApiError } from '@/lib/api';
import { itemSchema } from '@/lib/validation';
import { recalcServiceOrderTotals } from '@/lib/service-order-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = itemSchema.parse(body);

    const existing = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!existing) return notFound('Ordem de serviço não encontrada.');

    const subtotalCents = Math.max(0, data.quantity * data.unitPriceCents - data.discountCents);

    const serviceOrder = await prisma.$transaction(async (tx) => {
      await tx.serviceOrderItem.create({
        data: {
          serviceOrderId: id,
          type: data.type,
          description: data.description,
          quantity: data.quantity,
          unitPriceCents: data.unitPriceCents,
          discountCents: data.discountCents,
          subtotalCents,
        },
      });

      return recalcServiceOrderTotals(tx, id);
    });

    return NextResponse.json({ serviceOrder }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
