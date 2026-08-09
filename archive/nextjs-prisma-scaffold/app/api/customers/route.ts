import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, handleApiError } from '@/lib/api';
import { customerSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const q = request.nextUrl.searchParams.get('q')?.trim();

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { whatsapp: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
            { documentId: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { name: 'asc' },
    take: 20,
  });

  return NextResponse.json({ customers });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const data = customerSchema.parse(body);

    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        documentId: data.documentId || null,
        phone: data.phone,
        whatsapp: data.whatsapp || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
