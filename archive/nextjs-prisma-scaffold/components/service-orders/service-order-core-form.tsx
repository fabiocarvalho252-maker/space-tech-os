'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DeviceFields, type DeviceFormData } from '@/components/service-orders/device-fields';
import { centsToInputValue, dateInputValue, parseCurrencyToCents } from '@/lib/format';
import type { ServiceOrderDetail } from '@/lib/types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-4 text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

export function ServiceOrderCoreForm({ serviceOrder }: { serviceOrder: ServiceOrderDetail }) {
  const router = useRouter();

  const [customer, setCustomer] = useState({
    name: serviceOrder.customer.name,
    documentId: serviceOrder.customer.documentId ?? '',
    phone: serviceOrder.customer.phone,
    whatsapp: serviceOrder.customer.whatsapp ?? '',
    email: serviceOrder.customer.email ?? '',
    address: serviceOrder.customer.address ?? '',
    city: serviceOrder.customer.city ?? '',
    state: serviceOrder.customer.state ?? '',
    zipCode: serviceOrder.customer.zipCode ?? '',
    notes: serviceOrder.customer.notes ?? '',
  });

  const [device, setDevice] = useState<DeviceFormData>({
    type: serviceOrder.device.type ?? '',
    brand: serviceOrder.device.brand,
    model: serviceOrder.device.model,
    color: serviceOrder.device.color ?? '',
    imei1: serviceOrder.device.imei1 ?? '',
    imei2: serviceOrder.device.imei2 ?? '',
    serialNumber: serviceOrder.device.serialNumber ?? '',
    storageCapacity: serviceOrder.device.storageCapacity ?? '',
    devicePassword: serviceOrder.device.devicePassword ?? '',
    unlockPattern: serviceOrder.device.unlockPattern ?? '',
    condition: serviceOrder.device.condition,
    physicalNotes: serviceOrder.device.physicalNotes ?? '',
  });

  const [reportedIssue, setReportedIssue] = useState(serviceOrder.reportedIssue);
  const [diagnosis, setDiagnosis] = useState(serviceOrder.diagnosis ?? '');
  const [serviceToPerform, setServiceToPerform] = useState(serviceOrder.serviceToPerform ?? '');
  const [internalNotes, setInternalNotes] = useState(serviceOrder.internalNotes ?? '');
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(
    dateInputValue(serviceOrder.estimatedDeliveryDate)
  );
  const [deliveredAt, setDeliveredAt] = useState(dateInputValue(serviceOrder.deliveredAt));
  const [termsAccepted, setTermsAccepted] = useState(serviceOrder.termsAccepted);
  const [customerSignature, setCustomerSignature] = useState(serviceOrder.customerSignature ?? '');
  const [technicianSignature, setTechnicianSignature] = useState(serviceOrder.technicianSignature ?? '');

  const [discountValue, setDiscountValue] = useState(centsToInputValue(serviceOrder.discountValueCents));
  const [discountPercent, setDiscountPercent] = useState(String(serviceOrder.discountPercent || ''));
  const [surchargeValue, setSurchargeValue] = useState(centsToInputValue(serviceOrder.surchargeValueCents));

  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch(`/api/service-orders/${serviceOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          device,
          reportedIssue,
          diagnosis: diagnosis || null,
          serviceToPerform: serviceToPerform || null,
          internalNotes: internalNotes || null,
          estimatedDeliveryDate: estimatedDeliveryDate || null,
          deliveredAt: deliveredAt || null,
          termsAccepted,
          customerSignature: customerSignature || null,
          technicianSignature: technicianSignature || null,
          discountValueCents: parseCurrencyToCents(discountValue),
          discountPercent: Number.parseFloat(discountPercent) || 0,
          surchargeValueCents: parseCurrencyToCents(surchargeValue),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível salvar as alterações.');
      }

      toast.success('Ordem de serviço atualizada.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Cliente">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome completo *</Label>
            <Input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CPF/CNPJ</Label>
            <Input
              value={customer.documentId}
              onChange={(event) => setCustomer({ ...customer, documentId: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone *</Label>
            <Input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input
              value={customer.whatsapp}
              onChange={(event) => setCustomer({ ...customer, whatsapp: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Endereço</Label>
            <Input
              value={customer.address}
              onChange={(event) => setCustomer({ ...customer, address: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={customer.city} onChange={(event) => setCustomer({ ...customer, city: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input
              value={customer.state}
              maxLength={2}
              onChange={(event) => setCustomer({ ...customer, state: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input
              value={customer.zipCode}
              onChange={(event) => setCustomer({ ...customer, zipCode: event.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={customer.notes}
              onChange={(event) => setCustomer({ ...customer, notes: event.target.value })}
              rows={2}
            />
          </div>
        </div>
      </Section>

      <Section title="Aparelho">
        <DeviceFields value={device} onChange={setDevice} />
      </Section>

      <Section title="Defeito e serviço">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Defeito relatado *</Label>
            <Textarea value={reportedIssue} onChange={(event) => setReportedIssue(event.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Diagnóstico técnico</Label>
            <Textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Serviço a ser realizado</Label>
            <Textarea value={serviceToPerform} onChange={(event) => setServiceToPerform(event.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Observações internas</Label>
            <Textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Previsão de entrega</Label>
              <Input
                type="date"
                value={estimatedDeliveryDate}
                onChange={(event) => setEstimatedDeliveryDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Entregue em</Label>
              <Input type="date" value={deliveredAt} onChange={(event) => setDeliveredAt(event.target.value)} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Descontos e acréscimos">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Desconto (R$)</Label>
            <Input value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-2">
            <Label>Desconto (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={discountPercent}
              onChange={(event) => setDiscountPercent(event.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Acréscimo (R$)</Label>
            <Input value={surchargeValue} onChange={(event) => setSurchargeValue(event.target.value)} placeholder="0,00" />
          </div>
        </div>
      </Section>

      <Section title="Termos e assinaturas">
        <div className="space-y-4">
          <label className="flex items-start gap-2 text-sm text-slate-300">
            <Checkbox checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} />
            Cliente ciente e de acordo com os termos de serviço da assistência técnica.
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Assinatura do cliente</Label>
              <Input
                value={customerSignature}
                onChange={(event) => setCustomerSignature(event.target.value)}
                placeholder="Nome digitado como assinatura"
              />
            </div>
            <div className="space-y-2">
              <Label>Assinatura do técnico</Label>
              <Input
                value={technicianSignature}
                onChange={(event) => setTechnicianSignature(event.target.value)}
                placeholder="Nome digitado como assinatura"
              />
            </div>
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
