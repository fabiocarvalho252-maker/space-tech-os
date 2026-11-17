// Chave de acesso da NF-e: 44 dígitos, o último é dígito verificador (módulo 11,
// pesos 2 a 9 da direita para a esquerda). Serve para pegar erro de leitura de foto.
const TAMANHO_CHAVE = 44;
const PESO_MAXIMO = 9;
const MODULO = 11;

export function chaveAcessoValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  const corpo = chave.slice(0, TAMANHO_CHAVE - 1);
  let soma = 0;
  let peso = 2;
  for (let i = corpo.length - 1; i >= 0; i--) {
    soma += Number(corpo[i]) * peso;
    peso = peso === PESO_MAXIMO ? 2 : peso + 1;
  }
  const resto = soma % MODULO;
  const dvEsperado = resto === 0 || resto === 1 ? 0 : MODULO - resto;
  return dvEsperado === Number(chave[TAMANHO_CHAVE - 1]);
}
