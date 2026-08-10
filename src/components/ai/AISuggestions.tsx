const SUGESTOES = [
  "📋 Quantas OS estão abertas?",
  "📦 Como está meu estoque?",
  "💰 Quanto vendi hoje?",
  "📅 O que tenho na agenda hoje?",
  "👥 Quais clientes possuem OS em andamento?",
];

export function AISuggestions({ onEscolher }: { onEscolher: (texto: string) => void }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Experimente perguntar
      </p>
      <div className="flex flex-col gap-1.5">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onEscolher(s.replace(/^\S+\s/, ""))}
            className="rounded-xl border border-border bg-card px-3 py-2 text-left text-sm transition hover:border-primary/50 hover:bg-secondary/50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
