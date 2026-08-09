'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Printer,
  Copy,
  RefreshCcw,
  Trash2,
  MoreVertical,
  ArrowUpDown,
  Smartphone,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/service-orders/status-badge';
import { ChangeStatusDialog } from '@/components/service-orders/change-status-dialog';
import { DeleteServiceOrderDialog } from '@/components/service-orders/delete-service-order-dialog';
import { STATUS_FILTERS } from '@/lib/service-order';
import { formatCurrencyCents, formatDate, formatOsNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ServiceOrderListItem } from '@/lib/types';

export function ServiceOrdersList() {
  const router = useRouter();
  const [orders, setOrders] = useState<ServiceOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('TODAS');
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');

  const [statusDialogOrder, setStatusDialogOrder] = useState<ServiceOrderListItem | null>(null);
  const [deleteDialogOrder, setDeleteDialogOrder] = useState<ServiceOrderListItem | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (status !== 'TODAS') params.set('status', status);
      params.set('sort', sort);

      const response = await fetch(`/api/service-orders?${params.toString()}`);
      if (!response.ok) throw new Error('Falha ao carregar ordens de serviço.');
      const body = await response.json();
      setOrders(body.serviceOrders);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar OS.');
    } finally {
      setLoading(false);
    }
  }, [search, status, sort]);

  useEffect(() => {
    const timeout = setTimeout(loadOrders, 250);
    return () => clearTimeout(timeout);
  }, [loadOrders]);

  async function handleDuplicate(order: ServiceOrderListItem) {
    try {
      const response = await fetch(`/api/service-orders/${order.id}/duplicate`, { method: 'POST' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível duplicar a OS.');
      }
      const body = await response.json();
      toast.success('OS duplicada com sucesso.');
      router.push(`/dashboard/service-orders/${body.serviceOrder.id}/edit`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao duplicar OS.');
    }
  }

  const filterChips = useMemo(() => STATUS_FILTERS, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ordens de Serviço</h1>
          <p className="text-sm text-slate-400">Gerencie as ordens de serviço da assistência técnica.</p>
        </div>
        <Button render={<Link href="/dashboard/service-orders/new" />} size="lg">
          <Plus />
          Nova OS
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por número, cliente, telefone, IMEI ou modelo..."
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setSort((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
          className="shrink-0"
        >
          <ArrowUpDown />
          {sort === 'desc' ? 'Mais recentes' : 'Mais antigas'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterChips.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setStatus(chip.value)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition',
              status === chip.value
                ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-300'
                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 py-16 text-center">
          <Inbox className="mb-3 size-10 text-slate-600" />
          <p className="text-slate-300">Nenhuma ordem de serviço encontrada.</p>
          <p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou crie uma nova OS.</p>
          <Button render={<Link href="/dashboard/service-orders/new" />} className="mt-4">
            <Plus />
            Nova OS
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-white/5 md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-400">OS</TableHead>
                  <TableHead className="text-slate-400">Cliente</TableHead>
                  <TableHead className="text-slate-400">Aparelho</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Valor</TableHead>
                  <TableHead className="text-slate-400">Entrada</TableHead>
                  <TableHead className="text-slate-400">Previsão</TableHead>
                  <TableHead className="text-right text-slate-400">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="font-medium text-white">{formatOsNumber(order.number)}</TableCell>
                    <TableCell>
                      <div className="text-white">{order.customer.name}</div>
                      <div className="text-xs text-slate-500">{order.customer.phone}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-slate-200">
                        {order.device.brand} {order.device.model}
                      </div>
                      {order.device.imei1 && (
                        <div className="text-xs text-slate-500">IMEI {order.device.imei1}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-slate-200">{formatCurrencyCents(order.totalValueCents)}</TableCell>
                    <TableCell className="text-slate-400">{formatDate(order.entryDate)}</TableCell>
                    <TableCell className="text-slate-400">{formatDate(order.estimatedDeliveryDate)}</TableCell>
                    <TableCell className="text-right">
                      <OrderActionsMenu
                        order={order}
                        onChangeStatus={() => setStatusDialogOrder(order)}
                        onDelete={() => setDeleteDialogOrder(order)}
                        onDuplicate={() => handleDuplicate(order)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {orders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{formatOsNumber(order.number)}</p>
                    <p className="text-sm text-slate-300">{order.customer.name}</p>
                  </div>
                  <OrderActionsMenu
                    order={order}
                    onChangeStatus={() => setStatusDialogOrder(order)}
                    onDelete={() => setDeleteDialogOrder(order)}
                    onDuplicate={() => handleDuplicate(order)}
                  />
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                  <Smartphone className="size-4" />
                  {order.device.brand} {order.device.model}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <StatusBadge status={order.status} />
                  <span className="font-semibold text-white">{formatCurrencyCents(order.totalValueCents)}</span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>Entrada: {formatDate(order.entryDate)}</span>
                  <span>Previsão: {formatDate(order.estimatedDeliveryDate)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {statusDialogOrder && (
        <ChangeStatusDialog
          open={!!statusDialogOrder}
          onOpenChange={(open) => !open && setStatusDialogOrder(null)}
          serviceOrderId={statusDialogOrder.id}
          currentStatus={statusDialogOrder.status}
          onSuccess={loadOrders}
        />
      )}

      {deleteDialogOrder && (
        <DeleteServiceOrderDialog
          open={!!deleteDialogOrder}
          onOpenChange={(open) => !open && setDeleteDialogOrder(null)}
          serviceOrderId={deleteDialogOrder.id}
          serviceOrderNumber={deleteDialogOrder.number}
          onSuccess={loadOrders}
        />
      )}
    </div>
  );
}

function OrderActionsMenu({
  order,
  onChangeStatus,
  onDelete,
  onDuplicate,
}: {
  order: ServiceOrderListItem;
  onChangeStatus: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
        <MoreVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={`/dashboard/service-orders/${order.id}`} />}>
          <Eye /> Visualizar
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/dashboard/service-orders/${order.id}/edit`} />}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/dashboard/service-orders/${order.id}/print`} target="_blank" />}>
          <Printer /> Imprimir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onChangeStatus}>
          <RefreshCcw /> Alterar status
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
