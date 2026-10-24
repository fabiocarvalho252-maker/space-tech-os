// Texto padrão dos termos impressos no fim da OS (os_config.termos_condicoes),
// usado por Configurações > OS ("restaurar texto padrão") e pela configuração
// inicial (/bem-vindo).
export function termosOsPadrao(diasGarantia = 90): string {
  return `Parcelamento: em até 3x no cartão.\nPrazo de execução: até 5 dias úteis após a aprovação.\nValidade deste orçamento: 7 dias.\nGarantia: ${diasGarantia} dias sobre o serviço executado.\n\nEste orçamento é uma previsão de valores, não uma cobrança. Se durante a execução aparecer outro problema, você é avisado antes e nada é feito sem a sua aprovação. A aprovação autoriza a execução dos serviços e a aplicação das peças listadas.`;
}
