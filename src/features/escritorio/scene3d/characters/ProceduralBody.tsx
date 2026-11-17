// Personagem humanoide montado com primitivas do three.js e animado por useFrame.
// Geometrias e materiais ficam fora do loop: o loop só altera transforms.
import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { Aparencia } from "./appearance";
import { calcularPose, type Animacao, type Pose } from "./poses";
import { useGeometrias, useMateriais } from "./recursos";

type PropsCorpo = {
  aparencia: Aparencia;
  animacao: Animacao;
};

type RefGrupo = RefObject<THREE.Group | null>;

type RefsCorpo = {
  raiz: RefGrupo;
  torso: RefGrupo;
  cabeca: RefGrupo;
  bracoEsq: RefGrupo;
  bracoDir: RefGrupo;
  pernaEsq: RefGrupo;
  pernaDir: RefGrupo;
};

const POSICAO_TORSO_Y = 1.3;
const POSICAO_CABECA: [number, number, number] = [0, 1.75, 0];
const POSICAO_BRACO_ESQ: [number, number, number] = [-0.38, 1.6, 0];
const POSICAO_BRACO_DIR: [number, number, number] = [0.38, 1.6, 0];
const POSICAO_PERNA_ESQ: [number, number, number] = [-0.12, 0.8, 0];
const POSICAO_PERNA_DIR: [number, number, number] = [0.12, 0.8, 0];

function girar(objeto: THREE.Object3D | null, x: number, z = 0): void {
  if (!objeto) return;
  objeto.rotation.x = x;
  objeto.rotation.z = z;
}

function aplicarPose(refs: RefsCorpo, pose: Pose): void {
  const raiz = refs.raiz.current;
  if (raiz) raiz.position.y = pose.raizY;
  const torso = refs.torso.current;
  if (torso) {
    torso.scale.y = pose.respiracao;
    torso.rotation.z = pose.troncoZ;
  }
  girar(refs.cabeca.current, pose.cabecaX, pose.cabecaZ);
  girar(refs.bracoEsq.current, pose.bracoEsqX);
  girar(refs.bracoDir.current, pose.bracoDirX);
  girar(refs.pernaEsq.current, pose.pernaEsqX);
  girar(refs.pernaDir.current, pose.pernaDirX);
}

function useRefsCorpo(): RefsCorpo {
  return {
    raiz: useRef<THREE.Group | null>(null),
    torso: useRef<THREE.Group | null>(null),
    cabeca: useRef<THREE.Group | null>(null),
    bracoEsq: useRef<THREE.Group | null>(null),
    bracoDir: useRef<THREE.Group | null>(null),
    pernaEsq: useRef<THREE.Group | null>(null),
    pernaDir: useRef<THREE.Group | null>(null),
  };
}

export function ProceduralBody({ aparencia, animacao }: PropsCorpo) {
  const geometrias = useGeometrias();
  const materiais = useMateriais(aparencia);
  const refs = useRefsCorpo();
  const acessorio = aparencia.acessorio;

  useFrame((estado) => {
    aplicarPose(refs, calcularPose(animacao, estado.clock.elapsedTime));
  });

  return (
    <group ref={refs.raiz}>
      <group ref={refs.torso} position={[0, POSICAO_TORSO_Y, 0]}>
        <mesh geometry={geometrias.torso} material={materiais.roupa} />
        {acessorio === "cracha" ? (
          <mesh
            geometry={geometrias.cracha}
            material={materiais.acessorio}
            position={[0.14, 0.2, 0.3]}
          />
        ) : null}
      </group>

      <group ref={refs.cabeca} position={POSICAO_CABECA}>
        <mesh geometry={geometrias.cabeca} material={materiais.pele} />
        <mesh geometry={geometrias.cabelo} material={materiais.cabelo} position={[0, 0.04, 0]} />
        {acessorio === "oculos" ? (
          <mesh
            geometry={geometrias.oculos}
            material={materiais.acessorio}
            position={[0, 0.02, 0.2]}
          />
        ) : null}
        {acessorio === "fone" ? (
          <mesh geometry={geometrias.fone} material={materiais.acessorio} />
        ) : null}
        {acessorio === "bone" ? (
          <mesh geometry={geometrias.bone} material={materiais.acessorio} position={[0, 0.2, 0]} />
        ) : null}
      </group>

      <group ref={refs.bracoEsq} position={POSICAO_BRACO_ESQ}>
        <mesh geometry={geometrias.braco} material={materiais.roupa} position={[0, -0.3, 0]} />
      </group>
      <group ref={refs.bracoDir} position={POSICAO_BRACO_DIR}>
        <mesh geometry={geometrias.braco} material={materiais.roupa} position={[0, -0.3, 0]} />
      </group>

      <group ref={refs.pernaEsq} position={POSICAO_PERNA_ESQ}>
        <mesh geometry={geometrias.perna} material={materiais.calca} position={[0, -0.4, 0]} />
      </group>
      <group ref={refs.pernaDir} position={POSICAO_PERNA_DIR}>
        <mesh geometry={geometrias.perna} material={materiais.calca} position={[0, -0.4, 0]} />
      </group>
    </group>
  );
}
