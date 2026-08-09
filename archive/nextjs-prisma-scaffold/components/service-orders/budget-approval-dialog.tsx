'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export function BudgetApprovalDialog({
  open,
  onOpenChange,
  serviceOrderId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrderId: string;
  onSuccess: () => void;
}) {
  const [decision, setDecision] = useState<'APROVADO' | 'RECUSADO'>('APROVADO');
  const [approvedBy, setApprovedBy] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDecision('APROVADO');
      setApprovedBy('');
      setNote('');
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const response = await fetch(`/api/service-orders/${serviceOrderId}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, approvedBy: approvedBy || undefined, note: note || undefined }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível registrar a decisão do orçamento.');
      }
      toast.success('Orçamento atualizado com sucesso.');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar orçamento.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Decisão do orçamento</DialogTitle>
          <DialogDescription>Registre a aprovação ou recusa do orçamento pelo cliente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDecision('APROVADO')}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition',
                decision === 'APROVADO'
                  ? 'border-green-400/40 bg-green-400/15 text-green-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
              )}
            >
              Aprovar
            </button>
            <button
              type="button"
              onClick={() => setDecision('RECUSADO')}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition',
                decision === 'RECUSADO'
                  ? 'border-red-400/40 bg-red-400/15 text-red-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
              )}
            >
              Recusar
            </button>
          </div>

          <div className="space-y-2">
            <Label>Aprovado/recusado por</Label>
            <Input value={approvedBy} onChange={(event) => setApprovedBy(event.target.value)} placeholder="Nome do cliente" />
          </div>

          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Salvar decisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
