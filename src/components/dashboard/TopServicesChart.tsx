import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ItemRanking } from "./TopProductsChart";

// Fixed rotation, not one hue per distinct service — with up to 10 ranked
// bars this reads as "a controlled set of accent colors" per the design
// brief rather than a categorical legend, so the rotation index (not the
// service's identity) picks the color.
const CORES = ["#60A5FA", "#2DD4BF", "#FB923C", "#F472B6", "#A78BFA"];

const config: ChartConfig = {
  quantidade: { label: "Quantidade", color: "#60A5FA" },
};

export function TopServicesChart({ itens }: { itens: ItemRanking[] }) {
  if (!itens.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum serviço vendido no período.
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
        <Bar dataKey="quantidade" radius={[0, 6, 6, 0]} barSize={16}>
          {dados.map((_, idx) => (
            <Cell key={idx} fill={CORES[idx % CORES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
