// Prévias visuais dos conteúdos de marketing, montadas a partir do próprio
// arquivo (texto + "Ideia de arte ou roteiro"). São ilustrações para ajudar a
// imaginar a peça — não são a arte final, e isso aparece escrito embaixo.
import { useEffect, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Send,
  Share2,
  CheckCheck,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extrairCenas,
  extrairListaApos,
  extrairSlides,
  SECAO_ARTE,
  SECAO_CTA,
  SECAO_TEXTO,
  textosEntreAspas,
  tipoPrevia,
  type ConteudoMarketing,
} from "@/lib/marketing/conteudo";

// Marca fixa do SPACE TECH OS (o LogoMark do app mostra o logo da empresa
// logada, que não é o que vai nos posts).
function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-violet-400",
        className,
      )}
    >
      <Rocket className="h-3/5 w-3/5 text-white" strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

const FUNDO =
  "bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.55),transparent_60%),linear-gradient(160deg,#18181b_0%,#09090b_60%,#1e1036_100%)]";

function limpar(texto: string) {
  return texto.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}

function Legenda({ texto, linhas = 3 }: { texto: string; linhas?: number }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="px-3 pb-3 text-[13px] leading-snug text-zinc-200">
      <p
        className={cn("whitespace-pre-line", !aberta && "line-clamp-3")}
        style={aberta ? undefined : { WebkitLineClamp: linhas }}
      >
        <span className="font-semibold text-white">spacetech.os </span>
        {limpar(texto)}
      </p>
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className="mt-1 text-xs text-zinc-400 hover:text-zinc-200"
      >
        {aberta ? "ver menos" : "… mais"}
      </button>
    </div>
  );
}

function Avatar() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-500 p-[2px]">
      <span className="flex h-full w-full items-center justify-center rounded-full bg-zinc-950">
        <LogoMark className="h-5 w-5" />
      </span>
    </span>
  );
}

function Selo() {
  return (
    <p className="mt-2 text-center text-[11px] text-muted-foreground">
      Prévia ilustrativa montada a partir do texto — não é a arte final.
    </p>
  );
}

function Slide({
  titulo,
  descricao,
  n,
  total,
  destaque,
}: {
  titulo: string;
  descricao?: string;
  n?: number;
  total?: number;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn("relative flex h-full w-full flex-col justify-between p-5 text-white", FUNDO)}
    >
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-violet-200/80">
        <span>SPACE TECH OS</span>
        {n !== undefined && total !== undefined && (
          <span className="rounded-full bg-black/40 px-2 py-0.5 normal-case tracking-normal text-white">
            {n}/{total}
          </span>
        )}
      </div>
      <p
        className={cn(
          "text-balance font-extrabold leading-tight",
          destaque ? "text-3xl" : "text-2xl",
        )}
      >
        {titulo}
      </p>
      {descricao ? (
        <p className="line-clamp-4 rounded-lg bg-black/35 p-2 text-[11px] leading-snug text-zinc-300">
          <span className="font-semibold text-violet-200">Na arte: </span>
          {descricao}
        </p>
      ) : (
        <span />
      )}
    </div>
  );
}

