// Monta o Phaser só no navegador (import dinâmico dentro do useEffect), porque
// o TanStack Start renderiza no servidor. Destrói o jogo ao sair da tela.

import { useEffect, useRef } from "react";
import type { Game } from "phaser";
import type { EstadoMissao } from "../estado.ts";
import { ALTURA, LARGURA } from "../game/layout.ts";
import type { OfficeScene } from "../game/OfficeScene.ts";

type Props = {
  estado: EstadoMissao;
  onSelecionarAgente?: (agenteId: string) => void;
};

export function OfficeCanvas({ estado, onSelecionarAgente }: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<OfficeScene | null>(null);
  const estadoRef = useRef(estado);
  const selecionarRef = useRef(onSelecionarAgente);

  useEffect(() => {
    selecionarRef.current = onSelecionarAgente;
  }, [onSelecionarAgente]);

  useEffect(() => {
    let cancelado = false;
    let jogo: Game | null = null;

    (async () => {
      const Phaser = await import("phaser");
      const { OfficeScene: Cena } = await import("../game/OfficeScene.ts");
      if (cancelado || !areaRef.current) return;

      const cena = new Cena();
      cenaRef.current = cena;
      cena.setOnSelecionar((agenteId) => selecionarRef.current?.(agenteId));
      jogo = new Phaser.Game({
        type: Phaser.AUTO,
        parent: areaRef.current,
        width: LARGURA,
        height: ALTURA,
        backgroundColor: "#09090b",
        pixelArt: true,
        roundPixels: true,
        audio: { noAudio: true },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: cena,
      });
      cena.aplicar(estadoRef.current);
    })();

    return () => {
      cancelado = true;
      cenaRef.current?.setOnSelecionar(null);
      cenaRef.current = null;
      jogo?.destroy(true);
    };
  }, []);

  useEffect(() => {
    estadoRef.current = estado;
    cenaRef.current?.aplicar(estado);
  }, [estado]);

  return (
    <div
      ref={areaRef}
      role="img"
      aria-label="Escritório com os agentes trabalhando na missão"
      className="relative aspect-video w-full min-w-0 overflow-hidden lg:aspect-[3/2] rounded-3xl border border-primary/20 bg-black shadow-lg shadow-primary/10 [&_canvas]:!absolute [&_canvas]:!inset-0 [&_canvas]:!h-full [&_canvas]:!w-full [&_canvas]:[image-rendering:pixelated]"
    />
  );
}
