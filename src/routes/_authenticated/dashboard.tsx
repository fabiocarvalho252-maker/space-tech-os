import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useProfile } from "@/hooks/useCurrentUser";
import { QuickAccessCards } from "@/components/dashboard/QuickAccessCards";
import { FilmSearchCard } from "@/components/dashboard/FilmSearchCard";
import { PartnerProgramCard } from "@/components/dashboard/PartnerProgramCard";
import { MonthlyResultCard, type Periodo } from "@/components/dashboard/MonthlyResultCard";
import { TopProductsChart, type ItemRanking } from "@/components/dashboard/TopProductsChart";
import { TopServicesChart } from "@/components/dashboard/TopServicesChart";
import { OpenOrdersTable, type OsAberta } from "@/components/dashboard/OpenOrdersTable";
import { SystemStatistics } from "@/components/dashboard/SystemStatistics";
import {
  calcularResultado,
  intervaloAnterior,
  type ItemResultado,
} from "@/lib/dashboard/resultado";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — SpaceTech" },
      { name: "description", content: "Resumo da sua assistência: OS, vendas, estoque e caixa." },
      { property: "og:title", content: "Painel — SpaceTech" },
      { property: "og:description", content: "Resumo diário da sua assistência técnica." },
    ],
  }),
  component: Dashboard,
});

// OS fora do quadro "em aberto": faturada também foi concluída (e
// entregue/paga), reprovada não vai ser executada, e pronta só aguarda
// retirada — mesma regra da SPACE TECH IA (STATUS_OS_ABERTAS em
// src/lib/ai/tools.server.ts), para os dois mostrarem o mesmo número.
const STATUS_FECHADOS = ["pronto", "entregue", "faturado", "cancelado", "reprovado"];

function intervaloDoPeriodo(
  periodo: Periodo,
  dataInicio: string,
  dataFim: string,
): { inicio: Date; fim: Date } {
  const agora = new Date();
  switch (periodo) {
    case "hoje":
      return { inicio: agora, fim: agora };
    case "semana":
      return {
        inicio: startOfWeek(agora, { weekStartsOn: 1 }),
        fim: endOfWeek(agora, { weekStartsOn: 1 }),
      };
    case "mes_anterior": {
      const mesPassado = subMonths(agora, 1);
      return { inicio: startOfMonth(mesPassado), fim: endOfMonth(mesPassado) };
    }
    case "personalizado":
      return {
        inicio: dataInicio ? new Date(`${dataInicio}T00:00:00`) : startOfMonth(agora),
        fim: dataFim ? new Date(`${dataFim}T00:00:00`) : agora,
      };
    case "mes":
    default:
      return { inicio: startOfMonth(agora), fim: agora };
  }
}

