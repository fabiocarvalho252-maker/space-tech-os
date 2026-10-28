import { Info } from "lucide-react";

/** Faixa curta no topo de uma aba explicando para que ela serve. */
export function Explicacao({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </p>
  );
}
