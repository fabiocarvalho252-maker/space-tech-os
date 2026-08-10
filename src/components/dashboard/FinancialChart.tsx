import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { brl } from "@/lib/format";

export type PontoResultado = { data: string; label: string; valor: number };

const config: ChartConfig = {
  valor: { label: "Resultado", color: "#22C55E" },
};

export function FinancialChart({ pontos }: { pontos: PontoResultado[] }) {
  if (!pontos.length) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Sem movimentação financeira no período.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <AreaChart data={pontos} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="resultadoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={24} />
        <YAxis hide domain={["auto", "auto"]} />
        <ChartTooltip
          cursor={{ stroke: "#22C55E", strokeOpacity: 0.3 }}
          content={
            <ChartTooltipContent
              hideLabel={false}
              formatter={(value) => [brl(Number(value)), "Resultado"] as any}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="valor"
          stroke="#22C55E"
          strokeWidth={2}
          fill="url(#resultadoFill)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
