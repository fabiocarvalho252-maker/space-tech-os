'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Printer, RefreshCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/service-orders/status-badge';
import { ChangeStatusDialog } from '@/components/service-orders/change-status-dialog';
import { DeleteServiceOrderDialog } from '@/components/service-orders/delete-service-order-dialog';
import { formatOsNumber } from '@/lib/format';
import type { ServiceOrderDetail } from '@/lib/types';

export function ServiceOrderEditHeader({ serviceOrder }: { serviceOrder: ServiceOrderDetail }) {
  const router = useRouter();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href={`/dashboard/service-orders/${serviceOrder.id}`} />}>
          <ArrowLeft />
        </Button>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Editar {formatOsNumber(serviceOrder.number)}</h1>
            <StatusBadge status={serviceOrder.status} />
          </div>
          <p className="mt-1 text-sm text-slate-400">Atualize os dados, itens, peças e fotos da ordem de serviço.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" render={<Link href={`/dashboard/service-orders/${serviceOrder.id}`} />}>
          <Eye /> Visualizar
        </Button>
        <Button variant="outline" render={<Link href={`/dashboard/service-orders/${serviceOrder.id}/print`} target="_blank" />}>
          <Printer /> Imprimir
        </Button>
        <Button variant="outline" onClick={() => setStatusDialogOpen(true)}>
          <RefreshCcw /> Status
        </Button>
        <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 /> Excluir
        </Button>
      </div>

      <ChangeStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        serviceOrderId={serviceOrder.id}
        currentStatus={serviceOrder.status}
        onSuccess={() => router.refresh()}
      />

      <DeleteServiceOrderDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        serviceOrderId={serviceOrder.id}
        serviceOrderNumber={serviceOrder.number}
        onSuccess={() => router.push('/dashboard/service-orders')}
      />
    </div>
  );
}
