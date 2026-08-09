import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound, badRequest, handleApiError } from '@/lib/api';
import { recalcServiceOrderTotals } from '@/lib/service-order-server';

type Params = { params: Promise<{ id: string; partId: string }> };

const updateSchema = z.object({
  quantity: z.number().int().min(1, 'Quantidade deve ser maior que zero.'),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id, partId } = await params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const orderPart = await prisma.serviceOrderPart.findUnique({
      where: { id: partId },
      include: { part: true },
    });
    if (!orderPart || orderPart.serviceOrderId !== id) return notFound('Peça não encontrada na OS.');

    const delta = data.quantity - orderPart.quantity;

    if (delta > 0 && orderPart.part.stockQuantity < delta) {
      return badRequest(`Estoque insuficiente. Disponível: ${orderPart.part.stockQuantity} unidade(s).`);
    }

    const subtotalCents = data.quantity * orderPart.unitPriceCents;

    const serviceOrder = await prisma.$transaction(async (tx) => {
      await tx.serviceOrderPart.update({
        where: { id: partId },
        data: { quantity: data.quantity, subtotalCents },
      });

      if (delta !== 0) {
        await tx.part.update({
          where: { id: orderPart.partId },
          data: { stockQuantity: { decrement: delta } },
        });
      }

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

  const { id, partId } = await params;

  const orderPart = await prisma.serviceOrderPart.findUnique({ where: { id: partId } });
  if (!orderPart || orderPart.serviceOrderId !== id) return notFound('Peça não encontrada na OS.');

  const serviceOrder = await prisma.$transaction(async (tx) => {
    await tx.serviceOrderPart.delete({ where: { id: partId } });
    await tx.part.update({
      where: { id: orderPart.partId },
      data: { stockQuantity: { increment: orderPart.quantity } },
    });
    return recalcServiceOrderTotals(tx, id);
  });

  return NextResponse.json({ serviceOrder });
}
