// "Avaliar retorno": um aparelho devolvido volta para a loja e precisa ser
// reavaliado antes de voltar ao estoque. Registra o estado/bateria atuais,
// a nota da avaliação (no histórico) e o destino — Disponível para vender
// de novo, Pendente se ainda precisa de conserto, ou Sucata/Sem solução.
// A troca de status em si já entra no histórico pelo trigger da tabela.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type SeminovoRow = Database["public"]["Tables"]["seminovos"]["Row"];

const ESTADOS = ["Excelente", "Bom", "Regular", "Ruim"];

const DESTINOS = [
  { value: "disponivel", label: "Disponível para venda" },
  { value: "pendente", label: "Pendente (precisa de conserto)" },
  { value: "sucata", label: "Sucata" },
  { value: "sem_solucao", label: "Sem solução" },
] as const;

function numeroOuNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function AvaliarDevolucaoDialog({
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
  const { data: user } = useCurrentUser();
  const [estado, setEstado] = useState("Bom");
  const [bateria, setBateria] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [precoLojista, setPrecoLojista] = useState("");
  const [destino, setDestino] = useState<string>("disponivel");
  const [avaliacao, setAvaliacao] = useState("");

  useEffect(() => {
    if (!open || !seminovo) return;
    setEstado(seminovo.estado ?? "Bom");
    setBateria(seminovo.bateria_percentual != null ? String(seminovo.bateria_percentual) : "");
    setPrecoVenda(seminovo.preco_venda != null ? String(seminovo.preco_venda) : "");
    setPrecoLojista(seminovo.preco_lojista != null ? String(seminovo.preco_lojista) : "");
    setDestino("disponivel");
    setAvaliacao("");
  }, [open, seminovo]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!seminovo) throw new Error("Nenhum aparelho selecionado.");
      if (!avaliacao.trim()) throw new Error("Descreva a avaliação do aparelho.");
      const bateriaNum = numeroOuNull(bateria);
      if (bateriaNum != null && (bateriaNum < 0 || bateriaNum > 100)) {
        throw new Error("Bateria deve estar entre 0 e 100%.");
      }
      const precoVendaNum = numeroOuNull(precoVenda);
      if (destino === "disponivel" && !precoVendaNum) {
        throw new Error("Informe o preço de venda para deixar o aparelho disponível.");
      }

      const destinoLabel = DESTINOS.find((d) => d.value === destino)?.label ?? destino;
      const { error: histErro } = await supabase.from("seminovos_historico").insert({
        user_id: empresaId,
        seminovo_id: seminovo.id,
        evento: "avaliacao",
        created_by: user?.id ?? null,
        descricao:
          `Avaliação pós-devolução — estado ${estado}` +
          (bateriaNum != null ? `, bateria ${bateriaNum}%` : "") +
          ` — destino: ${destinoLabel}. ${avaliacao.trim()}`,
      });
      if (histErro) throw histErro;

      const { error } = await supabase
        .from("seminovos")
        .update({
          status: destino,
          estado,
          bateria_percentual: bateriaNum,
          preco_venda: precoVendaNum,
          preco_lojista: numeroOuNull(precoLojista),
        })
        .eq("id", seminovo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        destino === "disponivel" ? "Aparelho disponível para venda novamente" : "Avaliação registrada",
      );
      qc.invalidateQueries({ queryKey: ["seminovos"] });
      // Seminovos disponíveis espelham em Aparelhos (trigger no banco).
      qc.invalidateQueries({ queryKey: ["aparelhos"] });
      qc.invalidateQueries({ queryKey: ["seminovo-atual"] });
      qc.invalidateQueries({ queryKey: ["seminovo-historico"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!seminovo) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !salvar.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Avaliar retorno — {seminovo.marca} {seminovo.modelo}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {seminovo.devolucao_motivo && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground">Motivo da devolução</p>
              <p>{seminovo.devolucao_motivo}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Bateria (%)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={bateria}
                onChange={(e) => setBateria(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Avaliação *</Label>
            <Textarea
              value={avaliacao}
              onChange={(e) => setAvaliacao(e.target.value)}
              rows={3}
              placeholder="Ex.: testado, tela e câmeras OK, sem marcas novas de uso..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DESTINOS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(destino === "disponivel" || destino === "pendente") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preço cliente{destino === "disponivel" ? " *" : ""}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={precoVenda}
                  onChange={(e) => setPrecoVenda(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preço lojista</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={precoLojista}
                  onChange={(e) => setPrecoLojista(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          )}
          {destino === "pendente" && (
            <p className="text-xs text-muted-foreground">
              Registre as peças/serviços do conserto no detalhe do aparelho e depois mude o status
              para Disponível.
            </p>
          )}
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
