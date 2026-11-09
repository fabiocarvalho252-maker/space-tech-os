// Carrossel com as imagens geradas (marketing/midia/<ID>/slide-N.jpg), por
// link assinado e temporário. Mostra uma imagem por vez, com setas e
// pontos, e o botão de baixar a imagem atual (para postar manualmente).
import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function CarrosselReal({ id, slides }: { id: string; slides: string[] }) {
  const [i, setI] = useState(0);
  const atual = slides[Math.min(i, slides.length - 1)]!;
  return (
    <div className="space-y-3">
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-xl">
        <img
          src={atual}
          alt={`${id} — imagem ${i + 1} de ${slides.length}`}
          className="block aspect-[4/5] w-full object-cover"
        />
        {i > 0 && (
          <button
            type="button"
            aria-label="Imagem anterior"
            onClick={() => setI(i - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-zinc-900 shadow"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {i < slides.length - 1 && (
          <button
            type="button"
            aria-label="Próxima imagem"
            onClick={() => setI(i + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-zinc-900 shadow"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {slides.map((_, j) => (
          <button
            key={j}
            type="button"
            aria-label={`Imagem ${j + 1}`}
            onClick={() => setI(j)}
            className={cn(
              "h-2 w-2 rounded-full",
              j === i ? "bg-primary" : "bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
      <div className="text-center">
        <a
          href={atual}
          download={`${id}-${i + 1}.jpg`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" /> Baixar imagem {i + 1} de {slides.length}
        </a>
      </div>
    </div>
  );
}
