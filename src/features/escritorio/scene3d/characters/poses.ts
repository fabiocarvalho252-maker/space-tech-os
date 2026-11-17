// Poses dos personagens em função do tempo. Lógica pura, sem three e sem React.

export type Animacao =
  "parado" | "respirando" | "digitando" | "pensando" | "pulando" | "cabeca_baixa" | "caminhando";

export type Pose = {
  raizY: number;
  respiracao: number;
  troncoZ: number;
  cabecaX: number;
  cabecaZ: number;
  bracoEsqX: number;
  bracoDirX: number;
  pernaEsqX: number;
  pernaDirX: number;
};

type PoseParcial = Partial<Pose>;

const POSE_NEUTRA: Pose = {
  raizY: 0,
  respiracao: 1,
  troncoZ: 0,
  cabecaX: 0,
  cabecaZ: 0,
  bracoEsqX: 0,
  bracoDirX: 0,
  pernaEsqX: 0,
  pernaDirX: 0,
};

const RESPIRACAO_FREQ = 2;
const RESPIRACAO_AMPLITUDE = 0.02;

const DIGITACAO_FREQ = 12;
const DIGITACAO_AMPLITUDE = 0.35;
const DIGITACAO_BRACO_BASE = -0.9;
const DIGITACAO_CABECA_X = 0.15;

const PENSANDO_CABECA_Z = 0.25;
const PENSANDO_BRACO_QUEIXO = -1.3;
const PENSANDO_OSCILACAO_FREQ = 1.5;
const PENSANDO_OSCILACAO_AMPLITUDE = 0.04;

const PULO_FREQ = 6;
const PULO_ALTURA = 0.3;
const PULO_BRACO = -2.8;

const CABECA_BAIXA_X = 0.6;

const CAMINHADA_FREQ = 8;
const CAMINHADA_PERNA = 0.6;
const CAMINHADA_BRACO = 0.5;
const CAMINHADA_SUBIDA = 0.04;
const CAMINHADA_BALANCO_TRONCO = 0.03;

const CALCULOS: Record<Animacao, (tempo: number) => PoseParcial> = {
  parado: () => ({}),
  respirando: (tempo) => ({
    respiracao: 1 + RESPIRACAO_AMPLITUDE * Math.sin(tempo * RESPIRACAO_FREQ),
  }),
  digitando: (tempo) => {
    const onda = Math.sin(tempo * DIGITACAO_FREQ);
    return {
      cabecaX: DIGITACAO_CABECA_X,
      bracoEsqX: DIGITACAO_BRACO_BASE + DIGITACAO_AMPLITUDE * onda,
      bracoDirX: DIGITACAO_BRACO_BASE - DIGITACAO_AMPLITUDE * onda,
    };
  },
  pensando: (tempo) => ({
    cabecaZ:
      PENSANDO_CABECA_Z + PENSANDO_OSCILACAO_AMPLITUDE * Math.sin(tempo * PENSANDO_OSCILACAO_FREQ),
    bracoDirX: PENSANDO_BRACO_QUEIXO,
  }),
  pulando: (tempo) => ({
    raizY: PULO_ALTURA * Math.abs(Math.sin(tempo * PULO_FREQ)),
    bracoEsqX: PULO_BRACO,
    bracoDirX: PULO_BRACO,
  }),
  cabeca_baixa: () => ({ cabecaX: CABECA_BAIXA_X }),
  caminhando: (tempo) => {
    const onda = Math.sin(tempo * CAMINHADA_FREQ);
    return {
      raizY: CAMINHADA_SUBIDA * Math.abs(onda),
      pernaEsqX: CAMINHADA_PERNA * onda,
      pernaDirX: -CAMINHADA_PERNA * onda,
      bracoEsqX: -CAMINHADA_BRACO * onda,
      bracoDirX: CAMINHADA_BRACO * onda,
      troncoZ: CAMINHADA_BALANCO_TRONCO * onda,
    };
  },
};

export function calcularPose(animacao: Animacao, tempo: number): Pose {
  return { ...POSE_NEUTRA, ...CALCULOS[animacao](tempo) };
}
