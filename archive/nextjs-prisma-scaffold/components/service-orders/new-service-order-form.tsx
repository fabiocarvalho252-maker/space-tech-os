'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CustomerPicker, EMPTY_CUSTOMER, type NewCustomerData } from '@/components/service-orders/customer-picker';
import { DeviceFields, EMPTY_DEVICE, type DeviceFormData } from '@/components/service-orders/device-fields';
import {
  ChecklistEditor,
  buildEmptyChecklist,
  checklistStateToArray,
  type ChecklistState,
} from '@/components/service-orders/checklist-editor';
import type { CustomerRecord } from '@/lib/types';
import type { ChecklistCategory } from '@prisma/client';

const CHECKLIST_CATEGORIES: ChecklistCategory[] = ['CONDICAO_APARELHO', 'FUNCIONAMENTO', 'ACESSORIOS'];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function NewServiceOrderForm() {
  const router = useRouter();

  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [newCustomer, setNewCustomer] = useState<NewCustomerData>(EMPTY_CUSTOMER);

  const [device, setDevice] = useState<DeviceFormData>(EMPTY_DEVICE);

  const [reportedIssue, setReportedIssue] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [serviceToPerform, setServiceToPerform] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistState>(buildEmptyChecklist());

  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (customerMode === 'existing' && !selectedCustomer) {
      toast.error('Selecione um cliente existente ou cadastre um novo.');
      return;
    }
    if (!reportedIssue.trim()) {
      toast.error('Descreva o defeito relatado.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/service-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerMode === 'existing' ? selectedCustomer?.id : undefined,
          customer: customerMode === 'new' ? newCustomer : undefined,
          device,
          reportedIssue,
          diagnosis: diagnosis || undefined,
          serviceToPerform: serviceToPerform || undefined,
          internalNotes: internalNotes || undefined,
          estimatedDeliveryDate: estimatedDeliveryDate || undefined,
          termsAccepted,
          checklist: checklistStateToArray(checklist),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível criar a OS.');
      }

      const body = await response.json();
      toast.success('Ordem de serviço criada com sucesso.');
      router.push(`/dashboard/service-orders/${body.serviceOrder.id}/edit`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar OS.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard/service-orders" />}>
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Nova ordem de serviço</h1>
          <p className="text-sm text-slate-400">Cadastre o cliente, o aparelho e o defeito relatado.</p>
        </div>
      </div>

      <Section title="Cliente">
        <CustomerPicker
          selectedCustomer={selectedCustomer}
          onSelectExisting={setSelectedCustomer}
          onClearSelection={() => setSelectedCustomer(null)}
          newCustomer={newCustomer}
          onChangeNewCustomer={setNewCustomer}
          mode={customerMode}
          onChangeMode={setCustomerMode}
        />
      </Section>

      <Section title="Aparelho">
        <DeviceFields value={device} onChange={setDevice} />
      </Section>

      <Section title="Defeito e serviço">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Defeito relatado pelo cliente *</Label>
            <Textarea
              value={reportedIssue}
              onChange={(event) => setReportedIssue(event.target.value)}
              rows={3}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Diagnóstico técnico</Label>
            <Textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Serviço a ser realizado</Label>
            <Textarea
              value={serviceToPerform}
              onChange={(event) => setServiceToPerform(event.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações internas</Label>
            <Textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows={2} />
          </div>
          <div className="space-y-2 sm:max-w-xs">
            <Label>Previsão de entrega</Label>
            <Input
              type="date"
              value={estimatedDeliveryDate}
              onChange={(event) => setEstimatedDeliveryDate(event.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section title="Checklist de entrada" description="Marque as condições e itens verificados no momento da entrada.">
        <ChecklistEditor categories={CHECKLIST_CATEGORIES} value={checklist} onChange={setChecklist} />
      </Section>

      <Section title="Termos">
        <label className="flex items-start gap-2 text-sm text-slate-300">
          <Checkbox checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} />
          Cliente ciente e de acordo com os termos de serviço da assistência técnica.
        </label>
      </Section>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" render={<Link href="/dashboard/service-orders" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Save />}
          Criar OS
        </Button>
      </div>
    </form>
  );
}
