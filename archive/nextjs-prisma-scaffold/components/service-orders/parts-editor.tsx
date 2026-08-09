'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Search, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrencyCents } from '@/lib/format';
import type { ServiceOrderDetail } from '@/lib/types';
import type { PartRecord } from '@/lib/types';

export function PartsEditor({ serviceOrder }: { serviceOrder: ServiceOrderDetail }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PartRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPart, setSelectedPart] = useState<PartRecord | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState('1');

  useEffect(() => {
    if (!query.trim()) return;
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/parts?q=${encodeURIComponent(query)}`);
        const body = await response.json();
        setResults(body.parts ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  function cancelAdd() {
    setAdding(false);
    setSelectedPart(null);
    setQuery('');
    setQuantity('1');
  }

  async function submitAdd() {
    if (!selectedPart) {
      toast.error('Selecione uma peça.');
      return;
    }
    const qty = Number.parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error('Quantidade inválida.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/service-orders/${serviceOrder.id}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partId: selectedPart.id, quantity: qty }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível adicionar a peça.');
      }
      toast.success('Peça adicionada.');
      cancelAdd();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar peça.');
    } finally {
      setSaving(false);
    }
  }

  function startEditQty(orderPart: ServiceOrderDetail['parts'][number]) {
    setEditingQtyId(orderPart.id);
    setEditingQtyValue(String(orderPart.quantity));
  }

  async function submitEditQty(orderPartId: string) {
    const qty = Number.parseInt(editingQtyValue, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error('Quantidade inválida.');
      return;
    }
    try {
      const response = await fetch(`/api/service-orders/${serviceOrder.id}/parts/${orderPartId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível atualizar a quantidade.');
      }
      toast.success('Quantidade atualizada.');
      setEditingQtyId(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar quantidade.');
    }
  }

  async function remove(orderPartId: string) {
    if (!window.confirm('Remover esta peça da OS? O estoque será restaurado.')) return;
    try {
      const response = await fetch(`/api/service-orders/${serviceOrder.id}/parts/${orderPartId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível remover a peça.');
      }
      toast.success('Peça removida.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover peça.');
    }
  }

  return (
    <div className="space-y-4">
      {serviceOrder.parts.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-slate-400">
                <th className="p-2 font-medium">Peça</th>
                <th className="p-2 font-medium">Qtde</th>
                <th className="p-2 font-medium">Valor unit.</th>
                <th className="p-2 font-medium">Subtotal</th>
                <th className="p-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {serviceOrder.parts.map((orderPart) => (
                <tr key={orderPart.id}>
                  <td className="p-2 text-slate-200">{orderPart.part.name}</td>
                  <td className="p-2 text-slate-300">
                    {editingQtyId === orderPart.id ? (
                      <Input
                        type="number"
                        min={1}
                        className="h-7 w-20"
                        value={editingQtyValue}
                        onChange={(event) => setEditingQtyValue(event.target.value)}
                      />
                    ) : (
                      orderPart.quantity
                    )}
                  </td>
                  <td className="p-2 text-slate-300">{formatCurrencyCents(orderPart.unitPriceCents)}</td>
                  <td className="p-2 text-slate-200">{formatCurrencyCents(orderPart.subtotalCents)}</td>
                  <td className="p-2 text-right">
                    {editingQtyId === orderPart.id ? (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => submitEditQty(orderPart.id)}>
                          <Check />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditingQtyId(null)}>
                          <X />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => startEditQty(orderPart)}>
                          Alterar qtde
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => remove(orderPart.id)}>
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          {selectedPart ? (
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
              <div>
                <p className="text-white">{selectedPart.name}</p>
                <p className="text-xs text-slate-500">
                  Estoque: {selectedPart.stockQuantity} · {formatCurrencyCents(selectedPart.salePriceCents)}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setSelectedPart(null)}>
                <X />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar peça por nome, SKU ou marca..."
                className="pl-9"
              />
              {query.trim() && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-[#0b1020] shadow-xl">
                  {searching ? (
                    <p className="px-3 py-3 text-sm text-slate-500">Buscando...</p>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-slate-500">Nenhuma peça encontrada.</p>
                  ) : (
                    results.map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => {
                          setSelectedPart(part);
                          setQuery('');
                        }}
                        className="block w-full px-3 py-2.5 text-left text-sm hover:bg-white/5"
                      >
                        <p className="text-white">{part.name}</p>
                        <p className="text-xs text-slate-500">
                          Estoque: {part.stockQuantity} · {formatCurrencyCents(part.salePriceCents)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                className="w-24"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={cancelAdd} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={submitAdd} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus /> Adicionar peça
        </Button>
      )}
    </div>
  );
}
