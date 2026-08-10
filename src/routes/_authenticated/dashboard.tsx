import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
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

const STATUS_FECHADOS = ["entregue", "cancelado"];

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
          .select("tipo, valor, data")
          .gte("data", inicioStr)
          .lte("data", fimStr),
        supabase
          .from("os_itens")
          .select("produto_id, descricao, quantidade, tipo, created_at")
          .gte("created_at", `${inicioStr}T00:00:00`)
          .lte("created_at", `${fimStr}T23:59:59`),
        supabase
          .from("venda_itens")
          .select("produto_id, descricao, quantidade, created_at")
          .gte("created_at", `${inicioStr}T00:00:00`)
          .lte("created_at", `${fimStr}T23:59:59`),
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

  const receita = (data?.lancamentos ?? [])
    .filter((l) => l.tipo === "entrada")
    .reduce((s, l) => s + Number(l.valor), 0);
  const despesas = (data?.lancamentos ?? [])
    .filter((l) => l.tipo === "saida")
    .reduce((s, l) => s + Number(l.valor), 0);

  let cmv = 0;
  for (const i of data?.osItens ?? []) {
    if (i.tipo === "produto" && i.produto_id) {
      cmv += Number(i.quantidade) * Number(produtosById.get(i.produto_id)?.preco_custo ?? 0);
    }
  }
  for (const i of data?.vendaItens ?? []) {
    const produto = i.produto_id ? produtosById.get(i.produto_id) : null;
    if (produto && produto.categoria !== "Serviço") {
      cmv += Number(i.quantidade) * Number(produto.preco_custo ?? 0);
    }
  }
  const lucroLiquido = receita - cmv - despesas;
  const margem = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

  const pontos = useMemo(() => {
    const dias = eachDayOfInterval({ start: inicio, end: fim });
    return dias.map((dia) => {
      const diaStr = format(dia, "yyyy-MM-dd");
      const doDia = (data?.lancamentos ?? []).filter((l) => l.data === diaStr);
      const valor =
        doDia.filter((l) => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0) -
        doDia.filter((l) => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
      return { data: diaStr, label: format(dia, "dd/MM", { locale: ptBR }), valor };
    });
  }, [data?.lancamentos, inicio, fim]);

  const { topProdutos, topServicos } = useMemo(() => {
    const produtosMap = new Map<string, number>();
    const servicosMap = new Map<string, number>();

    for (const i of data?.osItens ?? []) {
      const alvo = i.tipo === "servico" ? servicosMap : produtosMap;
      alvo.set(i.descricao, (alvo.get(i.descricao) ?? 0) + Number(i.quantidade));
    }
    for (const i of data?.vendaItens ?? []) {
      const produto = i.produto_id ? produtosById.get(i.produto_id) : null;
      const alvo = produto?.categoria === "Serviço" ? servicosMap : produtosMap;
      alvo.set(i.descricao, (alvo.get(i.descricao) ?? 0) + Number(i.quantidade));
    }

    const paraLista = (m: Map<string, number>): ItemRanking[] =>
      Array.from(m.entries())
        .map(([nome, quantidade]) => ({ nome, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade);

    return { topProdutos: paraLista(produtosMap), topServicos: paraLista(servicosMap) };
  }, [data?.osItens, data?.vendaItens, produtosById]);

  const ordensAbertas: OsAberta[] = (data?.os ?? [])
    .filter((o) => !STATUS_FECHADOS.includes(o.status))
    .map((o) => ({
      id: o.id,
      numero: o.numero,
      cliente: (o.clientes as any)?.nome ?? "Sem cliente",
      previsao: o.previsao,
      status: o.status,
    }));

  const produtosCount = (data?.produtos ?? []).filter((p) => p.categoria !== "Serviço").length;
  const servicosCount = (data?.produtos ?? []).filter((p) => p.categoria === "Serviço").length;

  return (
    <div className="-m-4 space-y-6 bg-[#F3F4F9] p-4 dark:m-0 dark:bg-transparent dark:p-0 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <PageHeader
        title={`Olá, ${profile?.nome?.split(" ")[0] || "Administrador"}`}
        subtitle={profile?.loja ? `Painel da ${profile.loja}` : "Visão geral da sua operação"}
      />

      <QuickAccessCards />

      <div className="grid gap-4 md:grid-cols-2">
        <FilmSearchCard />
        <PartnerProgramCard />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <MonthlyResultCard
            periodo={periodo}
            onPeriodoChange={setPeriodo}
            dataInicio={dataInicio}
            dataFim={dataFim}
            onDataInicioChange={setDataInicio}
            onDataFimChange={setDataFim}
            metrics={{ lucroLiquido, margem, receita, cmv, despesas }}
            pontos={pontos}
            carregando={carregando}
          />

          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-4 text-base font-bold">Top 10 Produtos Vendidos</h2>
            {carregando ? (
              <div className="h-56 animate-pulse rounded-xl bg-secondary/40" />
            ) : (
              <TopProductsChart itens={topProdutos} />
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-4 text-base font-bold">Top 10 Serviços Vendidos</h2>
            {carregando ? (
              <div className="h-56 animate-pulse rounded-xl bg-secondary/40" />
            ) : (
              <TopServicesChart itens={topServicos} />
            )}
          </section>

          <OpenOrdersTable
            ordens={ordensAbertas}
            carregando={carregando}
            erro={erroOrdens}
            onTentarNovamente={() => refetch()}
          />
        </div>

        <div className="lg:col-span-1">
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
