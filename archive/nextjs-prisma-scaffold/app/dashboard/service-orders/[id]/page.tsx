import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { serviceOrderInclude } from '@/lib/service-order-server';
import { ServiceOrderDetailView } from '@/components/service-orders/service-order-detail-view';

export default async function ServiceOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const serviceOrder = await prisma.serviceOrder.findUnique({
    where: { id },
    include: serviceOrderInclude,
  });

  if (!serviceOrder) notFound();

  return <ServiceOrderDetailView serviceOrder={serviceOrder} />;
}
