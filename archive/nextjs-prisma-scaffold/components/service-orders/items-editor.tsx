'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { centsToInputValue, formatCurrencyCents, parseCurrencyToCents } from '@/lib/format';
import type { ServiceOrderDetail } from '@/lib/types';
import type { ServiceOrderItemType } from '@prisma/client';

type ItemFormState = {
  type: ServiceOrderItemType;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
};

const EMPTY_FORM: ItemFormState = {
  type: 'SERVICO',
  description: '',
  quantity: '1',
  unitPrice: '',
  discount: '0,00',
};

export function ItemsEditor({ serviceOrder }: { serviceOrder: ServiceOrderDetail }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function startAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setAdding(true);
  }

  function startEdit(item: ServiceOrderDetail['items'][number]) {
    setForm({
      type: item.type,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: centsToInputValue(item.unitPriceCents),
      discount: centsToInputValue(item.discountCents),
    });
    setAdding(false);
    setEditingId(item.id);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  async function submit() {
    if (!form.description.trim()) {
      toast.error('Descreva o item.');
      return;
    }
    const quantity = Number.parseInt(form.quantity, 10);
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.error('Quantidade inválida.');
      return;
    }

    setSaving(true);
    try {
      const body = {
        type: form.type,
        description: form.description,
        quantity,
        unitPriceCents: parseCurrencyToCents(form.unitPrice),
        discountCents: parseCurrencyToCents(form.discount),
      };

      const url = editingId
        ? `/api/service-orders/${serviceOrder.id}/items/${editingId}`
        : `/api/service-orders/${serviceOrder.id}/items`;

      const response = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || 'Não foi possível salvar o item.');
      }

      toast.success('Item salvo com sucesso.');
      cancel();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar item.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(itemId: string) {
    if (!window.confirm('Remover este item da OS?')) return;
    try {
      const response = await fetch(`/api/service-orders/${serviceOrder.id}/items/${itemId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || 'Não foi possível remover o item.');
      }
      toast.success('Item removido.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover item.');
    }
  }

  const showForm = adding || editingId !== null;

  return (
    <div className="space-y-4">
      {serviceOrder.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-slate-400">
                <th className="p-2 font-medium">Descrição</th>
                <th className="p-2 font-medium">Tipo</th>
                <th className="p-2 font-medium">Qtde</th>
                <th className="p-2 font-medium">Valor unit.</th>
                <th className="p-2 font-medium">Subtotal</th>
                <th className="p-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {serviceOrder.items.map((item) => (
                <tr key={item.id}>
                  <td className="p-2 text-slate-200">{item.description}</td>
                  <td className="p-2 text-slate-400">{item.type === 'SERVICO' ? 'Serviço' : 'Mão de obra'}</td>
                  <td className="p-2 text-slate-300">{item.quantity}</td>
                  <td className="p-2 text-slate-300">{formatCurrencyCents(item.unitPriceCents)}</td>
                  <td className="p-2 text-slate-200">{formatCurrencyCents(item.subtotalCents)}</td>
                  <td className="p-2 text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(item)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(item.id)}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value as ServiceOrderItemType })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SERVICO">Serviço</SelectItem>
                  <SelectItem value="MAO_DE_OBRA">Mão de obra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Qtde</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor unit. (R$)</Label>
              <Input value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cancel} disabled={saving}>
              <X /> Cancelar
            </Button>
            <Button type="button" size="sm" onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              Salvar item
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={startAdd}>
          <Plus /> Adicionar item
        </Button>
      )}
    </div>
  );
}
