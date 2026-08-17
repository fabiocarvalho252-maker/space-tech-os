import { useEffect, useRef, useState } from "react";
import { Minus, Sparkles, X } from "lucide-react";
import { AIChat } from "./AIChat";

const CHAVE_POSICAO = "space-tech-ia-posicao";
const MARGEM = 8;
// Abaixo disso, um pointerdown->up é tratado como clique (abre/fecha o
// chat) em vez de arraste — sem essa folga, todo clique com 1-2px de
// tremor do mouse/dedo seria engolido pelo modo de arrastar.
const LIMIAR_ARRASTO = 6;

type Offset = { right: number; bottom: number };

function limitarOffset(offset: Offset, largura: number, altura: number): Offset {
  const maxRight = Math.max(MARGEM, window.innerWidth - largura - MARGEM);
  const maxBottom = Math.max(MARGEM, window.innerHeight - altura - MARGEM);
  return {
    right: Math.min(Math.max(offset.right, MARGEM), maxRight),
    bottom: Math.min(Math.max(offset.bottom, MARGEM), maxBottom),
  };
}

function lerPosicaoSalva(): Offset | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE_POSICAO);
    if (!bruto) return null;
    const { right, bottom } = JSON.parse(bruto);
    if (typeof right !== "number" || typeof bottom !== "number") return null;
    return { right, bottom };
  } catch {
    return null;
  }
}

export function SpaceTechAI() {
  const [aberto, setAberto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [offset, setOffset] = useState<Offset | null>(lerPosicaoSalva);
  const [arrastando, setArrastando] = useState(false);
  // No celular o painel aberto ocupa a tela toda (inset-0) — só reaplicamos
  // a posição arrastada a partir do breakpoint onde ele volta a ser uma
  // janela flutuante, senão o right/bottom customizado brigaria com o
  // inset-0 e deixaria o painel deslocado.
  const [telaDesktop, setTelaDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches,
  );
  const botaoRef = useRef<HTMLButtonElement>(null);
  // Espelha `offset` de forma síncrona para o pointerup poder persistir o
  // valor exato do último pointermove, sem depender do closure do handler
  // ter sido re-criado a tempo pelo re-render do estado.
  const offsetRef = useRef<Offset | null>(offset);
  const arrasteRef = useRef<{
    startX: number;
    startY: number;
    offsetInicial: Offset;
    moveu: boolean;
  } | null>(null);

  // Se a janela encolher (ex: virar o celular) depois de posicionar o
  // widget num canto, garante que ele continue visível em vez de ficar
  // fora da tela.
  useEffect(() => {
    if (!offset) return;
    function reajustar() {
      const el = botaoRef.current;
      const largura = el?.offsetWidth ?? 56;
      const altura = el?.offsetHeight ?? 56;
      setOffset((atual) => {
        if (!atual) return atual;
        const ajustado = limitarOffset(atual, largura, altura);
        offsetRef.current = ajustado;
        return ajustado;
      });
    }
    window.addEventListener("resize", reajustar);
    return () => window.removeEventListener("resize", reajustar);
  }, [offset]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const ouvir = () => setTelaDesktop(mq.matches);
    mq.addEventListener("change", ouvir);
    return () => mq.removeEventListener("change", ouvir);
  }, []);

  function iniciarArraste(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const el = botaoRef.current;
    if (!el) return;
    const atual: Offset = offset ?? {
      right: window.innerWidth - el.getBoundingClientRect().right,
      bottom: window.innerHeight - el.getBoundingClientRect().bottom,
    };
    arrasteRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetInicial: atual,
      moveu: false,
    };
    el.setPointerCapture(e.pointerId);
  }

  function moverArraste(e: React.PointerEvent<HTMLButtonElement>) {
    const arraste = arrasteRef.current;
    const el = botaoRef.current;
    if (!arraste || !el) return;
    const deltaX = e.clientX - arraste.startX;
    const deltaY = e.clientY - arraste.startY;
    if (!arraste.moveu && Math.hypot(deltaX, deltaY) < LIMIAR_ARRASTO) return;
    arraste.moveu = true;
    setArrastando(true);
    const novo = limitarOffset(
      {
        right: arraste.offsetInicial.right - deltaX,
        bottom: arraste.offsetInicial.bottom - deltaY,
      },
      el.offsetWidth,
      el.offsetHeight,
    );
    offsetRef.current = novo;
    setOffset(novo);
  }

  function finalizarArraste(e: React.PointerEvent<HTMLButtonElement>) {
    const arraste = arrasteRef.current;
    botaoRef.current?.releasePointerCapture(e.pointerId);
    arrasteRef.current = null;
    if (arraste?.moveu) {
      setArrastando(false);
      if (offsetRef.current) {
        window.localStorage.setItem(CHAVE_POSICAO, JSON.stringify(offsetRef.current));
      }
      return;
    }
    setArrastando(false);
    // Sem arrasto de verdade: trata como clique normal.
    setAberto((v) => !v);
    if (!aberto) setMinimizado(false);
  }

  const estiloPosicaoBotao = offset ? { right: offset.right, bottom: offset.bottom } : undefined;
  const estiloPosicaoPainel =
    offset && telaDesktop ? { right: offset.right, bottom: offset.bottom } : undefined;

  if (!aberto) {
    return (
      <button
        ref={botaoRef}
        type="button"
        onPointerDown={iniciarArraste}
        onPointerMove={moverArraste}
        onPointerUp={finalizarArraste}
        onPointerCancel={finalizarArraste}
        style={estiloPosicaoBotao}
        className={`fixed z-50 flex touch-none select-none items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition hover:scale-105 active:scale-95 ${
          offset ? "" : "bottom-5 right-5"
        } ${arrastando ? "cursor-grabbing scale-105 transition-none" : "cursor-grab"}`}
        aria-label="Abrir SPACE TECH IA — arraste para mover"
      >
        <Sparkles className="h-5 w-5" />
        <span className="hidden sm:inline">SPACE TECH IA</span>
      </button>
    );
  }

  return (
    <div
      style={estiloPosicaoPainel}
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden border border-border bg-card/95 shadow-xl backdrop-blur-md transition-all sm:inset-auto sm:w-[400px] sm:rounded-2xl ${
        estiloPosicaoPainel ? "" : "sm:bottom-5 sm:right-5"
      } ${minimizado ? "sm:h-14" : "sm:h-[600px]"}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">SPACE TECH IA</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Assistente inteligente da sua assistência
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimizado((v) => !v)}
            aria-label={minimizado ? "Expandir" : "Minimizar"}
            className="hidden h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary sm:flex"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!minimizado && (
        <div className="min-h-0 flex-1">
          <AIChat />
        </div>
      )}
    </div>
  );
}
