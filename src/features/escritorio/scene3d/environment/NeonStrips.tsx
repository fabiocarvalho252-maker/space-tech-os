import { useEffect, useMemo } from "react";
import { BoxGeometry, MeshBasicMaterial } from "three";
import { salasEmTresD, type Trio } from "../layout3d.ts";
import { PALETA } from "./paleta.ts";
import { descartarRecursos } from "./recursos.ts";

const SALAS = salasEmTresD();
const ALTURA_NEON = 0.04;
const ESPESSURA_NEON = 0.05;
const RECUO_NEON = 0.03;

function criarRecursosNeon() {
  const caixa = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial({ color: PALETA.neon, toneMapped: false });
  return { caixa, material, todos: [caixa, material] };
}

// Faixa de neon roxo no rodapé (borda frontal) de cada setor.
export function NeonStrips() {
  const recursos = useMemo(criarRecursosNeon, []);

  useEffect(() => () => descartarRecursos(recursos.todos), [recursos]);

  return (
    <group>
      {SALAS.map((sala) => {
        const posicao: Trio = [sala.centroX, ALTURA_NEON / 2, sala.zFrontal - RECUO_NEON];
        const escala: Trio = [sala.largura, ALTURA_NEON, ESPESSURA_NEON];
        return (
          <mesh
            key={sala.id}
            geometry={recursos.caixa}
            material={recursos.material}
            position={posicao}
            scale={escala}
          />
        );
      })}
    </group>
  );
}
