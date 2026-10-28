import { RankingLista, type ItemRanking } from "./TopProductsChart";

export function TopServicesChart({ itens }: { itens: ItemRanking[] }) {
  if (!itens.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum serviço vendido no período.
      </p>
    );
  }
  return <RankingLista itens={itens} cor="#60A5FA" />;
}
