import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound, handleApiError } from '@/lib/api';
import { approvalSchema } from '@/lib/validation';
import { logHistory } from '@/lib/service-order-server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = approvalSchema.parse(body);

    const existing = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!existing) return notFound('Ordem de serviço não encontrada.');

    const serviceOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({
        where: { id },
        data: {
          budgetStatus: data.decision,
          budgetApprovedAt: new Date(),
          budgetApprovalNote: data.note || null,
          budgetApprovedBy: data.approvedBy || null,
          ...(data.decision === 'APROVADO' && { status: 'APROVADA' }),
        },
      });

      await logHistory(tx, {
        serviceOrderId: id,
        userId: user.id,
        action: data.decision === 'APROVADO' ? 'ORCAMENTO_APROVADO' : 'ORCAMENTO_RECUSADO',
        previousStatus: existing.status,
        newStatus: data.decision === 'APROVADO' ? 'APROVADA' : existing.status,
        note: data.note || null,
      });

      return updated;
    });

    return NextResponse.json({ serviceOrder });
  } catch (error) {
    return handleApiError(error);
  }
}
