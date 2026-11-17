// Agentes da missão dentro da cena 3D. A posição vem do setor (mesa) ou da sala de
// espera; o caminho contorna as mesas, o estado vira animação e efeitos, e quem delega
// liga um feixe até o agente delegado.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type * as THREE from "three";
import type { EstadoMissao } from "../estado.ts";
import type { EstadoAgente } from "../tipos.ts";
import { getAgentLabel } from "../rotulos.ts";
import { animacaoDoEstado, destinosDosAgentes } from "./destinosAgentes.ts";
import { pontoParaTresD } from "./layout3d.ts";
import { caminhoEntre, pontoDe3d } from "./navegacao.ts";
import { textoDoBalao } from "./balao.ts";
import { AnelAprovacao, FeixeDelegacao, Particulas } from "./fx/Efeitos.tsx";
import { aparenciaDoAgente } from "./characters/appearance.ts";
import { ProceduralBody } from "./characters/ProceduralBody.tsx";
import type { Animacao } from "./characters/poses.ts";

const VELOCIDADE_ANDAR = 2.2;
const DISTANCIA_CHEGOU = 0.05;
const ESCALA_PERSONAGEM = 0.55;

type Ponto3d = { x: number; z: number };

type PropsAgente = {
  id: string;
  nome: string;
  estado: EstadoAgente;
  texto: string | null;
  ferramenta: string | null;
  destino: Ponto3d;
};

function EfeitosDoEstado({ estado }: { estado: EstadoAgente }) {
  if (estado === "aguardando_aprovacao") return <AnelAprovacao />;
  if (estado === "concluido") return <Particulas cor="#c4b5fd" subida={1.3} />;
  if (estado === "erro")
    return <Particulas cor="#9ca3af" subida={1} tamanho={0.1} quantidade={8} />;
  return null;
}

function AgenteNaCena({ id, nome, estado, texto, ferramenta, destino }: PropsAgente) {
  const grupo = useRef<THREE.Group>(null);
  const fila = useRef<Ponto3d[]>([]);
  const andando = useRef(false);
  const aparencia = useMemo(() => aparenciaDoAgente(id), [id]);
  const balao = textoDoBalao(texto, ferramenta);

  // Ao mudar de destino, calcula o caminho a partir de onde o agente está agora.
  useEffect(() => {
    const g = grupo.current;
    if (!g) return;
    const atual = pontoDe3d(g.position.x, g.position.z);
    const alvo = pontoDe3d(destino.x, destino.z);
    fila.current = caminhoEntre(atual, alvo).map((p) => pontoParaTresD(p));
  }, [destino.x, destino.z]);

  useFrame((_, delta) => {
    const g = grupo.current;
    const alvo = fila.current[0];
    if (!g || !alvo) {
      andando.current = false;
      return;
    }
    const dx = alvo.x - g.position.x;
    const dz = alvo.z - g.position.z;
    const distancia = Math.hypot(dx, dz);
    if (distancia <= DISTANCIA_CHEGOU) {
      fila.current.shift();
      andando.current = fila.current.length > 0;
      return;
    }
    andando.current = true;
    const passo = Math.min(distancia, VELOCIDADE_ANDAR * delta);
    g.position.x += (dx / distancia) * passo;
    g.position.z += (dz / distancia) * passo;
  });

  const animacao: Animacao = andando.current ? "caminhando" : animacaoDoEstado(estado);

  return (
    <group ref={grupo} position={[destino.x, 0, destino.z]} scale={ESCALA_PERSONAGEM}>
      <ProceduralBody aparencia={aparencia} animacao={animacao} />
      <EfeitosDoEstado estado={estado} />
      <Html position={[0, 2.1, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div className="flex flex-col items-center gap-1">
          {balao && (
            <div className="max-w-[220px] rounded-xl border border-violet-400/50 bg-black/75 px-2.5 py-1 text-xs text-violet-50 shadow-lg shadow-violet-900/40 backdrop-blur">
              {balao}
            </div>
          )}
          <div className="whitespace-nowrap rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold text-violet-100 ring-1 ring-violet-400/40">
            {getAgentLabel(nome)}
          </div>
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
        const pai = agente.paiId ? destinos.get(agente.paiId) : undefined;
        return (
          <group key={id}>
            {pai ? <FeixeDelegacao de={pai} para={destino} /> : null}
            <AgenteNaCena
              id={id}
              nome={agente.nome}
              estado={agente.estado}
              texto={agente.texto}
              ferramenta={agente.ferramenta}
              destino={destino}
            />
          </group>
        );
      })}
    </>
  );
}
