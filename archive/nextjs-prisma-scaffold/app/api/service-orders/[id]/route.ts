import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound, handleApiError } from '@/lib/api';
import { serviceOrderUpdateSchema } from '@/lib/validation';
import { recalcServiceOrderTotals, serviceOrderInclude } from '@/lib/service-order-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const serviceOrder = await prisma.serviceOrder.findUnique({
    where: { id },
    include: serviceOrderInclude,
  });

  if (!serviceOrder) return notFound('Ordem de serviço não encontrada.');
  return NextResponse.json({ serviceOrder });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = serviceOrderUpdateSchema.parse(body);

    const existing = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!existing) return notFound('Ordem de serviço não encontrada.');

    const serviceOrder = await prisma.$transaction(async (tx) => {
      if (data.device) {
        await tx.device.update({
          where: { id: existing.deviceId },
          data: {
            ...(data.device.type !== undefined && { type: data.device.type || null }),
            ...(data.device.brand !== undefined && { brand: data.device.brand }),
            ...(data.device.model !== undefined && { model: data.device.model }),
            ...(data.device.color !== undefined && { color: data.device.color || null }),
            ...(data.device.imei1 !== undefined && { imei1: data.device.imei1 || null }),
            ...(data.device.imei2 !== undefined && { imei2: data.device.imei2 || null }),
            ...(data.device.serialNumber !== undefined && { serialNumber: data.device.serialNumber || null }),
            ...(data.device.storageCapacity !== undefined && { storageCapacity: data.device.storageCapacity || null }),
            ...(data.device.devicePassword !== undefined && { devicePassword: data.device.devicePassword || null }),
            ...(data.device.unlockPattern !== undefined && { unlockPattern: data.device.unlockPattern || null }),
            ...(data.device.condition !== undefined && { condition: data.device.condition }),
            ...(data.device.physicalNotes !== undefined && { physicalNotes: data.device.physicalNotes || null }),
          },
        });
      }

      if (data.customer && existing.customerId) {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: {
            ...(data.customer.name !== undefined && { name: data.customer.name }),
            ...(data.customer.documentId !== undefined && { documentId: data.customer.documentId || null }),
            ...(data.customer.phone !== undefined && { phone: data.customer.phone }),
            ...(data.customer.whatsapp !== undefined && { whatsapp: data.customer.whatsapp || null }),
            ...(data.customer.email !== undefined && { email: data.customer.email || null }),
            ...(data.customer.address !== undefined && { address: data.customer.address || null }),
            ...(data.customer.city !== undefined && { city: data.customer.city || null }),
            ...(data.customer.state !== undefined && { state: data.customer.state || null }),
            ...(data.customer.zipCode !== undefined && { zipCode: data.customer.zipCode || null }),
            ...(data.customer.notes !== undefined && { notes: data.customer.notes || null }),
          },
        });
      }

      await tx.serviceOrder.update({
        where: { id },
        data: {
          ...(data.reportedIssue !== undefined && { reportedIssue: data.reportedIssue }),
          ...(data.diagnosis !== undefined && { diagnosis: data.diagnosis || null }),
          ...(data.serviceToPerform !== undefined && { serviceToPerform: data.serviceToPerform || null }),
          ...(data.internalNotes !== undefined && { internalNotes: data.internalNotes || null }),
          ...(data.estimatedDeliveryDate !== undefined && {
            estimatedDeliveryDate: data.estimatedDeliveryDate ? new Date(data.estimatedDeliveryDate) : null,
          }),
          ...(data.deliveredAt !== undefined && {
            deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : null,
          }),
          ...(data.termsAccepted !== undefined && { termsAccepted: data.termsAccepted }),
          ...(data.customerSignature !== undefined && { customerSignature: data.customerSignature || null }),
          ...(data.technicianSignature !== undefined && { technicianSignature: data.technicianSignature || null }),
          ...(data.discountValueCents !== undefined && { discountValueCents: data.discountValueCents }),
          ...(data.discountPercent !== undefined && { discountPercent: data.discountPercent }),
          ...(data.surchargeValueCents !== undefined && { surchargeValueCents: data.surchargeValueCents }),
        },
      });

      const needsRecalc =
        data.discountValueCents !== undefined ||
        data.discountPercent !== undefined ||
        data.surchargeValueCents !== undefined;

      if (needsRecalc) {
        await recalcServiceOrderTotals(tx, id);
      }

      return tx.serviceOrder.findUniqueOrThrow({ where: { id }, include: serviceOrderInclude });
    });

    return NextResponse.json({ serviceOrder });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const existing = await prisma.serviceOrder.findUnique({
    where: { id },
    include: { parts: true },
  });
  if (!existing) return notFound('Ordem de serviço não encontrada.');

  await prisma.$transaction(async (tx) => {
    for (const part of existing.parts) {
      await tx.part.update({
        where: { id: part.partId },
        data: { stockQuantity: { increment: part.quantity } },
      });
    }
    await tx.serviceOrder.delete({ where: { id } });
    await tx.device.delete({ where: { id: existing.deviceId } });
  });

  return NextResponse.json({ success: true });
}
