// "Devolver aparelho" (pedido, seção 18): se o aparelho já estava vendido,
// estorna a receita da venda com um lançamento de saída (a venda em si não
// é apagada, só compensada — mesmo espírito do "cancelar venda" de
// aparelhos.tsx) e mantém a ligação com a venda original via venda_id. Se
// ainda não tinha sido vendido, é só a devolução ao vendedor original —
// sem efeito financeiro, já que nenhuma receita de venda existia.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type SeminovoRow = Database["public"]["Tables"]["seminovos"]["Row"];

export function DevolverSeminovoDialog({
  open,
  onOpenChange,
  seminovo,
  empresaId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seminovo: SeminovoRow | null;
  empresaId: string;
}) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");

  const devolver = useMutation({
    mutationFn: async () => {
      if (!seminovo) throw new Error("Nenhum aparelho selecionado.");
      if (!motivo.trim()) throw new Error("Informe o motivo da devolução.");

      const eraVendido = seminovo.status === "vendido";

      const { error } = await supabase
        .from("seminovos")
        .update({
          status: "devolvido",
          devolucao_motivo: motivo.trim(),
          devolucao_data: new Date().toISOString(),
        })
        .eq("id", seminovo.id);
      if (error) throw error;

      if (eraVendido && seminovo.preco_venda) {
        await supabase.from("lancamentos").insert({
          user_id: empresaId,
          tipo: "saida",
          categoria: "Devolução de seminovo",
          descricao: `Estorno da venda de ${seminovo.marca} ${seminovo.modelo} — devolução`,
          valor: seminovo.preco_venda,
          venda_id: seminovo.venda_id,
        });
      }
    },
    onSuccess: () => {
      toast.success("Aparelho devolvido");
      qc.invalidateQueries({ queryKey: ["seminovos"] });
      setMotivo("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!seminovo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Devolver — {seminovo.marca} {seminovo.modelo}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {seminovo.status === "vendido" && (
            <p className="text-sm text-muted-foreground">
              Este aparelho já estava vendido — a devolução vai lançar um estorno no financeiro. A
              venda original não será apagada.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Motivo *</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="h-11"
            onClick={() => devolver.mutate()}
            disabled={devolver.isPending}
          >
            {devolver.isPending ? "Confirmando..." : "Confirmar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
