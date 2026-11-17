import { useEffect, useMemo } from "react";
import { MeshStandardMaterial, PlaneGeometry } from "three";
import { chaoEmTresD } from "../layout3d.ts";
import { PALETA } from "./paleta.ts";
import { descartarRecursos } from "./recursos.ts";

const CHAO = chaoEmTresD();

function criarRecursosChao() {
  const geometria = new PlaneGeometry(1, 1);
  const material = new MeshStandardMaterial({
    color: PALETA.chao,
    roughness: 0.5,
    metalness: 0.25,
  });
  return { geometria, material, todos: [geometria, material] };
}

// Chão escuro, do tamanho da tela lógica de layout.ts (960 x 640 px).
export function Floor() {
  const recursos = useMemo(criarRecursosChao, []);

  useEffect(() => () => descartarRecursos(recursos.todos), [recursos]);

  return (
    <mesh
      geometry={recursos.geometria}
      material={recursos.material}
      position={[CHAO.centroX, 0, CHAO.centroZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[CHAO.largura, CHAO.profundidade, 1]}
      receiveShadow
    />
  );
}
