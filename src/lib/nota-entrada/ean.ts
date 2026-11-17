// Código de barras (EAN/GTIN): só dígitos, com 8, 12, 13 ou 14 posições.
export function eanValido(codigo: string): boolean {
  return /^\d+$/.test(codigo) && [8, 12, 13, 14].includes(codigo.length);
}
