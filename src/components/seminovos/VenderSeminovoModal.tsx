// "Vender aparelho" a partir de Compra Seminovos (pedido, seções 8/17):
// reaproveita o mesmo fluxo de venda genérico que vendas.tsx já usa
// (inserir em `vendas` + `venda_itens` com descrição livre, sem produto_id/
// aparelho_id — o item não é um produto de estoque de peças nem um
// registro da tabela `aparelhos`, que é outro módulo) + um lançamento de
// entrada em `lancamentos`, em vez de duplicar a lógica de vendas ou tocar
// no módulo "Aparelhos"/RPC vender_aparelho(), que é específico daquela
// tabela.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { Button } from "@/components/ui/button";
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

type SeminovoRow = Database["public"]["Tables"]["seminovos"]["Row"];

const FORMAS_PAGAMENTO = ["Dinheiro", "PIX", "Débito", "Crédito", "Transferência", "Outros"];

export function VenderSeminovoModal({
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
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const [clienteId, setClienteId] = useState("");
  const [preco, setPreco] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (open && seminovo) {
      setClienteId(seminovo.cliente_id ?? "");
      setPreco(Number(seminovo.preco_venda ?? 0));
      setDesconto(0);
      setFormaPagamento("PIX");
      setObservacoes("");
    }
  }, [open, seminovo]);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-seminovos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const valorFinal = Math.max(preco - desconto, 0);
  const custoTotal = Number(seminovo?.valor_total_gasto ?? 0);
  const lucroReal = valorFinal - custoTotal;

  const vender = useMutation({
    mutationFn: async () => {
      if (!seminovo) throw new Error("Nenhum aparelho selecionado.");
      if (!clienteId) throw new Error("Selecione o cliente.");
      if (preco < 0 || desconto < 0) throw new Error("Valores não podem ser negativos.");

      const { data: venda, error: vendaErro } = await supabase
        .from("vendas")
        .insert({
          user_id: empresaId,
          cliente_id: clienteId,
          total: valorFinal,
          desconto,
          forma_pagamento: formaPagamento,
          observacoes: observacoes.trim() || null,
        })
        .select()
        .single();
      if (vendaErro) throw vendaErro;
      if (!venda) throw new Error("Erro ao criar venda");

      const { error: itemErro } = await supabase.from("venda_itens").insert({
        user_id: empresaId,
        venda_id: venda.id,
        descricao: `${seminovo.marca} ${seminovo.modelo} (seminovo)`,
        quantidade: 1,
        preco_unitario: valorFinal,
      });
      if (itemErro) throw itemErro;

      await supabase.from("lancamentos").insert({
        user_id: empresaId,
        tipo: "entrada",
        categoria: "Venda de seminovo",
        descricao: `Venda de ${seminovo.marca} ${seminovo.modelo} — #${String(venda.numero ?? venda.id.slice(0, 8))}`,
        valor: valorFinal,
        venda_id: venda.id,
      });

      const { error: atualizarErro } = await supabase
        .from("seminovos")
        .update({ status: "vendido", preco_venda: preco, venda_id: venda.id })
        .eq("id", seminovo.id);
      if (atualizarErro) throw atualizarErro;
    },
    onSuccess: () => {
      toast.success("Venda realizada com sucesso!");
      qc.invalidateQueries({ queryKey: ["seminovos"] });
      // Seminovos disponíveis espelham em Aparelhos (trigger no banco).
      qc.invalidateQueries({ queryKey: ["aparelhos"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!seminovo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Vender {seminovo.marca} {seminovo.modelo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Preço de venda</Label>
              <MoneyInput className="h-11" value={preco} onChange={setPreco} />
            </div>
            <div className="space-y-1.5">
              <Label>Desconto</Label>
              <MoneyInput className="h-11" value={desconto} onChange={setDesconto} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-xl bg-secondary/30 p-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total a receber</p>
              <p className="font-bold">{brl(valorFinal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Custo</p>
              <p className="font-bold">{brl(custoTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lucro</p>
              <p
                className={`font-bold ${lucroReal >= 0 ? "text-emerald-600" : "text-destructive"}`}
              >
                {brl(lucroReal)}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={() => vender.mutate()} disabled={vender.isPending}>
            {vender.isPending ? "Confirmando..." : "Confirmar venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
