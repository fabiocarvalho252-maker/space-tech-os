import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, handleApiError } from '@/lib/api';
import { serviceOrderCreateSchema } from '@/lib/validation';
import { logHistory } from '@/lib/service-order-server';
import { DEFAULT_CHECKLIST } from '@/lib/service-order';
import type { ChecklistCategory, Prisma, ServiceOrderStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const params = request.nextUrl.searchParams;
  const q = params.get('q')?.trim();
  const status = params.get('status') as ServiceOrderStatus | 'TODAS' | null;
  const sort = params.get('sort') === 'asc' ? 'asc' : 'desc';

  const where: Prisma.ServiceOrderWhereInput = {};

  if (status && status !== 'TODAS') {
    where.status = status;
  }

  if (q) {
    const numeric = Number.parseInt(q.replace(/\D/g, ''), 10);
    where.OR = [
      { customer: { name: { contains: q, mode: 'insensitive' } } },
      { customer: { phone: { contains: q } } },
      { customer: { whatsapp: { contains: q } } },
      { device: { imei1: { contains: q } } },
      { device: { imei2: { contains: q } } },
      { device: { model: { contains: q, mode: 'insensitive' } } },
      { device: { brand: { contains: q, mode: 'insensitive' } } },
      ...(Number.isFinite(numeric) && numeric > 0 ? [{ number: numeric }] : []),
    ];
  }

  const serviceOrders = await prisma.serviceOrder.findMany({
    where,
    orderBy: { entryDate: sort },
    include: {
      customer: { select: { name: true, phone: true, whatsapp: true } },
      device: { select: { brand: true, model: true, imei1: true } },
    },
    take: 200,
  });

  return NextResponse.json({ serviceOrders });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const data = serviceOrderCreateSchema.parse(body);

    const serviceOrder = await prisma.$transaction(async (tx) => {
      let customerId = data.customerId ?? undefined;

      if (!customerId && data.customer) {
        const customer = await tx.customer.create({
          data: {
            name: data.customer.name,
            documentId: data.customer.documentId || null,
            phone: data.customer.phone,
            whatsapp: data.customer.whatsapp || null,
            email: data.customer.email || null,
            address: data.customer.address || null,
            city: data.customer.city || null,
            state: data.customer.state || null,
            zipCode: data.customer.zipCode || null,
            notes: data.customer.notes || null,
          },
        });
        customerId = customer.id;
      }

      if (!customerId) {
        throw new Error('Cliente não informado.');
      }

      const customerExists = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customerExists) throw new Error('Cliente não encontrado.');

      const device = await tx.device.create({
        data: {
          type: data.device.type || null,
          brand: data.device.brand,
          model: data.device.model,
          color: data.device.color || null,
          imei1: data.device.imei1 || null,
          imei2: data.device.imei2 || null,
          serialNumber: data.device.serialNumber || null,
          storageCapacity: data.device.storageCapacity || null,
          devicePassword: data.device.devicePassword || null,
          unlockPattern: data.device.unlockPattern || null,
          condition: data.device.condition,
          physicalNotes: data.device.physicalNotes || null,
        },
      });

      const order = await tx.serviceOrder.create({
        data: {
          customerId,
          deviceId: device.id,
          status: 'ABERTA',
          reportedIssue: data.reportedIssue,
          diagnosis: data.diagnosis || null,
          serviceToPerform: data.serviceToPerform || null,
          internalNotes: data.internalNotes || null,
          estimatedDeliveryDate: data.estimatedDeliveryDate ? new Date(data.estimatedDeliveryDate) : null,
          termsAccepted: data.termsAccepted,
          createdById: user.id,
        },
      });

      const checklistMap = new Map(data.checklist.map((item) => [`${item.category}::${item.label}`, item.checked]));

      const checklistRows = (Object.entries(DEFAULT_CHECKLIST) as [ChecklistCategory, string[]][]).flatMap(
        ([category, labels]) =>
          labels.map((label) => ({
            serviceOrderId: order.id,
            category,
            label,
            checked: checklistMap.get(`${category}::${label}`) ?? false,
          }))
      );

      await tx.serviceOrderChecklistItem.createMany({ data: checklistRows });

      await logHistory(tx, {
        serviceOrderId: order.id,
        userId: user.id,
        action: 'CRIACAO',
        newStatus: 'ABERTA',
        note: 'Ordem de serviço criada.',
      });

      return order;
    });

    return NextResponse.json({ serviceOrder }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
