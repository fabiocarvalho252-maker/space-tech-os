// Libera geometrias e materiais criados com new quando o componente desmonta.

export type Descartavel = { dispose: () => void };

export function descartarRecursos(recursos: readonly Descartavel[]): void {
  for (const recurso of recursos) {
    recurso.dispose();
  }
}
