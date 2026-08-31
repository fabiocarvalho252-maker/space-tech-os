// Adicionar/editar um item do detalhamento de conserto (aprimoramento
// pedido pelo usuário). Escreve direto em seminovos_conserto_itens — o
// total em seminovos.valor_conserto e o histórico são mantidos pela
// trigger seminovos_conserto_itens_after_change (ver migration
// 20260901090000), então este modal só precisa invalidar as duas queries
// que dependem desses valores derivados.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIAS_CONSERTO, type CategoriaConserto } from "@/lib/seminovos-conserto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/MoneyInput";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type ItemRow = Database["public"]["Tables"]["seminovos_conserto_itens"]["Row"];

export function AdicionarCustoConsertoModal({
  open,
  onOpenChange,
  seminovoId,
  empresaId,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seminovoId: string;
  empresaId: string;
  item: ItemRow | null;
}) {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<CategoriaConserto>("tela");
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState(0);
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open) return;
    if (item) {
      setCategoria(item.categoria as CategoriaConserto);
      setDescricao(item.descricao ?? "");
      setFornecedor(item.fornecedor ?? "");
      setValor(Number(item.valor));
      setObservacao(item.observacao ?? "");
    } else {
      setCategoria("tela");
      setDescricao("");
      setFornecedor("");
      setValor(0);
      setObservacao("");
    }
  }, [open, item]);

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["seminovo-conserto-itens", seminovoId] });
    qc.invalidateQueries({ queryKey: ["seminovos"] });
    qc.invalidateQueries({ queryKey: ["seminovo-atual", seminovoId] });
    qc.invalidateQueries({ queryKey: ["seminovo-historico", seminovoId] });
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!(valor >= 0)) throw new Error("Informe um valor válido.");

      const payload = {
        categoria,
        descricao: descricao.trim() || null,
        fornecedor: fornecedor.trim() || null,
        valor,
        observacao: observacao.trim() || null,
      };

      if (item) {
        const { error } = await supabase
          .from("seminovos_conserto_itens")
          .update(payload)
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("seminovos_conserto_itens").insert({
          ...payload,
          user_id: empresaId,
          seminovo_id: seminovoId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(item ? "Custo atualizado" : "Custo adicionado");
      invalidar();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {item ? "Editar custo de conserto" : "Adicionar custo de conserto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaConserto)}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_CONSERTO.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              className="h-11"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Tela Diamonds OLED"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input
                className="h-11"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                placeholder="Petro"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor *</Label>
              <MoneyInput className="h-11" value={valor} onChange={setValor} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : item ? "Salvar alterações" : "Adicionar custo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
