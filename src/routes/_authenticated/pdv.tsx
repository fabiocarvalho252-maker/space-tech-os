import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Trash2,
  FileCheck,
  Search,
  Plus,
  Minus,
  Clock,
  Check,
  Package,
  Wrench,
  ClipboardList,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useCurrentUser, useEmpresaId } from "@/hooks/useCurrentUser";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { teclasDaTela } from "@/lib/atalhos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClienteCampo } from "@/components/ClienteRapido";
import { CaixaDialog } from "@/components/CaixaDialog";
import { useCaixa } from "@/hooks/useCaixa";
import {
  ComprovanteVendaDialog,
  type VendaParaComprovante,
} from "@/components/ComprovanteVendaDialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// O que basta para pôr um item no carrinho (produto do cadastro ou item já no carrinho).
type ProdutoAdicionavel = Pick<
  Tables<"produtos">,
  "id" | "nome" | "preco_venda" | "quantidade" | "categoria"
>;

export const Route = createFileRoute("/_authenticated/pdv")({
  head: () => ({
    meta: [
      { title: "PDV — SpaceTech" },
      { name: "description", content: "Frente de caixa rápida e intuitiva." },
      { property: "og:title", content: "PDV — SpaceTech" },
    ],
  }),
  component: PDV,
});

const FORMAS_PAGAMENTO = ["Dinheiro", "PIX", "Débito", "Crédito", "Transferência", "Outros"];

type Item = {
  id: string;
  nome: string;
  preco: number;
  qtd: number;
  estoque: number;
  tipo: "Produto" | "Serviço";
};

// "10*iphone" -> busca por "iphone" com 10 unidades por clique/leitura, igual
// ao placeholder do campo de busca sempre prometeu mas nunca implementou.
function parseBusca(busca: string): { termo: string; qtd: number } {
  const m = busca.match(/^(\d+)\*(.*)$/);
  if (!m) return { termo: busca, qtd: 1 };
  return { termo: m[2] ?? "", qtd: Math.max(1, parseInt(m[1]!, 10) || 1) };
}

// Busca de cliente sem diferenciar acentos/maiúsculas ("joao" acha "João").
const normalizarBusca = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// Atalhos do PDV. F2/F4/F9 valem também com o cursor no campo de busca; o
// atalho global das mesmas teclas (Produtos, Ordens, Seminovos) fica suspenso
// enquanto o PDV está aberto.
const TECLAS_PDV = ["F2", "F4", "F9"];

// Leitor de código de barras manda o código + Enter: acha pelo código de
// barras e, se não houver, pelo SKU.
function acharPorCodigo<T extends { codigo_barras?: string | null; sku: string | null }>(
  produtos: T[],
  termo: string,
): T | undefined {
  const t = termo.trim().toLowerCase();
  if (!t) return undefined;
  return (
    produtos.find((p) => p.codigo_barras?.toLowerCase() === t) ??
    produtos.find((p) => p.sku?.toLowerCase() === t)
  );
}

function bateBusca(
  p: { nome: string; sku: string | null; codigo_barras?: string | null },
  termo: string,
) {
  const t = termo.toLowerCase();
  return (
    p.nome.toLowerCase().includes(t) ||
    (!!p.sku && p.sku.toLowerCase().includes(t)) ||
    (!!p.codigo_barras && p.codigo_barras.toLowerCase().includes(t.trim()))
  );
}

function tipoDoItem(categoria: string | null): "Produto" | "Serviço" {
  return categoria === "Serviço" ? "Serviço" : "Produto";
}

