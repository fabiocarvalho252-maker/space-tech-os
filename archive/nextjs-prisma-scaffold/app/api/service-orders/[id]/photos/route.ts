import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound, badRequest, handleApiError } from '@/lib/api';
import { photoSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

const MAX_DATA_URL_LENGTH = 8_000_000;

export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = photoSchema.parse(body);

    if (data.dataUrl.length > MAX_DATA_URL_LENGTH) {
      return badRequest('Imagem muito grande. Tente novamente com uma foto menor.');
    }

    const order = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!order) return notFound('Ordem de serviço não encontrada.');

    const photo = await prisma.serviceOrderPhoto.create({
      data: {
        serviceOrderId: id,
        category: data.category,
        dataUrl: data.dataUrl,
        label: data.label || null,
      },
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
