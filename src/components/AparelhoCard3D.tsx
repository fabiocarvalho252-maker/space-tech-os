import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RotateCw } from "lucide-react";
import { urlAssinada, type LadosAparelho } from "@/hooks/useLadosAparelho";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Cartão giratório com a foto da frente e a da traseira do aparelho (fotos
// da OS marcadas como "Frente"/"Traseira" na galeria). Não é um modelo 3D de
// verdade — duas fotos não bastam para isso —, é um cartão com perspectiva
// que vira ao passar o mouse e, ampliado, gira arrastando.

function Faces({
  frente,
  traseira,
  rotacao,
  animar,
  className,
}: {
  frente?: string | undefined;
  traseira?: string | undefined;
  rotacao: number;
  animar: boolean;
  className?: string;
}) {
  const face =
    "absolute inset-0 overflow-hidden rounded-[18%/12%] border border-white/10 bg-neutral-900 shadow-lg [backface-visibility:hidden]";
  return (
    <div className={`relative [perspective:600px] ${className ?? ""}`}>
      <div
        className={`relative h-full w-full [transform-style:preserve-3d] ${animar ? "transition-transform duration-700 ease-out" : ""}`}
        style={{ transform: `rotateY(${rotacao}deg)` }}
      >
        <div className={face}>
          {frente ? (
            <img
              src={frente}
              alt="Frente do aparelho"
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[9px] text-white/50">
              Frente
            </span>
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent" />
        </div>
        <div className={`${face} [transform:rotateY(180deg)]`}>
          {traseira ? (
            <img
              src={traseira}
              alt="Traseira do aparelho"
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[9px] text-white/50">
              Traseira
            </span>
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-tl from-transparent via-white/15 to-transparent" />
        </div>
      </div>
    </div>
  );
}

export function AparelhoCard3D({
  lados,
  titulo,
  tamanho = "sm",
}: {
  lados: LadosAparelho | undefined;
  titulo: string;
  tamanho?: "sm" | "md";
}) {
  const [hover, setHover] = useState(false);
  const [aberto, setAberto] = useState(false);
  if (!lados?.frente && !lados?.traseira) return null;
  const temDois = !!lados.frente && !!lados.traseira;
  // Só uma foto marcada: mostra ela parada, sem virar para um lado vazio.
  const rotacaoInicial = lados.frente ? 0 : 180;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="Ver aparelho em 3D"
        aria-label="Ver frente e traseira do aparelho"
        className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Faces
          frente={lados.frente?.thumb}
          traseira={lados.traseira?.thumb}
          rotacao={temDois && hover ? rotacaoInicial + 180 : rotacaoInicial}
          animar
          className={tamanho === "sm" ? "h-12 w-8" : "h-20 w-14"}
        />
      </button>
      {aberto && (
        <VisualizadorAparelho lados={lados} titulo={titulo} onClose={() => setAberto(false)} />
      )}
    </>
  );
}

function VisualizadorAparelho({
  lados,
  titulo,
  onClose,
}: {
  lados: LadosAparelho;
  titulo: string;
  onClose: () => void;
}) {
  const [rotacao, setRotacao] = useState(lados.frente ? 0 : 180);
  const [arrastando, setArrastando] = useState(false);
  const inicio = useRef<{ x: number; rot: number } | null>(null);

  const { data: grandes, isLoading } = useQuery({
    queryKey: ["os-fotos-lados-grandes", lados.frente?.path, lados.traseira?.path],
    staleTime: 50 * 60_000,
    queryFn: async () => ({
      frente: lados.frente ? await urlAssinada(lados.frente.path, 900) : undefined,
      traseira: lados.traseira ? await urlAssinada(lados.traseira.path, 900) : undefined,
    }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div
          className="flex touch-none select-none justify-center py-4"
          style={{ cursor: arrastando ? "grabbing" : "grab" }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            inicio.current = { x: e.clientX, rot: rotacao };
            setArrastando(true);
          }}
          onPointerMove={(e) => {
            if (!inicio.current) return;
            setRotacao(inicio.current.rot + (e.clientX - inicio.current.x) * 0.6);
          }}
          onPointerUp={() => {
            inicio.current = null;
            setArrastando(false);
            // Assenta no lado mais próximo (frente ou traseira).
            setRotacao((r) => Math.round(r / 180) * 180);
          }}
        >
          {isLoading ? (
            <div className="flex h-80 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Faces
              frente={grandes?.frente || lados.frente?.thumb}
              traseira={grandes?.traseira || lados.traseira?.thumb}
              rotacao={rotacao}
              animar={!arrastando}
              className="h-80 w-56"
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRotacao((r) => Math.round(r / 360) * 360)}
          >
            Frente
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRotacao((r) => r + 180)}>
            <RotateCw className="mr-1.5 h-4 w-4" /> Virar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRotacao((r) => Math.round((r - 180) / 360) * 360 + 180)}
          >
            Traseira
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">Arraste para girar o aparelho</p>
      </DialogContent>
    </Dialog>
  );
}
