import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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

export function TopProductsChart({ itens }: { itens: ItemRanking[] }) {
  if (!itens.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum produto vendido no período.
      </p>
    );
  }

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
