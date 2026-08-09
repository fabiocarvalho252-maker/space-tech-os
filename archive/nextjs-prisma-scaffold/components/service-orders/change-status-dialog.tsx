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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALL_STATUSES, STATUS_META } from '@/lib/service-order';
import type { ServiceOrderStatus } from '@prisma/client';

export function ChangeStatusDialog({
  open,
  onOpenChange,
  serviceOrderId,
  currentStatus,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrderId: string;
  currentStatus: ServiceOrderStatus;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<ServiceOrderStatus>(currentStatus);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStatus(currentStatus);
      setNote('');
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const response = await fetch(`/api/service-orders/${serviceOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: note || undefined }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível alterar o status.');
      }
      toast.success('Status atualizado com sucesso.');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar status.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar status da OS</DialogTitle>
          <DialogDescription>A alteração fica registrada no histórico da ordem de serviço.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Novo status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as ServiceOrderStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {STATUS_META[value].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Detalhes sobre a alteração de status..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Salvar status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
