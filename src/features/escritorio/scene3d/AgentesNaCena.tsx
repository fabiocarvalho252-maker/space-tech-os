// Agentes da missão dentro da cena 3D. Usa o mesmo estado do modo 2D: a posição
// vem do setor (mesa) ou da sala de espera, e o estado vira a animação do corpo.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type * as THREE from "three";
import type { EstadoMissao } from "../estado.ts";
import type { EstadoAgente } from "../tipos.ts";
import { getAgentLabel } from "../rotulos.ts";
import { animacaoDoEstado, destinosDosAgentes } from "./destinosAgentes.ts";
import { aparenciaDoAgente } from "./characters/appearance.ts";
import { ProceduralBody } from "./characters/ProceduralBody.tsx";
import type { Animacao } from "./characters/poses.ts";

const VELOCIDADE_ANDAR = 2.2;
const DISTANCIA_CHEGOU = 0.05;
const ESCALA_PERSONAGEM = 0.55;

type PropsAgente = {
  id: string;
  nome: string;
  estado: EstadoAgente;
  destino: { x: number; z: number };
};

function AgenteNaCena({ id, nome, estado, destino }: PropsAgente) {
  const grupo = useRef<THREE.Group>(null);
  const andando = useRef(false);
  const aparencia = useMemo(() => aparenciaDoAgente(id), [id]);

  useFrame((_, delta) => {
    const g = grupo.current;
    if (!g) return;
    const dx = destino.x - g.position.x;
    const dz = destino.z - g.position.z;
    const distancia = Math.hypot(dx, dz);
    andando.current = distancia > DISTANCIA_CHEGOU;
    if (!andando.current) return;
    const passo = Math.min(distancia, VELOCIDADE_ANDAR * delta);
    g.position.x += (dx / distancia) * passo;
    g.position.z += (dz / distancia) * passo;
  });

  const animacao: Animacao = andando.current ? "caminhando" : animacaoDoEstado(estado);

  return (
    <group ref={grupo} position={[destino.x, 0, destino.z]} scale={ESCALA_PERSONAGEM}>
      <ProceduralBody aparencia={aparencia} animacao={animacao} />
      <Html position={[0, 2.1, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div className="whitespace-nowrap rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold text-violet-100 ring-1 ring-violet-400/40">
          {getAgentLabel(nome)}
        </div>
      </Html>
    </group>
  );
}

export function AgentesNaCena({ estado }: { estado: EstadoMissao }) {
  const destinos = useMemo(() => destinosDosAgentes(estado), [estado]);
  return (
    <>
      {estado.ordem.map((id) => {
        const agente = estado.agentes[id];
        const destino = destinos.get(id);
        if (!agente || !destino) return null;
        return (
          <AgenteNaCena
            key={id}
            id={id}
            nome={agente.nome}
            estado={agente.estado}
            destino={destino}
          />
        );
      })}
    </>
  );
}
