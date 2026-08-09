'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { formatOsNumber } from '@/lib/format';

export function DeleteServiceOrderDialog({
  open,
  onOpenChange,
  serviceOrderId,
  serviceOrderNumber,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrderId: string;
  serviceOrderNumber: number;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const response = await fetch(`/api/service-orders/${serviceOrderId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível excluir a OS.');
      }
      toast.success('Ordem de serviço excluída.');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir OS.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir OS {formatOsNumber(serviceOrderNumber)}?</AlertDialogTitle>
          <AlertDialogDescription>
            Essa ação é irreversível. Todos os itens, peças, fotos e histórico vinculados a esta ordem de serviço
            serão excluídos permanentemente e o estoque de peças reservado será restaurado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleDelete();
            }}
            disabled={loading}
            className="bg-destructive text-white hover:bg-destructive/80"
          >
            {loading && <Loader2 className="animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
