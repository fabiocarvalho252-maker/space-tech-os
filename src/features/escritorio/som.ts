// Avisos sonoros opcionais do Escritório IA, feitos com WebAudio (sem arquivos).
// A preferência fica no localStorage e começa desligada.

import type { EstadoMissao } from "./estado.ts";

export type TipoAviso = "aprovacao" | "conclusao";

type Nota = { frequencia: number; inicio: number; duracao: number };

const CHAVE_PREFERENCIA = "escritorio.somAtivo";
const VOLUME_PICO = 0.12;
const VOLUME_SILENCIO = 0.0001;
const TEMPO_ATAQUE_S = 0.01;
const FOLGA_PARADA_S = 0.02;

const AVISOS: Record<TipoAviso, readonly Nota[]> = {
  aprovacao: [
    { frequencia: 880, inicio: 0, duracao: 0.12 },
    { frequencia: 880, inicio: 0.18, duracao: 0.12 },
  ],
  conclusao: [
    { frequencia: 523, inicio: 0, duracao: 0.12 },
    { frequencia: 659, inicio: 0.12, duracao: 0.12 },
    { frequencia: 784, inicio: 0.24, duracao: 0.2 },
  ],
};

export function lerPreferenciaSom(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CHAVE_PREFERENCIA) === "1";
  } catch {
    // Armazenamento bloqueado (modo privado, política do navegador): usa o padrão, desligado.
    return false;
  }
}

export function gravarPreferenciaSom(ativo: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_PREFERENCIA, ativo ? "1" : "0");
  } catch {
    // Sem armazenamento a preferência vale só nesta aba; nada mais a fazer.
  }
}

type JanelaAudio = Window & { webkitAudioContext?: typeof AudioContext };
let contexto: AudioContext | null = null;

function obterContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (contexto) return contexto;
  const Construtor = window.AudioContext ?? (window as JanelaAudio).webkitAudioContext;
  if (!Construtor) return null;
  contexto = new Construtor();
  return contexto;
}

function tocarNota(ctx: AudioContext, nota: Nota, instante: number): void {
  const oscilador = ctx.createOscillator();
  const ganho = ctx.createGain();
  oscilador.type = "sine";
  oscilador.frequency.value = nota.frequencia;
  ganho.gain.setValueAtTime(VOLUME_SILENCIO, instante);
  ganho.gain.exponentialRampToValueAtTime(VOLUME_PICO, instante + TEMPO_ATAQUE_S);
  ganho.gain.exponentialRampToValueAtTime(VOLUME_SILENCIO, instante + nota.duracao);
  oscilador.connect(ganho).connect(ctx.destination);
  oscilador.start(instante);
  oscilador.stop(instante + nota.duracao + FOLGA_PARADA_S);
}

// Toca o aviso curto. Sem suporte a WebAudio, não faz nada. Quem decide se o som
// está ligado é o chamador (ver lerPreferenciaSom).
export function tocarAviso(tipo: TipoAviso): void {
  const ctx = obterContexto();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const inicio = ctx.currentTime;
  for (const nota of AVISOS[tipo]) {
    tocarNota(ctx, nota, inicio + nota.inicio);
  }
}

const STATUS_TERMINO: ReadonlySet<EstadoMissao["status"]> = new Set(["concluida", "falhou"]);

// Qual aviso tocar ao passar de `anterior` para `atual`: pedido de aprovação novo
// ou missão que acabou de terminar. Nenhum aviso nos demais casos.
export function avisoDaTransicao(
  anterior: Pick<EstadoMissao, "status" | "aprovacao">,
  atual: Pick<EstadoMissao, "status" | "aprovacao">,
): TipoAviso | null {
  const idAtual = atual.aprovacao?.id ?? null;
  const idAnterior = anterior.aprovacao?.id ?? null;
  if (idAtual !== null && idAtual !== idAnterior) return "aprovacao";
  const terminou = atual.status !== anterior.status && STATUS_TERMINO.has(atual.status);
  return terminou ? "conclusao" : null;
}
