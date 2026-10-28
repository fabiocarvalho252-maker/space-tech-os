import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, Search, Eye, Minus, ShoppingBag, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser, useEmpresaId } from "@/hooks/useCurrentUser";
import { dataBR, STATUS_VENDAS } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { hojeISO } from "@/lib/crediario";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  ComprovanteVendaDialog,
  type VendaParaComprovante,
} from "@/components/ComprovanteVendaDialog";
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

// O que basta para pôr um item no carrinho (produto do cadastro ou item já no carrinho).
type ProdutoAdicionavel = Pick<
  Tables<"produtos">,
  "id" | "nome" | "preco_venda" | "quantidade" | "categoria"
>;

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
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
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
  // Data local, não UTC: com toISOString() a venda feita depois das 21h
  // (UTC-3) vinha com a data de amanhã preenchida.
  const [dataVenda, setDataVenda] = useState(() => hojeISO());
  const [confirmRemover, setConfirmRemover] = useState<{ id: string; numero: number } | null>(null);
  const [comprovante, setComprovante] = useState<VendaParaComprovante | null>(null);

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("*, cliente:clientes(nome, telefone), itens:venda_itens(descricao)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
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

  function adicionar(p: ProdutoAdicionavel) {
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
      // Antes só o 2º clique checava o estoque — dava para vender 1 unidade
      // de um produto zerado, e o estoque ficava em 0 sem aviso.
      if (tipo === "Produto" && (p.quantidade || 0) <= 0) {
        toast.error(`${p.nome} está sem estoque`);
        return c;
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
    setDataVenda(hojeISO());
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!carrinho.length) throw new Error("Adicione ao menos um item à venda");
      if (!user) throw new Error("Usuário não autenticado");
      if (descontoNum > subtotal) throw new Error("O desconto não pode ser maior que o subtotal");

      const agora = new Date();
      const partes = dataVenda.split("-").map(Number);
      const createdAt = new Date(
        partes[0] ?? agora.getFullYear(),
        (partes[1] ?? agora.getMonth() + 1) - 1,
        partes[2] ?? agora.getDate(),
        agora.getHours(),
        agora.getMinutes(),
        agora.getSeconds(),
      ).toISOString();

      // Venda, itens, baixa de estoque e receita numa única transação no
      // banco (registrar_venda): ou grava tudo, ou nada.
      const { data, error: vendaErro } = await supabase.rpc("registrar_venda", {
        p_empresa_id: empresaId!,
        p_itens: carrinho.map((i) => ({
          produto_id: i.id,
          descricao: i.nome,
          quantidade: i.qtd,
          preco_unitario: i.preco,
        })),
        p_cliente_id: (clienteId || null) as string,
        p_desconto: descontoNum,
        p_forma_pagamento: formaPagamento,
        p_observacoes: (observacoes || null) as string,
        p_categoria: "Venda",
        p_data: dataVenda,
        p_created_at: createdAt,
      });
      if (vendaErro) throw vendaErro;
      const venda = data as unknown as { id: string; numero: number | null } | null;
      if (!venda) throw new Error("Erro ao criar venda");
      return venda;
    },
    onSuccess: (venda) => {
      toast.success("Venda registrada");
      const cliente = clientes.find((c) => c.id === clienteId);
      // Abre depois que a janela da venda termina de fechar (~200 ms de
      // animação) — abrir junto fazia uma janela atropelar a outra.
      const dadosComprovante: VendaParaComprovante = {
        id: venda.id,
        numero: venda.numero ?? null,
        clienteNome: cliente?.nome ?? null,
        clienteTelefone: cliente?.telefone ?? null,
      };
      setTimeout(() => setComprovante(dadosComprovante), 250);
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
      // Cancelar devolve o estoque e cancela a receita; reabrir não refazia
      // nada disso — e cancelar de novo devolvia o estoque pela 2ª vez.
      if (origem === "cancelado") {
        throw new Error("Venda cancelada não pode ser reaberta. Registre uma nova venda.");
      }
      // Fora isso, qualquer status pode ir para qualquer outro (sem fluxo).

      // Cancelar uma venda precisa desfazer os dois efeitos colaterais que a
      // criação dela causou: devolver ao estoque as unidades de produto
      // baixadas (itens tipo Serviço nunca baixaram estoque, então ficam de
      // fora) e tirar o lançamento de receita do financeiro/DRE — sem isso o
      // CMV para de contar o custo (já exclui vendas canceladas) mas a
      // receita continuava contando, inflando o lucro líquido artificialmente.
      if (status === "cancelado") {
        const { data: itens, error: itensErro } = await supabase
          .from("venda_itens")
          .select("produto_id, quantidade, aparelho_id")
          .eq("venda_id", id);
        if (itensErro) throw itensErro;
        // Venda de aparelho (módulo Aparelhos/Seminovos) tem função própria no
        // banco: devolve o aparelho ao estoque, cancela receita e garantia e
        // grava no histórico do aparelho — e já marca a venda como cancelada.
        if ((itens ?? []).some((i) => i.aparelho_id)) {
          const { error } = await supabase.rpc("cancelar_venda_aparelho", {
            p_venda_id: id,
            p_motivo: "Cancelada pela tela de Vendas",
          });
          if (error) throw error;
          return;
        }
        // Devolve o estoque, cancela a receita e marca a venda, tudo numa
        // transação só (cancelar_venda).
        const { error } = await supabase.rpc("cancelar_venda", { p_venda_id: id });
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("vendas").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["produtos-vendas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-home"] });
      qc.invalidateQueries({ queryKey: ["aparelhos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      // Devolve o estoque (se a venda não estava cancelada) e apaga venda,
      // itens e lançamento numa transação só (excluir_venda). Venda de
      // aparelho ativa é recusada lá — precisa ser cancelada antes.
      const { error } = await supabase.rpc("excluir_venda", { p_venda_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda removida");
      setConfirmRemover(null);
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["produtos-vendas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmRemover(null);
    },
  });

  const filtrados = useMemo(() => {
    let base = filtro === "todas" ? vendas : vendas.filter((v) => v.status === filtro);
    const q = busca.trim().toLowerCase();
    if (q) {
      // The embedded item descriptions let the counter find a sale by what
      // was sold ("película A54"), not only by number or client.
      base = base.filter((v) =>
        [
          v.numero?.toString(),
          v.cliente?.nome,
          v.cliente?.telefone,
          v.forma_pagamento,
          ...(v.itens ?? []).map((i: { descricao: string }) => i.descricao),
        ].some((campo) => campo?.toLowerCase().includes(q)),
      );
    }
    return base;
  }, [vendas, filtro, busca]);

  const itensProduto = produtos.filter(
    (p) =>
      p.nome.toLowerCase().includes(buscaItem.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(buscaItem.toLowerCase())) ||
      (!!p.codigo_barras && p.codigo_barras === buscaItem.trim()),
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
                <div className="space-y-1.5">
                  <Label>Data da venda</Label>
                  <Input
                    type="date"
                    value={dataVenda}
                    onChange={(e) => setDataVenda(e.target.value)}
                  />
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

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar venda por nº, cliente, telefone, produto ou pagamento..."
          className="h-11 pl-9 pr-9"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar pesquisa"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

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
                      disabled={v.status === "cancelado"}
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
                        onClick={() =>
                          setComprovante({
                            id: v.id,
                            numero: v.numero,
                            clienteNome: v.cliente?.nome ?? null,
                            clienteTelefone: v.cliente?.telefone ?? null,
                          })
                        }
                        className="text-muted-foreground transition hover:text-primary"
                        aria-label="Comprovante"
                        title="Comprovante da venda"
                      >
                        <Receipt className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDetalheId(v.id)}
                        className="text-muted-foreground transition hover:text-primary"
                        aria-label="Ver itens"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmRemover({ id: v.id, numero: v.numero })}
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

      <ComprovanteVendaDialog venda={comprovante} onClose={() => setComprovante(null)} />

      <ConfirmDialog
        open={!!confirmRemover}
        onOpenChange={(v) => !v && setConfirmRemover(null)}
        title="Deseja realmente excluir esta venda?"
        description={
          confirmRemover
            ? `A venda #${String(confirmRemover.numero).padStart(4, "0")} e a receita dela no Financeiro serão apagadas, e os produtos voltam para o estoque. Para manter o histórico, prefira mudar o status para Cancelado.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        loading={remover.isPending}
        onConfirm={() => confirmRemover && remover.mutate(confirmRemover.id)}
      />

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
