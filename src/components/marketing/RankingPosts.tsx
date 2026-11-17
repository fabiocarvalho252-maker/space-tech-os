// Lista de posts/Reels do período, pensada para leitura rápida: miniatura, data,
// tipo em palavras simples e as quatro métricas com nome e ícone. O critério
// escolhido ordena a lista e fica destacado. Miniatura do CDN pode expirar: sem
// imagem, mostra um quadro neutro. Link externo só se for https (linkSeguro).
import { useMemo, useState } from "react";
import { Bookmark, Eye, Heart, ImageOff, MessageCircle, Share2 } from "lucide-react";
import {
  formatarValor,
  linkSeguro,
  rankingPosts,
  type CriterioRanking,
  type PostMetricas,
} from "@/lib/marketing/ig-metricas.calc";
import { cn } from "@/lib/utils";

const LIMITE_RANKING = 10;
const MEDALHAS = [
  "bg-amber-400 text-amber-950",
  "bg-slate-300 text-slate-900",
  "bg-orange-400 text-orange-950",
];

const TIPOS: Record<string, string> = {
  REELS: "Reel",
  VIDEO: "Vídeo",
  CARROSSEL: "Carrossel",
  IMAGE: "Foto",
};

const CRITERIOS: { valor: CriterioRanking; rotulo: string }[] = [
  { valor: "alcance", rotulo: "Alcance" },
  { valor: "salvamentos", rotulo: "Salvos" },
  { valor: "compartilhamentos", rotulo: "Compartilhamentos" },
  { valor: "visualizacoes", rotulo: "Visualizações" },
];

function dataBrasil(iso: string): string {
  return iso ? iso.split("-").reverse().join("/") : "sem data";
}

export function RankingPosts({
  posts,
  permissoesOk,
}: {
  posts: PostMetricas[];
  permissoesOk: boolean;
}) {
  const [criterio, setCriterio] = useState<CriterioRanking>("alcance");
  const ranking = useMemo(() => rankingPosts(posts, criterio, LIMITE_RANKING), [posts, criterio]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Melhores posts</h3>
          <span className="text-xs text-muted-foreground">
            ordenados por {rotuloCriterio(criterio)}
          </span>
        </div>
        <div role="group" aria-label="Ordenar por" className="flex flex-wrap gap-1.5">
          {CRITERIOS.map((c) => (
            <button
              key={c.valor}
              type="button"
              aria-pressed={criterio === c.valor}
              onClick={() => setCriterio(c.valor)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                criterio === c.valor
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {c.rotulo}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Alcance é quantas pessoas viram o post. Salvos e compartilhamentos mostram o que realmente
          interessou.
        </p>
      </div>

      {ranking.length === 0 ? (
        <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          Nenhum post publicado neste período.
        </p>
      ) : (
        <ol className="space-y-3">
          {ranking.map((p, i) => (
            <CartaoPost
              key={p.id}
              post={p}
              posicao={i + 1}
              criterio={criterio}
              permissoesOk={permissoesOk}
            />
          ))}
        </ol>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Seguidores ganhos por post não aparecem: a API não entrega para todos os tipos de mídia, e
        não estimamos.
      </p>
    </div>
  );
}

function rotuloCriterio(criterio: CriterioRanking): string {
  return CRITERIOS.find((c) => c.valor === criterio)?.rotulo.toLowerCase() ?? criterio;
}

function CartaoPost({
  post,
  posicao,
  criterio,
  permissoesOk,
}: {
  post: PostMetricas;
  posicao: number;
  criterio: CriterioRanking;
  permissoesOk: boolean;
}) {
  const [semImagem, setSemImagem] = useState(false);
  const href = linkSeguro(post.permalink);
  const tipo = TIPOS[post.tipo] ?? post.tipo;
  const titulo = post.legenda || "Post sem legenda";
  const conteudo = (
    <>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
            MEDALHAS[posicao - 1] ?? "bg-muted text-muted-foreground",
          )}
          aria-label={`${posicao}º lugar`}
        >
          {posicao}
        </span>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
          {post.miniatura && !semImagem ? (
            <img
              src={post.miniatura}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setSemImagem(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageOff className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{titulo}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tipo} · {dataBrasil(post.data)}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metrica
          icone={Eye}
          rotulo="Alcance"
          valor={post.alcance}
          destaque={criterio === "alcance"}
          permissoesOk={permissoesOk}
        />
        <Metrica
          icone={Bookmark}
          rotulo="Salvos"
          valor={post.salvamentos}
          destaque={criterio === "salvamentos"}
          permissoesOk={permissoesOk}
        />
        <Metrica
          icone={Share2}
          rotulo="Compartilhar"
          valor={post.compartilhamentos}
          destaque={criterio === "compartilhamentos"}
          permissoesOk={permissoesOk}
        />
        <Metrica
          icone={Heart}
          rotulo="Curtidas"
          valor={post.curtidas}
          destaque={false}
          permissoesOk
        />
      </dl>
      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" aria-hidden /> {formatarValor(post.comentarios)}{" "}
        comentários
      </p>
    </>
  );

  const classes =
    "block rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10";
  return (
    <li>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${posicao}º lugar: ${titulo}, ${tipo}, ${dataBrasil(post.data)}. Abre no Instagram em nova aba.`}
          className={classes}
        >
          {conteudo}
        </a>
      ) : (
        <div className={classes}>{conteudo}</div>
      )}
    </li>
  );
}

function Metrica({
  icone: Icone,
  rotulo,
  valor,
  destaque,
  permissoesOk,
}: {
  icone: typeof Eye;
  rotulo: string;
  valor: number | null;
  destaque: boolean;
  permissoesOk: boolean;
}) {
  const semDado = valor === null;
  return (
    <div
      className={cn(
        "rounded-lg px-2.5 py-2",
        destaque ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted/50",
      )}
      title={
        semDado
          ? permissoesOk
            ? "Dado não disponível para este post"
            : "Falta a permissão de insights"
          : undefined
      }
    >
      <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Icone className="h-3 w-3" aria-hidden /> {rotulo}
      </dt>
      <dd className={cn("text-sm font-semibold tabular-nums", destaque && "text-primary")}>
        {semDado ? "n/d" : formatarValor(valor)}
      </dd>
    </div>
  );
}
