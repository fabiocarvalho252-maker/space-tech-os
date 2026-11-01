// Compra de Seminovos — lista enxuta (pedido do usuário, 01/11/2026): 4
// cartões de resumo, busca + abas de status, tabela de 7 colunas e uma ação
// principal por aparelho (o resto no menu ⋮). Antes: reformulado para uma experiência
// de tablet: cards de resumo, filtros, tabela em telas largas e cards em
// telas estreitas/tablet retrato, com cadastro/venda/conserto/devolução
// ligados ao fluxo de vendas e financeiro já existentes (ver componentes em
// src/components/seminovos/). Mudança isolada a este módulo — nenhum outro
// arquivo fora daqui (e dos dois ajustes mínimos e necessários em
// lib/format.ts e relatorios.tsx para não quebrar com o novo vocabulário de
// status) foi tocado.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  Plus,
  Smartphone,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import {
  useEmpresaId,
  usePermissoes,
  podeGerenciar,
  usePodeFinalizarSeminovo,
} from "@/hooks/useCurrentUser";
import { dataBR, statusLabel, STATUS_SEMINOVOS } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { StatusBadge } from "@/components/StatusBadge";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CadastroSeminovoModal } from "@/components/seminovos/CadastroSeminovoModal";
import { VenderSeminovoModal } from "@/components/seminovos/VenderSeminovoModal";
import { DevolverSeminovoDialog } from "@/components/seminovos/DevolverSeminovoDialog";
import { AvaliarDevolucaoDialog } from "@/components/seminovos/AvaliarDevolucaoDialog";
import { DetalheSeminovoModal } from "@/components/seminovos/DetalheSeminovoModal";
import { FinalizarSeminovoDialog } from "@/components/seminovos/FinalizarSeminovoDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  // ?abrir=<seminovo_id> abre o detalhe direto — usado pelo link "Ver compra
  // de origem" no detalhe de um aparelho em Aparelhos.
  validateSearch: (search: Record<string, unknown>): { abrir?: string } => {
    const abrir = search["abrir"];
    return typeof abrir === "string" ? { abrir } : {};
  },
  component: Seminovos,
});

type SeminovoRow = Database["public"]["Tables"]["seminovos"]["Row"] & {
  cliente?: { nome: string } | null;
};

const PAGE_SIZE = 20;
const SEMINOVOS_VAZIO: SeminovoRow[] = [];

const TONE_POR_STATUS_SEMINOVO: Record<string, StatusTone> = {
  pendente: "warning",
  aguardando_finalizacao: "purple",
  disponivel: "success",
  vendido: "info",
  devolvido: "purple",
  sucata: "danger",
  sem_solucao: "neutral",
  recusado: "neutral",
};

