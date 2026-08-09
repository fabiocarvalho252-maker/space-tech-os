import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound, handleApiError } from '@/lib/api';

type Params = { params: Promise<{ id: string }> };

const bulkSchema = z.object({
  items: z.array(
    z.object({
      category: z.enum(['CONDICAO_APARELHO', 'FUNCIONAMENTO', 'ACESSORIOS']),
      label: z.string().trim().min(1),
      checked: z.boolean(),
    })
  ),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = bulkSchema.parse(body);

    const order = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!order) return notFound('Ordem de serviço não encontrada.');

    await prisma.$transaction(
      data.items.map((item) =>
        prisma.serviceOrderChecklistItem.upsert({
          where: {
            serviceOrderId_category_label: {
              serviceOrderId: id,
              category: item.category,
              label: item.label,
            },
          },
          update: { checked: item.checked },
          create: {
            serviceOrderId: id,
            category: item.category,
            label: item.label,
            checked: item.checked,
          },
        })
      )
    );

    const checklist = await prisma.serviceOrderChecklistItem.findMany({
      where: { serviceOrderId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ checklist });
  } catch (error) {
    return handleApiError(error);
  }
}
