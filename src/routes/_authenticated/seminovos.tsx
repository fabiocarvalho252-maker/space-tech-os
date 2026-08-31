// Compra de Seminovos — reformulado (pedido do usuário) para uma experiência
// de tablet: cards de resumo, filtros, tabela em telas largas e cards em
// telas estreitas/tablet retrato, com cadastro/venda/conserto/devolução
// ligados ao fluxo de vendas e financeiro já existentes (ver componentes em
// src/components/seminovos/). Mudança isolada a este módulo — nenhum outro
// arquivo fora daqui (e dos dois ajustes mínimos e necessários em
// lib/format.ts e relatorios.tsx para não quebrar com o novo vocabulário de
// status) foi tocado.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  Plus,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useEmpresaId, usePermissoes, podeGerenciar } from "@/hooks/useCurrentUser";
import { dataBR, statusLabel, STATUS_SEMINOVOS } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { StatusBadge } from "@/components/StatusBadge";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CadastroSeminovoModal } from "@/components/seminovos/CadastroSeminovoModal";
import { VenderSeminovoModal } from "@/components/seminovos/VenderSeminovoModal";
import { DevolverSeminovoDialog } from "@/components/seminovos/DevolverSeminovoDialog";
import { DetalheSeminovoModal } from "@/components/seminovos/DetalheSeminovoModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StatusTone } from "@/components/StatusBadge";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/seminovos")({
  head: () => ({
    meta: [
      { title: "Compra de Seminovos — SpaceTech" },
      {
        name: "description",
        content: "Controle de aparelhos comprados, custos, estoque e lucratividade.",
      },
    ],
  }),
  component: Seminovos,
});

type SeminovoRow = Database["public"]["Tables"]["seminovos"]["Row"] & {
  cliente?: { nome: string } | null;
};

const PAGE_SIZE = 20;
const SEMINOVOS_VAZIO: SeminovoRow[] = [];

const TONE_POR_STATUS_SEMINOVO: Record<string, StatusTone> = {
  pendente: "warning",
  disponivel: "success",
  vendido: "info",
  devolvido: "purple",
  sucata: "danger",
  sem_solucao: "neutral",
};

type Periodo = "todos" | "hoje" | "7dias" | "mes" | "mes_anterior" | "personalizado";

