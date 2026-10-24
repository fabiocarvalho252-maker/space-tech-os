// Ajuste de estoque com motivo: entrada, saída (perda, quebra, troca) ou
// contagem (define a quantidade exata). Grava pela função ajustar_estoque, e o
// motivo aparece no histórico do produto.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, ClipboardCheck, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Tipo = "entrada" | "saida" | "contagem";

const TIPOS: { value: Tipo; label: string; icon: typeof ArrowUpRight }[] = [
  { value: "entrada", label: "Entrada", icon: ArrowUpRight },
  { value: "saida", label: "Saída", icon: ArrowDownRight },
  { value: "contagem", label: "Contagem", icon: ClipboardCheck },
];

const MOTIVOS: Record<Tipo, string[]> = {
  entrada: ["Chegou do fornecedor", "Devolução de cliente", "Correção"],
  saida: ["Quebra / defeito", "Perda", "Troca em garantia", "Uso interno"],
  contagem: ["Inventário", "Conferência"],
};

export function AjustarEstoqueDialog({
  produto,
  onOpenChange,
}: {
  produto: { id: string; nome: string; quantidade: number } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<Tipo>("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!produto) return;
    setTipo("entrada");
    setQuantidade("");
    setMotivo("");
  }, [produto]);

  const qtd = Math.max(0, Math.floor(Number(quantidade) || 0));
  const atual = produto?.quantidade ?? 0;
  const nova = tipo === "entrada" ? atual + qtd : tipo === "saida" ? atual - qtd : qtd;

  const salvar = useMutation({
    mutationFn: async () => {
      if (quantidade.trim() === "") throw new Error("Informe a quantidade");
      if (!motivo.trim()) throw new Error("Informe o motivo");
      const { error } = await supabase.rpc("ajustar_estoque", {
        p_produto_id: produto!.id,
        p_tipo: tipo,
        p_quantidade: qtd,
        p_motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Estoque de ${produto?.nome} agora: ${nova}`);
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!produto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" /> Ajustar estoque
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {produto?.nome} · estoque atual: <strong>{atual}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTipo(t.value);
                  setMotivo("");
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold",
                  tipo === t.value ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>{tipo === "contagem" ? "Quantidade contada" : "Quantidade"}</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              autoFocus
            />
            {quantidade.trim() !== "" && (
              <p className={cn("text-xs", nova < 0 ? "text-destructive" : "text-muted-foreground")}>
                {atual} → <strong>{nova}</strong>
                {nova < 0 && " (maior que o estoque atual)"}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS[tipo].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    motivo === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value.slice(0, 200))}
              placeholder="Ou escreva o motivo"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || nova < 0}
          >
            {salvar.isPending ? "Salvando..." : "Salvar ajuste"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
