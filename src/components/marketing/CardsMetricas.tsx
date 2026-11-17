// Cards de resumo do painel de métricas do Instagram. "n/d" quando a API não
// devolveu o dado: nunca mostra zero inventado.
import { Bookmark, Eye, Heart, Share2, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatarValor, type VariacaoSeguidores } from "@/lib/marketing/ig-metricas.calc";

import { cn } from "@/lib/utils";

const formatoNumero = new Intl.NumberFormat("pt-BR");

type Props = {
  seguidores: number | null;
  variacao: VariacaoSeguidores;
  periodo: number;
  alcance: number | null;
  engajamento: number | null;
  salvamentos: number | null;
  compartilhamentos: number | null;
};

export function CardsMetricas(props: Props) {
  const { seguidores, variacao, periodo } = props;
  return (
    <section aria-label="Resumo" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <CardMetrica
        icone={Users}
        titulo="Seguidores"
        valor={formatarValor(seguidores)}
        rodape={<Variacao variacao={variacao} periodo={periodo} />}
        destaque
      />
      <CardMetrica
        icone={Eye}
        titulo="Alcance"
        valor={formatarValor(props.alcance)}
        rodape={`no período de ${periodo} dias`}
      />
      <CardMetrica
        icone={Heart}
        titulo="Engajamento médio"
        valor={
          props.engajamento === null ? "n/d" : `${props.engajamento.toString().replace(".", ",")}%`
        }
        rodape="curtidas, comentários, salvos e shares ÷ alcance"
      />
      <CardMetrica
        icone={Bookmark}
        titulo="Salvamentos"
        valor={formatarValor(props.salvamentos)}
        rodape="posts do período"
      />
      <CardMetrica
        icone={Share2}
        titulo="Compartilhamentos"
        valor={formatarValor(props.compartilhamentos)}
        rodape="posts do período"
      />
    </section>
  );
}

function Variacao({ variacao, periodo }: { variacao: VariacaoSeguidores; periodo: number }) {
  if (!variacao.suficiente || variacao.delta === null) {
    return (
      <span className="text-muted-foreground">histórico insuficiente para {periodo} dias</span>
    );
  }
  const subiu = variacao.delta >= 0;
  const Icone = subiu ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        subiu ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      )}
    >
      <Icone className="h-3.5 w-3.5" aria-hidden />
      {subiu ? "+" : ""}
      {formatoNumero.format(variacao.delta)}
      {variacao.percentual !== null && ` (${variacao.percentual.toString().replace(".", ",")}%)`}
      <span className="font-normal text-muted-foreground">em {periodo} dias</span>
    </span>
  );
}

function CardMetrica({
  icone: Icone,
  titulo,
  valor,
  rodape,
  destaque = false,
}: {
  icone: typeof Users;
  titulo: string;
  valor: string;
  rodape: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10",
        destaque && "col-span-2 bg-gradient-to-br from-primary/20 via-card to-card lg:col-span-1",
      )}
    >
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {titulo}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
            <Icone className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="text-3xl font-bold tabular-nums tracking-tight">{valor}</p>
        <div className="mt-2 text-xs text-muted-foreground">{rodape}</div>
      </CardContent>
    </Card>
  );
}
