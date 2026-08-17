import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";

export function FinancialMetrics({
  lucroLiquido,
  margem,
  receita,
  cmv,
  despesas,
}: {
  lucroLiquido: number;
  margem: number;
  receita: number;
  cmv: number;
  despesas: number;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="rounded-xl bg-secondary/40 p-3">
        <p className="text-xs text-muted-foreground">Lucro Líquido</p>
        <p
          className="mt-1 text-lg font-bold"
          style={{ color: lucroLiquido >= 0 ? "#22C55E" : "var(--destructive)" }}
        >
          {brl(lucroLiquido)}
        </p>
      </div>
      <div className="rounded-xl bg-secondary/40 p-3">
        <p className="text-xs text-muted-foreground">Margem</p>
        <p className="mt-1 text-lg font-bold">{margem.toFixed(1)}%</p>
      </div>
      <div className="rounded-xl bg-secondary/40 p-3">
        <p className="text-xs text-muted-foreground">Receita</p>
        <p className="mt-1 text-lg font-bold">{brl(receita)}</p>
      </div>
      <div className="rounded-xl bg-secondary/40 p-3">
        <p className="text-xs text-muted-foreground">CMV</p>
        <p className="mt-1 text-lg font-bold">{brl(cmv)}</p>
      </div>
      <div className="rounded-xl bg-secondary/40 p-3">
        <p className="text-xs text-muted-foreground">Despesas</p>
        <p className="mt-1 text-lg font-bold">{brl(despesas)}</p>
      </div>
    </div>
  );
}
