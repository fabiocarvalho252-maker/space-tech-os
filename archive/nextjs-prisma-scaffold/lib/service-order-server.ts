import type { Prisma, ServiceOrderStatus } from '@prisma/client';
import { calculateServiceOrderTotals } from '@/lib/service-order';

type Tx = Prisma.TransactionClient;

export async function recalcServiceOrderTotals(tx: Tx, serviceOrderId: string) {
  const [items, parts, order] = await Promise.all([
    tx.serviceOrderItem.findMany({ where: { serviceOrderId } }),
    tx.serviceOrderPart.findMany({ where: { serviceOrderId } }),
    tx.serviceOrder.findUniqueOrThrow({ where: { id: serviceOrderId } }),
  ]);

  const totals = calculateServiceOrderTotals({
    items: items.map((item) => ({ type: item.type, subtotalCents: item.subtotalCents })),
    parts: parts.map((part) => ({ subtotalCents: part.subtotalCents })),
    discountValueCents: order.discountValueCents,
    discountPercent: order.discountPercent,
    surchargeValueCents: order.surchargeValueCents,
  });

  return tx.serviceOrder.update({
    where: { id: serviceOrderId },
    data: {
      servicesTotalCents: totals.servicesTotalCents,
      laborTotalCents: totals.laborTotalCents,
      partsTotalCents: totals.partsTotalCents,
      totalValueCents: totals.totalValueCents,
    },
  });
}

export async function logHistory(
  tx: Tx,
  params: {
    serviceOrderId: string;
    userId?: string | null;
    action: string;
    previousStatus?: ServiceOrderStatus | null;
    newStatus?: ServiceOrderStatus | null;
    note?: string | null;
  }
) {
  return tx.serviceOrderHistory.create({
    data: {
      serviceOrderId: params.serviceOrderId,
      userId: params.userId ?? null,
      action: params.action,
      previousStatus: params.previousStatus ?? null,
      newStatus: params.newStatus ?? null,
      note: params.note ?? null,
    },
  });
}

export const serviceOrderInclude = {
  customer: true,
  device: true,
  items: { orderBy: { createdAt: 'asc' } },
  parts: { include: { part: true }, orderBy: { createdAt: 'asc' } },
  photos: { orderBy: { createdAt: 'asc' } },
  checklist: { orderBy: { createdAt: 'asc' } },
  history: { orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, email: true } } } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ServiceOrderInclude;
