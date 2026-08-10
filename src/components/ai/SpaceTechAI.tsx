import { useState } from "react";
import { Minus, Sparkles, X } from "lucide-react";
import { AIChat } from "./AIChat";

export function SpaceTechAI() {
  const [aberto, setAberto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAberto(true);
          setMinimizado(false);
        }}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition hover:scale-105 active:scale-95"
        aria-label="Abrir SPACE TECH IA"
      >
        <Sparkles className="h-5 w-5" />
        <span className="hidden sm:inline">SPACE TECH IA</span>
      </button>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden border border-border bg-card/95 shadow-xl backdrop-blur-md transition-all sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[400px] sm:rounded-2xl ${
        minimizado ? "sm:h-14" : "sm:h-[600px]"
      }`}
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
