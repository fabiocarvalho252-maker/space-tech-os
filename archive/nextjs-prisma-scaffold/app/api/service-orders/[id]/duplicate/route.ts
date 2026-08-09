import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound, handleApiError } from '@/lib/api';
import { logHistory } from '@/lib/service-order-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const source = await prisma.serviceOrder.findUnique({
      where: { id },
      include: { device: true, checklist: true },
    });
    if (!source) return notFound('Ordem de serviço não encontrada.');

    const serviceOrder = await prisma.$transaction(async (tx) => {
      const device = await tx.device.create({
        data: {
          type: source.device.type,
          brand: source.device.brand,
          model: source.device.model,
          color: source.device.color,
          imei1: source.device.imei1,
          imei2: source.device.imei2,
          serialNumber: source.device.serialNumber,
          storageCapacity: source.device.storageCapacity,
          devicePassword: source.device.devicePassword,
          unlockPattern: source.device.unlockPattern,
          condition: source.device.condition,
          physicalNotes: source.device.physicalNotes,
        },
      });

      const order = await tx.serviceOrder.create({
        data: {
          customerId: source.customerId,
          deviceId: device.id,
          status: 'ABERTA',
          reportedIssue: source.reportedIssue,
          diagnosis: source.diagnosis,
          serviceToPerform: source.serviceToPerform,
          createdById: user.id,
        },
      });

      if (source.checklist.length) {
        await tx.serviceOrderChecklistItem.createMany({
          data: source.checklist.map((item) => ({
            serviceOrderId: order.id,
            category: item.category,
            label: item.label,
            checked: false,
          })),
        });
      }

      await logHistory(tx, {
        serviceOrderId: order.id,
        userId: user.id,
        action: 'CRIACAO',
        newStatus: 'ABERTA',
        note: `Duplicada a partir da OS #${source.number.toString().padStart(6, '0')}.`,
      });

      return order;
    });

    return NextResponse.json({ serviceOrder }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
