import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VELOCIDADES, type Velocidade } from "../hooks/useReplay.ts";
import { cn } from "@/lib/utils";

type Props = {
  tocando: boolean;
  velocidade: Velocidade;
  desabilitado?: boolean;
  onReiniciar: () => void;
  onPausarContinuar: () => void;
  onVelocidade: (velocidade: Velocidade) => void;
};

export function ReplayControles({
  tocando,
  velocidade,
  desabilitado = false,
  onReiniciar,
  onPausarContinuar,
  onVelocidade,
}: Props) {
  const IconeAlternar = tocando ? Pause : Play;
  return (
    <div
      role="group"
      aria-label="Controles de reprodução"
      className="flex flex-wrap items-center gap-2"
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-2"
        onClick={onReiniciar}
        disabled={desabilitado}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reiniciar
      </Button>
      <Button
        type="button"
        size="sm"
        className="gap-2"
        onClick={onPausarContinuar}
        disabled={desabilitado}
      >
        <IconeAlternar className="h-4 w-4" aria-hidden="true" />
        {tocando ? "Pausar" : "Continuar"}
      </Button>
      <div className="flex items-center gap-1" role="group" aria-label="Velocidade">
        {VELOCIDADES.map((opcao) => (
          <Button
            key={opcao}
            type="button"
            size="sm"
            variant={opcao === velocidade ? "default" : "outline"}
            aria-pressed={opcao === velocidade}
            className={cn("min-w-12 tabular-nums")}
            onClick={() => onVelocidade(opcao)}
          >
            {opcao}×
          </Button>
        ))}
      </div>
    </div>
  );
}