function PreviaCarrossel({ c }: { c: ConteudoMarketing }) {
  const slides = extrairSlides(c.secoes[SECAO_ARTE] ?? "");
  const lista = slides.length ? slides : [{ titulo: c.titulo, descricao: "" }];
  const [i, setI] = useState(0);
  const atual = lista[Math.min(i, lista.length - 1)]!;
  return (
    <div>
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Avatar />
          <span className="text-sm font-semibold text-white">spacetech.os</span>
          <span className="ml-auto text-xs text-zinc-500">Carrossel</span>
        </div>
        <div className="relative aspect-[4/5]">
          <Slide
            titulo={atual.titulo}
            descricao={atual.descricao}
            n={i + 1}
            total={lista.length}
            destaque={i === 0}
          />
          {i > 0 && (
            <button
              type="button"
              aria-label="Imagem anterior"
              onClick={() => setI(i - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1 text-zinc-900 shadow"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {i < lista.length - 1 && (
            <button
              type="button"
              aria-label="Próxima imagem"
              onClick={() => setI(i + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1 text-zinc-900 shadow"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 px-3 pt-2.5 text-white">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
          <div className="mx-auto flex gap-1">
            {lista.map((_, j) => (
              <button
                key={j}
                type="button"
                aria-label={`Imagem ${j + 1}`}
                onClick={() => setI(j)}
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  j === i ? "bg-violet-400" : "bg-zinc-600",
                )}
              />
            ))}
          </div>
          <Bookmark className="h-5 w-5" />
        </div>
        <div className="pt-2">
          <Legenda texto={c.secoes[SECAO_TEXTO] ?? ""} />
        </div>
      </div>
      <Selo />
    </div>
  );
}

function PreviaVideo({ c }: { c: ConteudoMarketing }) {
  const arte = c.secoes[SECAO_ARTE] ?? "";
  const cenas = extrairCenas(arte);
  const falada = arte.match(/^>\s?(.+)$/m)?.[1];
  const lista = cenas.length
    ? cenas
    : [
        {
          tempo: "vídeo",
          textoNaTela: falada ? limpar(falada).replace(/^["“]|["”]$/g, "") : c.titulo,
          descricao: "",
        },
      ];
  const [i, setI] = useState(0);
  const [tocando, setTocando] = useState(false);
  useEffect(() => {
    if (!tocando) return;
    const t = setInterval(() => setI((v) => (v + 1) % lista.length), 2600);
    return () => clearInterval(t);
  }, [tocando, lista.length]);
  const atual = lista[Math.min(i, lista.length - 1)]!;
  const tiktok = /tiktok/i.test(c.plataforma) && !/instagram/i.test(c.plataforma);
  return (
    <div>
      <div className="mx-auto w-full max-w-[290px] overflow-hidden rounded-[2rem] border-4 border-zinc-800 bg-black shadow-xl">
        <div className={cn("relative aspect-[9/16] text-white", FUNDO)}>
          <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold">
            {tiktok ? "TikTok" : "Reels"} · {atual.tempo}
          </div>
          <div className="absolute inset-x-4 top-1/3 -translate-y-1/2">
            <p className="text-balance rounded-lg bg-black/50 px-3 py-2 text-center text-lg font-extrabold leading-tight shadow">
              {atual.textoNaTela}
            </p>
          </div>
          {atual.descricao && (
            <p className="absolute inset-x-3 top-[52%] line-clamp-4 rounded-lg bg-black/40 p-2 text-[11px] leading-snug text-zinc-300">
              <span className="font-semibold text-violet-200">Cena: </span>
              {atual.descricao}
            </p>
          )}
          <div className="absolute bottom-16 right-2 flex flex-col items-center gap-4 text-white">
            <Heart className="h-6 w-6" />
            <MessageCircle className="h-6 w-6" />
            <Share2 className="h-6 w-6" />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
            <p className="text-xs font-semibold">@spacetech.os</p>
            <p className="line-clamp-2 text-[11px] text-zinc-300">
              {limpar(c.secoes[SECAO_TEXTO] ?? "")}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-zinc-400">
              <Music2 className="h-3 w-3" /> áudio original
            </p>
          </div>
          <div className="absolute inset-x-0 top-0 flex gap-0.5 p-1">
            {lista.map((_, j) => (
              <span
                key={j}
                className={cn("h-0.5 flex-1 rounded", j <= i ? "bg-white" : "bg-white/30")}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => setTocando((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
        >
          {tocando ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{" "}
          {tocando ? "Pausar" : "Ver cenas"}
        </button>
        {lista.map((cena, j) => (
          <button
            key={j}
            type="button"
            onClick={() => {
              setTocando(false);
              setI(j);
            }}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px]",
              j === i
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {cena.tempo}
          </button>
        ))}
      </div>
      <Selo />
    </div>
  );
}

function PreviaImagem({ c }: { c: ConteudoMarketing }) {
  const arte = c.secoes[SECAO_ARTE] ?? "";
  const aspas = textosEntreAspas(arte);
  return (
    <div>
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Avatar />
          <span className="text-sm font-semibold text-white">spacetech.os</span>
        </div>
        <div className="aspect-[4/5]">
          <div
            className={cn(
              "flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white",
              FUNDO,
            )}
          >
            <p className="text-4xl font-black tracking-tight">{aspas[0] ?? c.titulo}</p>
            {aspas.slice(1).map((t) => (
              <p key={t} className="text-sm text-zinc-300">
                {t}
              </p>
            ))}
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold tracking-widest text-violet-200">
              <LogoMark className="h-5 w-5" /> SPACE TECH OS
            </div>
          </div>
        </div>
        <div className="flex gap-4 px-3 pt-2.5 text-white">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
          <Bookmark className="ml-auto h-5 w-5" />
        </div>
        <div className="pt-2">
          <Legenda texto={c.secoes[SECAO_TEXTO] ?? ""} />
        </div>
      </div>
      <Selo />
    </div>
  );
}

function PreviaWhatsapp({ c }: { c: ConteudoMarketing }) {
  return (
    <div>
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-2 bg-[#202c33] px-3 py-2.5 text-white">
          <Avatar />
          <div>
            <p className="text-sm font-semibold">SPACE TECH</p>
            <p className="text-[11px] text-zinc-400">conversa individual</p>
          </div>
        </div>
        <div className="max-h-[520px] overflow-y-auto bg-[#0b141a] p-3">
          <div className="ml-auto max-w-[88%] rounded-lg rounded-tr-none bg-[#005c4b] px-3 py-2 text-[13px] leading-snug text-zinc-100 shadow">
            <p className="whitespace-pre-line break-words">{limpar(c.secoes[SECAO_TEXTO] ?? "")}</p>
            <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-zinc-300">
              10:00 <CheckCheck className="h-3 w-3 text-sky-300" />
            </p>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Prévia ilustrativa. Os campos entre [colchetes] são trocados pelos dados de cada pessoa.
      </p>
    </div>
  );
}

function PreviaAnuncioPesquisa({ c }: { c: ConteudoMarketing }) {
  const texto = c.secoes[SECAO_TEXTO] ?? "";
  const titulos = extrairListaApos(texto, /^\*\*T[íi]tulos/);
  const descricoes = extrairListaApos(texto, /^\*\*Descri[çc][õo]es/);
  const url = c.links[0]?.url ?? "https://srmpretech.online";
  return (
    <div>
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-white p-4 text-left shadow-xl">
        <p className="text-[11px] font-bold text-zinc-900">Patrocinado</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100">
            <LogoMark className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-zinc-900">SPACE TECH OS</p>
            <p className="text-[11px] text-zinc-600">{new URL(url).hostname}</p>
          </div>
        </div>
        <p className="mt-2 text-lg leading-snug text-[#1a0dab]">
          {titulos.slice(0, 3).join(" | ") || c.titulo}
        </p>
        <p className="mt-1 text-sm text-zinc-700">{descricoes.slice(0, 2).join(" ")}</p>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Prévia de uma das combinações possíveis — o Google monta o anúncio misturando os títulos e
        as descrições.
      </p>
    </div>
  );
}

function PreviaPerfilGoogle({ c }: { c: ConteudoMarketing }) {
  const cta = limpar(c.secoes[SECAO_CTA] ?? "").match(/["“]([^"”]+)["”]/)?.[1] ?? "Saiba mais";
  const aspas = textosEntreAspas(c.secoes[SECAO_ARTE] ?? "");
  return (
    <div>
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100">
            <LogoMark className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-900">SPACE TECH OS</p>
            <p className="text-[11px] text-zinc-500">Perfil da Empresa no Google</p>
          </div>
        </div>
        <div
          className={cn(
            "flex aspect-[4/3] flex-col items-center justify-center gap-2 p-6 text-center text-white",
            FUNDO,
          )}
        >
          <p className="text-2xl font-extrabold">
            {aspas[0] ?? "Sistema para assistência técnica"}
          </p>
          {aspas[1] && <p className="text-sm text-zinc-300">{aspas[1]}</p>}
        </div>
        <p className="px-4 pt-3 text-[13px] leading-snug text-zinc-700">
          {limpar(c.secoes[SECAO_TEXTO] ?? "")}
        </p>
        <div className="p-4">
          <span className="inline-block rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-[#1a73e8]">
            {cta}
          </span>
        </div>
      </div>
      <Selo />
    </div>
  );
}

export function PreviaConteudo({ c }: { c: ConteudoMarketing }) {
  switch (tipoPrevia(c)) {
    case "carrossel":
      return <PreviaCarrossel c={c} />;
    case "video":
      return <PreviaVideo c={c} />;
    case "whatsapp":
      return <PreviaWhatsapp c={c} />;
    case "anuncio-pesquisa":
      return <PreviaAnuncioPesquisa c={c} />;
    case "perfil-google":
      return <PreviaPerfilGoogle c={c} />;
    default:
      return <PreviaImagem c={c} />;
  }
}

// Miniatura para a lista de conteúdos.
export function MiniaturaConteudo({ c }: { c: ConteudoMarketing }) {
  const tipo = tipoPrevia(c);
  const slides = extrairSlides(c.secoes[SECAO_ARTE] ?? "");
  const aspas = textosEntreAspas(c.secoes[SECAO_ARTE] ?? "");
  const cenas = extrairCenas(c.secoes[SECAO_ARTE] ?? "");
  const titulo =
    tipo === "carrossel"
      ? (slides[0]?.titulo ?? c.titulo)
      : tipo === "video"
        ? cenas[0] && cenas[0].textoNaTela.length >= 12
          ? cenas[0].textoNaTela
          : c.titulo
        : tipo === "whatsapp" || tipo === "anuncio-pesquisa"
          ? c.titulo
          : (aspas[0] ?? c.titulo);
  return (
    <div className={cn("flex h-full w-full flex-col justify-between p-3 text-white", FUNDO)}>
      <span className="text-[9px] font-semibold uppercase tracking-widest text-violet-200/80">
        {tipo === "video"
          ? "vídeo"
          : tipo === "anuncio-pesquisa"
            ? "anúncio"
            : tipo === "perfil-google"
              ? "google"
              : tipo}
      </span>
      <p className="line-clamp-4 text-sm font-extrabold leading-tight">{titulo}</p>
      <span />
    </div>
  );
}
