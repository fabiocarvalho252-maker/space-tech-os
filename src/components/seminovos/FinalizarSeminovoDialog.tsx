// "Finalizar avaliação": depois que o técnico conserta o aparelho, o dono da
// empresa (ou um admin/gerente) confere se está tudo OK antes de liberar para venda.
// Aprovado -> Disponível (só com o checklist todo marcado e preço de venda);
// Reprovado -> volta para Pendente com o motivo no histórico.
// Quem pode aprovar é garantido no banco (trigger seminovos_exigir_finalizacao),
// que também grava finalizado_em/finalizado_por.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export const CHECKLIST_FINALIZACAO = [
  { key: "tela", label: "Tela e touch" },
  { key: "bateria", label: "Bateria e carregamento" },
  { key: "cameras", label: "Câmeras" },
  { key: "audio", label: "Áudio, microfone e alto-falante" },
  { key: "botoes", label: "Botões e vibração" },
  { key: "biometria", label: "Face ID / biometria" },
  { key: "conexoes", label: "Wi-Fi, Bluetooth e sinal" },
  { key: "aparencia", label: "Aparência e limpeza" },
] as const;

type Checklist = Record<(typeof CHECKLIST_FINALIZACAO)[number]["key"], boolean>;

const CHECKLIST_VAZIO = Object.fromEntries(
  CHECKLIST_FINALIZACAO.map((c) => [c.key, false]),
) as Checklist;

function numeroOuNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function FinalizarSeminovoDialog({
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
  const [checklist, setChecklist] = useState<Checklist>(CHECKLIST_VAZIO);
  const [estado, setEstado] = useState("Bom");
  const [bateria, setBateria] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [precoLojista, setPrecoLojista] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open || !seminovo) return;
    setChecklist(CHECKLIST_VAZIO);
    setEstado(seminovo.estado ?? "Bom");
    setBateria(seminovo.bateria_percentual != null ? String(seminovo.bateria_percentual) : "");
    setPrecoVenda(seminovo.preco_venda != null ? String(seminovo.preco_venda) : "");
    setPrecoLojista(seminovo.preco_lojista != null ? String(seminovo.preco_lojista) : "");
    setObservacao("");
  }, [open, seminovo]);

  const tudoOk = CHECKLIST_FINALIZACAO.every((c) => checklist[c.key]);

  const salvar = useMutation({
    mutationFn: async (aprovado: boolean) => {
      if (!seminovo) throw new Error("Nenhum aparelho selecionado.");
      const bateriaNum = numeroOuNull(bateria);
      if (bateriaNum != null && (bateriaNum < 0 || bateriaNum > 100)) {
        throw new Error("Bateria deve estar entre 0 e 100%.");
      }
      const precoVendaNum = numeroOuNull(precoVenda);
      if (aprovado) {
        if (!tudoOk) throw new Error("Marque todos os itens do checklist para aprovar.");
        if (!precoVendaNum) throw new Error("Informe o preço de venda para liberar o aparelho.");
      } else if (!observacao.trim()) {
        throw new Error("Descreva o que precisa ser corrigido.");
      }

      const pendentes = CHECKLIST_FINALIZACAO.filter((c) => !checklist[c.key]).map((c) => c.label);
      const { error: histErro } = await supabase.from("seminovos_historico").insert({
        user_id: empresaId,
        seminovo_id: seminovo.id,
        evento: "finalizacao",
        created_by: user?.id ?? null,
        descricao: aprovado
          ? `Avaliação final aprovada — liberado para venda. Estado ${estado}` +
            (bateriaNum != null ? `, bateria ${bateriaNum}%` : "") +
            (observacao.trim() ? `. ${observacao.trim()}` : "")
          : `Avaliação final reprovada — voltou para conserto. ${observacao.trim()}` +
            (pendentes.length ? ` (não OK: ${pendentes.join(", ")})` : ""),
      });
      if (histErro) throw histErro;

      const { error } = await supabase
        .from("seminovos")
        .update({
          status: aprovado ? "disponivel" : "pendente",
          estado,
          bateria_percentual: bateriaNum,
          preco_venda: precoVendaNum,
          preco_lojista: numeroOuNull(precoLojista),
          // Reprovação fica só no histórico; estes campos guardam a aprovação.
          ...(aprovado
            ? {
                finalizacao_checklist: checklist,
                finalizacao_observacao: observacao.trim() || null,
              }
            : {}),
        })
        .eq("id", seminovo.id);
      if (error) throw error;
      return aprovado;
    },
    onSuccess: (aprovado) => {
      toast.success(aprovado ? "Aparelho liberado para venda" : "Aparelho voltou para conserto");
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
            Finalizar avaliação — {seminovo.marca} {seminovo.modelo}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Checklist de conferência</Label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() =>
                  setChecklist(
                    Object.fromEntries(
                      CHECKLIST_FINALIZACAO.map((c) => [c.key, !tudoOk]),
                    ) as Checklist,
                  )
                }
              >
                {tudoOk ? "Desmarcar todos" : "Marcar todos"}
              </button>
            </div>
            <div className="grid gap-2 rounded-xl border border-border p-3">
              {CHECKLIST_FINALIZACAO.map((c) => (
                <label
                  key={c.key}
                  className="flex min-h-9 cursor-pointer items-center gap-3 text-sm"
                >
                  <Checkbox
                    checked={checklist[c.key]}
                    onCheckedChange={(v) =>
                      setChecklist((prev) => ({ ...prev, [c.key]: v === true }))
                    }
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço cliente *</Label>
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

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              placeholder="Obrigatória para reprovar. Ex.: câmera traseira desfocando, refazer."
            />
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2 sm:gap-0">
          <Button
            variant="outline"
            className="h-11 text-destructive hover:text-destructive"
            onClick={() => salvar.mutate(false)}
            disabled={salvar.isPending}
          >
            Reprovar (voltar p/ conserto)
          </Button>
          <Button
            className="h-11"
            onClick={() => salvar.mutate(true)}
            disabled={salvar.isPending || !tudoOk}
          >
            {salvar.isPending ? "Salvando..." : "Aprovar e liberar p/ venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
