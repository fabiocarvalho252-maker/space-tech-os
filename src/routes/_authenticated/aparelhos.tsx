// Módulo "Aparelhos" (pedido): estoque próprio de celulares lacrados e
// seminovos para venda, rastreado por unidade/IMEI. Mesma receita de
// seminovos.tsx/compras.tsx (createFileRoute + TanStack Query + tabela
// crua + Dialogs do shadcn) — as partes pesadas (cadastro, venda, detalhe)
// ficam em componentes próprios sob src/components/aparelhos/. Visual alinhado
// à lista de Compra de Seminovos (02/11/2026): 4 cartões, busca + abas com
// contagem, tabela enxuta e cartões no celular.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Boxes, Plus, Search, ShieldCheck, Smartphone, TrendingUp, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useEmpresaId, usePermissoes, podeGerenciar } from "@/hooks/useCurrentUser";
import { dataBR, statusLabel } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listarAparelhosComCustoFn } from "@/lib/aparelhos/aparelhos.functions";
import { CadastroAparelhoModal } from "@/components/aparelhos/CadastroAparelhoModal";
import { VenderAparelhoModal } from "@/components/aparelhos/VenderAparelhoModal";
import { DetalheAparelhoModal } from "@/components/aparelhos/DetalheAparelhoModal";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/aparelhos")({
  head: () => ({
    meta: [
      { title: "Aparelhos — SpaceTech" },
      {
        name: "description",
        content: "Estoque, venda e garantia de aparelhos lacrados e seminovos.",
      },
    ],
  }),
  // ?abrir=<aparelho_id> abre o detalhe direto — usado pelo link "Ver no
  // estoque" no detalhe de uma compra em Compra de Seminovos.
  validateSearch: (search: Record<string, unknown>): { abrir?: string } => {
    const abrir = search["abrir"];
    return typeof abrir === "string" ? { abrir } : {};
  },
  component: Aparelhos,
});

type AparelhoRow = Database["public"]["Tables"]["aparelhos"]["Row"];
type Aba = "todos" | "disponivel" | "reservado" | "vendido" | "outros" | "garantias";

const ABAS: { value: Aba; label: string; status: string[] | null }[] = [
  { value: "todos", label: "Todos", status: null },
  { value: "disponivel", label: "À venda", status: ["disponivel"] },
  { value: "reservado", label: "Reservados", status: ["reservado"] },
  { value: "vendido", label: "Vendidos", status: ["vendido"] },
  { value: "outros", label: "Devolvidos / retirados", status: ["devolvido", "cancelado"] },
  { value: "garantias", label: "Garantias", status: null },
];

// Referência estável — usar `data?.aparelhos ?? []` inline criaria um array
// novo a cada render, invalidando a memoização dos hooks que dependem dele.
const APARELHOS_VAZIO: AparelhoRow[] = [];

const TONE_POR_STATUS: Record<string, StatusTone> = {
  disponivel: "success",
  reservado: "warning",
  vendido: "info",
  devolvido: "danger",
  garantia: "purple",
  cancelado: "neutral",
};

