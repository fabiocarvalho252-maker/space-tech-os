// Geometrias e materiais compartilhados pelos personagens procedurais.
// Geometrias são criadas uma vez por montagem; materiais mudam só quando as cores mudam.
import { useEffect, useMemo } from "react";
import * as THREE from "three";

export type CoresCorpo = {
  corRoupa: string;
  corCabelo: string;
  corPele: string;
  corAcessorio: string;
};

export type Geometrias = Record<NomeGeometria, THREE.BufferGeometry>;
export type Materiais = Record<NomeMaterial, THREE.MeshStandardMaterial>;

export type NomeGeometria =
  "cabeca" | "cabelo" | "torso" | "braco" | "perna" | "oculos" | "fone" | "bone" | "cracha";

export type NomeMaterial = "roupa" | "pele" | "cabelo" | "calca" | "acessorio";

const COR_CALCA = "#1f1b2e";
const RUGOSIDADE_PADRAO = 0.6;

const RAIO_CABECA = 0.22;
const SEGMENTOS_ESFERA = 20;
const RAIO_TORSO = 0.28;
const COMPRIMENTO_TORSO = 0.5;
const SEGMENTOS_CAPSULA = 4;
const SEGMENTOS_RADIAIS = 12;

export function criarGeometrias(): Geometrias {
  return {
    cabeca: new THREE.SphereGeometry(RAIO_CABECA, SEGMENTOS_ESFERA, SEGMENTOS_ESFERA),
    cabelo: new THREE.SphereGeometry(
      RAIO_CABECA * 1.08,
      SEGMENTOS_ESFERA,
      SEGMENTOS_ESFERA / 2,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    ),
    torso: new THREE.CapsuleGeometry(
      RAIO_TORSO,
      COMPRIMENTO_TORSO,
      SEGMENTOS_CAPSULA,
      SEGMENTOS_RADIAIS,
    ),
    braco: new THREE.BoxGeometry(0.16, 0.6, 0.16),
    perna: new THREE.BoxGeometry(0.22, 0.8, 0.22),
    oculos: new THREE.BoxGeometry(0.34, 0.06, 0.03),
    fone: new THREE.TorusGeometry(0.23, 0.02, 6, 16, Math.PI),
    bone: new THREE.CylinderGeometry(0.2, 0.22, 0.08, SEGMENTOS_RADIAIS),
    cracha: new THREE.BoxGeometry(0.12, 0.08, 0.02),
  };
}

function materialComCor(cor: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: cor, roughness: RUGOSIDADE_PADRAO });
}

export function criarMateriais(cores: CoresCorpo): Materiais {
  return {
    roupa: materialComCor(cores.corRoupa),
    pele: materialComCor(cores.corPele),
    cabelo: materialComCor(cores.corCabelo),
    calca: materialComCor(COR_CALCA),
    acessorio: materialComCor(cores.corAcessorio),
  };
}

export function descartarRecursos(recursos: ReadonlyArray<{ dispose: () => void }>): void {
  recursos.forEach((recurso) => recurso.dispose());
}

export function useGeometrias(): Geometrias {
  const geometrias = useMemo(criarGeometrias, []);
  useEffect(() => () => descartarRecursos(Object.values(geometrias)), [geometrias]);
  return geometrias;
}

export function useMateriais(cores: CoresCorpo): Materiais {
  const { corRoupa, corCabelo, corPele, corAcessorio } = cores;
  const materiais = useMemo(
    () => criarMateriais({ corRoupa, corCabelo, corPele, corAcessorio }),
    [corRoupa, corCabelo, corPele, corAcessorio],
  );
  useEffect(() => () => descartarRecursos(Object.values(materiais)), [materiais]);
  return materiais;
}
