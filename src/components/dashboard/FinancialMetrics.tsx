import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { variacaoPercentual } from "@/lib/dashboard/resultado";
import { cn } from "@/lib/utils";

export type MetricasResultado = {
  lucroLiquido: number;
  margem: number;
  receita: number;
  cmv: number;
  custoServicos: number;
  despesas: number;
};

/**
 * Seta + % em relação ao período anterior. `menorEhMelhor` inverte a cor
 * (despesa/custo subindo é ruim). `pontos` mostra diferença em pontos
 * percentuais (para a margem, que já é %).
 */
function Variacao({
  atual,
  anterior,
  menorEhMelhor = false,
  pontos = false,
}: {
  atual: number;
  anterior: number | undefined;
  menorEhMelhor?: boolean;
  pontos?: boolean;
}) {
  if (anterior === undefined) return null;
  const v = pontos ? atual - anterior : variacaoPercentual(atual, anterior);
  if (v === null || Math.abs(v) < 0.05) {
    return <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">= anterior</p>;
  }
  const subiu = v > 0;
  const bom = menorEhMelhor ? !subiu : subiu;
  const Icone = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={cn(
        "mt-0.5 flex items-center gap-0.5 text-[10px] font-medium sm:text-[11px]",
        bom ? "text-emerald-600" : "text-destructive",
      )}
      title="Comparado ao período anterior equivalente"
    >
      <Icone className="h-3 w-3" aria-hidden="true" />
      {subiu ? "+" : ""}
      {v.toFixed(1)}
      {pontos ? " p.p." : "%"}
      <span className="font-normal text-muted-foreground"> vs anterior</span>
    </p>
  );
}

export function FinancialMetrics({
  atual,
  anterior,
}: {
  atual: MetricasResultado;
  anterior: MetricasResultado | null;
}) {
  const { formatFinancialValue: brl, isFinancialValuesVisible } = useFinancialVisibility();
  // Valores escondidos (olho fechado): a variação também some.
  if (!isFinancialValuesVisible) anterior = null;
  const { lucroLiquido, margem, receita, cmv, custoServicos, despesas } = atual;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2 sm:rounded-xl sm:p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">Lucro Líquido</p>
        <p
          className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg"
          style={{ color: lucroLiquido >= 0 ? "#22C55E" : "var(--destructive)" }}
        >
          {brl(lucroLiquido)}
        </p>
        <Variacao atual={lucroLiquido} anterior={anterior?.lucroLiquido} />
      </div>
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2 sm:rounded-xl sm:p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">Margem</p>
        <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg">{margem.toFixed(1)}%</p>
        <Variacao atual={margem} anterior={anterior?.margem} pontos />
      </div>
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2 sm:rounded-xl sm:p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">Receita</p>
        <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg">{brl(receita)}</p>
        <Variacao atual={receita} anterior={anterior?.receita} />
      </div>
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2 sm:rounded-xl sm:p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">CMV (peças/produtos)</p>
        <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg">{brl(cmv)}</p>
        <Variacao atual={cmv} anterior={anterior?.cmv} menorEhMelhor />
      </div>
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2 sm:rounded-xl sm:p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">Custo dos serviços</p>
        <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg">{brl(custoServicos)}</p>
        <Variacao atual={custoServicos} anterior={anterior?.custoServicos} menorEhMelhor />
      </div>
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2 sm:rounded-xl sm:p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">Despesas</p>
        <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg">{brl(despesas)}</p>
        <Variacao atual={despesas} anterior={anterior?.despesas} menorEhMelhor />
      </div>
    </div>
  );
}
