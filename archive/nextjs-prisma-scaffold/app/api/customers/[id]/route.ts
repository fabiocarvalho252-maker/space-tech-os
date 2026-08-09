import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound, handleApiError } from '@/lib/api';
import { customerSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      serviceOrders: {
        orderBy: { entryDate: 'desc' },
        take: 10,
        include: { device: true },
      },
    },
  });

  if (!customer) return notFound('Cliente não encontrado.');
  return NextResponse.json({ customer });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = customerSchema.partial().parse(body);

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return notFound('Cliente não encontrado.');

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.documentId !== undefined && { documentId: data.documentId || null }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.city !== undefined && { city: data.city || null }),
        ...(data.state !== undefined && { state: data.state || null }),
        ...(data.zipCode !== undefined && { zipCode: data.zipCode || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
      },
    });

    return NextResponse.json({ customer });
  } catch (error) {
    return handleApiError(error);
  }
}
