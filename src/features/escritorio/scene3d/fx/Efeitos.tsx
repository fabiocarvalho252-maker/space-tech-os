// Efeitos visuais dos agentes na cena 3D: anel de aprovação, confete, fumaça e
// feixe de delegação. Geometrias e materiais são criados uma vez e liberados no unmount.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

type Ponto3d = { x: number; z: number };

// Anel amarelo pulsante no chão: sinaliza que o agente espera sua aprovação.
export function AnelAprovacao() {
  const geometria = useMemo(() => new THREE.TorusGeometry(0.55, 0.05, 8, 32), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#facc15", transparent: true }),
    [],
  );
  useEffect(
    () => () => {
      geometria.dispose();
      material.dispose();
    },
    [geometria, material],
  );
  const anel = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const escala = 1 + Math.sin(clock.elapsedTime * 4) * 0.12;
    anel.current?.scale.set(escala, escala, 1);
  });
  return (
    <mesh
      ref={anel}
      geometry={geometria}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.03, 0]}
    />
  );
}

// Partículas que sobem e somem: confete (concluído) ou fumaça (erro).
export function Particulas({
  cor,
  subida,
  tamanho = 0.07,
  quantidade = 12,
}: {
  cor: string;
  subida: number;
  tamanho?: number;
  quantidade?: number;
}) {
  const geometria = useMemo(() => new THREE.SphereGeometry(tamanho, 6, 6), [tamanho]);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.9 }),
    [cor],
  );
  useEffect(
    () => () => {
      geometria.dispose();
      material.dispose();
    },
    [geometria, material],
  );
  const grupo = useRef<THREE.Group>(null);
  const sementes = useMemo(
    () =>
      Array.from({ length: quantidade }, (_, i) => ({
        dx: Math.sin(i * 2.4) * 0.45,
        fase: i / quantidade,
      })),
    [quantidade],
  );
  useFrame(({ clock }) => {
    grupo.current?.children.forEach((filho, i) => {
      const semente = sementes[i];
      if (!semente) return;
      const progresso = (clock.elapsedTime * 0.6 + semente.fase) % 1;
      filho.position.set(semente.dx * progresso, 0.2 + progresso * subida, 0);
    });
  });
  return (
    <group ref={grupo}>
      {sementes.map((s, i) => (
        <mesh key={i} geometry={geometria} material={material} />
      ))}
    </group>
  );
}

// Linha roxa tracejada do agente que delegou até o agente delegado.
export function FeixeDelegacao({ de, para }: { de: Ponto3d; para: Ponto3d }) {
  return (
    <Line
      points={[
        [de.x, 0.9, de.z],
        [para.x, 0.9, para.z],
      ]}
      color="#a78bfa"
      lineWidth={1.5}
      dashed
      dashSize={0.2}
      gapSize={0.15}
    />
  );
}
