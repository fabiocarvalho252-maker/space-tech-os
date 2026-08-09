import type { Prisma } from '@prisma/client';
import type { serviceOrderInclude } from '@/lib/service-order-server';

export type ServiceOrderListItem = Prisma.ServiceOrderGetPayload<{
  include: {
    customer: { select: { name: true; phone: true; whatsapp: true } };
    device: { select: { brand: true; model: true; imei1: true } };
  };
}>;

export type ServiceOrderDetail = Prisma.ServiceOrderGetPayload<{
  include: typeof serviceOrderInclude;
}>;

export type CustomerRecord = Prisma.CustomerGetPayload<Record<string, never>>;
export type PartRecord = Prisma.PartGetPayload<Record<string, never>>;
