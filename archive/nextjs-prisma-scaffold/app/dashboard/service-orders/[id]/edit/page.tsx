import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { serviceOrderInclude } from '@/lib/service-order-server';
import { ServiceOrderEditHeader } from '@/components/service-orders/service-order-edit-header';
import { ServiceOrderCoreForm } from '@/components/service-orders/service-order-core-form';
import { ChecklistManager } from '@/components/service-orders/checklist-manager';
import { ItemsEditor } from '@/components/service-orders/items-editor';
import { PartsEditor } from '@/components/service-orders/parts-editor';
import { PhotosEditor } from '@/components/service-orders/photos-editor';
import { formatCurrencyCents } from '@/lib/format';

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

export default async function ServiceOrderEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const serviceOrder = await prisma.serviceOrder.findUnique({
    where: { id },
    include: serviceOrderInclude,
  });

  if (!serviceOrder) notFound();

  return (
    <div className="space-y-6">
      <ServiceOrderEditHeader serviceOrder={serviceOrder} />

      <ServiceOrderCoreForm serviceOrder={serviceOrder} />

      <Section title="Checklist de entrada" description="As alterações são salvas automaticamente.">
        <ChecklistManager serviceOrder={serviceOrder} />
      </Section>

      <Section title="Itens e mão de obra">
        <ItemsEditor serviceOrder={serviceOrder} />
      </Section>

      <Section title="Peças">
        <PartsEditor serviceOrder={serviceOrder} />
      </Section>

      <Section title="Fotos">
        <PhotosEditor serviceOrder={serviceOrder} />
      </Section>

      <Section title="Totais">
        <div className="ml-auto max-w-xs space-y-1.5 text-sm">
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
          <div className="flex justify-between border-t border-white/10 pt-1.5 text-base font-semibold text-white">
            <span>Total</span>
            <span>{formatCurrencyCents(serviceOrder.totalValueCents)}</span>
          </div>
        </div>
      </Section>
    </div>
  );
}
