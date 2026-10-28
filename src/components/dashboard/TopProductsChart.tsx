import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";

export type ItemRanking = { nome: string; quantidade: number; faturamento: number; margem: number };

// Ranking com quantidade, faturamento e margem. A barra fina de fundo mostra a
// quantidade relativa ao 1º colocado; no celular as colunas de valor ficam
// empilhadas embaixo do nome para não espremer o texto.
export function RankingLista({ itens, cor }: { itens: ItemRanking[]; cor: string }) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const lista = itens.slice(0, 10);
  const max = Math.max(...lista.map((i) => i.quantidade), 1);
  return (
    <div>
      <div className="hidden px-2.5 pb-1.5 text-[11px] uppercase text-muted-foreground sm:flex sm:items-center sm:gap-2">
        <span className="flex-1">Item</span>
        <span className="w-12 text-right">Qtd.</span>
        <span className="w-24 text-right">Faturamento</span>
        <span className="w-14 text-right">Margem</span>
      </div>
      <ol className="space-y-1">
        {lista.map((i, idx) => (
          <li
            key={i.nome}
            className="relative overflow-hidden rounded-md px-2.5 py-1.5 text-[13px]"
          >
            <span
              className="absolute inset-y-0 left-0 opacity-15"
              style={{ width: `${(i.quantidade / max) * 100}%`, background: cor }}
            />
            <span className="relative flex flex-wrap items-center gap-x-2 sm:flex-nowrap">
              <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">
                {idx + 1}.
              </span>
              <span className="min-w-0 flex-1 truncate">{i.nome}</span>
              <span className="w-12 shrink-0 text-right font-bold">{i.quantidade}</span>
              <span className="flex w-full justify-end gap-3 pl-7 text-xs text-muted-foreground sm:w-auto sm:gap-2 sm:pl-0 sm:text-[13px]">
                <span className="sm:w-24 sm:text-right sm:text-foreground">
                  {brl(i.faturamento)}
                </span>
                <span className={`sm:w-14 sm:text-right ${i.margem < 0 ? "text-destructive" : ""}`}>
                  {i.margem.toFixed(1)}%
                </span>
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TopProductsChart({ itens }: { itens: ItemRanking[] }) {
  if (!itens.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum produto vendido no período.
      </p>
    );
  }
  return <RankingLista itens={itens} cor="#818CF8" />;
}
