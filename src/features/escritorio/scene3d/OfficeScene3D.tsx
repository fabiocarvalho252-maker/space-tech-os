import { useMemo, useRef, Suspense, type ComponentRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PCFSoftShadowMap } from "three";
import { larguraDaTela, quality, type Qualidade } from "./quality.ts";
import { Floor } from "./environment/Floor.tsx";
import { Setores } from "./environment/Setores.tsx";
import { NeonStrips } from "./environment/NeonStrips.tsx";
import { PALETA } from "./environment/paleta.ts";

const FOV_GRAUS = 30;
const RAIO_INICIAL = 15;
const POLAR_INICIAL_GRAUS = 50;
const AZIMUTE_INICIAL_GRAUS = 45;
const POLAR_MINIMO_GRAUS = 35;
const POLAR_MAXIMO_GRAUS = 60;
const ZOOM_MINIMO = 9;
const ZOOM_MAXIMO = 22;
const EXTENSAO_SOMBRA = 8;

function grausParaRadianos(graus: number): number {
  return (graus * Math.PI) / 180;
}

// Posição inicial da câmera em coordenadas esféricas (vista isométrica).
function posicaoInicialCamera(): [number, number, number] {
  const polar = grausParaRadianos(POLAR_INICIAL_GRAUS);
  const azimute = grausParaRadianos(AZIMUTE_INICIAL_GRAUS);
  return [
    RAIO_INICIAL * Math.sin(polar) * Math.sin(azimute),
    RAIO_INICIAL * Math.cos(polar),
    RAIO_INICIAL * Math.sin(polar) * Math.cos(azimute),
  ];
}

const CAMERA_INICIAL = posicaoInicialCamera();

type ControlesOrbitais = ComponentRef<typeof OrbitControls>;

import type { EstadoMissao } from "../estado.ts";
import { AgentesNaCena } from "./AgentesNaCena.tsx";

export type OfficeScene3DProps = {
  qualidade?: Qualidade;
  estado?: EstadoMissao;
};

export function CarregandoEscritorio() {
  return (
    <div className="flex h-full min-h-[420px] w-full items-center justify-center rounded-2xl bg-[#0b0714]">
      <p className="animate-pulse text-sm font-medium tracking-wide text-violet-200">
        Montando o escritório…
      </p>
    </div>
  );
}

// Cena 3D do escritório. Deve ser montada só no client (ver ClientOnly).
export default function OfficeScene3D({ qualidade = "alta", estado }: OfficeScene3DProps) {
  const controles = useRef<ControlesOrbitais | null>(null);
  const ajustes = useMemo(() => quality(qualidade, larguraDaTela()), [qualidade]);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-2xl bg-[#0b0714]">
      <Suspense fallback={<CarregandoEscritorio />}>
        <Canvas
          camera={{ position: CAMERA_INICIAL, fov: FOV_GRAUS, near: 0.1, far: 100 }}
          dpr={[1, ajustes.dprMaximo]}
          gl={{ antialias: ajustes.antialias }}
          shadows={ajustes.sombras ? { type: PCFSoftShadowMap } : false}
        >
          <color attach="background" args={[PALETA.fundo]} />
          <ambientLight intensity={0.4} color="#c4b5fd" />
          <directionalLight
            position={[6, 12, 5]}
            intensity={1.2}
            color="#f5f3ff"
            castShadow={ajustes.sombras}
            shadow-mapSize={[ajustes.sombraMapSize, ajustes.sombraMapSize]}
            shadow-camera-left={-EXTENSAO_SOMBRA}
            shadow-camera-right={EXTENSAO_SOMBRA}
            shadow-camera-top={EXTENSAO_SOMBRA}
            shadow-camera-bottom={-EXTENSAO_SOMBRA}
            shadow-bias={-0.0005}
          />
          <Floor />
          <Setores />
          <NeonStrips />
          {estado ? <AgentesNaCena estado={estado} /> : null}
          <OrbitControls
            ref={controles}
            makeDefault
            enableDamping
            enablePan={false}
            minDistance={ZOOM_MINIMO}
            maxDistance={ZOOM_MAXIMO}
            minPolarAngle={grausParaRadianos(POLAR_MINIMO_GRAUS)}
            maxPolarAngle={grausParaRadianos(POLAR_MAXIMO_GRAUS)}
          />
        </Canvas>
      </Suspense>
      <button
        type="button"
        onClick={() => controles.current?.reset()}
        className="absolute right-3 top-3 rounded-lg border border-violet-400/40 bg-black/60 px-3 py-1.5 text-sm font-medium text-violet-100 backdrop-blur transition hover:bg-violet-500/30 focus-visible:outline-2 focus-visible:outline-violet-300"
      >
        Centralizar
      </button>
    </div>
  );
}
