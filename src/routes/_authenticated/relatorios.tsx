import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subDays } from "date-fns";
import { Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/AppShell";
import { useProfile } from "@/hooks/useCurrentUser";
import { dataBR, statusLabel } from "@/lib/format";
import { categoriaConsertoInfo } from "@/lib/seminovos-conserto";
import { exportToCSV, generateFinancePDF } from "@/lib/exports";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — SpaceTech" },
      {
        name: "description",
        content: "OS, vendas, estoque, financeiro e mais, com filtro por período.",
      },
    ],
  }),
  component: Relatorios,
});

type FaturamentoOsRow = {
  id: string;
  valor_total: number;
  created_at: string;
  ordens_servico: {
    numero: number;
    aparelho: string;
    marca: string | null;
    modelo: string | null;
    clientes: { nome: string } | null;
    os_itens: { produto_id: string | null; quantidade: number }[];
  } | null;
};

type SeminovoRow = Database["public"]["Tables"]["seminovos"]["Row"] & {
  clientes: { nome: string } | null;
  seminovos_conserto_itens: { categoria: string; descricao: string | null; valor: number }[];
  vendas: { total: number; created_at: string; status: string } | null;
};

function hojeStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function Relatorios() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const { data: profile } = useProfile();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(hojeStr());

  // Limites do dia no fuso local, convertidos para UTC — comparar strings
  // sem timezone com colunas timestamptz faz o Postgres assumir UTC, o que
  // exclui vendas/OS feitas à noite (horário local) do período selecionado.
  const inicioISO = new Date(`${dataInicio}T00:00:00`).toISOString();
  const fimISO = new Date(`${dataFim}T23:59:59.999`).toISOString();

  const { data } = useQuery({
    queryKey: ["relatorios", dataInicio, dataFim],
    queryFn: async () => {
      const [
        ordens,
        osItens,
        vendas,
        vendaItens,
        lancamentos,
        clientesNovos,
        clientesTotal,
        produtos,
        comprasAparelhos,
        seminovos,
        termos,
        faturamentosOs,
      ] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select("*")
          .gte("created_at", inicioISO)
          .lte("created_at", fimISO),
        supabase
          .from("os_itens")
          .select("*, ordens_servico(status)")
          .gte("created_at", inicioISO)
          .lte("created_at", fimISO),
        supabase.from("vendas").select("*").gte("created_at", inicioISO).lte("created_at", fimISO),
        supabase.from("venda_itens").select("*"),
        supabase.from("lancamentos").select("*").gte("data", dataInicio).lte("data", dataFim),
        supabase
          .from("clientes")
          .select("id, created_at")
          .gte("created_at", inicioISO)
          .lte("created_at", fimISO),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("produtos").select("*"),
        supabase
          .from("compras_aparelhos")
          .select("*")
          .gte("data_compra", dataInicio)
          .lte("data_compra", dataFim),
        // Seminovos comprados no período (data da compra = data_avaliacao,
        // a mesma exibida na tela Compra de Seminovos), com o detalhe do
        // conserto e a venda vinculada para calcular o lucro de cada aparelho.
        supabase
          .from("seminovos")
          .select(
            "*, clientes(nome), seminovos_conserto_itens(categoria, descricao, valor), vendas(total, created_at, status)",
          )
          .gte("data_avaliacao", inicioISO)
          .lte("data_avaliacao", fimISO)
          .order("data_avaliacao", { ascending: false }),
        supabase.from("termos_garantia").select("*"),
        // Faturamentos de OS do período (data do faturamento, não da abertura
        // da OS), com os itens da OS para calcular o custo das peças.
        supabase
          .from("os_faturamentos")
          .select(
            "id, valor_total, created_at, ordens_servico(numero, aparelho, marca, modelo, clientes(nome), os_itens(produto_id, quantidade))",
          )
          .neq("status", "cancelado")
          .gte("created_at", inicioISO)
          .lte("created_at", fimISO)
          .order("created_at", { ascending: false }),
      ]);
      return {
        ordens: ordens.data ?? [],
        osItens: osItens.data ?? [],
        vendas: vendas.data ?? [],
        vendaItens: vendaItens.data ?? [],
        lancamentos: lancamentos.data ?? [],
        clientesNovos: clientesNovos.data ?? [],
        clientesTotal: clientesTotal.count ?? 0,
        produtos: produtos.data ?? [],
        comprasAparelhos: comprasAparelhos.data ?? [],
        seminovos: (seminovos.data ?? []) as unknown as SeminovoRow[],
        termos: termos.data ?? [],
        faturamentosOs: (faturamentosOs.data ?? []) as unknown as FaturamentoOsRow[],
      };
    },
  });

  const resumo = useMemo(() => {
    const d = data;
    if (!d) return null;

    const osPorStatus: Record<string, number> = {};
    for (const o of d.ordens) osPorStatus[o.status] = (osPorStatus[o.status] ?? 0) + 1;

    const vendasValidas = d.vendas.filter((v) => v.status !== "cancelado");
    const vendasById = new Map(vendasValidas.map((v) => [v.id, v]));
    const vendaIdsPeriodo = new Set(vendasValidas.map((v) => v.id));
    const itensVendaPeriodo = d.vendaItens.filter((i) => vendaIdsPeriodo.has(i.venda_id));
    const produtosById = new Map(d.produtos.map((p) => [p.id, p]));

    // Soma bruta (sem desconto) dos itens de cada venda, usada para ratear o
    // desconto da venda proporcionalmente entre os itens no faturamento por produto.
    const subtotalBrutoPorVenda = new Map<string, number>();
    for (const i of itensVendaPeriodo) {
      const atual = subtotalBrutoPorVenda.get(i.venda_id) ?? 0;
      subtotalBrutoPorVenda.set(i.venda_id, atual + i.quantidade * i.preco_unitario);
    }

    const acumulador = new Map<
      string,
      { descricao: string; tipo: string; qtd: number; faturamento: number; custo: number }
    >();
    function acumular(
      descricao: string,
      tipo: string,
      qtd: number,
      valor: number,
      custoUnitario: number,
    ) {
      const chave = `${tipo}:${descricao}`;
      const atual = acumulador.get(chave) ?? { descricao, tipo, qtd: 0, faturamento: 0, custo: 0 };
      atual.qtd += qtd;
      atual.faturamento += valor;
      atual.custo += qtd * custoUnitario;
      acumulador.set(chave, atual);
    }
    for (const i of d.osItens) {
      const produto = i.produto_id ? produtosById.get(i.produto_id) : null;
      acumular(
        i.descricao,
        i.tipo === "servico" ? "Serviço" : "Produto",
        i.quantidade,
        i.quantidade * i.preco_unitario,
        Number(produto?.preco_custo ?? 0),
      );
    }
    for (const i of itensVendaPeriodo) {
      const produto = i.produto_id ? produtosById.get(i.produto_id) : null;
      const tipo = produto?.categoria === "Serviço" ? "Serviço" : "Produto";
      const venda = vendasById.get(i.venda_id);
      const subtotalBruto = subtotalBrutoPorVenda.get(i.venda_id) ?? 0;
      // Rateia o desconto da venda proporcionalmente entre os itens, para que a
      // soma do faturamento por produto bata com o faturamento total da venda.
      const fatorDesconto = venda && subtotalBruto > 0 ? Number(venda.total) / subtotalBruto : 1;
      acumular(
        i.descricao,
        tipo,
        i.quantidade,
        i.quantidade * i.preco_unitario * fatorDesconto,
        Number(produto?.preco_custo ?? 0),
      );
    }
    const comMargem = (i: { faturamento: number; custo: number }) =>
      i.faturamento > 0 ? ((i.faturamento - i.custo) / i.faturamento) * 100 : 0;
    const todosItens = Array.from(acumulador.values())
      .map((i) => ({ ...i, margem: comMargem(i) }))
      .sort((a, b) => b.faturamento - a.faturamento);
    const topProdutos = todosItens.filter((i) => i.tipo === "Produto").slice(0, 10);
    const topServicos = todosItens.filter((i) => i.tipo === "Serviço").slice(0, 10);

    // Só lançamentos "pago" contam como caixa realizado — mesmo padrão da
    // tela Financeiro (filtro padrão status="pago"). "pendente" ainda não
    // entrou no caixa e "cancelado" não deve contar como receita/despesa.
    const lancamentosPagos = d.lancamentos.filter((l) => l.status === "pago");
    const entradas = lancamentosPagos
      .filter((l) => l.tipo === "entrada")
      .reduce((s, l) => s + Number(l.valor), 0);
    const saidas = lancamentosPagos
      .filter((l) => l.tipo === "saida")
      .reduce((s, l) => s + Number(l.valor), 0);
    const porCategoria = new Map<string, { entradas: number; saidas: number }>();
    for (const l of lancamentosPagos) {
      const cat = l.categoria || "Sem categoria";
      const atual = porCategoria.get(cat) ?? { entradas: 0, saidas: 0 };
      if (l.tipo === "entrada") atual.entradas += Number(l.valor);
      else atual.saidas += Number(l.valor);
      porCategoria.set(cat, atual);
    }

    // Custo dos serviços: o "Custo adicional" do cadastro de Serviços
    // (produtos.preco_custo com categoria "Serviço") de cada serviço usado em
    // OS ou venda no período entra como despesa — mesma regra do CMV no
    // Dashboard. Itens de OS cancelada/reprovada ou venda cancelada não
    // geraram receita, então o custo deles também não conta.
    const OS_STATUS_SEM_CUSTO = new Set(["cancelado", "reprovado"]);
    const custoServico = (produtoId: string | null, quantidade: number) => {
      const produto = produtoId ? produtosById.get(produtoId) : null;
      return produto?.categoria === "Serviço"
        ? Number(quantidade) * Number(produto.preco_custo ?? 0)
        : 0;
    };
    let custoServicos = 0;
    for (const i of d.osItens) {
      const statusOs = (i as unknown as { ordens_servico?: { status?: string } | null })
        .ordens_servico?.status;
      if (statusOs && OS_STATUS_SEM_CUSTO.has(statusOs)) continue;
      custoServicos += custoServico(i.produto_id, i.quantidade);
    }
    for (const i of itensVendaPeriodo) custoServicos += custoServico(i.produto_id, i.quantidade);
    if (custoServicos > 0) {
      const atual = porCategoria.get("Custo dos serviços") ?? { entradas: 0, saidas: 0 };
      atual.saidas += custoServicos;
      porCategoria.set("Custo dos serviços", atual);
    }
    const despesaTotal = saidas + custoServicos;

    const faturamentoVendas = vendasValidas.reduce((s, v) => s + Number(v.total), 0);
    const baixoEstoque = d.produtos.filter((p) => p.quantidade <= p.estoque_minimo);
    const valorEstoque = d.produtos.reduce((s, p) => s + p.quantidade * Number(p.preco_custo), 0);

    const valorComprasAparelhos = d.comprasAparelhos.reduce((s, c) => s + Number(c.valor_pago), 0);
    // Toda linha em "seminovos" já representa uma compra efetivada (o
    // módulo não tem mais uma etapa de "em avaliação" antes da compra —
    // ver reformulação de Compra de Seminovos), então não há mais um
    // subconjunto de status a filtrar aqui: a lista inteira do período conta.
    const seminovosComprados = d.seminovos;
    const valorSeminovos = seminovosComprados.reduce((s, i) => s + Number(i.valor_pago ?? 0), 0);

    // Detalhe das despesas por aparelho comprado (compra + conserto + outros
    // custos = valor_total_gasto) e o lucro da venda, quando já vendido. O
    // valor de venda vem da venda vinculada (vendas.total); venda cancelada
    // não conta como vendido.
    const aparelhosComprados = seminovosComprados.map((s) => {
      const compra = Number(s.valor_pago ?? 0);
      const conserto = Number(s.valor_conserto ?? 0);
      const outros = Number(s.outros_custos ?? 0);
      const totalGasto = compra + conserto + outros;
      const vendaValida = s.vendas && s.vendas.status !== "cancelado" ? s.vendas : null;
      const vendido = s.status === "vendido" || !!vendaValida;
      const valorVenda = vendido ? Number(vendaValida?.total ?? s.preco_venda ?? 0) : null;
      return {
        id: s.id,
        data: s.data_avaliacao,
        aparelho: [s.marca, s.modelo].filter(Boolean).join(" "),
        imei: s.imei,
        vendedor: s.clientes?.nome ?? s.vendedor_nome ?? "—",
        status: s.status,
        compra,
        conserto,
        outros,
        totalGasto,
        itensConserto: s.seminovos_conserto_itens ?? [],
        dataVenda: vendaValida?.created_at ?? null,
        valorVenda,
        lucro: valorVenda !== null ? valorVenda - totalGasto : null,
      };
    });
    const aparelhosVendidos = aparelhosComprados.filter((a) => a.valorVenda !== null);
    const aparelhosTotais = {
      compra: aparelhosComprados.reduce((s, a) => s + a.compra, 0),
      conserto: aparelhosComprados.reduce((s, a) => s + a.conserto, 0),
      outros: aparelhosComprados.reduce((s, a) => s + a.outros, 0),
      totalGasto: aparelhosComprados.reduce((s, a) => s + a.totalGasto, 0),
      vendidos: aparelhosVendidos.length,
      custoVendidos: aparelhosVendidos.reduce((s, a) => s + a.totalGasto, 0),
      valorVendido: aparelhosVendidos.reduce((s, a) => s + (a.valorVenda ?? 0), 0),
      lucro: aparelhosVendidos.reduce((s, a) => s + (a.lucro ?? 0), 0),
    };
    const consertoPorCategoria = new Map<string, number>();
    for (const a of aparelhosComprados)
      for (const i of a.itensConserto)
        consertoPorCategoria.set(
          i.categoria,
          (consertoPorCategoria.get(i.categoria) ?? 0) + Number(i.valor),
        );

    // Faturamento de OS: o custo (despesa direta) de cada OS é o custo das
    // peças/serviços usados, pelo preco_custo do cadastro — mesma regra do
    // CMV no Dashboard.
    const faturamentoOs = d.faturamentosOs.map((f) => {
      const os = f.ordens_servico;
      const custo = (os?.os_itens ?? []).reduce(
        (s, i) =>
          s +
          (i.produto_id
            ? Number(i.quantidade) * Number(produtosById.get(i.produto_id)?.preco_custo ?? 0)
            : 0),
        0,
      );
      const faturado = Number(f.valor_total);
      return {
        id: f.id,
        data: f.created_at,
        numero: os?.numero ?? null,
        cliente: os?.clientes?.nome ?? "Sem cliente",
        aparelho: [os?.marca, os?.modelo].filter(Boolean).join(" ") || os?.aparelho || "—",
        faturado,
        custo,
        lucro: faturado - custo,
      };
    });
    const osFaturado = faturamentoOs.reduce((s, f) => s + f.faturado, 0);
    const osCusto = faturamentoOs.reduce((s, f) => s + f.custo, 0);

    return {
      faturamentoOs,
      osFaturado,
      osCusto,
      osLucro: osFaturado - osCusto,
      osMargem: osFaturado > 0 ? ((osFaturado - osCusto) / osFaturado) * 100 : 0,
      osPorStatus,
      topProdutos,
      topServicos,
      entradas,
      saidas,
      custoServicos,
      despesaTotal,
      resultado: entradas - despesaTotal,
      margem: entradas > 0 ? ((entradas - despesaTotal) / entradas) * 100 : 0,
      porCategoria: Array.from(porCategoria.entries()),
      faturamentoVendas,
      ticketMedio: vendasValidas.length ? faturamentoVendas / vendasValidas.length : 0,
      baixoEstoque,
      valorEstoque,
      valorComprasAparelhos,
      seminovosComprados,
      valorSeminovos,
      aparelhosComprados,
      aparelhosTotais,
      consertoPorCategoria: Array.from(consertoPorCategoria.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [data]);

  function preset(tipo: "hoje" | "7dias" | "mes" | "ano") {
    const hoje = new Date();
    if (tipo === "hoje") {
      setDataInicio(hojeStr());
      setDataFim(hojeStr());
    } else if (tipo === "7dias") {
      setDataInicio(format(subDays(hoje, 6), "yyyy-MM-dd"));
      setDataFim(hojeStr());
    } else if (tipo === "mes") {
      setDataInicio(format(startOfMonth(hoje), "yyyy-MM-dd"));
      setDataFim(format(endOfMonth(hoje), "yyyy-MM-dd"));
    } else {
      setDataInicio(format(startOfYear(hoje), "yyyy-MM-dd"));
      setDataFim(format(endOfYear(hoje), "yyyy-MM-dd"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="OS, vendas, estoque, financeiro e muito mais — filtrado por período"
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="space-y-1.5">
          <Label className="text-xs">Data início</Label>
          <Input
            type="date"
            className="h-9"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data fim</Label>
          <Input
            type="date"
            className="h-9"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => preset("hoje")}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => preset("7dias")}>
            7 dias
          </Button>
          <Button variant="outline" size="sm" onClick={() => preset("mes")}>
            Este mês
          </Button>
          <Button variant="outline" size="sm" onClick={() => preset("ano")}>
            Este ano
          </Button>
        </div>
      </div>

      {resumo && data && (
        <>
          <div id="visao-geral" className="scroll-mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Ordens de serviço" value={String(data.ordens.length)} />
            <Stat
              label="Vendas"
              value={String(data.vendas.length)}
              sub={brl(resumo.faturamentoVendas)}
            />
            <Stat label="Ticket médio" value={brl(resumo.ticketMedio)} />
            <Stat
              label="Clientes novos"
              value={String(data.clientesNovos.length)}
              sub={`${data.clientesTotal} no total`}
            />
            <Stat label="Receita" value={brl(resumo.entradas)} tone="success" />
            <Stat
              label="Despesa"
              value={brl(resumo.despesaTotal)}
              sub={`Saídas ${brl(resumo.saidas)} + custo dos serviços ${brl(resumo.custoServicos)}`}
              tone="danger"
            />
            <Stat label="Resultado" value={brl(resumo.resultado)} />
            <Stat label="Margem" value={`${resumo.margem.toFixed(1)}%`} />
          </div>

          <Secao
            id="ordens"
            titulo="Faturamento de OS"
            onExportar={() =>
              exportToCSV(
                resumo.faturamentoOs.map((f) => ({
                  os: f.numero,
                  data: format(new Date(f.data), "dd/MM/yyyy"),
                  cliente: f.cliente,
                  aparelho: f.aparelho,
                  faturado: f.faturado.toFixed(2),
                  custo_pecas: f.custo.toFixed(2),
                  lucro: f.lucro.toFixed(2),
                })),
                "relatorio-faturamento-os",
              )
            }
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Faturado em OS" value={brl(resumo.osFaturado)} tone="success" />
              <Stat
                label="Despesas das OS"
                value={brl(resumo.osCusto)}
                sub="Custo das peças e serviços"
                tone="danger"
              />
              <Stat label="Lucro das OS" value={brl(resumo.osLucro)} />
              <Stat label="Margem das OS" value={`${resumo.osMargem.toFixed(1)}%`} />
              <Stat
                label="Despesas do período"
                value={brl(resumo.despesaTotal)}
                sub="Saídas pagas + custo dos serviços"
                tone="danger"
              />
            </div>
            {resumo.faturamentoOs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="pb-2">OS</th>
                      <th className="pb-2">Data</th>
                      <th className="pb-2">Cliente</th>
                      <th className="pb-2">Aparelho</th>
                      <th className="pb-2 text-right">Faturado</th>
                      <th className="pb-2 text-right">Despesas</th>
                      <th className="pb-2 text-right">Lucro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resumo.faturamentoOs.map((f) => (
                      <tr key={f.id}>
                        <td className="py-2 font-semibold">{f.numero ?? "—"}</td>
                        <td className="py-2">{format(new Date(f.data), "dd/MM/yyyy")}</td>
                        <td className="py-2">{f.cliente}</td>
                        <td className="py-2">{f.aparelho}</td>
                        <td className="py-2 text-right text-emerald-600">{brl(f.faturado)}</td>
                        <td className="py-2 text-right text-destructive">{brl(f.custo)}</td>
                        <td
                          className={`py-2 text-right font-semibold ${f.lucro < 0 ? "text-destructive" : ""}`}
                        >
                          {brl(f.lucro)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma OS faturada no período.</p>
            )}
          </Secao>

          <Secao
            titulo="Ordens de serviço por status"
            onExportar={() =>
              exportToCSV(
                Object.entries(resumo.osPorStatus).map(([status, qtd]) => ({
                  status: statusLabel(status),
                  quantidade: qtd,
                })),
                "relatorio-os-por-status",
              )
            }
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(resumo.osPorStatus).map(([status, qtd]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-2.5 text-sm"
                >
                  <span className="text-muted-foreground">{statusLabel(status)}</span>
                  <span className="font-bold">{qtd}</span>
                </div>
              ))}
              {!Object.keys(resumo.osPorStatus).length && (
                <p className="text-sm text-muted-foreground">Nenhuma OS no período.</p>
              )}
            </div>
          </Secao>

          <div className="grid gap-6 lg:grid-cols-2">
            <Secao
              id="produtos"
              titulo="Top 10 produtos vendidos"
              onExportar={() => exportToCSV(resumo.topProdutos, "relatorio-top-produtos")}
            >
              <TabelaTop itens={resumo.topProdutos} />
            </Secao>
            <Secao
              id="servicos"
              titulo="Top 10 serviços vendidos"
              onExportar={() => exportToCSV(resumo.topServicos, "relatorio-top-servicos")}
            >
              <TabelaTop itens={resumo.topServicos} />
            </Secao>
          </div>

          <Secao
            titulo="Estoque"
            onExportar={() => exportToCSV(resumo.baixoEstoque, "relatorio-estoque-baixo")}
          >
            <div className="mb-3 flex flex-wrap gap-4 text-sm">
              <span>
                Produtos cadastrados: <b>{data.produtos.length}</b>
              </span>
              <span>
                Valor em estoque (custo): <b>{brl(resumo.valorEstoque)}</b>
              </span>
              <span>
                Abaixo do mínimo: <b>{resumo.baixoEstoque.length}</b>
              </span>
            </div>
            {resumo.baixoEstoque.length > 0 && (
              <div className="divide-y divide-border rounded-xl border border-border">
                {resumo.baixoEstoque.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span>{p.nome}</span>
                    <span className="text-destructive">
                      {p.quantidade} / mín. {p.estoque_minimo}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Secao>

          <Secao
            id="financeiro"
            titulo="Financeiro por categoria"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  generateFinancePDF(
                    // O custo dos serviços entra no total de Saídas, então
                    // aparece também como uma linha da tabela para o PDF fechar.
                    resumo.custoServicos > 0
                      ? [
                          ...data.lancamentos,
                          {
                            data: dataFim,
                            descricao: "Custo dos serviços usados no período",
                            categoria: "Custo dos serviços",
                            tipo: "saida",
                            valor: resumo.custoServicos,
                          },
                        ]
                      : data.lancamentos,
                    profile,
                    {
                      entradas: resumo.entradas,
                      saidas: resumo.despesaTotal,
                      saldo: resumo.resultado,
                    },
                  )
                }
              >
                <FileText className="h-4 w-4" /> PDF
              </Button>
            }
            onExportar={() =>
              exportToCSV(
                resumo.porCategoria.map(([categoria, v]) => ({
                  categoria,
                  entradas: v.entradas,
                  saidas: v.saidas,
                })),
                "relatorio-financeiro-categorias",
              )
            }
          >
            <div className="divide-y divide-border rounded-xl border border-border">
              {resumo.porCategoria.map(([categoria, v]) => (
                <div
                  key={categoria}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span>{categoria}</span>
                  <span>
                    <span className="text-emerald-600">+{brl(v.entradas)}</span>{" "}
                    <span className="text-destructive">-{brl(v.saidas)}</span>
                  </span>
                </div>
              ))}
              {!resumo.porCategoria.length && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Nenhum lançamento no período.
                </p>
              )}
            </div>
          </Secao>

          <Secao
            id="aparelhos-comprados"
            titulo="Despesas com aparelhos comprados"
            onExportar={() =>
              exportToCSV(
                resumo.aparelhosComprados.map((a) => ({
                  data_compra: dataBR(a.data),
                  aparelho: a.aparelho,
                  imei: a.imei ?? "",
                  vendedor: a.vendedor,
                  status: statusLabel(a.status),
                  valor_compra: a.compra.toFixed(2),
                  conserto: a.conserto.toFixed(2),
                  detalhe_conserto: a.itensConserto
                    .map(
                      (i) =>
                        `${categoriaConsertoInfo(i.categoria).label}${i.descricao ? ` (${i.descricao})` : ""}: ${Number(i.valor).toFixed(2)}`,
                    )
                    .join("; "),
                  outros_custos: a.outros.toFixed(2),
                  total_gasto: a.totalGasto.toFixed(2),
                  data_venda: a.dataVenda ? dataBR(a.dataVenda) : "",
                  valor_venda: a.valorVenda !== null ? a.valorVenda.toFixed(2) : "",
                  lucro: a.lucro !== null ? a.lucro.toFixed(2) : "",
                })),
                "relatorio-despesas-aparelhos-comprados",
              )
            }
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Aparelhos comprados"
                value={String(resumo.aparelhosComprados.length)}
                sub={`Pago na compra ${brl(resumo.aparelhosTotais.compra)}`}
              />
              <Stat
                label="Despesas totais"
                value={brl(resumo.aparelhosTotais.totalGasto)}
                sub={`Conserto ${brl(resumo.aparelhosTotais.conserto)} · outros ${brl(resumo.aparelhosTotais.outros)}`}
                tone="danger"
              />
              <Stat
                label="Vendidos"
                value={String(resumo.aparelhosTotais.vendidos)}
                sub={`Vendidos por ${brl(resumo.aparelhosTotais.valorVendido)} · custo ${brl(resumo.aparelhosTotais.custoVendidos)}`}
                tone="success"
              />
              <Stat
                label="Lucro com as vendas"
                value={brl(resumo.aparelhosTotais.lucro)}
                sub={
                  resumo.aparelhosTotais.valorVendido > 0
                    ? `Margem ${((resumo.aparelhosTotais.lucro / resumo.aparelhosTotais.valorVendido) * 100).toFixed(1)}%`
                    : "Nenhum vendido ainda"
                }
              />
            </div>
            {resumo.consertoPorCategoria.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {resumo.consertoPorCategoria.map(([categoria, valor]) => (
                  <span
                    key={categoria}
                    className="rounded-full bg-secondary/60 px-3 py-1 text-xs text-muted-foreground"
                  >
                    {categoriaConsertoInfo(categoria).label}:{" "}
                    <b className="text-foreground">{brl(valor)}</b>
                  </span>
                ))}
              </div>
            )}
            {resumo.aparelhosComprados.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="pb-2">Compra</th>
                      <th className="pb-2">Aparelho</th>
                      <th className="pb-2">Vendedor</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Valor pago</th>
                      <th className="pb-2 text-right">Conserto</th>
                      <th className="pb-2 text-right">Outros</th>
                      <th className="pb-2 text-right">Total gasto</th>
                      <th className="pb-2 text-right">Venda</th>
                      <th className="pb-2 text-right">Lucro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resumo.aparelhosComprados.map((a) => (
                      <tr key={a.id} className="align-top">
                        <td className="py-2">{dataBR(a.data)}</td>
                        <td className="py-2">
                          <p className="font-semibold">{a.aparelho}</p>
                          {a.imei && <p className="text-xs text-muted-foreground">IMEI {a.imei}</p>}
                        </td>
                        <td className="py-2">{a.vendedor}</td>
                        <td className="py-2">{statusLabel(a.status)}</td>
                        <td className="py-2 text-right text-destructive">{brl(a.compra)}</td>
                        <td className="py-2 text-right">
                          <span className="text-destructive">{brl(a.conserto)}</span>
                          {a.itensConserto.map((i, idx) => (
                            <p key={idx} className="text-xs text-muted-foreground">
                              {categoriaConsertoInfo(i.categoria).label}
                              {i.descricao ? ` (${i.descricao})` : ""}: {brl(Number(i.valor))}
                            </p>
                          ))}
                        </td>
                        <td className="py-2 text-right text-destructive">{brl(a.outros)}</td>
                        <td className="py-2 text-right font-semibold text-destructive">
                          {brl(a.totalGasto)}
                        </td>
                        <td className="py-2 text-right">
                          {a.valorVenda !== null ? (
                            <>
                              <span className="text-emerald-600">{brl(a.valorVenda)}</span>
                              {a.dataVenda && (
                                <p className="text-xs text-muted-foreground">
                                  {dataBR(a.dataVenda)}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td
                          className={`py-2 text-right font-semibold ${a.lucro !== null && a.lucro < 0 ? "text-destructive" : ""}`}
                        >
                          {a.lucro !== null ? brl(a.lucro) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum aparelho comprado no período.</p>
            )}
          </Secao>

          <div className="grid gap-6 lg:grid-cols-2">
            <Secao
              titulo="Compras (aparelhos e seminovos)"
              onExportar={() => exportToCSV(data.comprasAparelhos, "relatorio-compras")}
            >
              <div className="space-y-2 text-sm">
                <p>
                  Compras de aparelhos: <b>{data.comprasAparelhos.length}</b> ·{" "}
                  <b>{brl(resumo.valorComprasAparelhos)}</b>
                </p>
                <p>
                  Seminovos comprados/vendidos: <b>{resumo.seminovosComprados.length}</b> ·{" "}
                  <b>{brl(resumo.valorSeminovos)}</b>
                </p>
              </div>
            </Secao>
            <Secao
              titulo="Garantias"
              onExportar={() => exportToCSV(data.termos, "relatorio-garantias")}
            >
              <div className="divide-y divide-border rounded-xl border border-border">
                {data.termos.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span>{t.titulo}</span>
                    {t.is_default && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                        Padrão
                      </span>
                    )}
                  </div>
                ))}
                {!data.termos.length && (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    Nenhum termo de garantia cadastrado.
                  </p>
                )}
              </div>
            </Secao>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-extrabold ${
          tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Secao({
  titulo,
  children,
  onExportar,
  action,
  id,
}: {
  titulo: string;
  children: React.ReactNode;
  onExportar?: () => void;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">{titulo}</h2>
        <div className="flex items-center gap-2">
          {action}
          {onExportar && (
            <Button size="sm" variant="outline" onClick={onExportar}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function TabelaTop({
  itens,
}: {
  itens: { descricao: string; qtd: number; faturamento: number; margem: number }[];
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  if (!itens.length)
    return <p className="text-sm text-muted-foreground">Nenhum item vendido no período.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="pb-2">Item</th>
            <th className="pb-2 text-right">Qtd.</th>
            <th className="pb-2 text-right">Faturamento</th>
            <th className="pb-2 text-right">Margem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {itens.map((i) => (
            <tr key={i.descricao}>
              <td className="py-2">{i.descricao}</td>
              <td className="py-2 text-right">{i.qtd}</td>
              <td className="py-2 text-right font-semibold">{brl(i.faturamento)}</td>
              <td
                className={`py-2 text-right ${i.margem < 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {i.margem.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
