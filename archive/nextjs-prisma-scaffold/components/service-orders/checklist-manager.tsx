'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { CHECKLIST_CATEGORY_META, DEFAULT_CHECKLIST } from '@/lib/service-order';
import type { ServiceOrderDetail } from '@/lib/types';
import type { ChecklistCategory } from '@prisma/client';

export function ChecklistManager({ serviceOrder }: { serviceOrder: ServiceOrderDetail }) {
  const router = useRouter();
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const checkedByKey = new Map(serviceOrder.checklist.map((item) => [`${item.category}::${item.label}`, item.checked]));

  async function toggle(category: ChecklistCategory, label: string, checked: boolean) {
    const key = `${category}::${label}`;
    setPending((prev) => ({ ...prev, [key]: checked }));

    const items = (Object.entries(DEFAULT_CHECKLIST) as [ChecklistCategory, string[]][]).flatMap(([cat, labels]) =>
      labels.map((lbl) => ({
        category: cat,
        label: lbl,
        checked: cat === category && lbl === label ? checked : checkedByKey.get(`${cat}::${lbl}`) ?? false,
      }))
    );

    try {
      const response = await fetch(`/api/service-orders/${serviceOrder.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!response.ok) throw new Error('Não foi possível atualizar o checklist.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar checklist.');
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {(Object.entries(DEFAULT_CHECKLIST) as [ChecklistCategory, string[]][]).map(([category, labels]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">{CHECKLIST_CATEGORY_META[category]}</h3>
          <div className="space-y-2">
            {labels.map((label) => {
              const key = `${category}::${label}`;
              const checked = key in pending ? pending[key] : checkedByKey.get(key) ?? false;
              return (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
                  <Checkbox checked={checked} onCheckedChange={(value) => toggle(category, label, value === true)} />
                  {label}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
