'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Pencil,
  Printer,
  Copy,
  RefreshCcw,
  Trash2,
  MessageCircle,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/service-orders/status-badge';
import { ChangeStatusDialog } from '@/components/service-orders/change-status-dialog';
import { DeleteServiceOrderDialog } from '@/components/service-orders/delete-service-order-dialog';
import { BudgetApprovalDialog } from '@/components/service-orders/budget-approval-dialog';
import {
  DEVICE_CONDITION_META,
  CHECKLIST_CATEGORY_META,
  BUDGET_STATUS_META,
  STATUS_META,
  buildWhatsAppLink,
} from '@/lib/service-order';
import { formatCurrencyCents, formatDate, formatDateTime, formatOsNumber } from '@/lib/format';
import type { ServiceOrderDetail } from '@/lib/types';
import type { ChecklistCategory } from '@prisma/client';

const ACTION_LABELS: Record<string, string> = {
  CRIACAO: 'Ordem de serviço criada',
  ALTERACAO_STATUS: 'Status alterado',
  ORCAMENTO_APROVADO: 'Orçamento aprovado',
  ORCAMENTO_RECUSADO: 'Orçamento recusado',
};

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-200">{value}</p>
    </div>
  );
}

export function ServiceOrderDetailView({ serviceOrder }: { serviceOrder: ServiceOrderDetail }) {
  const router = useRouter();

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const response = await fetch(`/api/service-orders/${serviceOrder.id}/duplicate`, { method: 'POST' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível duplicar a OS.');
      }
      const body = await response.json();
      toast.success('OS duplicada com sucesso.');
      router.push(`/dashboard/service-orders/${body.serviceOrder.id}/edit`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao duplicar OS.');
    } finally {
      setDuplicating(false);
    }
  }

  const deviceLabel = [serviceOrder.device.brand, serviceOrder.device.model].filter(Boolean).join(' ');
  const whatsappPhone = serviceOrder.customer.whatsapp || serviceOrder.customer.phone;
  const whatsappLink = whatsappPhone
    ? buildWhatsAppLink({
        phone: whatsappPhone,
        customerName: serviceOrder.customer.name,
        osNumber: serviceOrder.number,
        status: serviceOrder.status,
        deviceLabel,
        totalValueCents: serviceOrder.totalValueCents,
      })
    : null;

  const checklistByCategory = serviceOrder.checklist.reduce<Record<string, typeof serviceOrder.checklist>>(
    (acc, item) => {
      acc[item.category] = acc[item.category] ? [...acc[item.category], item] : [item];
      return acc;
    },
    {}
  );

  const budgetMeta = BUDGET_STATUS_META[serviceOrder.budgetStatus];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard/service-orders" />}>
            <ArrowLeft />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{formatOsNumber(serviceOrder.number)}</h1>
              <StatusBadge status={serviceOrder.status} />
              <Badge variant="outline" className={budgetMeta.badgeClass}>
                Orçamento: {budgetMeta.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Entrada em {formatDate(serviceOrder.entryDate)} · Previsão {formatDate(serviceOrder.estimatedDeliveryDate)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {whatsappLink && (
            <Button variant="outline" render={<a href={whatsappLink} target="_blank" rel="noreferrer" />}>
              <MessageCircle /> WhatsApp
            </Button>
          )}
          <Button variant="outline" render={<Link href={`/dashboard/service-orders/${serviceOrder.id}/print`} target="_blank" />}>
            <Printer /> Imprimir
          </Button>
          <Button variant="outline" onClick={handleDuplicate} disabled={duplicating}>
            <Copy /> Duplicar
          </Button>
          <Button variant="outline" onClick={() => setStatusDialogOpen(true)}>
            <RefreshCcw /> Status
          </Button>
          <Button render={<Link href={`/dashboard/service-orders/${serviceOrder.id}/edit`} />}>
            <Pencil /> Editar
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 /> Excluir
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Cliente">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome" value={serviceOrder.customer.name} />
            <Field label="Telefone" value={serviceOrder.customer.phone} />
            <Field label="WhatsApp" value={serviceOrder.customer.whatsapp} />
            <Field label="Email" value={serviceOrder.customer.email} />
            <Field label="CPF/CNPJ" value={serviceOrder.customer.documentId} />
            <Field
              label="Endereço"
              value={[serviceOrder.customer.address, serviceOrder.customer.city, serviceOrder.customer.state]
                .filter(Boolean)
                .join(', ')}
            />
          </div>
        </Section>

        <Section title="Aparelho">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo" value={serviceOrder.device.type} />
            <Field label="Marca/Modelo" value={deviceLabel} />
            <Field label="Cor" value={serviceOrder.device.color} />
            <Field label="Armazenamento" value={serviceOrder.device.storageCapacity} />
            <Field label="IMEI 1" value={serviceOrder.device.imei1} />
            <Field label="IMEI 2" value={serviceOrder.device.imei2} />
            <Field label="Número de série" value={serviceOrder.device.serialNumber} />
            <Field label="Estado físico" value={DEVICE_CONDITION_META[serviceOrder.device.condition]} />
            <Field label="Senha" value={serviceOrder.device.devicePassword} />
            <Field label="Padrão de desbloqueio" value={serviceOrder.device.unlockPattern} />
          </div>
          {serviceOrder.device.physicalNotes && (
            <p className="mt-4 text-sm text-slate-300">
              <span className="text-xs text-slate-500">Observações: </span>
              {serviceOrder.device.physicalNotes}
            </p>
          )}
        </Section>
      </div>

      <Section title="Defeito e serviço">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Defeito relatado" value={serviceOrder.reportedIssue} />
          <Field label="Diagnóstico técnico" value={serviceOrder.diagnosis} />
          <Field label="Serviço a ser realizado" value={serviceOrder.serviceToPerform} />
          <Field label="Observações internas" value={serviceOrder.internalNotes} />
        </div>
      </Section>

      {serviceOrder.checklist.length > 0 && (
        <Section title="Checklist de entrada">
          <div className="grid gap-6 sm:grid-cols-3">
            {(Object.entries(checklistByCategory) as [ChecklistCategory, typeof serviceOrder.checklist][]).map(
              ([category, items]) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-300">{CHECKLIST_CATEGORY_META[category]}</h3>
                  <ul className="space-y-1.5">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-sm text-slate-300">
                        {item.checked ? (
                          <CheckCircle2 className="size-4 text-cyan-400" />
                        ) : (
                          <Circle className="size-4 text-slate-600" />
                        )}
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>
        </Section>
      )}

      <Section title="Itens, mão de obra e peças">
        {serviceOrder.items.length === 0 && serviceOrder.parts.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum item lançado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="pb-2 font-medium">Descrição</th>
                  <th className="pb-2 font-medium">Qtde</th>
                  <th className="pb-2 font-medium">Valor unit.</th>
                  <th className="pb-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {serviceOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 text-slate-200">
                      {item.description}
                      <span className="ml-2 text-xs text-slate-500">
                        {item.type === 'SERVICO' ? 'Serviço' : 'Mão de obra'}
                      </span>
                    </td>
                    <td className="py-2 text-slate-300">{item.quantity}</td>
                    <td className="py-2 text-slate-300">{formatCurrencyCents(item.unitPriceCents)}</td>
                    <td className="py-2 text-right text-slate-200">{formatCurrencyCents(item.subtotalCents)}</td>
                  </tr>
                ))}
                {serviceOrder.parts.map((orderPart) => (
                  <tr key={orderPart.id}>
                    <td className="py-2 text-slate-200">
                      {orderPart.part.name}
                      <span className="ml-2 text-xs text-slate-500">Peça</span>
                    </td>
                    <td className="py-2 text-slate-300">{orderPart.quantity}</td>
                    <td className="py-2 text-slate-300">{formatCurrencyCents(orderPart.unitPriceCents)}</td>
                    <td className="py-2 text-right text-slate-200">{formatCurrencyCents(orderPart.subtotalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 ml-auto max-w-xs space-y-1.5 border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Serviços</span>
            <span>{formatCurrencyCents(serviceOrder.servicesTotalCents)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Mão de obra</span>
            <span>{formatCurrencyCents(serviceOrder.laborTotalCents)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Peças</span>
            <span>{formatCurrencyCents(serviceOrder.partsTotalCents)}</span>
          </div>
          {(serviceOrder.discountValueCents > 0 || serviceOrder.discountPercent > 0) && (
            <div className="flex justify-between text-red-300">
              <span>Desconto {serviceOrder.discountPercent > 0 ? `(${serviceOrder.discountPercent}%)` : ''}</span>
              <span>-{formatCurrencyCents(serviceOrder.discountValueCents)}</span>
            </div>
          )}
          {serviceOrder.surchargeValueCents > 0 && (
            <div className="flex justify-between text-amber-300">
              <span>Acréscimo</span>
              <span>+{formatCurrencyCents(serviceOrder.surchargeValueCents)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-white/10 pt-1.5 text-base font-semibold text-white">
            <span>Total</span>
            <span>{formatCurrencyCents(serviceOrder.totalValueCents)}</span>
          </div>
        </div>
      </Section>

      <Section
        title="Orçamento"
        action={
          serviceOrder.budgetStatus === 'AGUARDANDO' ? (
            <Button size="sm" onClick={() => setApprovalDialogOpen(true)}>
              Registrar decisão
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status" value={budgetMeta.label} />
          <Field label="Decidido em" value={formatDateTime(serviceOrder.budgetApprovedAt)} />
          <Field label="Decidido por" value={serviceOrder.budgetApprovedBy} />
        </div>
        {serviceOrder.budgetApprovalNote && (
          <p className="mt-3 text-sm text-slate-300">{serviceOrder.budgetApprovalNote}</p>
        )}
      </Section>

      {serviceOrder.photos.length > 0 && (
        <Section title="Fotos">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {serviceOrder.photos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.dataUrl}
                alt={photo.label || photo.category}
                className="aspect-square w-full rounded-lg border border-white/10 object-cover"
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="Histórico">
        <ol className="space-y-3">
          {serviceOrder.history.map((entry) => (
            <li key={entry.id} className="flex gap-3 text-sm">
              <div className="mt-1 size-1.5 shrink-0 rounded-full bg-cyan-400" />
              <div>
                <p className="text-slate-200">
                  {ACTION_LABELS[entry.action] ?? entry.action.replaceAll('_', ' ')}
                  {entry.previousStatus && entry.newStatus && entry.previousStatus !== entry.newStatus && (
                    <span className="text-slate-500">
                      {' '}
                      — {STATUS_META[entry.previousStatus].label} → {STATUS_META[entry.newStatus].label}
                    </span>
                  )}
                </p>
                {entry.note && <p className="text-slate-400">{entry.note}</p>}
                <p className="text-xs text-slate-500">
                  {formatDateTime(entry.createdAt)} {entry.user?.name ? `· ${entry.user.name}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <ChangeStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        serviceOrderId={serviceOrder.id}
        currentStatus={serviceOrder.status}
        onSuccess={() => router.refresh()}
      />

      <BudgetApprovalDialog
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        serviceOrderId={serviceOrder.id}
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
