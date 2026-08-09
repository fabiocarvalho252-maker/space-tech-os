import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, handleApiError } from '@/lib/api';
import { partSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const q = request.nextUrl.searchParams.get('q')?.trim();

  const parts = await prisma.part.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
            { brand: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { name: 'asc' },
    take: 30,
  });

  return NextResponse.json({ parts });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const data = partSchema.parse(body);

    const part = await prisma.part.create({
      data: {
        name: data.name,
        sku: data.sku || null,
        brand: data.brand || null,
        costPriceCents: data.costPriceCents,
        salePriceCents: data.salePriceCents,
        stockQuantity: data.stockQuantity,
        minStockQuantity: data.minStockQuantity,
      },
    });

    return NextResponse.json({ part }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
