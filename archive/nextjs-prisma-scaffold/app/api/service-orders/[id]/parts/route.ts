import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound, badRequest, handleApiError } from '@/lib/api';
import { partItemSchema } from '@/lib/validation';
import { recalcServiceOrderTotals } from '@/lib/service-order-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = partItemSchema.parse(body);

    const order = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!order) return notFound('Ordem de serviço não encontrada.');

    const part = await prisma.part.findUnique({ where: { id: data.partId } });
    if (!part) return notFound('Peça não encontrada no estoque.');

    if (part.stockQuantity < data.quantity) {
      return badRequest(`Estoque insuficiente. Disponível: ${part.stockQuantity} unidade(s).`);
    }

    const subtotalCents = data.quantity * part.salePriceCents;

    const serviceOrder = await prisma.$transaction(async (tx) => {
      await tx.serviceOrderPart.create({
        data: {
          serviceOrderId: id,
          partId: part.id,
          quantity: data.quantity,
          unitCostCents: part.costPriceCents,
          unitPriceCents: part.salePriceCents,
          subtotalCents,
        },
      });

      await tx.part.update({
        where: { id: part.id },
        data: { stockQuantity: { decrement: data.quantity } },
      });

      return recalcServiceOrderTotals(tx, id);
    });

    return NextResponse.json({ serviceOrder }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
