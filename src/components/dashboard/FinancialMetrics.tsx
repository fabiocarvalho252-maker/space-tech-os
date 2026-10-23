import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";

export function FinancialMetrics({
  lucroLiquido,
  margem,
  receita,
  cmv,
  custoServicos,
  despesas,
}: {
  lucroLiquido: number;
  margem: number;
  receita: number;
  cmv: number;
  custoServicos: number;
  despesas: number;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
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
      </div>
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2 sm:rounded-xl sm:p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">Margem</p>
        <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg">{margem.toFixed(1)}%</p>
      </div>
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2 sm:rounded-xl sm:p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">Receita</p>
        <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg">{brl(receita)}</p>
      </div>
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2 sm:rounded-xl sm:p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">CMV (peças/produtos)</p>
        <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg">{brl(cmv)}</p>
      </div>
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2 sm:rounded-xl sm:p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">Custo dos serviços</p>
        <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg">{brl(custoServicos)}</p>
      </div>
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2 sm:rounded-xl sm:p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">Despesas</p>
        <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg">{brl(despesas)}</p>
      </div>
    </div>
  );
}
