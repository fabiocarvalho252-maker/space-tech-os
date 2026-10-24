// Texto padrão dos termos impressos no fim da OS (os_config.termos_condicoes),
// usado por Configurações > OS ("restaurar texto padrão") e pela configuração
// inicial (/bem-vindo).
export function termosOsPadrao(diasGarantia = 90): string {
  return `Parcelamento: em até 3x no cartão.\nPrazo de execução: até 5 dias úteis após a aprovação.\nValidade deste orçamento: 7 dias.\nGarantia: ${diasGarantia} dias sobre o serviço executado.\n\nEste orçamento é uma previsão de valores, não uma cobrança. Se durante a execução aparecer outro problema, você é avisado antes e nada é feito sem a sua aprovação. A aprovação autoriza a execução dos serviços e a aplicação das peças listadas.`;
}

// Termo de garantia padrão (termos_garantia.conteudo) criado na configuração
// inicial (/bem-vindo) para empresas novas.
export function termoGarantiaPadrao(loja: string, diasGarantia = 90): string {
  const empresa = loja.trim() || "A assistência";
  return `TERMO DE GARANTIA

${empresa} oferece ${diasGarantia} dias de garantia sobre as peças substituídas e os serviços realizados, contados a partir da data de entrega do aparelho ao cliente, conforme o Código de Defesa do Consumidor.

A garantia cobre apenas a peça instalada e o serviço descrito nesta ordem de serviço.

A garantia perde a validade em caso de:
- quedas, impactos, pressão ou aparelho trincado/amassado após a entrega;
- contato com líquidos, umidade ou oxidação;
- abertura ou reparo do aparelho por terceiros;
- violação ou remoção do selo de garantia;
- uso de carregadores ou acessórios inadequados;
- defeitos não relacionados ao serviço realizado.

Para acionar a garantia, apresente esta ordem de serviço. O aparelho passará por avaliação técnica antes de qualquer reparo.`;
}
