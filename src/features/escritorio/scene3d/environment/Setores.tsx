import { useEffect, useMemo } from "react";
import { BoxGeometry, MeshStandardMaterial, PlaneGeometry } from "three";
import { caixasDasParedes, salasEmTresD, type SalaCena3d, type Trio } from "../layout3d.ts";
import { corDoPiso, PALETA } from "./paleta.ts";
import { descartarRecursos } from "./recursos.ts";

const SALAS = salasEmTresD();
const ALTURA_PAREDE = 1.1;
const ESPESSURA_PAREDE = 0.04;
const ALTURA_MESA = 0.74;
const MEDIDA_TAMPO: Trio = [0.8, 0.06, 0.5];
const MEDIDA_PEDESTAL: Trio = [0.12, ALTURA_MESA, 0.12];

function criarRecursosSalas() {
  const chao = new PlaneGeometry(1, 1);
  const caixa = new BoxGeometry(1, 1, 1);
  const vidro = new MeshStandardMaterial({
    color: PALETA.vidro,
    transparent: true,
    opacity: 0.12,
    roughness: 0.85,
    depthWrite: false,
  });
  const mesa = new MeshStandardMaterial({ color: PALETA.mesa, roughness: 0.5, metalness: 0.1 });
  const salas = SALAS.map((sala) => ({
    sala,
    piso: new MeshStandardMaterial({ color: corDoPiso(sala.id), roughness: 0.7 }),
  }));
  const todos = [chao, caixa, vidro, mesa, ...salas.map((item) => item.piso)];
  return { chao, caixa, vidro, mesa, salas, todos };
}

type RecursosSalas = ReturnType<typeof criarRecursosSalas>;

type SalaProps = {
  sala: SalaCena3d;
  piso: MeshStandardMaterial;
  recursos: RecursosSalas;
};

function Sala({ sala, piso, recursos }: SalaProps) {
  return (
    <group>
      <mesh
        geometry={recursos.chao}
        material={piso}
        position={[sala.centroX, 0.01, sala.centroZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[sala.largura, sala.profundidade, 1]}
        receiveShadow
      />
      {caixasDasParedes(sala, ALTURA_PAREDE, ESPESSURA_PAREDE).map((parede, indice) => (
        <mesh
          key={indice}
          geometry={recursos.caixa}
          material={recursos.vidro}
          position={parede.posicao}
          scale={parede.escala}
        />
      ))}
      {sala.mesas.map((mesa, indice) => (
        <group key={indice} position={[mesa.x, 0, mesa.z]}>
          <mesh
            geometry={recursos.caixa}
            material={recursos.mesa}
            position={[0, ALTURA_MESA, 0]}
            scale={MEDIDA_TAMPO}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={recursos.caixa}
            material={recursos.mesa}
            position={[0, ALTURA_MESA / 2, 0]}
            scale={MEDIDA_PEDESTAL}
            castShadow
          />
        </group>
      ))}
    </group>
  );
}

// Salas dos setores de layout.ts: piso com cor própria, paredes de vidro
// fosco e mesas em caixa simples.
export function Setores() {
  const recursos = useMemo(criarRecursosSalas, []);

  useEffect(() => () => descartarRecursos(recursos.todos), [recursos]);

  return (
    <group>
      {recursos.salas.map(({ sala, piso }) => (
        <Sala key={sala.id} sala={sala} piso={piso} recursos={recursos} />
      ))}
    </group>
  );
}