function inicioDoDia(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function fimDoDia(d: Date) {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

function CardResumo({
  icon: Icon,
  cor,
  label,
  valor,
}: {
  icon: typeof Boxes;
  cor: string;
  label: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${cor}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-2xl font-extrabold tracking-tight">{valor}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Seminovos() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "seminovos");

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroMarca, setFiltroMarca] = useState("todas");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [dataInicioCustom, setDataInicioCustom] = useState("");
  const [dataFimCustom, setDataFimCustom] = useState("");
  const [precoMin, setPrecoMin] = useState("");
  const [precoMax, setPrecoMax] = useState("");
  const [pagina, setPagina] = useState(1);

  const [modalCadastro, setModalCadastro] = useState(false);
  const [emEdicao, setEmEdicao] = useState<SeminovoRow | null>(null);
  const [modalDetalhe, setModalDetalhe] = useState(false);
  const [detalheAtual, setDetalheAtual] = useState<SeminovoRow | null>(null);
  const [modalVenda, setModalVenda] = useState(false);
  const [paraVender, setParaVender] = useState<SeminovoRow | null>(null);
  const [modalDevolucao, setModalDevolucao] = useState(false);
  const [paraDevolucao, setParaDevolucao] = useState<SeminovoRow | null>(null);
  const [statusPendente, setStatusPendente] = useState<{
    item: SeminovoRow;
    status: string;
  } | null>(null);

  const { data: itens = SEMINOVOS_VAZIO, isLoading } = useQuery({
    queryKey: ["seminovos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminovos")
        .select("*, cliente:clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SeminovoRow[];
    },
  });

  const marcas = useMemo(
    () => Array.from(new Set(itens.map((i) => i.marca).filter(Boolean))).sort(),
    [itens],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const agora = new Date();

    let periodoInicio: Date | null = null;
    let periodoFim: Date | null = null;
    if (periodo === "hoje") {
      periodoInicio = inicioDoDia(agora);
      periodoFim = fimDoDia(agora);
    } else if (periodo === "7dias") {
      periodoInicio = inicioDoDia(new Date(agora.getTime() - 6 * 86400000));
      periodoFim = fimDoDia(agora);
    } else if (periodo === "mes") {
      periodoInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
      periodoFim = fimDoDia(agora);
    } else if (periodo === "mes_anterior") {
      periodoInicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
      periodoFim = fimDoDia(new Date(agora.getFullYear(), agora.getMonth(), 0));
    } else if (periodo === "personalizado" && dataInicioCustom && dataFimCustom) {
      periodoInicio = inicioDoDia(new Date(dataInicioCustom + "T12:00:00"));
      periodoFim = fimDoDia(new Date(dataFimCustom + "T12:00:00"));
    }

    const min = precoMin ? Number(precoMin) : null;
    const max = precoMax ? Number(precoMax) : null;

    return itens.filter((s) => {
      if (filtroStatus !== "todos" && s.status !== filtroStatus) return false;
      if (filtroMarca !== "todas" && s.marca !== filtroMarca) return false;

      if (periodoInicio && periodoFim) {
        const d = new Date(s.data_avaliacao);
        if (d < periodoInicio || d > periodoFim) return false;
      }

      const preco = Number(s.preco_venda ?? s.valor_total_gasto ?? 0);
      if (min != null && preco < min) return false;
      if (max != null && preco > max) return false;

      if (termo) {
        const alvo = [
          s.marca,
          s.modelo,
          s.vendedor_nome,
          s.vendedor_telefone,
          s.imei,
          s.cliente?.nome,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [
    itens,
    busca,
    filtroStatus,
    filtroMarca,
    periodo,
    dataInicioCustom,
    dataFimCustom,
    precoMin,
    precoMax,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  function limparFiltros() {
    setBusca("");
    setFiltroStatus("todos");
    setFiltroMarca("todas");
    setPeriodo("todos");
    setDataInicioCustom("");
    setDataFimCustom("");
    setPrecoMin("");
    setPrecoMax("");
    setPagina(1);
  }

  const resumo = useMemo(() => {
    const disponiveis = itens.filter((i) => i.status === "disponivel");
    const pendentes = itens.filter((i) => i.status === "pendente");
    const vendidos = itens.filter((i) => i.status === "vendido");
    const emEstoque = itens.filter((i) => i.status === "pendente" || i.status === "disponivel");
    const investido = emEstoque.reduce((s, i) => s + Number(i.valor_total_gasto ?? 0), 0);
    const lucroPrevisto = disponiveis.reduce((s, i) => s + Number(i.lucro_previsto ?? 0), 0);
    const atencao = emEstoque.filter((i) => {
      const custo = Number(i.valor_total_gasto ?? 0);
      const semPreco = i.preco_venda == null && i.preco_lojista == null;
      const custoAcimaDaVenda = i.preco_venda != null && Number(i.preco_venda) < custo;
      const lucroNegativo = Number(i.lucro_previsto ?? 0) < 0;
      return semPreco || custoAcimaDaVenda || lucroNegativo;
    });
    return {
      total: itens.length,
      disponiveis: disponiveis.length,
      pendentes: pendentes.length,
      vendidos: vendidos.length,
      investido,
      lucroPrevisto,
      atencao: atencao.length,
    };
  }, [itens]);

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("seminovos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["seminovos"] });
      setStatusPendente(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirDetalhe(s: SeminovoRow) {
    setDetalheAtual(s);
    setModalDetalhe(true);
  }
  function abrirEdicao(s: SeminovoRow) {
    setEmEdicao(s);
    setModalDetalhe(false);
    setModalCadastro(true);
  }
  function abrirVenda(s: SeminovoRow) {
    setParaVender(s);
    setModalDetalhe(false);
    setModalVenda(true);
  }
  function abrirDevolucao(s: SeminovoRow) {
    setParaDevolucao(s);
    setModalDetalhe(false);
    setModalDevolucao(true);
  }

  const STATUS_RAPIDOS = STATUS_SEMINOVOS.filter(
    (s) => s.value !== "vendido" && s.value !== "devolvido",
  );

  return (
    <div>
      <PageHeader
        title="Compra de Seminovos"
        subtitle="Controle de aparelhos comprados, custos, estoque e lucratividade"
        action={
          gerenciar && (
            <Button
              size="lg"
              className="h-12 px-5 text-base"
              onClick={() => {
                setEmEdicao(null);
                setModalCadastro(true);
              }}
            >
              <Plus className="h-5 w-5" /> Comprar aparelho
            </Button>
          )
        }
      />

      {/* CARDS DE RESUMO */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <CardResumo
          icon={Smartphone}
          cor="text-indigo-600 bg-indigo-500/10"
          label="Total de aparelhos"
          valor={String(resumo.total)}
        />
        <CardResumo
          icon={CheckCircle2}
          cor="text-emerald-600 bg-emerald-500/10"
          label="Disponíveis"
          valor={String(resumo.disponiveis)}
        />
        <CardResumo
          icon={Clock}
          cor="text-amber-600 bg-amber-500/10"
          label="Pendentes"
          valor={String(resumo.pendentes)}
        />
        <CardResumo
          icon={Boxes}
          cor="text-blue-600 bg-blue-500/10"
          label="Vendidos"
          valor={String(resumo.vendidos)}
        />
        <CardResumo
          icon={Wallet}
          cor="text-rose-600 bg-rose-500/10"
          label="Valor investido"
          valor={brl(resumo.investido)}
        />
        <CardResumo
          icon={TrendingUp}
          cor="text-cyan-600 bg-cyan-500/10"
          label="Lucro previsto"
          valor={brl(resumo.lucroPrevisto)}
        />
        <CardResumo
          icon={AlertTriangle}
          cor="text-orange-600 bg-orange-500/10"
          label="Atenção"
          valor={String(resumo.atencao)}
        />
      </div>

      {/* FILTROS */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap gap-3">
          <SearchInput
            value={busca}
            onChange={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="Buscar por aparelho, modelo, pessoa, contato ou IMEI..."
            className="min-w-64 flex-1"
          />
          <Select
            value={filtroStatus}
            onValueChange={(v) => {
              setFiltroStatus(v);
              setPagina(1);
            }}
          >
            <SelectTrigger className="h-11 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_SEMINOVOS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={periodo}
            onValueChange={(v) => {
              setPeriodo(v as Periodo);
              setPagina(1);
            }}
          >
            <SelectTrigger className="h-11 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer período</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7dias">Últimos 7 dias</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="mes_anterior">Mês anterior</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {marcas.length > 0 && (
            <Select
              value={filtroMarca}
              onValueChange={(v) => {
                setFiltroMarca(v);
                setPagina(1);
              }}
            >
              <SelectTrigger className="h-11 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as marcas</SelectItem>
                {marcas.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" className="h-11" onClick={limparFiltros}>
            Limpar filtros
          </Button>
        </div>

        {periodo === "personalizado" && (
          <div className="mt-3 flex flex-wrap gap-3">
            <Input
              type="date"
              className="h-11 w-44"
              value={dataInicioCustom}
              onChange={(e) => setDataInicioCustom(e.target.value)}
            />
            <Input
              type="date"
              className="h-11 w-44"
              value={dataFimCustom}
              onChange={(e) => setDataFimCustom(e.target.value)}
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">Faixa de preço:</span>
          <Input
            type="number"
            placeholder="Mínimo"
            className="h-11 w-32"
            value={precoMin}
            onChange={(e) => {
              setPrecoMin(e.target.value);
              setPagina(1);
            }}
          />
          <span className="text-muted-foreground">até</span>
          <Input
            type="number"
            placeholder="Máximo"
            className="h-11 w-32"
            value={precoMax}
            onChange={(e) => {
              setPrecoMax(e.target.value);
              setPagina(1);
            }}
          />
        </div>
      </section>

      {/* LISTAGEM */}
      {isLoading ? (
        <TableSkeleton />
      ) : paginados.length ? (
        <>
          {/* Desktop / tablet paisagem: tabela */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-soft lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Aparelho</th>
                  <th className="px-4 py-3">Comprado de</th>
                  <th className="px-4 py-3">Armaz.</th>
                  <th className="px-4 py-3">Bateria</th>
                  <th className="px-4 py-3">Compra</th>
                  <th className="px-4 py-3">Conserto</th>
                  <th className="px-4 py-3">Custo total</th>
                  <th className="px-4 py-3">Venda</th>
                  <th className="px-4 py-3">Lojista</th>
                  <th className="px-4 py-3">Lucro</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {paginados.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-b border-border/60 hover:bg-secondary/30"
                    onClick={() => abrirDetalhe(s)}
                  >
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={statusLabel(s.status)}
                        tone={TONE_POR_STATUS_SEMINOVO[s.status] ?? "neutral"}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{dataBR(s.data_avaliacao)}</td>
                    <td className="px-4 py-3 font-medium">
                      {s.marca} {s.modelo}
                    </td>
                    <td className="px-4 py-3">{s.cliente?.nome || s.vendedor_nome || "—"}</td>
                    <td className="px-4 py-3">{s.armazenamento ?? "—"}</td>
                    <td className="px-4 py-3">
                      {s.bateria_percentual != null ? `${s.bateria_percentual}%` : "—"}
                    </td>
                    <td className="px-4 py-3">{brl(s.valor_pago)}</td>
                    <td className="px-4 py-3">{brl(s.valor_conserto)}</td>
                    <td className="px-4 py-3 font-semibold">{brl(s.valor_total_gasto)}</td>
                    <td className="px-4 py-3">{brl(s.preco_venda)}</td>
                    <td className="px-4 py-3">{brl(s.preco_lojista)}</td>
                    <td
                      className={`px-4 py-3 font-semibold ${Number(s.lucro_previsto ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"}`}
                    >
                      {brl(s.lucro_previsto)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {gerenciar && s.status !== "vendido" && s.status !== "devolvido" && (
                          <Select
                            value={s.status}
                            onValueChange={(v) => setStatusPendente({ item: s, status: v })}
                          >
                            <SelectTrigger className="h-9 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_RAPIDOS.map((st) => (
                                <SelectItem key={st.value} value={st.value}>
                                  {st.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {gerenciar && s.status === "disponivel" && (
                          <Button size="sm" onClick={() => abrirVenda(s)}>
                            Vender
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet retrato: cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
            {paginados.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-soft"
                onClick={() => abrirDetalhe(s)}
              >
                <div className="flex items-center justify-between">
                  <StatusBadge
                    label={statusLabel(s.status)}
                    tone={TONE_POR_STATUS_SEMINOVO[s.status] ?? "neutral"}
                  />
                  <span className="text-xs text-muted-foreground">{dataBR(s.data_avaliacao)}</span>
                </div>
                <h3 className="mt-2 text-lg font-bold leading-tight">
                  {s.marca} {s.modelo}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {[
                    s.armazenamento,
                    s.bateria_percentual != null ? `${s.bateria_percentual}% bateria` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>

                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Compra</span>
                    <span className="font-medium">{brl(s.valor_pago)}</span>
                  </div>
                  {Number(s.valor_conserto) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Conserto</span>
                      <span className="font-medium">{brl(s.valor_conserto)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Custo total</span>
                    <span className="font-semibold">{brl(s.valor_total_gasto)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Venda</span>
                    <span className="font-medium">{brl(s.preco_venda)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Lucro</span>
                    <span
                      className={`font-bold ${Number(s.lucro_previsto ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"}`}
                    >
                      {brl(s.lucro_previsto)}
                    </span>
                  </div>
                </div>

                <div
                  className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 flex-1"
                    onClick={() => abrirDetalhe(s)}
                  >
                    Ver
                  </Button>
                  {gerenciar && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 flex-1"
                      onClick={() => abrirEdicao(s)}
                    >
                      Editar
                    </Button>
                  )}
                  {gerenciar && s.status === "disponivel" && (
                    <Button size="sm" className="h-10 flex-1" onClick={() => abrirVenda(s)}>
                      Vender
                    </Button>
                  )}
                </div>
                {gerenciar && s.status !== "vendido" && s.status !== "devolvido" && (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={s.status}
                      onValueChange={(v) => setStatusPendente({ item: s, status: v })}
                    >
                      <SelectTrigger className="h-10 w-full text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_RAPIDOS.map((st) => (
                          <SelectItem key={st.value} value={st.value}>
                            {st.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Mostrando {(paginaAtual - 1) * PAGE_SIZE + 1}–
              {Math.min(paginaAtual * PAGE_SIZE, filtrados.length)} de {filtrados.length} aparelhos
            </span>
            {totalPaginas > 1 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10"
                  disabled={paginaAtual <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10"
                  disabled={paginaAtual >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Smartphone}
          title="Nenhum aparelho encontrado"
          description="Ajuste os filtros ou registre uma nova compra."
        />
      )}

      {empresaId && (
        <>
          <CadastroSeminovoModal
            open={modalCadastro}
            onOpenChange={setModalCadastro}
            seminovo={emEdicao}
            empresaId={empresaId}
          />
          <DetalheSeminovoModal
            open={modalDetalhe}
            onOpenChange={setModalDetalhe}
            seminovo={detalheAtual}
            empresaId={empresaId}
            podeGerenciarModulo={gerenciar}
            onEditar={() => detalheAtual && abrirEdicao(detalheAtual)}
            onVender={() => detalheAtual && abrirVenda(detalheAtual)}
            onDevolver={() => detalheAtual && abrirDevolucao(detalheAtual)}
          />
          <VenderSeminovoModal
            open={modalVenda}
            onOpenChange={setModalVenda}
            seminovo={paraVender}
            empresaId={empresaId}
          />
          <DevolverSeminovoDialog
            open={modalDevolucao}
            onOpenChange={setModalDevolucao}
            seminovo={paraDevolucao}
            empresaId={empresaId}
          />
        </>
      )}

      <ConfirmDialog
        open={!!statusPendente}
        onOpenChange={(v) => !v && setStatusPendente(null)}
        title="Alterar status?"
        description={
          statusPendente
            ? `${statusPendente.item.marca} ${statusPendente.item.modelo} vai para "${statusLabel(statusPendente.status)}".`
            : ""
        }
        confirmLabel="Confirmar"
        loading={mudarStatus.isPending}
        onConfirm={() =>
          statusPendente &&
          mudarStatus.mutate({ id: statusPendente.item.id, status: statusPendente.status })
        }
      />
    </div>
  );
}