function CardEstatistica({
  icon: Icon,
  label,
  valor,
  detalhe,
  destaque,
}: {
  icon: typeof Boxes;
  label: string;
  valor: string;
  detalhe?: string | undefined;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>
      <p
        className={`mt-2 text-2xl font-extrabold tracking-tight ${destaque ? "text-primary" : ""}`}
      >
        {valor}
      </p>
      {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function Aparelhos() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const empresaId = useEmpresaId();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "aparelhos");

  const [aba, setAba] = useState<Aba>("todos");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [modalCadastro, setModalCadastro] = useState(false);
  const [aparelhoEmEdicao, setAparelhoEmEdicao] = useState<AparelhoRow | null>(null);
  const [modalVenda, setModalVenda] = useState(false);
  const [aparelhoParaVender, setAparelhoParaVender] = useState<AparelhoRow | null>(null);
  const [modalDetalhe, setModalDetalhe] = useState(false);
  const [aparelhoDetalhe, setAparelhoDetalhe] = useState<AparelhoRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["aparelhos"],
    queryFn: () => listarAparelhosComCustoFn(),
  });
  const aparelhos = data?.aparelhos ?? APARELHOS_VAZIO;
  const podeVerCusto = data?.podeVerCusto ?? false;

  const { abrir } = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    if (!abrir || isLoading) return;
    const alvo = aparelhos.find((a) => a.id === abrir);
    if (alvo) {
      setAparelhoDetalhe(alvo);
      setModalDetalhe(true);
    }
    navigate({ to: "/aparelhos", search: {}, replace: true });
  }, [abrir, isLoading, aparelhos, navigate]);

  const { data: garantias = [], isLoading: carregandoGarantias } = useQuery({
    queryKey: ["aparelho-garantias-lista"],
    enabled: aba === "garantias",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aparelho_garantias")
        .select("*, aparelhos(marca, modelo, imei1), clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (Database["public"]["Tables"]["aparelho_garantias"]["Row"] & {
        aparelhos: { marca: string; modelo: string; imei1: string | null } | null;
        clientes: { nome: string } | null;
      })[];
    },
  });

  const listaFiltrada = useMemo(() => {
    let lista = aparelhos;
    const status = ABAS.find((x) => x.value === aba)?.status;
    if (status) lista = lista.filter((a) => status.includes(a.status));
    if (filtroTipo !== "todos") lista = lista.filter((a) => a.tipo === filtroTipo);

    const termo = busca.trim().toLowerCase();
    if (termo) {
      lista = lista.filter((a) =>
        [a.marca, a.modelo, a.imei1, a.imei2, a.numero_serie]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termo)),
      );
    }
    return lista;
  }, [aparelhos, aba, filtroTipo, busca]);

  const contagemPorAba = useMemo(() => {
    const contagem: Partial<Record<Aba, number>> = {};
    for (const x of ABAS) {
      if (x.value === "garantias") continue;
      const status = x.status;
      contagem[x.value] = status
        ? aparelhos.filter((a) => status.includes(a.status)).length
        : aparelhos.length;
    }
    return contagem;
  }, [aparelhos]);

  function abrirDetalhe(a: AparelhoRow) {
    setAparelhoDetalhe(a);
    setModalDetalhe(true);
  }
  function abrirVenda(a: AparelhoRow) {
    setAparelhoParaVender(a);
    setModalVenda(true);
  }
  function descricao(a: AparelhoRow) {
    return [
      `AP-${String(a.numero).padStart(6, "0")}`,
      a.tipo === "lacrado" ? "Lacrado" : "Seminovo",
      a.armazenamento,
      a.cor,
      a.saude_bateria != null ? `bateria ${a.saude_bateria}%` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const estatisticas = useMemo(() => {
    const emEstoque = aparelhos.filter(
      (a) => a.status === "disponivel" || a.status === "reservado",
    );
    const investido = emEstoque.reduce((s, a) => s + Number(a.preco_custo ?? 0), 0);
    const valorVenda = emEstoque.reduce((s, a) => s + Number(a.preco_venda ?? 0), 0);
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const vendidosNoMes = aparelhos.filter(
      (a) => a.status === "vendido" && a.sold_at && new Date(a.sold_at) >= inicioMes,
    );
    const vendasDoMes = vendidosNoMes.reduce((s, a) => s + Number(a.preco_venda ?? 0), 0);
    const lucroRealizado = vendidosNoMes.reduce(
      (s, a) => s + (Number(a.preco_venda ?? 0) - Number(a.preco_custo ?? 0)),
      0,
    );
    return {
      estoque: emEstoque.length,
      lacrados: emEstoque.filter((a) => a.tipo === "lacrado").length,
      seminovos: emEstoque.filter((a) => a.tipo === "seminovo").length,
      investido,
      valorVenda,
      lucroPotencial: valorVenda - investido,
      vendasDoMes,
      lucroRealizado,
    };
  }, [aparelhos]);

  return (
    <div>
      <PageHeader
        title="Aparelhos"
        subtitle="Estoque, venda e garantia de aparelhos lacrados e seminovos."
        action={
          gerenciar && (
            <Button
              size="lg"
              className="h-12 px-5 text-base"
              onClick={() => {
                setAparelhoEmEdicao(null);
                setModalCadastro(true);
              }}
            >
              <Plus className="h-5 w-5" /> Novo aparelho
            </Button>
          )
        }
      />

      {/* RESUMO */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardEstatistica
          icon={Boxes}
          label="Em estoque"
          valor={String(estatisticas.estoque)}
          detalhe={`${estatisticas.lacrados} lacrado${estatisticas.lacrados === 1 ? "" : "s"} · ${estatisticas.seminovos} seminovo${estatisticas.seminovos === 1 ? "" : "s"}`}
        />
        {podeVerCusto ? (
          <CardEstatistica
            icon={Wallet}
            label="Investido em estoque"
            valor={brl(estatisticas.investido)}
            detalhe={`vale ${brl(estatisticas.valorVenda)} à venda`}
          />
        ) : (
          <CardEstatistica
            icon={Wallet}
            label="Valor de venda em estoque"
            valor={brl(estatisticas.valorVenda)}
          />
        )}
        {podeVerCusto && (
          <CardEstatistica
            icon={TrendingUp}
            label="Lucro potencial"
            valor={brl(estatisticas.lucroPotencial)}
            destaque
            detalhe="se vender todo o estoque"
          />
        )}
        <CardEstatistica
          icon={Smartphone}
          label="Vendas do mês"
          valor={brl(estatisticas.vendasDoMes)}
          detalhe={podeVerCusto ? `lucro de ${brl(estatisticas.lucroRealizado)}` : undefined}
        />
      </div>

      {/* BUSCA + ABAS */}
      <section className="mb-4 space-y-3">
        {aba !== "garantias" && (
          <div className="flex flex-wrap gap-2">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar marca, modelo, IMEI ou série..."
              className="min-w-0 flex-1 basis-64"
            />
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="h-11 w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Lacrados e seminovos</SelectItem>
                <SelectItem value="lacrado">Só lacrados</SelectItem>
                <SelectItem value="seminovo">Só seminovos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {ABAS.map((x) => {
            const ativa = aba === x.value;
            const total = contagemPorAba[x.value];
            return (
              <button
                key={x.value}
                type="button"
                onClick={() => setAba(x.value)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition ${
                  ativa
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {x.value === "garantias" && <ShieldCheck className="h-3.5 w-3.5" />}
                {x.label}
                {total != null && (
                  <span
                    className={`rounded-full px-1.5 text-xs ${ativa ? "bg-primary-foreground/20" : "bg-muted"}`}
                  >
                    {total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {aba === "garantias" ? (
        carregandoGarantias ? (
          <TableSkeleton />
        ) : garantias.length ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Garantia</th>
                  <th className="px-4 py-3 font-semibold">Aparelho</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Período</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {garantias.map((g) => (
                  <tr key={g.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">
                      GAR-{String(g.numero).padStart(6, "0")}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">
                        {g.aparelhos?.marca} {g.aparelhos?.modelo}
                      </p>
                      {g.aparelhos?.imei1 && (
                        <p className="text-xs text-muted-foreground">IMEI {g.aparelhos.imei1}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">{g.clientes?.nome ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {dataBR(g.inicio)} a {dataBR(g.fim)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={
                          {
                            ativa: "Ativa",
                            expirada: "Expirada",
                            cancelada: "Cancelada",
                            acionada: "Acionada",
                          }[g.status] ?? g.status
                        }
                        tone={
                          g.status === "ativa"
                            ? "success"
                            : g.status === "acionada"
                              ? "warning"
                              : g.status === "cancelada"
                                ? "danger"
                                : "neutral"
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={ShieldCheck} title="Nenhuma garantia emitida ainda" />
        )
      ) : isLoading ? (
        <TableSkeleton />
      ) : listaFiltrada.length ? (
        <>
          {/* Desktop: tabela */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-soft lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Aparelho</th>
                  <th className="px-4 py-3 font-semibold">IMEI</th>
                  {podeVerCusto && <th className="px-4 py-3 text-right font-semibold">Custo</th>}
                  <th className="px-4 py-3 text-right font-semibold">Venda</th>
                  {podeVerCusto && <th className="px-4 py-3 text-right font-semibold">Lucro</th>}
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((a) => {
                  const lucro = Number(a.preco_venda) - Number(a.preco_custo);
                  return (
                    <tr
                      key={a.id}
                      className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-secondary/30"
                      onClick={() => abrirDetalhe(a)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold">
                          {a.marca} {a.modelo}
                        </p>
                        <p className="text-xs text-muted-foreground">{descricao(a)}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {a.imei1 ?? "—"}
                      </td>
                      {podeVerCusto && (
                        <td className="px-4 py-3 text-right font-medium">{brl(a.preco_custo)}</td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold">{brl(a.preco_venda)}</p>
                        {a.preco_minimo != null && (
                          <p className="text-xs text-muted-foreground">
                            mínimo {brl(a.preco_minimo)}
                          </p>
                        )}
                      </td>
                      {podeVerCusto && (
                        <td
                          className={`px-4 py-3 text-right font-bold ${lucro >= 0 ? "text-emerald-600" : "text-destructive"}`}
                        >
                          {brl(lucro)}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={statusLabel(a.status)}
                          tone={TONE_POR_STATUS[a.status] ?? "neutral"}
                        />
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {gerenciar && a.status === "disponivel" ? (
                          <Button size="sm" className="h-9" onClick={() => abrirVenda(a)}>
                            Vender
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9"
                            onClick={() => abrirDetalhe(a)}
                          >
                            Ver
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Celular / tablet: cartões */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {listaFiltrada.map((a) => {
              const lucro = Number(a.preco_venda) - Number(a.preco_custo);
              return (
                <div
                  key={a.id}
                  className="cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-soft"
                  onClick={() => abrirDetalhe(a)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold leading-tight">
                        {a.marca} {a.modelo}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{descricao(a)}</p>
                    </div>
                    <StatusBadge
                      label={statusLabel(a.status)}
                      tone={TONE_POR_STATUS[a.status] ?? "neutral"}
                    />
                  </div>
                  {a.imei1 && (
                    <p className="mt-2 font-mono text-xs text-muted-foreground">IMEI {a.imei1}</p>
                  )}

                  <div
                    className={`mt-3 grid gap-2 rounded-xl bg-muted/40 p-3 text-center ${podeVerCusto ? "grid-cols-3" : "grid-cols-2"}`}
                  >
                    {podeVerCusto && (
                      <div>
                        <p className="text-[11px] text-muted-foreground">Custo</p>
                        <p className="text-sm font-semibold">{brl(a.preco_custo)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] text-muted-foreground">Venda</p>
                      <p className="text-sm font-semibold">{brl(a.preco_venda)}</p>
                    </div>
                    {podeVerCusto ? (
                      <div>
                        <p className="text-[11px] text-muted-foreground">Lucro</p>
                        <p
                          className={`text-sm font-bold ${lucro >= 0 ? "text-emerald-600" : "text-destructive"}`}
                        >
                          {brl(lucro)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[11px] text-muted-foreground">Menor preço</p>
                        <p className="text-sm font-semibold">
                          {a.preco_minimo != null ? brl(a.preco_minimo) : "—"}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {gerenciar && a.status === "disponivel" && (
                      <Button className="h-10 flex-1" onClick={() => abrirVenda(a)}>
                        Vender
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="h-10 flex-1"
                      onClick={() => abrirDetalhe(a)}
                    >
                      Ver detalhes
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {listaFiltrada.length} aparelho{listaFiltrada.length === 1 ? "" : "s"}
          </p>
        </>
      ) : (
        <EmptyState
          icon={Search}
          title="Nenhum aparelho encontrado"
          description="Ajuste a busca ou os filtros, ou cadastre um novo aparelho."
        />
      )}

      {empresaId && (
        <>
          <CadastroAparelhoModal
            open={modalCadastro}
            onOpenChange={setModalCadastro}
            aparelho={aparelhoEmEdicao}
            empresaId={empresaId}
            podeVerCusto={podeVerCusto}
          />
          <VenderAparelhoModal
            open={modalVenda}
            onOpenChange={setModalVenda}
            aparelho={aparelhoParaVender}
            empresaId={empresaId}
          />
          <DetalheAparelhoModal
            open={modalDetalhe}
            onOpenChange={setModalDetalhe}
            aparelho={aparelhoDetalhe}
            empresaId={empresaId}
            podeVerCusto={podeVerCusto}
            podeGerenciarModulo={gerenciar}
            onEditar={() => {
              setModalDetalhe(false);
              setAparelhoEmEdicao(aparelhoDetalhe);
              setModalCadastro(true);
            }}
            onVender={() => {
              setModalDetalhe(false);
              setAparelhoParaVender(aparelhoDetalhe);
              setModalVenda(true);
            }}
          />
        </>
      )}
    </div>
  );
}
