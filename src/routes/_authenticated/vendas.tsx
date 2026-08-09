import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, Search, Eye, Minus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { brl, dataBR, STATUS_VENDAS, statusLabel } from "@/lib/format";
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
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas — SpaceTech" },
      { name: "description", content: "Histórico e gestão das vendas da sua assistência técnica." },
      { property: "og:title", content: "Vendas — SpaceTech" },
      {
        property: "og:description",
        content: "Acompanhe orçamentos, negociações e vendas faturadas.",
      },
    ],
  }),
  component: Vendas,
});

const FORMAS_PAGAMENTO = ["Dinheiro", "PIX", "Débito", "Crédito", "Transferência", "Outros"];

type CartItem = {
  id: string;
  nome: string;
  preco: number;
  qtd: number;
  estoque: number;
  tipo: "Produto" | "Serviço";
};

function Vendas() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string>("todas");
  const [open, setOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  const [buscaItem, setBuscaItem] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("*, cliente:clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-vendas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-vendas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: statusFlows = [] } = useQuery({
    queryKey: ["sale-status-flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_status_flows")
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: itensDetalhe = [] } = useQuery({
    queryKey: ["venda-itens", detalheId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venda_itens")
        .select("*")
        .eq("venda_id", detalheId as string);
      if (error) throw error;
      return data;
    },
    enabled: !!detalheId,
  });

  function adicionar(p: any) {
    setCarrinho((c) => {
      const existe = c.find((i) => i.id === p.id);
      const tipo: CartItem["tipo"] = p.categoria === "Serviço" ? "Serviço" : "Produto";
      if (existe) {
        if (tipo === "Produto" && existe.qtd >= (p.quantidade || 0)) {
          toast.error("Limite de estoque atingido");
          return c;
        }
        return c.map((i) => (i.id === p.id ? { ...i, qtd: i.qtd + 1 } : i));
      }
      return [
        ...c,
        {
          id: p.id,
          nome: p.nome,
          preco: Number(p.preco_venda),
          qtd: 1,
          estoque: p.quantidade || 0,
          tipo,
        },
      ];
    });
  }

  const subtotal = carrinho.reduce((s, i) => s + i.preco * i.qtd, 0);
  const descontoNum = Math.max(0, Number(desconto) || 0);
  const total = Math.max(0, subtotal - descontoNum);

  const resetForm = () => {
    setCarrinho([]);
    setBuscaItem("");
    setClienteId("");
    setFormaPagamento("PIX");
    setDesconto("0");
    setObservacoes("");
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!carrinho.length) throw new Error("Adicione ao menos um item à venda");
      if (!user) throw new Error("Usuário não autenticado");

      const { data: venda, error: vendaErro } = await supabase
        .from("vendas")
        .insert({
          user_id: user.id,
          cliente_id: clienteId || null,
          total,
          desconto: descontoNum,
          forma_pagamento: formaPagamento,
          observacoes: observacoes || null,
        })
        .select()
        .single();
      if (vendaErro) throw vendaErro;
      if (!venda) throw new Error("Erro ao criar venda");

      const { error: itensErro } = await supabase.from("venda_itens").insert(
        carrinho.map((i) => ({
          user_id: user.id,
          venda_id: venda.id,
          produto_id: i.id,
          descricao: i.nome,
          quantidade: i.qtd,
          preco_unitario: i.preco,
        })),
      );
      if (itensErro) throw itensErro;

      for (const item of carrinho) {
        if (item.tipo === "Produto") {
          const { data: p } = await supabase
            .from("produtos")
            .select("quantidade")
            .eq("id", item.id)
            .single();
          if (p) {
            await supabase
              .from("produtos")
              .update({ quantidade: Math.max(0, p.quantidade - item.qtd) })
              .eq("id", item.id);
          }
        }
      }

      await supabase.from("lancamentos").insert({
        user_id: user.id,
        tipo: "entrada",
        categoria: "Venda",
        descricao: `Venda #${String(venda.numero ?? venda.id.slice(0, 8)).padStart(4, "0")}`,
        valor: total,
      });
    },
    onSuccess: () => {
      toast.success("Venda registrada");
      resetForm();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["produtos-vendas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status, origem }: { id: string; status: string; origem?: string }) => {
      if (origem && statusFlows && statusFlows.length > 0) {
        const permitido = statusFlows.some((f) => f.origem === origem && f.destino === status);
        if (!permitido) {
          throw new Error(
            `Transição de ${statusLabel(origem)} para ${statusLabel(status)} não permitida no fluxo.`,
          );
        }
      }
      const { error } = await supabase.from("vendas").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda removida");
      qc.invalidateQueries({ queryKey: ["vendas"] });
    },
  });

  const filtrados = useMemo(() => {
    let base = filtro === "todas" ? vendas : vendas.filter((v) => v.status === filtro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      base = base.filter((v) =>
        `${v.numero ?? ""} ${v.cliente?.nome ?? ""}`.toLowerCase().includes(q),
      );
    }
    return base;
  }, [vendas, filtro, busca]);

  const itensProduto = produtos.filter(
    (p) =>
      p.nome.toLowerCase().includes(buscaItem.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(buscaItem.toLowerCase())),
  );

  const detalheVenda = vendas.find((v) => v.id === detalheId);

  return (
    <div>
      <PageHeader
        title="Vendas"
        subtitle="Orçamentos, negociações e vendas faturadas"
        action={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Nova venda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Nova venda</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Cliente</Label>
                  <Select
                    value={clienteId || "none"}
                    onValueChange={(v) => setClienteId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Consumidor final" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Consumidor final</SelectItem>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Forma de pagamento</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger>
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
              </div>

              <div className="space-y-1.5">
                <Label>Produtos e serviços</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={buscaItem}
                    onChange={(e) => setBuscaItem(e.target.value)}
                    placeholder="Buscar produto ou serviço..."
                    className="pl-9"
                  />
                </div>
                {buscaItem && (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border">
                    {itensProduto.slice(0, 8).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          adicionar(p);
                          setBuscaItem("");
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-muted"
                      >
                        <span className="truncate">{p.nome}</span>
                        <span className="shrink-0 font-semibold text-primary">
                          {brl(p.preco_venda)}
                        </span>
                      </button>
                    ))}
                    {!itensProduto.length && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Nada encontrado.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-border p-3">
                {carrinho.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {brl(item.preco)} · {item.tipo}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setCarrinho((c) =>
                            c.map((x) =>
                              x.id === item.id ? { ...x, qtd: Math.max(1, x.qtd - 1) } : x,
                            ),
                          )
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:bg-muted"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{item.qtd}</span>
                      <button
                        onClick={() =>
                          adicionar({
                            id: item.id,
                            nome: item.nome,
                            preco_venda: item.preco,
                            quantidade: item.estoque,
                            categoria: item.tipo,
                          })
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:bg-muted"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => setCarrinho((c) => c.filter((x) => x.id !== item.id))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {!carrinho.length && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Busque acima para adicionar itens.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Desconto (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="text-sm text-muted-foreground">
                  Subtotal {brl(subtotal)} {descontoNum > 0 && `− desconto ${brl(descontoNum)}`}
                </div>
                <div className="text-2xl font-black text-primary">{brl(total)}</div>
              </div>

              <Button onClick={() => criar.mutate()} disabled={criar.isPending || !carrinho.length}>
                Registrar venda
              </Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[{ value: "todas", label: "Todas" }, ...STATUS_VENDAS].map((s) => (
          <button
            key={s.value}
            onClick={() => setFiltro(s.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filtro === s.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por número ou cliente..."
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="hidden px-4 py-3 sm:table-cell">Pagamento</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 font-medium">
                    #{String(v.numero ?? "—").padStart(4, "0")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{dataBR(v.created_at)}</td>
                  <td className="px-4 py-3">{v.cliente?.nome ?? "Consumidor final"}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {v.forma_pagamento}
                  </td>
                  <td className="px-4 py-3 font-semibold">{brl(v.total)}</td>
                  <td className="p-3">
                    <select
                      value={v.status ?? "aberto"}
                      onChange={(e) =>
                        mudarStatus.mutate({ id: v.id, status: e.target.value, origem: v.status })
                      }
                      className={`h-8 w-full rounded-lg border border-input px-2 text-xs font-medium transition ${
                        v.status === "faturado" || v.status === "finalizado"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : v.status === "cancelado"
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-primary/10 text-primary border-primary/20"
                      }`}
                    >
                      {STATUS_VENDAS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDetalheId(v.id)}
                        className="text-muted-foreground transition hover:text-primary"
                        aria-label="Ver itens"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remover.mutate(v.id)}
                        className="text-muted-foreground transition hover:text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtrados.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!detalheId} onOpenChange={(v) => !v && setDetalheId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Venda #{String(detalheVenda?.numero ?? "—").padStart(4, "0")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {itensDetalhe.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span>
                  {i.quantidade}x {i.descricao}
                </span>
                <span className="font-medium">{brl(i.preco_unitario * i.quantidade)}</span>
              </div>
            ))}
            {!itensDetalhe.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sem itens registrados.
              </p>
            )}
          </div>
          {detalheVenda && (
            <div className="space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Desconto</span>
                <span>{brl(detalheVenda.desconto ?? 0)}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{brl(detalheVenda.total)}</span>
              </div>
              {detalheVenda.observacoes && (
                <p className="pt-2 text-xs text-muted-foreground">{detalheVenda.observacoes}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