// Abas de status da lista: as etapas do dia a dia separadas e o que já saiu
// do estoque sem venda (sucata, sem solução, avaliação recusada) junto.
const ABAS_STATUS = [
  { value: "todos", label: "Todos", status: null },
  { value: "pendente", label: "Em conserto", status: ["pendente"] },
  {
    value: "aguardando_finalizacao",
    label: "Aguard. finalização",
    status: ["aguardando_finalizacao"],
  },
  { value: "disponivel", label: "À venda", status: ["disponivel"] },
  { value: "vendido", label: "Vendidos", status: ["vendido"] },
  { value: "devolvido", label: "Devolvidos", status: ["devolvido"] },
  { value: "encerrados", label: "Encerrados", status: ["sucata", "sem_solucao", "recusado"] },
] as const;

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
  label,
  valor,
  detalhe,
  destaque,
}: {
  icon: typeof Smartphone;
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

function Seminovos() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "seminovos");
  const podeFinalizar = usePodeFinalizarSeminovo();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [dataInicioCustom, setDataInicioCustom] = useState("");
  const [dataFimCustom, setDataFimCustom] = useState("");
  const [pagina, setPagina] = useState(1);

  const [modalCadastro, setModalCadastro] = useState(false);
  const [emEdicao, setEmEdicao] = useState<SeminovoRow | null>(null);
  const [modalDetalhe, setModalDetalhe] = useState(false);
  const [detalheAtual, setDetalheAtual] = useState<SeminovoRow | null>(null);
  const [modalVenda, setModalVenda] = useState(false);
  const [paraVender, setParaVender] = useState<SeminovoRow | null>(null);
  const [modalDevolucao, setModalDevolucao] = useState(false);
  const [paraDevolucao, setParaDevolucao] = useState<SeminovoRow | null>(null);
  const [modalAvaliacao, setModalAvaliacao] = useState(false);
  const [paraAvaliacao, setParaAvaliacao] = useState<SeminovoRow | null>(null);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [paraFinalizar, setParaFinalizar] = useState<SeminovoRow | null>(null);
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

  const { abrir } = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    if (!abrir || isLoading) return;
    const alvo = itens.find((i) => i.id === abrir);
    if (alvo) {
      setDetalheAtual(alvo);
      setModalDetalhe(true);
    }
    navigate({ to: "/seminovos", search: {}, replace: true });
  }, [abrir, isLoading, itens, navigate]);

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

    const aba = ABAS_STATUS.find((a) => a.value === filtroStatus);
    const statusDaAba: readonly string[] | null = aba?.status ?? null;

    return itens.filter((s) => {
      if (statusDaAba && !statusDaAba.includes(s.status)) return false;

      if (periodoInicio && periodoFim) {
        const d = new Date(s.data_avaliacao);
        if (d < periodoInicio || d > periodoFim) return false;
      }

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
  }, [itens, busca, filtroStatus, periodo, dataInicioCustom, dataFimCustom]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  function limparFiltros() {
    setBusca("");
    setFiltroStatus("todos");
    setPeriodo("todos");
    setDataInicioCustom("");
    setDataFimCustom("");
    setPagina(1);
  }

  const filtrosAtivos = busca.trim() !== "" || filtroStatus !== "todos" || periodo !== "todos";

  const contagemPorAba = useMemo(() => {
    const contagem: Record<string, number> = {};
    for (const aba of ABAS_STATUS) {
      const lista: readonly string[] | null = aba.status;
      contagem[aba.value] = lista
        ? itens.filter((i) => lista.includes(i.status)).length
        : itens.length;
    }
    return contagem;
  }, [itens]);

  const resumo = useMemo(() => {
    const disponiveis = itens.filter((i) => i.status === "disponivel");
    const pendentes = itens.filter((i) => i.status === "pendente");
    const aguardando = itens.filter((i) => i.status === "aguardando_finalizacao");
    const vendidos = itens.filter((i) => i.status === "vendido");
    const emEstoque = itens.filter(
      (i) =>
        i.status === "pendente" ||
        i.status === "aguardando_finalizacao" ||
        i.status === "disponivel",
    );
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
      total: itens.filter((i) => i.status !== "recusado").length,
      disponiveis: disponiveis.length,
      pendentes: pendentes.length,
      aguardando: aguardando.length,
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
      // Seminovos disponíveis espelham em Aparelhos (trigger no banco).
      qc.invalidateQueries({ queryKey: ["aparelhos"] });
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

  function abrirAvaliacao(s: SeminovoRow) {
    setParaAvaliacao(s);
    setModalDetalhe(false);
    setModalAvaliacao(true);
  }

  function abrirFinalizacao(s: SeminovoRow) {
    setParaFinalizar(s);
    setModalFinalizar(true);
    setModalDetalhe(false);
  }

  // "Disponível" só aparece para quem pode finalizar (ou se já está
  // disponível); escolher essa opção abre a avaliação final em vez de
  // trocar o status direto — o banco recusaria mesmo assim.
  function statusRapidos(s: SeminovoRow) {
    return STATUS_SEMINOVOS.filter(
      (st) =>
        st.value !== "vendido" &&
        st.value !== "devolvido" &&
        st.value !== "recusado" &&
        (st.value !== "disponivel" || podeFinalizar || s.status === "disponivel"),
    );
  }
  function escolherStatus(s: SeminovoRow, status: string) {
    if (status === s.status) return;
    if (status === "disponivel") abrirFinalizacao(s);
    else setStatusPendente({ item: s, status });
  }

  function especificacoes(s: SeminovoRow) {
    return [
      s.armazenamento,
      s.cor,
      s.bateria_percentual != null ? `bateria ${s.bateria_percentual}%` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  // O próximo passo do aparelho, conforme a etapa em que está.
  function acaoPrincipal(s: SeminovoRow, className: string) {
    if (gerenciar && s.status === "pendente")
      return (
        <Button
          size="sm"
          variant="outline"
          className={className}
          onClick={() => setStatusPendente({ item: s, status: "aguardando_finalizacao" })}
        >
          Conserto concluído
        </Button>
      );
    if (podeFinalizar && s.status === "aguardando_finalizacao")
      return (
        <Button size="sm" className={className} onClick={() => abrirFinalizacao(s)}>
          Finalizar
        </Button>
      );
    if (gerenciar && s.status === "disponivel")
      return (
        <Button size="sm" className={className} onClick={() => abrirVenda(s)}>
          Vender
        </Button>
      );
    if (gerenciar && s.status === "devolvido")
      return (
        <Button size="sm" className={className} onClick={() => abrirAvaliacao(s)}>
          Avaliar retorno
        </Button>
      );
    return null;
  }

  function menuAcoes(s: SeminovoRow) {
    const podeTrocarStatus =
      gerenciar && s.status !== "vendido" && s.status !== "devolvido" && s.status !== "recusado";
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title="Mais ações">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => abrirDetalhe(s)}>Ver detalhes</DropdownMenuItem>
          {gerenciar && <DropdownMenuItem onClick={() => abrirEdicao(s)}>Editar</DropdownMenuItem>}
          {podeTrocarStatus && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Alterar status</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={s.status}
                    onValueChange={(v) => escolherStatus(s, v)}
                  >
                    {statusRapidos(s).map((st) => (
                      <DropdownMenuRadioItem key={st.value} value={st.value}>
                        {st.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

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

      {/* RESUMO */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardResumo
          icon={Wrench}
          label="Em preparo"
          valor={String(resumo.pendentes + resumo.aguardando)}
          detalhe={
            resumo.aguardando > 0
              ? `${resumo.aguardando} aguardando finalização`
              : "em conserto ou revisão"
          }
        />
        <CardResumo
          icon={CheckCircle2}
          label="À venda"
          valor={String(resumo.disponiveis)}
          detalhe={`${resumo.vendidos} vendido${resumo.vendidos === 1 ? "" : "s"} no total`}
        />
        <CardResumo
          icon={Wallet}
          label="Investido em estoque"
          valor={brl(resumo.investido)}
          detalhe="compra + conserto"
        />
        <CardResumo
          icon={TrendingUp}
          label="Lucro previsto"
          valor={brl(resumo.lucroPrevisto)}
          destaque
          detalhe={
            resumo.atencao > 0
              ? `${resumo.atencao} sem preço ou com prejuízo`
              : "dos aparelhos à venda"
          }
        />
      </div>

      {/* FILTROS */}
      <section className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <SearchInput
            value={busca}
            onChange={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="Buscar aparelho, IMEI ou de quem comprou..."
            className="min-w-0 flex-1 basis-64"
          />
          <Select
            value={periodo}
            onValueChange={(v) => {
              setPeriodo(v as Periodo);
              setPagina(1);
            }}
          >
            <SelectTrigger className="h-11 w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer data</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7dias">Últimos 7 dias</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="mes_anterior">Mês anterior</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {periodo === "personalizado" && (
            <div className="flex w-full gap-2 sm:w-auto">
              <Input
                type="date"
                className="h-11 flex-1 sm:w-40"
                value={dataInicioCustom}
                onChange={(e) => setDataInicioCustom(e.target.value)}
              />
              <Input
                type="date"
                className="h-11 flex-1 sm:w-40"
                value={dataFimCustom}
                onChange={(e) => setDataFimCustom(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {ABAS_STATUS.map((aba) => {
            const ativa = filtroStatus === aba.value;
            return (
              <button
                key={aba.value}
                type="button"
                onClick={() => {
                  setFiltroStatus(aba.value);
                  setPagina(1);
                }}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition ${
                  ativa
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {aba.label}
                <span
                  className={`rounded-full px-1.5 text-xs ${ativa ? "bg-primary-foreground/20" : "bg-muted"}`}
                >
                  {contagemPorAba[aba.value] ?? 0}
                </span>
              </button>
            );
          })}
          {filtrosAtivos && (
            <button
              type="button"
              onClick={limparFiltros}
              className="h-9 shrink-0 px-2 text-sm font-medium text-primary hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      </section>

      {/* LISTAGEM */}
      {isLoading ? (
        <TableSkeleton />
      ) : paginados.length ? (
        <>
          {/* Desktop: tabela */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-soft lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Aparelho</th>
                  <th className="px-4 py-3 font-semibold">Comprado de</th>
                  <th className="px-4 py-3 text-right font-semibold">Custo</th>
                  <th className="px-4 py-3 text-right font-semibold">Venda</th>
                  <th className="px-4 py-3 text-right font-semibold">Lucro</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {paginados.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-secondary/30"
                    onClick={() => abrirDetalhe(s)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold">
                        {s.marca} {s.modelo}
                      </p>
                      <p className="text-xs text-muted-foreground">{especificacoes(s) || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{s.cliente?.nome || s.vendedor_nome || "—"}</p>
                      <p className="text-xs text-muted-foreground">{dataBR(s.data_avaliacao)}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold">{brl(s.valor_total_gasto)}</p>
                      {Number(s.valor_conserto) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {brl(s.valor_pago)} + {brl(s.valor_conserto)} conserto
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium">
                        {s.preco_venda != null ? brl(s.preco_venda) : "—"}
                      </p>
                      {s.preco_lojista != null && (
                        <p className="text-xs text-muted-foreground">
                          lojista {brl(s.preco_lojista)}
                        </p>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${Number(s.lucro_previsto ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"}`}
                    >
                      {brl(s.lucro_previsto)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={statusLabel(s.status)}
                        tone={TONE_POR_STATUS_SEMINOVO[s.status] ?? "neutral"}
                      />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {acaoPrincipal(s, "h-9")}
                        {menuAcoes(s)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular / tablet: cartões */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {paginados.map((s) => (
              <div
                key={s.id}
                className="cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-soft"
                onClick={() => abrirDetalhe(s)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold leading-tight">
                      {s.marca} {s.modelo}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {especificacoes(s) || "—"}
                    </p>
                  </div>
                  <StatusBadge
                    label={statusLabel(s.status)}
                    tone={TONE_POR_STATUS_SEMINOVO[s.status] ?? "neutral"}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {s.cliente?.nome || s.vendedor_nome || "—"} · {dataBR(s.data_avaliacao)}
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Custo</p>
                    <p className="text-sm font-semibold">{brl(s.valor_total_gasto)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Venda</p>
                    <p className="text-sm font-semibold">
                      {s.preco_venda != null ? brl(s.preco_venda) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Lucro</p>
                    <p
                      className={`text-sm font-bold ${Number(s.lucro_previsto ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"}`}
                    >
                      {brl(s.lucro_previsto)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {acaoPrincipal(s, "h-10 flex-1")}
                  <Button variant="outline" className="h-10 flex-1" onClick={() => abrirDetalhe(s)}>
                    Ver detalhes
                  </Button>
                  {menuAcoes(s)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {(paginaAtual - 1) * PAGE_SIZE + 1}–
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
          title={filtrosAtivos ? "Nenhum aparelho encontrado" : "Nenhuma compra registrada"}
          description={
            filtrosAtivos
              ? "Ajuste a busca ou os filtros."
              : 'Toque em "Comprar aparelho" para registrar a primeira compra.'
          }
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
            podeFinalizar={podeFinalizar}
            onEditar={() => detalheAtual && abrirEdicao(detalheAtual)}
            onVender={() => detalheAtual && abrirVenda(detalheAtual)}
            onDevolver={() => detalheAtual && abrirDevolucao(detalheAtual)}
            onAvaliarRetorno={() => detalheAtual && abrirAvaliacao(detalheAtual)}
            onConsertoConcluido={() => {
              if (!detalheAtual) return;
              setModalDetalhe(false);
              setStatusPendente({ item: detalheAtual, status: "aguardando_finalizacao" });
            }}
            onFinalizar={() => detalheAtual && abrirFinalizacao(detalheAtual)}
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
          <AvaliarDevolucaoDialog
            open={modalAvaliacao}
            onOpenChange={setModalAvaliacao}
            seminovo={paraAvaliacao}
            empresaId={empresaId}
          />
          <FinalizarSeminovoDialog
            open={modalFinalizar}
            onOpenChange={setModalFinalizar}
            seminovo={paraFinalizar}
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
