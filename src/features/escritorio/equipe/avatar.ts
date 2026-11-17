// Iniciais e cor do avatar de um agente da equipe. A cor vem do agentId,
// então o mesmo agente tem sempre a mesma cor. Classes completas para o Tailwind.

const PALETAS_AVATAR = [
  "bg-violet-600 text-white",
  "bg-fuchsia-600 text-white",
  "bg-sky-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-500 text-black",
  "bg-rose-600 text-white",
  "bg-indigo-600 text-white",
  "bg-teal-600 text-white",
] as const;

const INICIAIS_PADRAO = "?";
const MAXIMO_INICIAIS = 2;

/** Primeira letra das duas primeiras palavras do nome, em maiúsculas. */
export function iniciaisDoNome(nome: string): string {
  const palavras = nome
    .trim()
    .split(/\s+/)
    .filter((palavra) => palavra !== "");
  if (palavras.length === 0) return INICIAIS_PADRAO;
  return palavras
    .slice(0, MAXIMO_INICIAIS)
    .map((palavra) => palavra.charAt(0).toUpperCase())
    .join("");
}

/** Hash simples e estável do texto (djb2 com inteiro de 32 bits). */
function hashEstavel(texto: string): number {
  let hash = 5381;
  for (const caractere of texto) {
    hash = ((hash << 5) + hash + (caractere.codePointAt(0) ?? 0)) | 0;
  }
  return Math.abs(hash);
}

/** Classes de cor de fundo e texto para o avatar do agente. */
export function corDoAvatar(agentId: string): string {
  const indice = hashEstavel(agentId) % PALETAS_AVATAR.length;
  return PALETAS_AVATAR[indice] ?? PALETAS_AVATAR[0];
}