function Dashboard() {
  const { data: profile } = useProfile();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(new Date(), "yyyy-MM-dd"));

  const { inicio, fim } = useMemo(
    () => intervaloDoPeriodo(periodo, dataInicio, dataFim),
    [periodo, dataInicio, dataFim],
  );
  const inicioStr = format(inicio, "yyyy-MM-dd");
  const fimStr = format(fim, "yyyy-MM-dd");
  // Limites do dia no fuso local, convertidos para UTC — comparar strings
  // sem timezone com colunas timestamptz faz o Postgres assumir UTC, o que
  // exclui vendas/OS feitas à noite (horário local) do "hoje"/período.
  const inicioTsISO = startOfDay(inicio).toISOString();
  const fimTsISO = endOfDay(fim).toISOString();

  const {
    data,
    isLoading: carregando,
    isError: erroOrdens,
    refetch,
  } = useQuery({
    queryKey: ["dashboard-home", inicioStr, fimStr],
    queryFn: async () => {
      const [
        produtosRes,
        clientesRes,
        osRes,
        vendasRes,
        lancamentosRes,
        osItensRes,
        vendaItensRes,
        garantiasRes,
      ] = await Promise.all([
        supabase.from("produtos").select("id, categoria, preco_custo"),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase
          .from("ordens_servico")
          .select("id, numero, previsao, status, clientes(nome)")
          .order("created_at", { ascending: false }),
        supabase.from("vendas").select("id", { count: "exact", head: true }),
        supabase
          .from("lancamentos")
          .select("tipo, valor, data, status")
          .gte("data", inicioStr)
          .lte("data", fimStr),
        supabase
          .from("os_itens")
          .select(
            "produto_id, descricao, quantidade, preco_unitario, tipo, created_at, ordens_servico(status)",
          )
          .gte("created_at", inicioTsISO)
          .lte("created_at", fimTsISO),
        supabase
          .from("venda_itens")
          .select(
            "venda_id, produto_id, descricao, quantidade, preco_unitario, created_at, vendas(status, total)",
          )
          .gte("created_at", inicioTsISO)
          .lte("created_at", fimTsISO),
        supabase.from("termos_garantia").select("id", { count: "exact", head: true }),
      ]);

      if (osRes.error) throw osRes.error;

      return {
        produtos: produtosRes.data ?? [],
        clientesCount: clientesRes.count ?? 0,
        os: osRes.data ?? [],
        vendasCount: vendasRes.count ?? 0,
        lancamentos: lancamentosRes.data ?? [],
        osItens: osItensRes.data ?? [],
        vendaItens: vendaItensRes.data ?? [],
        garantiasCount: garantiasRes.count ?? 0,
      };
    },
  });

  const produtosById = useMemo(
    () => new Map((data?.produtos ?? []).map((p) => [p.id, p])),
    [data?.produtos],
  );

  const lancamentosPagos = (data?.lancamentos ?? []).filter((l) => l.status === "pago");
  const resultado = useMemo(
    () =>
      calcularResultado(
        data?.lancamentos ?? [],
        (data?.osItens ?? []) as unknown as ItemResultado[],
        (data?.vendaItens ?? []) as unknown as ItemResultado[],
        produtosById,
      ),
    [data?.lancamentos, data?.osItens, data?.vendaItens, produtosById],
  );
  const { receita, despesas, cmv, custoServicos, lucroLiquido, margem, custoPorDia } = resultado;

  // Mesmo cálculo no período anterior equivalente, para a comparação do
  // card (ver intervaloAnterior). Busca só o que o DRE usa.
  const anterior = useMemo(() => intervaloAnterior(periodo, inicio, fim), [periodo, inicio, fim]);
  const anteriorInicioStr = format(anterior.inicio, "yyyy-MM-dd");
  const anteriorFimStr = format(anterior.fim, "yyyy-MM-dd");
  const { data: dadosAnterior } = useQuery({
    queryKey: ["dashboard-resultado-anterior", anteriorInicioStr, anteriorFimStr],
    queryFn: async () => {
      const inicioTs = startOfDay(anterior.inicio).toISOString();
      const fimTs = endOfDay(anterior.fim).toISOString();
      const [lancRes, osItensRes, vendaItensRes] = await Promise.all([
        supabase
          .from("lancamentos")
          .select("tipo, valor, data, status")
          .gte("data", anteriorInicioStr)
          .lte("data", anteriorFimStr),
        supabase
          .from("os_itens")
          .select("produto_id, quantidade, created_at, ordens_servico(status)")
          .gte("created_at", inicioTs)
          .lte("created_at", fimTs),
        supabase
          .from("venda_itens")
          .select("produto_id, quantidade, created_at, vendas(status)")
          .gte("created_at", inicioTs)
          .lte("created_at", fimTs),
      ]);
      if (lancRes.error) throw lancRes.error;
      return {
        lancamentos: lancRes.data ?? [],
        osItens: (osItensRes.data ?? []) as unknown as ItemResultado[],
        vendaItens: (vendaItensRes.data ?? []) as unknown as ItemResultado[],
      };
    },
  });
  const resultadoAnterior = useMemo(
    () =>
      dadosAnterior
        ? calcularResultado(
            dadosAnterior.lancamentos,
            dadosAnterior.osItens,
            dadosAnterior.vendaItens,
            produtosById,
          )
        : null,
    [dadosAnterior, produtosById],
  );

  const pontos = useMemo(() => {
    const dias = eachDayOfInterval({ start: inicio, end: fim });
    return dias.map((dia) => {
      const diaStr = format(dia, "yyyy-MM-dd");
      const doDia = lancamentosPagos.filter((l) => l.data === diaStr);
      const valor =
        doDia.filter((l) => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0) -
        doDia.filter((l) => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0) -
        (custoPorDia.get(diaStr) ?? 0);
      return { data: diaStr, label: format(dia, "dd/MM", { locale: ptBR }), valor };
    });
  }, [lancamentosPagos, custoPorDia, inicio, fim]);

  // Mesma regra do relatório "Top 10": faturamento com o desconto da venda
  // rateado entre os itens, margem pelo custo do cadastro, e itens de OS/venda
  // cancelada (ou OS reprovada) fora do ranking.
  const { topProdutos, topServicos } = useMemo(() => {
    type Acc = { quantidade: number; faturamento: number; custo: number };
    const produtosMap = new Map<string, Acc>();
    const servicosMap = new Map<string, Acc>();
    function acumular(
      alvo: Map<string, Acc>,
      nome: string,
      qtd: number,
      valor: number,
      custoUnit: number,
    ) {
      const a = alvo.get(nome) ?? { quantidade: 0, faturamento: 0, custo: 0 };
      a.quantidade += qtd;
      a.faturamento += valor;
      a.custo += qtd * custoUnit;
      alvo.set(nome, a);
    }

    for (const i of data?.osItens ?? []) {
      const statusOs = i.ordens_servico?.status;
      if (statusOs === "cancelado" || statusOs === "reprovado") continue;
      const produto = i.produto_id ? produtosById.get(i.produto_id) : null;
      const qtd = Number(i.quantidade);
      acumular(
        i.tipo === "servico" ? servicosMap : produtosMap,
        i.descricao,
        qtd,
        qtd * Number(i.preco_unitario),
        Number(produto?.preco_custo ?? 0),
      );
    }

    const vendaItens = (data?.vendaItens ?? []).filter((i) => i.vendas?.status !== "cancelado");
    const subtotalPorVenda = new Map<string, number>();
    for (const i of vendaItens) {
      const bruto = Number(i.quantidade) * Number(i.preco_unitario);
      subtotalPorVenda.set(i.venda_id, (subtotalPorVenda.get(i.venda_id) ?? 0) + bruto);
    }
    for (const i of vendaItens) {
      const produto = i.produto_id ? produtosById.get(i.produto_id) : null;
      const subtotal = subtotalPorVenda.get(i.venda_id) ?? 0;
      const fator = i.vendas && subtotal > 0 ? Number(i.vendas.total) / subtotal : 1;
      const qtd = Number(i.quantidade);
      acumular(
        produto?.categoria === "Serviço" ? servicosMap : produtosMap,
        i.descricao,
        qtd,
        qtd * Number(i.preco_unitario) * fator,
        Number(produto?.preco_custo ?? 0),
      );
    }

    const paraLista = (m: Map<string, Acc>): ItemRanking[] =>
      Array.from(m.entries())
        .map(([nome, a]) => ({
          nome,
          quantidade: a.quantidade,
          faturamento: a.faturamento,
          margem: a.faturamento > 0 ? ((a.faturamento - a.custo) / a.faturamento) * 100 : 0,
        }))
        .sort((a, b) => b.quantidade - a.quantidade || b.faturamento - a.faturamento);

    return { topProdutos: paraLista(produtosMap), topServicos: paraLista(servicosMap) };
  }, [data?.osItens, data?.vendaItens, produtosById]);

  const ordensAbertas: OsAberta[] = (data?.os ?? [])
    .filter((o) => !STATUS_FECHADOS.includes(o.status))
    .map((o) => ({
      id: o.id,
      numero: o.numero,
      cliente: o.clientes?.nome ?? "Sem cliente",
      previsao: o.previsao,
      status: o.status,
    }));

  const produtosCount = (data?.produtos ?? []).filter((p) => p.categoria !== "Serviço").length;
  const servicosCount = (data?.produtos ?? []).filter((p) => p.categoria === "Serviço").length;

  return (
    <div className="-m-4 flex flex-col gap-3 bg-[#F3F4F9] p-4 sm:gap-6 dark:m-0 dark:bg-transparent dark:p-0 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <PageHeader
        title={`Olá, ${profile?.nome?.split(" ")[0] || "Administrador"}`}
        subtitle={profile?.loja ? `Painel da ${profile.loja}` : "Visão geral da sua operação"}
      />

      <QuickAccessCards />

      {/* Celular: películas e indicações vão para o fim — o topo fica com os
          números e as OS. No desktop a ordem não muda. */}
      <div className="order-last grid gap-3 md:grid-cols-2 md:gap-4 lg:order-none">
        <FilmSearchCard />
        <PartnerProgramCard />
      </div>

      <div className="grid gap-3 sm:gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-3 sm:gap-6 lg:col-span-2">
          <div className="order-1">
            <MonthlyResultCard
              periodo={periodo}
              onPeriodoChange={setPeriodo}
              dataInicio={dataInicio}
              dataFim={dataFim}
              onDataInicioChange={setDataInicio}
              onDataFimChange={setDataFim}
              metrics={{ lucroLiquido, margem, receita, cmv, custoServicos, despesas }}
              anterior={resultadoAnterior}
              pontos={pontos}
              carregando={carregando}
            />
          </div>

          {/* Celular: OS em aberto logo após o resultado (antes dos rankings). */}
          <section className="order-3 rounded-2xl border border-border bg-card p-3 shadow-soft sm:p-5 lg:order-2">
            <h2 className="mb-2 text-sm font-bold sm:mb-4 sm:text-base">
              Top 10 Produtos Vendidos
            </h2>
            {carregando ? (
              <div className="h-56 animate-pulse rounded-xl bg-secondary/40" />
            ) : (
              <TopProductsChart itens={topProdutos} />
            )}
          </section>

          <section className="order-4 rounded-2xl border border-border bg-card p-3 shadow-soft sm:p-5 lg:order-3">
            <h2 className="mb-2 text-sm font-bold sm:mb-4 sm:text-base">
              Top 10 Serviços Vendidos
            </h2>
            {carregando ? (
              <div className="h-56 animate-pulse rounded-xl bg-secondary/40" />
            ) : (
              <TopServicesChart itens={topServicos} />
            )}
          </section>

          <div className="order-2 lg:order-4">
            <OpenOrdersTable
              ordens={ordensAbertas}
              carregando={carregando}
              erro={erroOrdens}
              onTentarNovamente={() => refetch()}
            />
          </div>
        </div>

        {/* Celular: estatísticas antes do resultado do mês. */}
        <div className="order-first lg:order-none lg:col-span-1">
          <SystemStatistics
            clientes={data?.clientesCount ?? 0}
            produtos={produtosCount}
            servicos={servicosCount}
            ordens={data?.os.length ?? 0}
            garantias={data?.garantiasCount ?? 0}
            vendas={data?.vendasCount ?? 0}
          />
        </div>
      </div>
    </div>
  );
}
