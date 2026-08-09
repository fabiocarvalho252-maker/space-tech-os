'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { CHECKLIST_CATEGORY_META, DEFAULT_CHECKLIST } from '@/lib/service-order';
import type { ChecklistCategory } from '@prisma/client';

export type ChecklistState = Record<string, boolean>;

export function checklistKey(category: ChecklistCategory, label: string) {
  return `${category}::${label}`;
}

export function buildEmptyChecklist(): ChecklistState {
  const state: ChecklistState = {};
  (Object.entries(DEFAULT_CHECKLIST) as [ChecklistCategory, string[]][]).forEach(([category, labels]) => {
    labels.forEach((label) => {
      state[checklistKey(category, label)] = false;
    });
  });
  return state;
}

export function checklistStateToArray(state: ChecklistState) {
  return Object.entries(state).map(([key, checked]) => {
    const [category, label] = key.split('::') as [ChecklistCategory, string];
    return { category, label, checked };
  });
}

export function ChecklistGroup({
  category,
  value,
  onChange,
}: {
  category: ChecklistCategory;
  value: ChecklistState;
  onChange: (state: ChecklistState) => void;
}) {
  const labels = DEFAULT_CHECKLIST[category];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-300">{CHECKLIST_CATEGORY_META[category]}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {labels.map((label) => {
          const key = checklistKey(category, label);
          return (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
              <Checkbox
                checked={value[key] ?? false}
                onCheckedChange={(checked) => onChange({ ...value, [key]: checked === true })}
              />
              {label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ChecklistEditor({
  categories,
  value,
  onChange,
}: {
  categories: ChecklistCategory[];
  value: ChecklistState;
  onChange: (state: ChecklistState) => void;
}) {
  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <ChecklistGroup key={category} category={category} value={value} onChange={onChange} />
      ))}
    </div>
  );
}
