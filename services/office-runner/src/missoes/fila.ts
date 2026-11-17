// Fila de execução com concorrência limitada. Uma missão por vez por padrão.
export function criarFila(concorrencia: number) {
  let ativas = 0;
  const pendentes: Array<() => Promise<void>> = [];

  function proxima(): void {
    if (ativas >= concorrencia) return;
    const tarefa = pendentes.shift();
    if (!tarefa) return;
    ativas += 1;
    void tarefa().finally(() => {
      ativas -= 1;
      proxima();
    });
  }

  return {
    enfileirar(tarefa: () => Promise<void>): number {
      pendentes.push(tarefa);
      const posicao = pendentes.length + ativas;
      proxima();
      return posicao;
    },
    tamanho: () => ({ ativas, aguardando: pendentes.length }),
  };
}
