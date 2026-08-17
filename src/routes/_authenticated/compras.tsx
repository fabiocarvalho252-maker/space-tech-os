import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, Package, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser, useEmpresaId } from "@/hooks/useCurrentUser";
import { dataBR, STATUS_COMPRAS, statusLabel } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MoneyInput } from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({
    meta: [
      { title: "Compras — SpaceTech" },
      { name: "description", content: "Compras de peças e produtos junto a fornecedores." },
    ],
  }),
  component: Compras,
});

const FORMAS_PAGAMENTO = ["Dinheiro", "PIX", "Débito", "Crédito", "Transferência", "Outros"];

const TONE_POR_STATUS: Record<string, StatusTone> = {
  aberto: "neutral",
  aprovado: "info",
  em_andamento: "purple",
  recebido: "warning",
  finalizado: "success",
  faturado: "success",
  cancelado: "danger",
};

type ItemForm = { produto_id: string; descricao: string; quantidade: string; custo_unitario: string };
const itemVazio: ItemForm = { produto_id: "", descricao: "", quantidade: "1", custo_unitario: "0" };

function Compras() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [verId, setVerId] = useState<string | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<{ id: string; fornecedor: string } | null>(
    null,
  );

  const [fornecedorId, setFornecedorId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [novoItem, setNovoItem] = useState<ItemForm>(itemVazio);

  const { data: compras = [], isLoading } = useQuery({
    queryKey: ["compras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras" as any)
        .select("*, fornecedor:fornecedores(razao_social, nome_fantasia)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const { data: itensDaCompra = [] } = useQuery({
    queryKey: ["compra-itens", verId],
    enabled: !!verId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compra_itens" as any)
        .select("*")
        .eq("compra_id", verId);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-compras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, razao_social, nome_fantasia")
        .order("razao_social");
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-compras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, preco_custo, quantidade")
        .neq("categoria", "Serviço")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: purchaseConfig } = useQuery({
    queryKey: ["purchase-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_config" as any).select("*").maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  const { data: statusFlows = [] } = useQuery({
    queryKey: ["purchase-status-flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_status_flows" as any)
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  function fecharDialog() {
    setOpen(false);
    setFornecedorId("");
    setFormaPagamento("");
    setObservacoes("");
    setItens([]);
    setNovoItem(itemVazio);
  }

  function adicionarItem() {
    if (!novoItem.produto_id) {
      toast.error("Selecione o produto.");
      return;
    }
    const produto = produtos.find((p) => p.id === novoItem.produto_id);
    setItens((prev) => [
      ...prev,
      { ...novoItem, descricao: produto?.nome ?? novoItem.descricao },
    ]);
    setNovoItem(itemVazio);
  }

  const totalNovaCompra = itens.reduce(
    (s, i) => s + (parseFloat(i.quantidade) || 0) * (parseFloat(i.custo_unitario) || 0),
    0,
  );

  const criar = useMutation({
    mutationFn: async () => {
      if (!fornecedorId) throw new Error("Selecione o fornecedor.");
      if (!itens.length) throw new Error("Adicione ao menos um item.");

      const { data: compra, error: compraErro } = await supabase
        .from("compras" as any)
        .insert({
          user_id: empresaId!,
          fornecedor_id: fornecedorId,
          forma_pagamento: formaPagamento || null,
          observacoes: observacoes || null,
          valor_total: totalNovaCompra,
        })
        .select()
        .single();
      if (compraErro) throw compraErro;

      const { error: itensErro } = await supabase.from("compra_itens" as any).insert(
        itens.map((i) => ({
          user_id: empresaId!,
          compra_id: (compra as any).id,
          produto_id: i.produto_id || null,
          descricao: i.descricao,
          quantidade: parseFloat(i.quantidade) || 1,
          custo_unitario: parseFloat(i.custo_unitario) || 0,
        })),
      );
      if (itensErro) throw itensErro;
    },
    onSuccess: () => {
      toast.success("Compra registrada.");
      fecharDialog();
      qc.invalidateQueries({ queryKey: ["compras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status, origem }: { id: string; status: string; origem: string }) => {
      if (statusFlows.length > 0) {
        const permitido = statusFlows.some(
          (f) => f.from_status === origem && f.to_status === status,
        );
        if (!permitido) {
          throw new Error(
            `Transição de ${statusLabel(origem)} para ${statusLabel(status)} não permitida no seu fluxo.`,
          );
        }
      }

      const compra = compras.find((c) => c.id === id);

      // Entrada automática no estoque ao marcar como recebido — só uma vez
      // por compra, senão reabrir/editar o status duplicaria a entrada.
      if (status === "recebido" && !compra?.recebido_em) {
        const { data: itensCompra, error: itensErro } = await supabase
          .from("compra_itens" as any)
          .select("produto_id, quantidade")
          .eq("compra_id", id);
        if (itensErro) throw itensErro;
        for (const item of (itensCompra as any[]) ?? []) {
          if (!item.produto_id) continue;
          const { data: produto } = await supabase
            .from("produtos")
            .select("quantidade")
            .eq("id", item.produto_id)
            .single();
          if (produto) {
            await supabase
              .from("produtos")
              .update({ quantidade: (produto.quantidade || 0) + Number(item.quantidade) })
              .eq("id", item.produto_id);
          }
        }
      }

      const situacaoFaturar = purchaseConfig?.situacao_faturar || "faturado";
      const patch: Record<string, unknown> = { status };
      if (status === "recebido" && !compra?.recebido_em)
        patch["recebido_em"] = new Date().toISOString();
      if (status === situacaoFaturar && !compra?.faturado_em) {
        patch["faturado_em"] = new Date().toISOString();
        await supabase.from("lancamentos").insert({
          user_id: empresaId!,
          tipo: "saida",
          categoria: "Compra de fornecedor",
          descricao: `Compra #${id.slice(0, 8)}`,
          valor: compra?.valor_total ?? 0,
        });
      }

      const { error } = await supabase.from("compras" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["produtos-compras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compras" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compra removida.");
      setConfirmExcluir(null);
      qc.invalidateQueries({ queryKey: ["compras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtradas = compras.filter((c) => {
    const nomeFornecedor = c.fornecedor?.nome_fantasia || c.fornecedor?.razao_social || "";
    return nomeFornecedor.toLowerCase().includes(busca.toLowerCase());
  });

  return (
    <div>
      <PageHeader
        title="Compras"
        subtitle="Reposição de estoque junto aos fornecedores."
        action={
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Compra
          </Button>
        }
      />

      <SearchInput
        value={busca}
        onChange={setBusca}
        placeholder="Buscar por fornecedor..."
        className="mb-4 max-w-md"
      />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Fornecedor</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-4">
                  <TableSkeleton />
                </td>
              </tr>
            ) : !filtradas.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-4">
                  <EmptyState
                    icon={ShoppingCart}
                    title="Nenhuma compra registrada"
                    description="Registre uma compra de peças/produtos junto a um fornecedor para repor o estoque."
                  />
                </td>
              </tr>
            ) : (
              filtradas.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">
                    {c.fornecedor?.nome_fantasia || c.fornecedor?.razao_social || "Fornecedor removido"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{dataBR(c.created_at)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{brl(c.valor_total)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={c.status}
                      onChange={(e) =>
                        mudarStatus.mutate({ id: c.id, status: e.target.value, origem: c.status })
                      }
                      className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                    >
                      {STATUS_COMPRAS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1">
                      <StatusBadge
                        label={statusLabel(c.status)}
                        tone={TONE_POR_STATUS[c.status] ?? "neutral"}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setVerId(c.id)}
                        className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        title="Ver itens"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          setConfirmExcluir({
                            id: c.id,
                            fornecedor:
                              c.fornecedor?.nome_fantasia || c.fornecedor?.razao_social || "compra",
                          })
                        }
                        className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(v) => !v && fecharDialog()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Compra</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Fornecedor</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_fantasia || f.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Forma de pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
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
            </div>

            <div className="space-y-2 rounded-xl border border-border p-3">
              <Label>Itens</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_90px_120px_40px] sm:items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Produto</Label>
                  <Select
                    value={novoItem.produto_id}
                    onValueChange={(v) => {
                      const p = produtos.find((x) => x.id === v);
                      setNovoItem((it) => ({
                        ...it,
                        produto_id: v,
                        custo_unitario: p ? String(p.preco_custo) : it.custo_unitario,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Qtd</Label>
                  <Input
                    type="number"
                    min={1}
                    value={novoItem.quantidade}
                    onChange={(e) => setNovoItem((it) => ({ ...it, quantidade: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Custo unit.</Label>
                  <MoneyInput
                    value={novoItem.custo_unitario}
                    onChange={(v) => setNovoItem((it) => ({ ...it, custo_unitario: String(v) }))}
                  />
                </div>
                <Button type="button" size="icon" onClick={adicionarItem} className="mb-0.5">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {itens.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {itens.map((i, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        {i.quantidade}x {i.descricao} — {brl(parseFloat(i.custo_unitario) || 0)}
                      </span>
                      <button
                        onClick={() => setItens((prev) => prev.filter((_, x) => x !== idx))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <p className="pt-1 text-right text-sm font-bold">Total: {brl(totalNovaCompra)}</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fecharDialog}>
              Cancelar
            </Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
              {criar.isPending ? "Salvando..." : "Registrar Compra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!verId} onOpenChange={(v) => !v && setVerId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Itens da compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {itensDaCompra.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
              >
                <span>
                  {i.quantidade}x {i.descricao}
                </span>
                <span className="font-semibold">
                  {brl(Number(i.quantidade) * Number(i.custo_unitario))}
                </span>
              </div>
            ))}
            {!itensDaCompra.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">Carregando...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmExcluir}
        onOpenChange={(v) => !v && setConfirmExcluir(null)}
        title="Deseja realmente excluir esta compra?"
        description={confirmExcluir ? `A compra de "${confirmExcluir.fornecedor}" será removida permanentemente.` : ""}
        confirmLabel="Excluir"
        destructive
        loading={remover.isPending}
        onConfirm={() => confirmExcluir && remover.mutate(confirmExcluir.id)}
      />
    </div>
  );
}
