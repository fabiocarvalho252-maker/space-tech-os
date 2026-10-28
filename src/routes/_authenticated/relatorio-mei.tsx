// Receitas Brutas – MEI: receita mês a mês do ano, separada em comércio e
// serviços, no formato que o MEI informa na declaração anual (DASN-SIMEI).
// O cálculo fica em src/lib/relatorio-mei.ts (testado).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Download, Printer, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useEmpresaId } from "@/hooks/useCurrentUser";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { TableSkeleton } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportToCSV } from "@/lib/exports";
import {
  LIMITE_MEI_ANUAL,
  calcularReceitaMei,
  type FaturamentoMei,
  type VendaMei,
} from "@/lib/relatorio-mei";

export const Route = createFileRoute("/_authenticated/relatorio-mei")({
  head: () => ({
    meta: [
      { title: "Receitas Brutas – MEI — SpaceTech" },
      {
        name: "description",
        content: "Receita bruta mensal separada em comércio e serviços para a declaração do MEI.",
      },
    ],
  }),
  component: RelatorioMei,
});

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const LOTE = 1000;

/** Busca todas as linhas, de 1000 em 1000 (limite por consulta do servidor). */
async function buscarTudo<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: Error | null }>,
): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += LOTE) {
    const { data, error } = await consulta(de, de + LOTE - 1);
    if (error) throw error;
    todas.push(...(data ?? []));
    if (!data || data.length < LOTE) return todas;
  }
}

function RelatorioMei() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const empresaId = useEmpresaId();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);

  // Um dia de folga em cada ponta: o mês é decidido no horário de Brasília.
  const inicio = new Date(Date.UTC(ano, 0, 1) - 86_400_000).toISOString();
  const fim = new Date(Date.UTC(ano + 1, 0, 1) + 86_400_000).toISOString();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["relatorio-mei", empresaId, ano],
    enabled: !!empresaId,
    queryFn: async () => {
      const [produtos, vendas, faturamentos] = await Promise.all([
        buscarTudo((de, ate) =>
          supabase
            .from("produtos")
            .select("id, categoria")
            .eq("user_id", empresaId!)
            .range(de, ate),
        ),
        buscarTudo((de, ate) =>
          supabase
            .from("vendas")
            .select("created_at, total, venda_itens(quantidade, preco_unitario, produto_id)")
            .eq("user_id", empresaId!)
            .neq("status", "cancelado")
            .gte("created_at", inicio)
            .lt("created_at", fim)
            .order("created_at")
            .range(de, ate),
        ),
        buscarTudo((de, ate) =>
          supabase
            .from("os_faturamentos")
            .select(
              "created_at, valor_total, ordens_servico(os_itens(tipo, quantidade, preco_unitario))",
            )
            .eq("user_id", empresaId!)
            .neq("status", "cancelado")
            .gte("created_at", inicio)
            .lt("created_at", fim)
            .order("created_at")
            .range(de, ate),
        ),
      ]);
      const servicos = new Set(produtos.filter((p) => p.categoria === "Serviço").map((p) => p.id));
      const vendasMei: VendaMei[] = vendas.map((v) => ({
        created_at: v.created_at,
        total: v.total,
        itens: (v.venda_itens ?? []).map((i) => ({
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          servico: !!i.produto_id && servicos.has(i.produto_id),
        })),
      }));
      const faturamentosMei: FaturamentoMei[] = faturamentos.map((f) => {
        const os = f.ordens_servico as unknown as {
          os_itens: FaturamentoMei["itens"];
        } | null;
        return { created_at: f.created_at, valor_total: f.valor_total, itens: os?.os_itens ?? [] };
      });
      return calcularReceitaMei(ano, vendasMei, faturamentosMei);
    },
  });

  const totais = useMemo(() => {
    const t = { comercio: 0, servicos: 0, total: 0 };
    for (const m of data ?? []) {
      t.comercio += m.comercio;
      t.servicos += m.servicos;
      t.total += m.total;
    }
    return t;
  }, [data]);
  const usoLimite = (totais.total / LIMITE_MEI_ANUAL) * 100;
  const anos = Array.from({ length: 4 }, (_, i) => anoAtual - i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receitas Brutas – MEI"
        subtitle="Receita do ano mês a mês, separada em comércio e serviços (DASN-SIMEI)"
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={!data}
              onClick={() =>
                exportToCSV(
                  [
                    ...(data ?? []).map((m) => ({
                      mes: MESES[m.mes - 1]!,
                      comercio: m.comercio.toFixed(2),
                      servicos: m.servicos.toFixed(2),
                      total: m.total.toFixed(2),
                    })),
                    {
                      mes: `Total ${ano}`,
                      comercio: totais.comercio.toFixed(2),
                      servicos: totais.servicos.toFixed(2),
                      total: totais.total.toFixed(2),
                    },
                  ],
                  `receitas-brutas-mei-${ano}`,
                )
              }
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Resumo titulo="Comércio (produtos, peças e aparelhos)" valor={brl(totais.comercio)} />
        <Resumo titulo="Prestação de serviços" valor={brl(totais.servicos)} />
        <Resumo titulo={`Receita bruta total ${ano}`} valor={brl(totais.total)} destaque />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">Limite anual do MEI</span>
          <span className="text-muted-foreground">
            {brl(totais.total)} de {brl(LIMITE_MEI_ANUAL)} ({usoLimite.toFixed(1)}%)
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full ${usoLimite >= 100 ? "bg-destructive" : usoLimite >= 80 ? "bg-amber-500" : "bg-primary"}`}
            style={{ width: `${Math.min(100, usoLimite)}%` }}
          />
        </div>
        {usoLimite >= 80 && (
          <p className="mt-3 flex items-start gap-2 text-xs text-amber-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {usoLimite >= 100
              ? "A receita do ano passou do limite do MEI. Fale com seu contador sobre o desenquadramento."
              : "A receita do ano está perto do limite do MEI. Vale conversar com seu contador."}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Quem abriu o MEI durante o ano tem limite proporcional (R$ 6.750 por mês de atividade).
          Confira o limite vigente com seu contador.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : isError ? (
          <div className="px-4 py-10 text-center">
            <p className="mb-2 text-sm text-destructive">Não foi possível calcular o relatório.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Mês</th>
                  <th className="px-4 py-3 text-right">Comércio</th>
                  <th className="px-4 py-3 text-right">Serviços</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data ?? []).map((m) => (
                  <tr key={m.mes} className={m.total ? "" : "text-muted-foreground"}>
                    <td className="px-4 py-2.5">{MESES[m.mes - 1]}</td>
                    <td className="px-4 py-2.5 text-right">{brl(m.comercio)}</td>
                    <td className="px-4 py-2.5 text-right">{brl(m.servicos)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{brl(m.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border font-bold">
                <tr>
                  <td className="px-4 py-3">Total {ano}</td>
                  <td className="px-4 py-3 text-right">{brl(totais.comercio)}</td>
                  <td className="px-4 py-3 text-right">{brl(totais.servicos)}</td>
                  <td className="px-4 py-3 text-right text-primary">{brl(totais.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Receipt className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Pela data da venda e do faturamento da OS, sem os cancelados. Comércio = produtos, peças
        usadas na OS e aparelhos vendidos; serviços = mão de obra. Quando há desconto, ele é
        dividido na proporção dos itens. Use como base para a declaração e confira com seu contador.
      </p>
    </div>
  );
}

function Resumo({
  titulo,
  valor,
  destaque,
}: {
  titulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`mt-1 text-xl font-bold ${destaque ? "text-primary" : ""}`}>{valor}</p>
    </div>
  );
}
