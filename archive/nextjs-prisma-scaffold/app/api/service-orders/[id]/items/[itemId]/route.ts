import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound, handleApiError } from '@/lib/api';
import { itemSchema } from '@/lib/validation';
import { recalcServiceOrderTotals } from '@/lib/service-order-server';

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id, itemId } = await params;

  try {
    const body = await request.json();
    const data = itemSchema.parse(body);

    const item = await prisma.serviceOrderItem.findUnique({ where: { id: itemId } });
    if (!item || item.serviceOrderId !== id) return notFound('Item não encontrado.');

    const subtotalCents = Math.max(0, data.quantity * data.unitPriceCents - data.discountCents);

    const serviceOrder = await prisma.$transaction(async (tx) => {
      await tx.serviceOrderItem.update({
        where: { id: itemId },
        data: {
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

    return NextResponse.json({ serviceOrder });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id, itemId } = await params;

  const item = await prisma.serviceOrderItem.findUnique({ where: { id: itemId } });
  if (!item || item.serviceOrderId !== id) return notFound('Item não encontrado.');

  const serviceOrder = await prisma.$transaction(async (tx) => {
    await tx.serviceOrderItem.delete({ where: { id: itemId } });
    return recalcServiceOrderTotals(tx, id);
  });

  return NextResponse.json({ serviceOrder });
}
