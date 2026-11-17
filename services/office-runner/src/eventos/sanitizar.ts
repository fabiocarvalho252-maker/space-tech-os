// Mascara segredos antes de qualquer evento sair do runner (chaves, tokens e
// variáveis de ambiente). Regra simples e conservadora.

const PADROES_SEGREDO: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b[A-Z0-9_]*(SERVICE_ROLE|SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*[=:]\s*\S+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function mascararSegredos(texto: string): string {
  return PADROES_SEGREDO.reduce((acc, padrao) => acc.replace(padrao, "[segredo mascarado]"), texto);
}

export function truncar(texto: string, limite: number): string {
  return texto.length <= limite ? texto : `${texto.slice(0, limite - 1)}…`;
}
