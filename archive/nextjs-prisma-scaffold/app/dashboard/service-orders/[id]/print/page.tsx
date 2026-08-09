import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { serviceOrderInclude } from '@/lib/service-order-server';
import { PrintButton } from '@/components/service-orders/print-button';
import {
  DEVICE_CONDITION_META,
  CHECKLIST_CATEGORY_META,
  STATUS_META,
} from '@/lib/service-order';
import { formatCurrencyCents, formatDate, formatOsNumber } from '@/lib/format';
import type { ChecklistCategory } from '@prisma/client';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] tracking-wide text-gray-500 uppercase">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

export default async function ServiceOrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const serviceOrder = await prisma.serviceOrder.findUnique({
    where: { id },
    include: serviceOrderInclude,
  });

  if (!serviceOrder) notFound();

  const deviceLabel = [serviceOrder.device.brand, serviceOrder.device.model].filter(Boolean).join(' ');

  const checklistByCategory = serviceOrder.checklist.reduce<Record<string, typeof serviceOrder.checklist>>(
    (acc, item) => {
      acc[item.category] = acc[item.category] ? [...acc[item.category], item] : [item];
      return acc;
    },
    {}
  );

  return (
    <div className="min-h-screen bg-white px-8 py-10 text-gray-900 print:px-0 print:py-0">
      <PrintButton />

      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-start justify-between border-b-2 border-gray-900 pb-4">
          <div>
            <p className="text-xl font-bold tracking-[0.2em]">SPACE TECH</p>
            <p className="text-xs text-gray-500">Ordem de Serviço</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatOsNumber(serviceOrder.number)}</p>
            <p className="text-xs text-gray-500">Status: {STATUS_META[serviceOrder.status].label}</p>
            <p className="text-xs text-gray-500">Entrada: {formatDate(serviceOrder.entryDate)}</p>
            <p className="text-xs text-gray-500">Previsão: {formatDate(serviceOrder.estimatedDeliveryDate)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4">
          <Field label="Cliente" value={serviceOrder.customer.name} />
          <Field label="Telefone" value={serviceOrder.customer.phone} />
          <Field
            label="Endereço"
            value={[serviceOrder.customer.address, serviceOrder.customer.city, serviceOrder.customer.state]
              .filter(Boolean)
              .join(', ')}
          />
          <Field label="CPF/CNPJ" value={serviceOrder.customer.documentId} />
        </section>

        <section className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
          <Field label="Aparelho" value={deviceLabel} />
          <Field label="Cor" value={serviceOrder.device.color} />
          <Field label="IMEI 1" value={serviceOrder.device.imei1} />
          <Field label="IMEI 2" value={serviceOrder.device.imei2} />
          <Field label="Número de série" value={serviceOrder.device.serialNumber} />
          <Field label="Estado físico" value={DEVICE_CONDITION_META[serviceOrder.device.condition]} />
          <Field label="Senha" value={serviceOrder.device.devicePassword} />
          <Field label="Padrão de desbloqueio" value={serviceOrder.device.unlockPattern} />
        </section>

        <section className="space-y-3 border-t border-gray-200 pt-4">
          <Field label="Defeito relatado" value={serviceOrder.reportedIssue} />
          <Field label="Diagnóstico técnico" value={serviceOrder.diagnosis} />
          <Field label="Serviço a ser realizado" value={serviceOrder.serviceToPerform} />
        </section>

        {serviceOrder.checklist.length > 0 && (
          <section className="border-t border-gray-200 pt-4">
            <p className="mb-2 text-[10px] tracking-wide text-gray-500 uppercase">Checklist de entrada</p>
            <div className="grid grid-cols-3 gap-4">
              {(Object.entries(checklistByCategory) as [ChecklistCategory, typeof serviceOrder.checklist][]).map(
                ([category, items]) => (
                  <div key={category}>
                    <p className="mb-1 text-xs font-semibold text-gray-700">{CHECKLIST_CATEGORY_META[category]}</p>
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                          <span className="inline-block size-3 border border-gray-500 text-center leading-3">
                            {item.checked ? '✓' : ''}
                          </span>
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {(serviceOrder.items.length > 0 || serviceOrder.parts.length > 0) && (
          <section className="border-t border-gray-200 pt-4">
            <p className="mb-2 text-[10px] tracking-wide text-gray-500 uppercase">Itens, mão de obra e peças</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-300 text-left text-gray-500">
                  <th className="py-1 font-medium">Descrição</th>
                  <th className="py-1 font-medium">Qtde</th>
                  <th className="py-1 font-medium">Valor unit.</th>
                  <th className="py-1 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {serviceOrder.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-1">{item.description}</td>
                    <td className="py-1">{item.quantity}</td>
                    <td className="py-1">{formatCurrencyCents(item.unitPriceCents)}</td>
                    <td className="py-1 text-right">{formatCurrencyCents(item.subtotalCents)}</td>
                  </tr>
                ))}
                {serviceOrder.parts.map((orderPart) => (
                  <tr key={orderPart.id} className="border-b border-gray-100">
                    <td className="py-1">{orderPart.part.name}</td>
                    <td className="py-1">{orderPart.quantity}</td>
                    <td className="py-1">{formatCurrencyCents(orderPart.unitPriceCents)}</td>
                    <td className="py-1 text-right">{formatCurrencyCents(orderPart.subtotalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 ml-auto max-w-xs space-y-1 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Serviços</span>
                <span>{formatCurrencyCents(serviceOrder.servicesTotalCents)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Mão de obra</span>
                <span>{formatCurrencyCents(serviceOrder.laborTotalCents)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Peças</span>
                <span>{formatCurrencyCents(serviceOrder.partsTotalCents)}</span>
              </div>
              {(serviceOrder.discountValueCents > 0 || serviceOrder.discountPercent > 0) && (
                <div className="flex justify-between text-gray-500">
                  <span>Desconto</span>
                  <span>-{formatCurrencyCents(serviceOrder.discountValueCents)}</span>
                </div>
              )}
              {serviceOrder.surchargeValueCents > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Acréscimo</span>
                  <span>+{formatCurrencyCents(serviceOrder.surchargeValueCents)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-300 pt-1 text-sm font-bold">
                <span>Total</span>
                <span>{formatCurrencyCents(serviceOrder.totalValueCents)}</span>
              </div>
            </div>
          </section>
        )}

        <section className="border-t border-gray-200 pt-6 text-xs text-gray-600">
          <p>
            Declaro estar ciente e de acordo com o diagnóstico, o serviço a ser realizado e os valores
            apresentados nesta ordem de serviço.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-8 pt-10 text-center text-xs">
          <div>
            <div className="border-t border-gray-900 pt-1">
              {serviceOrder.customerSignature || 'Assinatura do cliente'}
            </div>
          </div>
          <div>
            <div className="border-t border-gray-900 pt-1">
              {serviceOrder.technicianSignature || 'Assinatura do técnico'}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
