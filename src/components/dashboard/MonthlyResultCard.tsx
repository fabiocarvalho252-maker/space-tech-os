import { Layers } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FinancialMetrics } from "./FinancialMetrics";
import { FinancialChart, type PontoResultado } from "./FinancialChart";

export type Periodo = "hoje" | "semana" | "mes" | "mes_anterior" | "personalizado";

const OPCOES_PERIODO: { value: Periodo; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mês" },
  { value: "mes_anterior", label: "Mês anterior" },
  { value: "personalizado", label: "Personalizado" },
];

export function MonthlyResultCard({
  periodo,
  onPeriodoChange,
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
  metrics,
  pontos,
  carregando,
}: {
  periodo: Periodo;
  onPeriodoChange: (p: Periodo) => void;
  dataInicio: string;
  dataFim: string;
  onDataInicioChange: (v: string) => void;
  onDataFimChange: (v: string) => void;
  metrics: { lucroLiquido: number; margem: number; receita: number; cmv: number; despesas: number };
  pontos: PontoResultado[];
  carregando: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <Layers className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold leading-tight">Resultado do mês</h2>
            <p className="text-xs text-muted-foreground">DRE</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periodo === "personalizado" && (
            <>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => onDataInicioChange(e.target.value)}
                className="h-9 w-36 text-xs"
                aria-label="Data inicial"
              />
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => onDataFimChange(e.target.value)}
                className="h-9 w-36 text-xs"
                aria-label="Data final"
              />
            </>
          )}
          <Select value={periodo} onValueChange={(v) => onPeriodoChange(v as Periodo)}>
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_PERIODO.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {carregando ? (
        <div className="h-56 animate-pulse rounded-xl bg-secondary/40" />
      ) : (
        <>
          <FinancialMetrics {...metrics} />
          <div className="mt-4">
            <FinancialChart pontos={pontos} />
          </div>
        </>
      )}
    </section>
  );
}