function PDV() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const [carrinho, setCarrinho] = useState<Item[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"Tudo" | "Produto" | "Serviço">("Tudo");
  const [observacoes, setObservacoes] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [descontoTipo, setDescontoTipo] = useState<"valor" | "percentual">("valor");
  const [descontoInput, setDescontoInput] = useState("");
  const [finalizarAberto, setFinalizarAberto] = useState(false);
  // Painel "Nova venda": cliente, produtos, desconto e pagamento num lugar só.
  const [painelAberto, setPainelAberto] = useState(false);
  const [buscaPainel, setBuscaPainel] = useState("");
  // Etapas do painel (pedido do usuário): 1 produtos → 2 cliente → 3 pagamento.
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [comprovante, setComprovante] = useState<VendaParaComprovante | null>(null);
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [valorRecebidoInput, setValorRecebidoInput] = useState("");
  const { caixa, controleAtivo } = useCaixa(empresaId);
  const [caixaDialogAberto, setCaixaDialogAberto] = useState(false);
  // Com "Controle de caixa" ligado em Configurações, só vende com caixa aberto.
  const caixaBloqueado = controleAtivo && !caixa;
  const buscaRef = useRef<HTMLInputElement>(null);
  const buscaPainelRef = useRef<HTMLInputElement>(null);

  const { data: produtos = [] } = useQuery({
    queryKey: ["pdv-itens"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-pdv"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome, telefone").order("nome");
      return data ?? [];
    },
  });

  const selectedCliente = useMemo(
    () => clientes.find((c) => c.id === clienteId)?.nome || "Consumidor Final",
    [clientes, clienteId],
  );

  const subtotal = carrinho.reduce((s, i) => s + i.preco * i.qtd, 0);
  const descontoBruto = Math.max(0, Number(descontoInput.replace(",", ".")) || 0);
  const desconto = Math.min(
    subtotal,
    Math.round(
      (descontoTipo === "percentual"
        ? (subtotal * Math.min(descontoBruto, 100)) / 100
        : descontoBruto) * 100,
    ) / 100,
  );
  const total = Math.max(0, subtotal - desconto);
  const valorRecebido = Math.max(0, Number(valorRecebidoInput.replace(",", ".")) || 0);
  const troco = Math.max(0, Math.round((valorRecebido - total) * 100) / 100);

  const agora = new Date();
  const dataFormatada = agora.toLocaleDateString("pt-BR");
  const horaFormatada = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function adicionar(p: ProdutoAdicionavel, qtdAdicional = 1) {
    const tipo = tipoDoItem(p.categoria);
    setCarrinho((c) => {
      const existe = c.find((i) => i.id === p.id);
      const qtdFinal = (existe?.qtd ?? 0) + qtdAdicional;
      // Serviço não tem estoque de verdade — só produto é limitado.
      if (tipo === "Produto" && qtdFinal > (p.quantidade || 0)) {
        toast.error(
          (p.quantidade || 0) <= 0 ? `${p.nome} está sem estoque` : "Limite de estoque atingido",
        );
        return c;
      }
      if (existe) {
        return c.map((i) => (i.id === p.id ? { ...i, qtd: qtdFinal } : i));
      }
      return [
        ...c,
        {
          id: p.id,
          nome: p.nome,
          preco: Number(p.preco_venda),
          qtd: qtdAdicional,
          estoque: p.quantidade || 0,
          tipo,
        },
      ];
    });
  }

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!carrinho.length) throw new Error("Carrinho vazio");
      if (!user) throw new Error("Usuário não autenticado");
      if (caixaBloqueado) throw new Error("Abra o caixa antes de finalizar a venda");
      if (formaPagamento === "Dinheiro" && valorRecebidoInput && valorRecebido < total) {
        throw new Error("Valor recebido é menor que o total");
      }

      // Venda, itens, baixa de estoque e receita numa única transação no
      // banco (registrar_venda): ou grava tudo, ou nada.
      const { data: venda, error: vendaErro } = await supabase.rpc("registrar_venda", {
        p_empresa_id: empresaId!,
        p_itens: carrinho.map((i) => ({
          produto_id: i.id,
          descricao: i.nome,
          quantidade: i.qtd,
          preco_unitario: i.preco,
        })),
        p_cliente_id: clienteId as string,
        p_desconto: desconto,
        p_forma_pagamento: formaPagamento,
        p_observacoes: (observacoes.trim() || null) as string,
        p_categoria: "Venda PDV",
      });
      if (vendaErro) throw vendaErro;
      if (!venda) throw new Error("Erro ao criar venda");
      return venda as { id: string; numero: number | null };
    },
    onSuccess: (venda) => {
      toast.success("Venda finalizada com sucesso!");
      // Antes de limpar o cliente da tela: o comprovante abre logo em seguida.
      const cliente = clientes.find((c) => c.id === clienteId);
      // Abre depois que a janela da venda termina de fechar (~200 ms de
      // animação) — abrir junto fazia uma janela atropelar a outra.
      const dadosComprovante: VendaParaComprovante = {
        id: venda.id,
        numero: venda.numero,
        clienteNome: cliente?.nome ?? null,
        clienteTelefone: cliente?.telefone ?? null,
      };
      setTimeout(() => setComprovante(dadosComprovante), 250);
      setCarrinho([]);
      setObservacoes("");
      setClienteId(null);
      setDescontoInput("");
      setValorRecebidoInput("");
      setFormaPagamento("PIX");
      setFinalizarAberto(false);
      setPainelAberto(false);
      setBuscaPainel("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { termo: termoBusca, qtd: qtdBusca } = parseBusca(busca);

  const filtrados = produtos.filter((p) => {
    if (filtroTipo !== "Tudo" && tipoDoItem(p.categoria) !== filtroTipo) return false;
    return bateBusca(p, termoBusca);
  });

  const { termo: termoPainel, qtd: qtdPainel } = parseBusca(buscaPainel);
  const resultadosPainel = termoPainel.trim()
    ? produtos.filter((p) => bateBusca(p, termoPainel)).slice(0, 8)
    : [];

  function adicionarDoPainel(p: ProdutoAdicionavel) {
    adicionar(p, qtdPainel);
    setBuscaPainel("");
  }

  function iniciarNovaVenda() {
    setCarrinho([]);
    setObservacoes("");
    setClienteId(null);
    setDescontoInput("");
    setValorRecebidoInput("");
    setFormaPagamento("PIX");
    setBusca("");
    setBuscaPainel("");
    setEtapa(1);
    setPainelAberto(true);
  }

  function abrirPainel() {
    setEtapa(1);
    setPainelAberto(true);
  }

  // Enter no campo de busca (é o que o leitor de código de barras manda).
  function adicionarPorEnter(termo: string, qtd: number, resultados: typeof produtos) {
    const alvo =
      acharPorCodigo(produtos, termo) ?? (resultados.length === 1 ? resultados[0] : null);
    if (alvo) {
      adicionar(alvo, qtd);
      return true;
    }
    if (/^\d{6,}$/.test(termo.trim())) toast.error(`Código ${termo.trim()} não cadastrado`);
    return false;
  }

  // As funções mudam a cada render; o listener lê sempre a versão atual.
  const teclaRef = useRef<(e: KeyboardEvent) => void>(() => {});
  teclaRef.current = (e: KeyboardEvent) => {
    if (comprovante || caixaDialogAberto) return;
    if (e.key === "F2") {
      e.preventDefault();
      if (finalizarAberto) return;
      if (painelAberto) {
        setEtapa(1);
        setTimeout(() => buscaPainelRef.current?.focus(), 0);
      } else {
        buscaRef.current?.focus();
        buscaRef.current?.select();
      }
    } else if (e.key === "F4") {
      e.preventDefault();
      if (finalizar.isPending) return;
      setFinalizarAberto(false);
      setEtapa(2);
      setPainelAberto(true);
    } else if (e.key === "F9") {
      e.preventDefault();
      if (!carrinho.length) {
        toast.error("Adicione itens antes de finalizar");
        return;
      }
      if (finalizar.isPending) return;
      if (finalizarAberto || (painelAberto && etapa === 3)) finalizar.mutate();
      else if (painelAberto) setEtapa(3);
      else setFinalizarAberto(true);
    } else if (e.key === "Escape" && !painelAberto && !finalizarAberto && busca) {
      setBusca("");
    }
  };

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => teclaRef.current(e);
    TECLAS_PDV.forEach((t) => teclasDaTela.add(t));
    window.addEventListener("keydown", aoTeclar);
    return () => {
      TECLAS_PDV.forEach((t) => teclasDaTela.delete(t));
      window.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  const descontoCampo = (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Desconto
      </Label>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
          {(["valor", "percentual"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setDescontoTipo(t)}
              className={`h-8 w-10 rounded-lg ${
                descontoTipo === t ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "valor" ? "R$" : "%"}
            </Button>
          ))}
        </div>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={descontoTipo === "percentual" ? 100 : undefined}
          step="0.01"
          value={descontoInput}
          onChange={(e) => setDescontoInput(e.target.value)}
          className="h-10 flex-1 rounded-xl border-border/50 bg-background"
          placeholder={descontoTipo === "valor" ? "0,00" : "0"}
        />
      </div>
    </div>
  );

  const pagamentoCampos = (
    <>
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Forma de pagamento
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {FORMAS_PAGAMENTO.map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={formaPagamento === f ? "default" : "outline"}
              onClick={() => setFormaPagamento(f)}
              className="h-9 rounded-xl"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {formaPagamento === "Dinheiro" && (
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Valor recebido
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={valorRecebidoInput}
            onChange={(e) => setValorRecebidoInput(e.target.value)}
            className="h-10 rounded-xl"
            placeholder="0,00"
          />
          {valorRecebido > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Troco</span>
              <span className="font-bold">{brl(troco)}</span>
            </div>
          )}
        </div>
      )}
    </>
  );

  const resumoDesconto = desconto > 0 && (
    <div className="space-y-1 text-sm">
      <div className="flex items-center justify-between text-muted-foreground">
        <span>Subtotal</span>
        <span>{brl(subtotal)}</span>
      </div>
      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
        <span>
          Desconto{descontoTipo === "percentual" ? ` (${Math.min(descontoBruto, 100)}%)` : ""}
        </span>
        <span>− {brl(desconto)}</span>
      </div>
    </div>
  );

  const userName = user?.email?.split("@")?.[0]?.replace(/\./g, " ") || "Usuário";

  return (
    <div className="flex flex-col gap-6 pb-24 lg:h-[calc(100vh-120px)] lg:overflow-hidden lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">PDV</h1>
            <p className="truncate text-sm text-muted-foreground">
              Boa noite, <span className="font-semibold text-foreground uppercase">{userName}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-right">
          <Button
            variant="outline"
            className="h-10 gap-2 rounded-xl"
            onClick={() => setCaixaDialogAberto(true)}
          >
            <span
              className={`h-2 w-2 rounded-full ${caixa ? "bg-emerald-500" : controleAtivo ? "bg-red-500" : "bg-muted-foreground/40"}`}
            />
            <Wallet className="h-4 w-4" />
            {caixa ? "Caixa aberto" : "Caixa"}
          </Button>
          <div className="hidden items-center justify-end gap-2 text-sm font-medium sm:flex">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{dataFormatada}</span>
            <span className="text-muted-foreground">|</span>
            <span>{horaFormatada}</span>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_400px] lg:overflow-hidden">
        <div className="flex flex-col gap-4 lg:overflow-hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-xl bg-primary/5 text-primary hover:bg-primary/10"
              onClick={iniciarNovaVenda}
            >
              <Plus className="h-4 w-4" /> Nova venda
            </Button>
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-xl hover:bg-muted"
              onClick={() => navigate({ to: "/ordens" })}
            >
              <ClipboardList className="h-4 w-4" /> Entregar OS
            </Button>
            <div className="ml-auto hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
              {[
                ["F2", "Buscar"],
                ["F4", "Cliente"],
                ["F9", "Finalizar"],
                ["Esc", "Limpar busca"],
              ].map(([tecla, acao]) => (
                <span key={tecla} className="flex items-center gap-1">
                  <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                    {tecla}
                  </kbd>
                  {acao}
                </span>
              ))}
            </div>
          </div>

          {caixaBloqueado && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              <Wallet className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="flex-1">
                O caixa está fechado. Abra o caixa para começar a vender.
              </span>
              <Button size="sm" onClick={() => setCaixaDialogAberto(true)}>
                Abrir caixa
              </Button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-primary/20">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={buscaRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (adicionarPorEnter(termoBusca, qtdBusca, filtrados)) setBusca("");
                }}
                placeholder="Qtde*nome — ex: 10*iphone ou código de barras"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
              {(["Tudo", "Produto", "Serviço"] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant="ghost"
                  onClick={() => setFiltroTipo(t)}
                  className={`h-8 rounded-lg ${
                    filtroTipo === t ? "bg-background shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {t === "Tudo" ? "Tudo" : t === "Produto" ? "Produtos" : "Serviços"}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtrados.map((p) => {
                const tipo = tipoDoItem(p.categoria);
                const Icone = tipo === "Serviço" ? Wrench : Package;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      adicionar(p, qtdBusca);
                      setBusca("");
                    }}
                    className="group relative flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted/50 flex items-center justify-center">
                      <Icone className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="truncate text-xs font-semibold leading-tight">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {p.categoria || tipo}
                      </p>
                      <p className="text-sm font-bold text-primary">{brl(p.preco_venda)}</p>
                    </div>
                    {tipo === "Produto" && p.quantidade <= 5 && (
                      <span className="absolute right-2 top-2 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                        {p.quantidade}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* No celular o carrinho fica no painel de venda (barra fixa embaixo). */}
        <div className="hidden flex-col rounded-3xl border border-border bg-card shadow-panel overflow-hidden lg:flex">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Itens da Venda
            </h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
              {carrinho.length} Itens
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-border">
            {carrinho.map((item) => (
              <div key={item.id} className="group flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  {item.tipo === "Serviço" ? (
                    <Wrench className="h-4 w-4" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.nome}</p>
                  <p className="text-xs text-muted-foreground">{brl(item.preco)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCarrinho((c) =>
                        c.map((x) =>
                          x.id === item.id ? { ...x, qtd: Math.max(1, x.qtd - 1) } : x,
                        ),
                      )
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-4 text-center text-sm font-bold">{item.qtd}</span>
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
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button
                  onClick={() => setCarrinho((c) => c.filter((x) => x.id !== item.id))}
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {!carrinho.length && (
              <div className="flex h-full flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                  <ShoppingCart className="h-8 w-8 opacity-20" />
                </div>
                <p className="text-sm font-medium">Nenhum item no carrinho</p>
              </div>
            )}
          </div>

          <div className="bg-muted/30 p-5 pb-20 space-y-4 lg:pb-5">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Observações
              </Label>
              <Input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="h-10 rounded-xl border-border/50 bg-background"
                placeholder="Opcional..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Cliente
              </Label>
              <ClienteCampo
                clientes={clientes}
                value={clienteId ?? ""}
                onChange={(id) => setClienteId(id || null)}
                semClienteLabel="Consumidor Final"
              />
            </div>

            {descontoCampo}

            {resumoDesconto}

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-2xl font-black text-primary">{brl(total)}</span>
            </div>

            <Button
              onClick={() => setFinalizarAberto(true)}
              disabled={finalizar.isPending || !carrinho.length}
              className="h-12 w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/20"
            >
              Finalizar venda
              <kbd className="ml-2 rounded-md bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px]">
                F9
              </kbd>
            </Button>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {carrinho.reduce((n, i) => n + i.qtd, 0)} itens · {selectedCliente}
            </p>
            <p className="text-xl font-black text-primary">{brl(total)}</p>
          </div>
          <Button
            className="h-12 gap-2 rounded-xl px-5 text-base font-bold"
            onClick={() => (carrinho.length ? abrirPainel() : iniciarNovaVenda())}
          >
            <ShoppingCart className="h-5 w-5" />
            {carrinho.length ? "Ver venda" : "Nova venda"}
          </Button>
        </div>
      </div>

      <ComprovanteVendaDialog venda={comprovante} onClose={() => setComprovante(null)} />
      <CaixaDialog
        open={caixaDialogAberto}
        onOpenChange={setCaixaDialogAberto}
        empresaId={empresaId}
      />

      <Dialog open={painelAberto} onOpenChange={(o) => !finalizar.isPending && setPainelAberto(o)}>
        {/* Tela cheia no celular, com total e "Finalizar" fixos no rodapé. */}
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl">
          <DialogHeader className="border-b border-border px-4 py-4 text-left sm:px-6">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" /> Nova venda
            </DialogTitle>
            <div className="flex gap-1.5 pt-2">
              {(["Produtos", "Cliente", "Pagamento"] as const).map((nome, i) => {
                const n = (i + 1) as 1 | 2 | 3;
                const liberada = n === 1 || carrinho.length > 0;
                return (
                  <button
                    key={nome}
                    type="button"
                    disabled={!liberada}
                    onClick={() => setEtapa(n)}
                    className="flex-1 text-left disabled:opacity-50"
                  >
                    <span
                      className={`block h-1.5 rounded-full ${etapa >= n ? "bg-primary" : "bg-muted"}`}
                    />
                    <span
                      className={`mt-1 block text-[11px] font-semibold ${etapa === n ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {n}. {nome}
                    </span>
                  </button>
                );
              })}
            </div>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
            {etapa === 1 && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Produtos e serviços
                </Label>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-primary/20">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    ref={buscaPainelRef}
                    autoFocus
                    value={buscaPainel}
                    onChange={(e) => setBuscaPainel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (adicionarPorEnter(termoPainel, qtdPainel, resultadosPainel))
                        setBuscaPainel("");
                    }}
                    placeholder="Digite o nome ou leia o código de barras (ex.: 2*capinha)"
                    className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/60 sm:h-11 sm:text-sm"
                  />
                </div>
                {termoPainel.trim() && (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-border">
                    {resultadosPainel.map((p) => {
                      const tipo = tipoDoItem(p.categoria);
                      const Icone = tipo === "Serviço" ? Wrench : Package;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => adicionarDoPainel(p)}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition hover:bg-muted sm:py-2"
                        >
                          <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                          {tipo === "Produto" && (
                            <span
                              className={`shrink-0 text-xs ${p.quantidade <= 0 ? "text-destructive" : "text-muted-foreground"}`}
                            >
                              {p.quantidade <= 0 ? "sem estoque" : `${p.quantidade} un.`}
                            </span>
                          )}
                          <span className="shrink-0 font-semibold text-primary">
                            {brl(p.preco_venda)}
                          </span>
                        </button>
                      );
                    })}
                    {!resultadosPainel.length && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Nada encontrado.</p>
                    )}
                  </div>
                )}

                <div className="space-y-2 rounded-xl border border-border p-3">
                  {carrinho.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {brl(item.preco)} · {item.tipo}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setCarrinho((c) =>
                              c.map((x) =>
                                x.id === item.id ? { ...x, qtd: Math.max(1, x.qtd - 1) } : x,
                              ),
                            )
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted sm:h-7 sm:w-7"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold">{item.qtd}</span>
                        <button
                          type="button"
                          onClick={() =>
                            adicionar({
                              id: item.id,
                              nome: item.nome,
                              preco_venda: item.preco,
                              quantidade: item.estoque,
                              categoria: item.tipo,
                            })
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted sm:h-7 sm:w-7"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="hidden w-20 text-right text-sm font-semibold sm:inline">
                        {brl(item.preco * item.qtd)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCarrinho((c) => c.filter((x) => x.id !== item.id))}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                        aria-label="Remover item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {!carrinho.length && (
                    <p className="py-3 text-center text-sm text-muted-foreground">
                      Busque acima para adicionar itens.
                    </p>
                  )}
                </div>
              </div>
            )}

            {etapa === 2 && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Quem está comprando?
                </Label>
                <Command
                  className="rounded-xl border border-border"
                  filter={(_, termo, palavras) =>
                    normalizarBusca((palavras ?? []).join(" ")).includes(normalizarBusca(termo))
                      ? 1
                      : 0
                  }
                >
                  <CommandInput
                    placeholder="Digite o nome do cliente..."
                    className="h-12 text-base sm:h-11 sm:text-sm"
                  />
                  <CommandList className="max-h-[50dvh] sm:max-h-72">
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {[{ id: "", nome: "Consumidor Final" }, ...clientes].map((c) => (
                        <CommandItem
                          key={c.id || "consumidor-final"}
                          value={c.id || "consumidor-final"}
                          keywords={[c.nome]}
                          onSelect={() => {
                            setClienteId(c.id || null);
                            setEtapa(3);
                          }}
                          className="py-3 sm:py-2"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${(clienteId ?? "") === c.id ? "opacity-100" : "opacity-0"}`}
                          />
                          {c.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                <p className="text-xs text-muted-foreground">
                  Toque no cliente para seguir para o pagamento.
                </p>
              </div>
            )}

            {etapa === 3 && (
              <div className="space-y-5">
                <div className="space-y-1 rounded-xl bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Cliente</span>
                    <button
                      type="button"
                      onClick={() => setEtapa(2)}
                      className="truncate font-medium text-primary"
                    >
                      {selectedCliente}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Itens</span>
                    <button
                      type="button"
                      onClick={() => setEtapa(1)}
                      className="font-medium text-primary"
                    >
                      {carrinho.reduce((n, i) => n + i.qtd, 0)} · {brl(subtotal)}
                    </button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-4">{descontoCampo}</div>
                  <div className="space-y-4">{pagamentoCampos}</div>
                </div>
                {resumoDesconto}
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-border bg-card px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Total · {carrinho.reduce((n, i) => n + i.qtd, 0)} itens
              </span>
              <span className="text-2xl font-black text-primary">{brl(total)}</span>
            </div>
            <div className="flex gap-2 sm:justify-end">
              <Button
                variant="outline"
                className="h-12 flex-1 sm:h-10 sm:flex-none"
                onClick={() =>
                  etapa === 1 ? setPainelAberto(false) : setEtapa((etapa - 1) as 1 | 2)
                }
                disabled={finalizar.isPending}
              >
                {etapa === 1 ? "Fechar" : "Voltar"}
              </Button>
              {etapa < 3 ? (
                <Button
                  className="h-12 flex-[2] text-base font-bold sm:h-10 sm:flex-none sm:text-sm"
                  onClick={() => setEtapa((etapa + 1) as 2 | 3)}
                  disabled={!carrinho.length}
                >
                  {etapa === 1 ? "Próximo: cliente" : "Próximo: pagamento"}
                </Button>
              ) : (
                <Button
                  className="h-12 flex-[2] text-base font-bold sm:h-10 sm:flex-none sm:text-sm"
                  onClick={() => finalizar.mutate()}
                  disabled={finalizar.isPending || !carrinho.length}
                >
                  {finalizar.isPending ? "Finalizando..." : "Finalizar venda"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={finalizarAberto}
        onOpenChange={(o) => !finalizar.isPending && setFinalizarAberto(o)}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Finalizar venda</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{selectedCliente}</span>
            </div>

            {descontoCampo}

            {pagamentoCampos}

            <div className="space-y-1 border-t border-border pt-3">
              {resumoDesconto}
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium text-muted-foreground">Total</span>
                <span className="text-2xl font-black text-primary">{brl(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFinalizarAberto(false)}
              disabled={finalizar.isPending}
            >
              Voltar
            </Button>
            <Button
              onClick={() => finalizar.mutate()}
              disabled={finalizar.isPending || !carrinho.length}
            >
              {finalizar.isPending ? "Finalizando..." : "Confirmar venda (F9)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
