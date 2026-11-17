// Limite de lotes de sincronização por dia (UTC), guardado em memória, como o
// limite diário de missões. Reiniciar o runner zera a contagem.
export type LimiteDiario = {
  tentar(): boolean;
  usadosHoje(): number;
};

export function criarLimiteDiario(maximo: number, agora: () => Date = () => new Date()): LimiteDiario {
  let diaAtual = "";
  let usados = 0;
  const renovarSeNecessario = (): void => {
    const hoje = agora().toISOString().slice(0, 10);
    if (hoje !== diaAtual) {
      diaAtual = hoje;
      usados = 0;
    }
  };
  return {
    tentar() {
      renovarSeNecessario();
      if (usados >= maximo) return false;
      usados += 1;
      return true;
    },
    usadosHoje() {
      renovarSeNecessario();
      return usados;
    },
  };
}
