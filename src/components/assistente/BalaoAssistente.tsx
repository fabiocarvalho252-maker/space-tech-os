import { useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import type { Sugestao } from "@/lib/assistente/sugestoes";
import { useAssistente } from "./useAssistente";
import { CartaoSugestao } from "./PainelSugestoes";

// O balão que "puxa assunto": mostra uma sugestão importante (prioridade 1
// ou 2) acima do botão da IA, no máximo uma vez a cada 20 minutos e nunca a
// mesma duas vezes na mesma sessão do navegador.
const CHAVE_ULTIMO = "space-tech-assistente-balao";
const CHAVE_VISTAS = "space-tech-assistente-vistas";
const INTERVALO_MS = 20 * 60_000;
const ESPERA_INICIAL_MS = 5_000;
const LARGURA = 320;
const MARGEM = 8;
const ALTURA_BOTAO = 56;

function lerVistas(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(CHAVE_VISTAS) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function marcarVista(chave: string) {
  try {
    const vistas = lerVistas();
    vistas.add(chave);
    sessionStorage.setItem(CHAVE_VISTAS, JSON.stringify([...vistas]));
    localStorage.setItem(CHAVE_ULTIMO, String(Date.now()));
  } catch {
    // Sem storage (aba anônima/bloqueado): o balão só pode repetir.
  }
}

function podeMostrarAgora(): boolean {
  try {
    const ultimo = Number(localStorage.getItem(CHAVE_ULTIMO) ?? 0);
    return Date.now() - ultimo >= INTERVALO_MS;
  } catch {
    return true;
  }
}

type Offset = { right: number; bottom: number };

/** Acima do botão; abaixo dele se o botão estiver arrastado lá para cima. */
function estiloPosicao(offset: Offset | null): React.CSSProperties {
  const right = Math.max(
    MARGEM,
    Math.min(offset?.right ?? 20, window.innerWidth - LARGURA - MARGEM),
  );
  const bottomBotao = offset?.bottom ?? 20;
  const espacoAcima = window.innerHeight - bottomBotao - ALTURA_BOTAO;
  if (espacoAcima < 220) {
    return { right, top: window.innerHeight - bottomBotao + MARGEM };
  }
  // Na posição padrão o botão de suporte (SuporteWhatsapp, bottom-24 = 96px,
  // 48px de altura) fica logo acima do da IA: o balão sobe por cima dele.
  if (!offset) return { right, bottom: 96 + 48 + MARGEM };
  return { right, bottom: bottomBotao + ALTURA_BOTAO + MARGEM };
}

export function BalaoAssistente({
  offset,
  onAbrirPainel,
}: {
  offset: Offset | null;
  onAbrirPainel: () => void;
}) {
  const { sugestoes, silenciado } = useAssistente();
  const [atual, setAtual] = useState<Sugestao | null>(null);
  const [liberado, setLiberado] = useState(false);

  // Não aparece de cara no carregamento da página.
  useEffect(() => {
    const t = setTimeout(() => setLiberado(true), ESPERA_INICIAL_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!liberado || silenciado) {
      setAtual(null);
      return;
    }
    // A sugestão mostrada some do balão se deixou de valer (resolvida/dispensada).
    if (atual && !sugestoes.some((s) => s.chave === atual.chave)) setAtual(null);
    if (atual) return;
    if (!podeMostrarAgora()) return;
    const vistas = lerVistas();
    const proxima = sugestoes.find((s) => s.prioridade <= 2 && !vistas.has(s.chave));
    if (!proxima) return;
    marcarVista(proxima.chave);
    setAtual(proxima);
  }, [liberado, silenciado, sugestoes, atual]);

  if (!atual) return null;
  const outras = sugestoes.filter((s) => s.chave !== atual.chave && s.prioridade <= 2).length;

  return (
    <div
      role="status"
      style={{
        ...estiloPosicao(offset),
        width: LARGURA,
        maxWidth: `calc(100vw - ${MARGEM * 2}px)`,
      }}
      className="fixed z-50 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="rounded-2xl border border-primary/30 bg-card/95 p-2 shadow-xl shadow-primary/20 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 px-1.5 pb-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <Bot className="h-3.5 w-3.5" /> Assistente SPACE TECH
          </span>
          <button
            type="button"
            onClick={() => setAtual(null)}
            aria-label="Fechar aviso"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <CartaoSugestao
          sugestao={atual}
          className="border-0 bg-transparent p-1.5"
          onAcao={() => setAtual(null)}
        />
        {outras > 0 && (
          <button
            type="button"
            onClick={() => {
              setAtual(null);
              onAbrirPainel();
            }}
            className="mt-1 w-full rounded-xl px-2 py-1.5 text-center text-xs font-medium text-primary transition hover:bg-primary/5"
          >
            Ver mais {outras} {outras === 1 ? "sugestão" : "sugestões"}
          </button>
        )}
      </div>
    </div>
  );
}
