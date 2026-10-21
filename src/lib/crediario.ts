// Crediário (venda parcelada com bloqueio do aparelho): rótulos, termo de
// aceite e o cálculo de parcelas usado na prévia do novo contrato. As regras
// de verdade (status, bloqueio, valores mínimos) ficam nas funções Postgres
// da migration 20261021100000_crediario.sql; aqui é só apresentação.
import type { StatusTone } from "@/components/StatusBadge";
import { paraCentavos, paraReais } from "@/lib/format";

type InfoStatus = { label: string; tone: StatusTone };

const STATUS_CONTRATO = {
  ativo: { label: "Em dia", tone: "success" },
  atrasado: { label: "Atrasado", tone: "warning" },
  bloqueado: { label: "Bloqueado", tone: "danger" },
  quitado: { label: "Quitado", tone: "info" },
  cancelado: { label: "Cancelado", tone: "neutral" },
} satisfies Record<string, InfoStatus>;

const STATUS_PARCELA = {
  aberta: { label: "Em aberto", tone: "neutral" },
  atrasada: { label: "Atrasada", tone: "danger" },
  paga: { label: "Paga", tone: "success" },
  cancelada: { label: "Cancelada", tone: "neutral" },
} satisfies Record<string, InfoStatus>;

const STATUS_APARELHO = {
  liberado: { label: "Liberado", tone: "success" },
  bloqueado: { label: "Bloqueado", tone: "danger" },
  removido: { label: "Proteção removida", tone: "neutral" },
} satisfies Record<string, InfoStatus>;

export const TIPO_COMANDO: Record<string, string> = {
  bloquear: "Bloquear",
  liberar: "Liberar",
  mensagem: "Mensagem",
  remover_protecao: "Remover proteção",
};

const STATUS_COMANDO = {
  pendente: { label: "Aguardando aparelho", tone: "warning" },
  enviado: { label: "Enviado", tone: "info" },
  confirmado: { label: "Confirmado", tone: "success" },
  cancelado: { label: "Substituído", tone: "neutral" },
} satisfies Record<string, InfoStatus>;

// Status desconhecido (não deveria acontecer: o banco tem CHECK) cai no
// padrão em vez de quebrar a tela.
function info<T extends Record<string, InfoStatus>>(
  mapa: T,
  chave: string | null | undefined,
  padrao: keyof T,
): InfoStatus {
  return (mapa[(chave ?? "") as keyof T] ?? mapa[padrao]) as InfoStatus;
}

export const statusContrato = (s: string | null | undefined) => info(STATUS_CONTRATO, s, "ativo");
export const statusParcela = (s: string | null | undefined) => info(STATUS_PARCELA, s, "aberta");
export const statusAparelho = (s: string | null | undefined) =>
  info(STATUS_APARELHO, s, "liberado");
export const statusComando = (s: string | null | undefined) => info(STATUS_COMANDO, s, "pendente");

export const numeroContrato = (numero: number | null | undefined) =>
  `CR-${String(numero ?? 0).padStart(4, "0")}`;

export function termoBloqueio(diasTolerancia: number) {
  return (
    "Declaro estar ciente de que o aparelho adquirido neste contrato possui um aplicativo de " +
    "proteção instalado pela loja. Em caso de atraso de " +
    `${diasTolerancia} dia(s) ou mais no pagamento de qualquer parcela, o aparelho poderá ser ` +
    "bloqueado remotamente, mantendo apenas chamadas de emergência, e será liberado " +
    "automaticamente após a regularização do pagamento. Ao quitar todas as parcelas, a " +
    "proteção será removida definitivamente. Parcelas pagas em atraso estão sujeitas a " +
    "multa e juros de mora conforme este contrato."
  );
}

/** Mesma divisão que criar_contrato_crediario(): sem valor fixo de parcela,
 * divide o financiado igualmente e joga o arredondamento na última. */
export function previaParcelas(
  valorAparelho: number,
  entrada: number,
  numParcelas: number,
  valorParcelaFixo: number | null,
): number[] {
  const n = Math.max(1, Math.floor(numParcelas || 1));
  if (valorParcelaFixo && valorParcelaFixo > 0) return Array(n).fill(valorParcelaFixo);
  const financiado = paraCentavos(valorAparelho - entrada);
  if (financiado <= 0) return [];
  const base = Math.floor(financiado / n);
  return Array.from({ length: n }, (_, i) =>
    paraReais(i === n - 1 ? financiado - base * (n - 1) : base),
  );
}

/** Soma o mês sem estourar o fim do mês (31/01 + 1 → 28/02), igual ao
 * `date + interval '1 month'` do Postgres. Recebe e devolve "YYYY-MM-DD". */
export function somarMeses(iso: string, meses: number) {
  const [ano = 0, mes = 1, dia = 1] = iso.split("-").map(Number);
  const alvo = new Date(ano, mes - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(dia, ultimoDia));
  return hojeISO(alvo);
}

export function hojeISO(data = new Date()) {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Dígito verificador do IMEI (Luhn). Só um aviso na tela: o banco aceita
 * qualquer IMEI de 15 dígitos. */
export function imeiValido(imei: string) {
  if (!/^\d{15}$/.test(imei)) return false;
  let soma = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(imei[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
  }
  return soma % 10 === 0;
}
