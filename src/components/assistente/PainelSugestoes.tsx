import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Lightbulb,
  Loader2,
  MessageSquare,
  Package,
  Settings2,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CategoriaAssistente, Sugestao } from "@/lib/assistente/sugestoes";
import { useAcoesSugestao, useAssistente } from "./useAssistente";
import { PreferenciasAssistente } from "./PreferenciasAssistente";

const ICONE_CATEGORIA: Record<CategoriaAssistente, LucideIcon> = {
  os: Wrench,
  financeiro: Wallet,
  estoque: Package,
  agenda: Calendar,
  whatsapp: MessageSquare,
  dicas: Lightbulb,
};

const TOM_PRIORIDADE: Record<Sugestao["prioridade"], string> = {
  1: "bg-red-500/10 text-red-600",
  2: "bg-amber-500/10 text-amber-600",
  3: "bg-primary/10 text-primary",
};

export function CartaoSugestao({
  sugestao: s,
  onAcao,
  className,
}: {
  sugestao: Sugestao;
  /** Chamado depois de qualquer botão (ex.: fechar o painel ao navegar). */
  onAcao?: (tipo: "abrir" | "depois") => void;
  className?: string;
}) {
  const acoes = useAcoesSugestao();
  const Icone = ICONE_CATEGORIA[s.categoria];
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-3", className)}>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            TOM_PRIORIDADE[s.prioridade],
          )}
        >
          <Icone className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{s.titulo}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.pergunta}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {s.acoes.map((a, i) => (
              <Button
                key={a.rotulo}
                size="sm"
                variant={i === 0 ? "default" : "outline"}
                className="h-7 px-2.5 text-xs"
                onClick={() => {
                  acoes.abrir(a);
                  onAcao?.("abrir");
                }}
              >
                {a.rotulo}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => {
                acoes.depois(s);
                onAcao?.("depois");
              }}
            >
              Depois
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            acoes.nuncaMais(s);
            onAcao?.("depois");
          }}
          title="Não mostrar mais este aviso"
          aria-label="Não mostrar mais este aviso"
          className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function PainelSugestoes({ onNavegar }: { onNavegar?: () => void }) {
  const { sugestoes, ligado, carregando } = useAssistente();
  const [ajustes, setAjustes] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {ajustes ? "Ajustes do assistente" : "O assistente sugere"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
          onClick={() => setAjustes((v) => !v)}
        >
          <Settings2 className="h-3.5 w-3.5" /> {ajustes ? "Voltar" : "Ajustes"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
        {ajustes ? (
          <PreferenciasAssistente compacto />
        ) : !ligado ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              O assistente está desligado. Ligue para receber avisos e perguntas sobre o que precisa
              da sua atenção.
            </p>
            <Button size="sm" onClick={() => setAjustes(true)}>
              Ligar assistente
            </Button>
          </div>
        ) : carregando ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sugestoes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-semibold">Tudo em dia!</p>
            <p className="text-xs text-muted-foreground">
              Nada parado ou vencido agora. Quando algo precisar de você, eu aviso aqui.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sugestoes.map((s) => (
              <CartaoSugestao
                key={s.chave}
                sugestao={s}
                onAcao={(tipo) => tipo === "abrir" && onNavegar?.()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
