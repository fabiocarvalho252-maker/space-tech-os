// Defeitos visíveis que podem ser marcados na compra de um seminovo — usados
// no formulário, no detalhe e no comprovante de compra (PDF).
export const SEMINOVO_DEFEITOS = [
  { key: "tela_trincada", label: "Tela trincada" },
  { key: "tela_riscada", label: "Tela riscada" },
  { key: "tela_manchas", label: "Manchas ou pixels na tela" },
  { key: "tampa_trincada", label: "Tampa traseira trincada" },
  { key: "carcaca_riscada", label: "Carcaça riscada" },
  { key: "carcaca_amassada", label: "Carcaça amassada" },
  { key: "camera_lente", label: "Lente da câmera trincada" },
  { key: "botoes", label: "Botões danificados" },
  { key: "oxidacao", label: "Sinais de oxidação" },
  { key: "parafusos", label: "Parafusos ausentes" },
] as const;

const ROTULOS: Record<string, string> = Object.fromEntries(
  SEMINOVO_DEFEITOS.map((d) => [d.key, d.label]),
);

/** Lista legível dos defeitos marcados + o texto livre, ou null se não houver nenhum. */
export function descreverDefeitos(
  defeitos: string[] | null | undefined,
  obs?: string | null,
): string | null {
  const itens = (defeitos ?? []).map((k) => ROTULOS[k] ?? k);
  if (obs?.trim()) itens.push(obs.trim());
  return itens.length ? itens.join(", ") : null;
}
