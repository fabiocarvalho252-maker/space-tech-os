import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type ItemRanking = { nome: string; quantidade: number };

const config: ChartConfig = {
  quantidade: { label: "Quantidade", color: "#818CF8" },
};

// No celular o gráfico de barras deitadas ficava espremido (160 px só de
// rótulo); lá vira uma lista com a quantidade e uma barra fina de fundo.
export function RankingLista({ itens, cor }: { itens: ItemRanking[]; cor: string }) {
  const max = Math.max(...itens.map((i) => i.quantidade), 1);
  return (
    <ol className="space-y-1">
      {itens.slice(0, 10).map((i, idx) => (
        <li key={i.nome} className="relative overflow-hidden rounded-md px-2.5 py-1.5 text-[13px]">
          <span
            className="absolute inset-y-0 left-0 opacity-15"
            style={{ width: `${(i.quantidade / max) * 100}%`, background: cor }}
          />
          <span className="relative flex items-center gap-2">
            <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">{idx + 1}.</span>
            <span className="min-w-0 flex-1 truncate">{i.nome}</span>
            <span className="shrink-0 font-bold">{i.quantidade}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function TopProductsChart({ itens }: { itens: ItemRanking[] }) {
  const isMobile = useIsMobile();
  if (!itens.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum produto vendido no período.
      </p>
    );
  }

  if (isMobile) return <RankingLista itens={itens} cor="#818CF8" />;

  const dados = itens.slice(0, 10).map((i, idx) => ({ ...i, rotulo: `${idx + 1}. ${i.nome}` }));

  return (
    <ChartContainer config={config} className="w-full" style={{ height: dados.length * 34 + 24 }}>
      <BarChart data={dados} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis type="number" hide />
        <YAxis
          dataKey="rotulo"
          type="category"
          tickLine={false}
          axisLine={false}
          width={160}
          fontSize={11}
          interval={0}
        />
        <ChartTooltip
          cursor={{ fill: "var(--secondary)" }}
          content={<ChartTooltipContent hideLabel />}
        />
        <Bar dataKey="quantidade" fill="#818CF8" radius={[0, 6, 6, 0]} barSize={16} />
      </BarChart>
    </ChartContainer>
  );
}
