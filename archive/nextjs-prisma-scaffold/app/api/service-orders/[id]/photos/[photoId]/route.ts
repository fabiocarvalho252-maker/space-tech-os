import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, notFound } from '@/lib/api';

type Params = { params: Promise<{ id: string; photoId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id, photoId } = await params;

  const photo = await prisma.serviceOrderPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.serviceOrderId !== id) return notFound('Foto não encontrada.');

  await prisma.serviceOrderPhoto.delete({ where: { id: photoId } });

  return NextResponse.json({ success: true });
}
