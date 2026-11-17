// Gráfico de crescimento de seguidores. Uma série só: uma cor de destaque, sem
// legenda, grade discreta, tooltip no cursor, eixo único. Dias sem coleta repetem
// o último valor (ver serieSeguidores) e o início do histórico é informado.
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  dataCurtaPt,
  resumoParaLeitor,
  type PontoSeguidores,
} from "@/lib/marketing/ig-metricas.calc";

const configuracao = {
  seguidores: { label: "Seguidores", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function GraficoSeguidores({
  serie,
  periodo,
}: {
  serie: PontoSeguidores[];
  periodo: number;
}) {
  const inicio = serie[0]?.data;
  const cobertura = serie.length;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">Crescimento de seguidores</h3>
        <span className="text-xs text-muted-foreground">
          {inicio && cobertura < periodo
            ? `histórico desde ${dataCurtaPt(inicio)}`
            : `últimos ${periodo} dias`}
        </span>
      </div>

      {serie.length > 0 && <p className="sr-only">{resumoParaLeitor(serie)}</p>}

      {serie.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Ainda não há dados de seguidores para este período.
        </p>
      ) : (
        <ChartContainer config={configuracao} className="h-64 w-full">
          <AreaChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradienteSeguidores" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="data"
              tickFormatter={dataCurtaPt}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={["dataMin - 2", "dataMax + 2"]}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) => new Intl.NumberFormat("pt-BR").format(v)}
            />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={<ChartTooltipContent labelFormatter={(v) => dataCurtaPt(String(v))} />}
            />
            <Area
              dataKey="seguidores"
              type="monotone"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              fill="url(#gradienteSeguidores)"
              dot={false}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  );
}
