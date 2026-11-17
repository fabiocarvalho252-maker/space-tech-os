// Tokens em formato curto: 1234 vira "1,2 mil", 1234567 vira "1,2 mi".
export function formatarTokens(total: number): string {
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (total >= 1_000) return `${(total / 1_000).toFixed(1).replace(".", ",")} mil`;
  return String(total);
}
