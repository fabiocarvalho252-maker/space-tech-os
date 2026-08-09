import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound, handleApiError } from '@/lib/api';
import { statusUpdateSchema } from '@/lib/validation';
import { logHistory } from '@/lib/service-order-server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = statusUpdateSchema.parse(body);

    const existing = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!existing) return notFound('Ordem de serviço não encontrada.');

    const serviceOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({
        where: { id },
        data: {
          status: data.status,
          ...(data.status === 'ENTREGUE' && !existing.deliveredAt && { deliveredAt: new Date() }),
        },
      });

      await logHistory(tx, {
        serviceOrderId: id,
        userId: user.id,
        action: 'ALTERACAO_STATUS',
        previousStatus: existing.status,
        newStatus: data.status,
        note: data.note || null,
      });

      return updated;
    });

    return NextResponse.json({ serviceOrder });
  } catch (error) {
    return handleApiError(error);
  }
}
