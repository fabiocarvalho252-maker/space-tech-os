import { useEffect, useRef, useState } from "react";

const NUMERO_SUPORTE = "5574999294500";
const CHAVE_POSICAO = "suporte-whatsapp-posicao";
const MARGEM = 8;
// Abaixo disso, um pointerdown->up é tratado como clique (abre o WhatsApp)
// em vez de arraste — mesmo limiar usado no botão da IA, pelo mesmo motivo.
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

function IconeWhatsapp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.004 2c-5.523 0-10 4.477-10 10 0 1.765.462 3.489 1.34 5.007L2 22l5.117-1.334A9.958 9.958 0 0 0 12.004 22c5.522 0 10-4.477 10-10s-4.478-10-10-10zm0 18.166a8.14 8.14 0 0 1-4.152-1.137l-.298-.177-3.037.792.81-2.962-.194-.304a8.147 8.147 0 0 1-1.256-4.378c0-4.508 3.669-8.176 8.177-8.176 2.184 0 4.238.85 5.783 2.396a8.12 8.12 0 0 1 2.393 5.784c0 4.508-3.668 8.176-8.176 8.176z" />
    </svg>
  );
}

// Contato de suporte da SPACE TECH — visível em todo o app logado. Arrastável
// como o botão da IA (mesmo padrão), com posição própria salva à parte, para
// o usuário poder colocar em qualquer canto sem os dois brigarem por espaço.
export function SuporteWhatsapp() {
  const [offset, setOffset] = useState<Offset | null>(lerPosicaoSalva);
  const [arrastando, setArrastando] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const offsetRef = useRef<Offset | null>(offset);
  const arrasteRef = useRef<{
    startX: number;
    startY: number;
    offsetInicial: Offset;
    moveu: boolean;
  } | null>(null);

  useEffect(() => {
    if (!offset) return;
    function reajustar() {
      const el = botaoRef.current;
      const largura = el?.offsetWidth ?? 48;
      const altura = el?.offsetHeight ?? 48;
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
    window.open(`https://wa.me/${NUMERO_SUPORTE}`, "_blank", "noopener,noreferrer");
  }

  const estiloPosicao = offset ? { right: offset.right, bottom: offset.bottom } : undefined;

  return (
    <button
      ref={botaoRef}
      type="button"
      onPointerDown={iniciarArraste}
      onPointerMove={moverArraste}
      onPointerUp={finalizarArraste}
      onPointerCancel={finalizarArraste}
      style={estiloPosicao}
      className={`fixed z-50 flex h-12 w-12 touch-none select-none items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-black/20 transition hover:scale-105 active:scale-95 ${
        offset ? "" : "bottom-24 right-5"
      } ${arrastando ? "cursor-grabbing scale-105 transition-none" : "cursor-grab"}`}
      aria-label="Falar com o suporte no WhatsApp — arraste para mover"
    >
      <IconeWhatsapp className="h-7 w-7" />
    </button>
  );
}
