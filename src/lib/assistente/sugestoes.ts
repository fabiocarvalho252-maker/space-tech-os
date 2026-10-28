// Assistente do sistema: transforma o que já está no banco (OS, cobranças,
// contas, estoque, agenda, WhatsApp) em perguntas curtas com botão de ação.
// Tudo regra fixa, sem IA — não gasta o limite diário do Gemini. Este
// arquivo é puro (sem banco nem React) para rodar no `npm test`; quem busca
// os dados é useAssistente.ts.

export type CategoriaAssistente = "os" | "financeiro" | "estoque" | "agenda" | "whatsapp" | "dicas";

export const CATEGORIAS_ASSISTENTE: { id: CategoriaAssistente; label: string }[] = [
  { id: "os", label: "Ordens de serviço" },
  { id: "financeiro", label: "Cobranças e contas" },
  { id: "estoque", label: "Estoque" },
  { id: "agenda", label: "Agenda" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "dicas", label: "Dicas de uso" },
];

export type AcaoSugestao = { rotulo: string; to: string; search?: Record<string, string> };

export type Sugestao = {
  /** Identifica a sugestão para "Depois"/"Não mostrar". Muda quando a
   * situação muda (outro status, mais itens), para voltar a aparecer. */
  chave: string;
  categoria: CategoriaAssistente;
  /** 1 = precisa de atenção, 2 = importante, 3 = dica. */
  prioridade: 1 | 2 | 3;
  titulo: string;
  pergunta: string;
  acoes: AcaoSugestao[];
};

export type OsAssistente = {
  id: string;
  numero: number;
  status: string;
  updated_at: string;
  previsao: string | null;
  aparelho: string;
  cliente: string | null;
};

export type DadosAssistente = {
  /** OS fora de entregue/faturado/cancelado/reprovado. */
  os: OsAssistente[] | null;
  cobrancasVencidas: { valor: number }[] | null;
  contasPagarVencidas: { valor: number }[] | null;
  receberAtrasados: { valor: number }[] | null;
  estoqueBaixo: { nome: string }[] | null;
  /** Compromissos "agendado" de hoje que ainda não começaram. */
  agendaHoje: { titulo: string; inicio: string }[] | null;
  whatsappNaoLidas: number | null;
  reclamacoes: number | null;
  totais: { clientes: number | null; os: number | null; produtos: number | null };
};

const DIA = 86_400_000;
const MAX_POR_TIPO = 3;

export const STATUS_OS_ENCERRADA = ["entregue", "faturado", "cancelado", "reprovado"];

const ROTULO_STATUS: Record<string, string> = {
  recebido: "Recebido",
  em_analise: "Em análise",
  orcamento: "Orçamento",
  aprovado: "Aprovado",
  em_reparo: "Em reparo",
};

export function diasDesde(iso: string, agora: Date): number {
  return Math.floor((agora.getTime() - new Date(iso).getTime()) / DIA);
}

/** "AAAA-MM-DD" de hoje no fuso do navegador. */
export function hojeLocal(agora: Date): string {
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${m}-${d}`;
}

function plural(n: number, um: string, varios: string) {
  return n === 1 ? um : varios;
}

function dias(n: number) {
  return `${n} ${plural(n, "dia", "dias")}`;
}

function reais(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function soma(itens: { valor: number }[]) {
  return itens.reduce((t, i) => t + (Number(i.valor) || 0), 0);
}

function dataCurta(iso: string) {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

function nomeOs(os: OsAssistente) {
  const cliente = os.cliente ? ` de ${os.cliente.split(/\s+/)[0]}` : "";
  return `OS #${os.numero} (${os.aparelho}${cliente})`;
}

function abrirOs(os: OsAssistente): AcaoSugestao {
  return { rotulo: "Abrir OS", to: "/ordens", search: { os: os.id } };
}

/** Uma OS gera no máximo uma sugestão: a mais específica que se aplica. */
function sugestaoDaOs(os: OsAssistente, agora: Date): Sugestao | null {
  const parada = diasDesde(os.updated_at, agora);
  const hoje = hojeLocal(agora);
  const base = { categoria: "os" as const, chave: `os:${os.id}:${os.status}` };

  if (os.status === "aguardando_aprovacao" && parada >= 2) {
    return {
      ...base,
      prioridade: 1,
      titulo: `Orçamento sem resposta há ${dias(parada)}`,
      pergunta: `O cliente ainda não respondeu o orçamento da ${nomeOs(os)}. Quer cobrar uma resposta?`,
      acoes: [abrirOs(os)],
    };
  }
  if (os.previsao && os.previsao < hoje && os.status !== "pronto") {
    return {
      ...base,
      chave: `${base.chave}:previsao:${os.previsao}`,
      prioridade: 1,
      titulo: "Previsão de entrega vencida",
      pergunta: `A previsão da ${nomeOs(os)} era ${dataCurta(os.previsao)}. Quer atualizar o prazo e avisar o cliente?`,
      acoes: [abrirOs(os)],
    };
  }
  if (os.status === "aguardando_peca" && parada >= 5) {
    return {
      ...base,
      prioridade: 2,
      titulo: `Aguardando peça há ${dias(parada)}`,
      pergunta: `A ${nomeOs(os)} está esperando peça há ${dias(parada)}. Quer consultar um fornecedor?`,
      acoes: [abrirOs(os), { rotulo: "Consultar fornecedor", to: "/fornecedores" }],
    };
  }
  if (os.status in ROTULO_STATUS && parada >= 3) {
    return {
      ...base,
      prioridade: 2,
      titulo: `OS parada há ${dias(parada)}`,
      pergunta: `A ${nomeOs(os)} está em "${ROTULO_STATUS[os.status]}" sem movimentação há ${dias(parada)}. Quer dar andamento?`,
      acoes: [abrirOs(os)],
    };
  }
  if (os.status === "pronto" && parada >= 2) {
    return {
      ...base,
      prioridade: 2,
      titulo: `Pronta há ${dias(parada)} e não retirada`,
      pergunta: `A ${nomeOs(os)} está pronta há ${dias(parada)}. Quer lembrar o cliente de buscar?`,
      acoes: [abrirOs(os)],
    };
  }
  return null;
}

function sugestoesDeOs(lista: OsAssistente[], agora: Date): Sugestao[] {
  // As mais antigas primeiro; o que passar de 3 vira um resumo.
  const todas = [...lista]
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .map((os) => sugestaoDaOs(os, agora))
    .filter((s): s is Sugestao => s !== null);
  if (todas.length <= MAX_POR_TIPO) return todas;
  const restantes = todas.length - MAX_POR_TIPO;
  return [
    ...todas.slice(0, MAX_POR_TIPO),
    {
      chave: `os:mais:${restantes}`,
      categoria: "os",
      prioridade: 2,
      titulo: `Mais ${restantes} ${plural(restantes, "OS precisa", "OS precisam")} de atenção`,
      pergunta: "Tem outras ordens paradas ou atrasadas. Quer ver a lista de OS?",
      acoes: [{ rotulo: "Ver ordens", to: "/ordens" }],
    },
  ];
}

const DICAS: { titulo: string; pergunta: string; acao: AcaoSugestao }[] = [
  {
    titulo: "Atalho: F8 abre o PDV",
    pergunta: "No balcão, aperte F8 para vender rápido, com leitor de código de barras.",
    acao: { rotulo: "Abrir PDV", to: "/pdv" },
  },
  {
    titulo: "Atalho: F4 abre as OS",
    pergunta: "F1 Clientes, F2 Produtos, F3 Serviços, F4 OS, F6 Vendas. Quer experimentar?",
    acao: { rotulo: "Abrir OS", to: "/ordens" },
  },
  {
    titulo: "Buscador de películas",
    pergunta: "Na bancada, encontre a película compatível pelo modelo do aparelho.",
    acao: { rotulo: "Abrir ferramentas", to: "/ferramentas" },
  },
  {
    titulo: "Respostas rápidas no WhatsApp",
    pergunta: "Na central do WhatsApp, digite / para usar uma resposta pronta.",
    acao: { rotulo: "Abrir WhatsApp", to: "/whatsapp" },
  },
  {
    titulo: "Termo de garantia",
    pergunta: "Gere e imprima o termo de garantia de cada serviço entregue.",
    acao: { rotulo: "Ver garantias", to: "/garantia" },
  },
  {
    titulo: "Relatórios do mês",
    pergunta: "Veja faturamento, lucro e os serviços que mais saem.",
    acao: { rotulo: "Abrir relatórios", to: "/relatorios" },
  },
];

function sugestoesDeDicas(dados: DadosAssistente, agora: Date): Sugestao[] {
  const { totais } = dados;
  const primeiros: Sugestao[] = [];
  if (totais.clientes === 0) {
    primeiros.push({
      chave: "dica:primeiro-cliente",
      categoria: "dicas",
      prioridade: 3,
      titulo: "Comece pelos clientes",
      pergunta: "Ainda não há clientes cadastrados. Quer cadastrar o primeiro?",
      acoes: [{ rotulo: "Cadastrar cliente", to: "/clientes" }],
    });
  }
  if (totais.os === 0) {
    primeiros.push({
      chave: "dica:primeira-os",
      categoria: "dicas",
      prioridade: 3,
      titulo: "Primeira ordem de serviço",
      pergunta: "Quer abrir sua primeira OS? Dá para fazer com o cliente no balcão.",
      acoes: [{ rotulo: "Abrir OS", to: "/ordens" }],
    });
  }
  if (totais.produtos === 0) {
    primeiros.push({
      chave: "dica:primeiro-produto",
      categoria: "dicas",
      prioridade: 3,
      titulo: "Cadastre seus produtos",
      pergunta: "Cadastre peças e acessórios para controlar o estoque e vender no PDV.",
      acoes: [{ rotulo: "Cadastrar produto", to: "/estoque" }],
    });
  }
  if (primeiros.length) return primeiros;

  // Uma dica por dia, sempre a mesma no mesmo dia.
  const indice = Math.floor(agora.getTime() / DIA) % DICAS.length;
  const dica = DICAS[indice]!;
  return [
    {
      chave: `dica:${hojeLocal(agora)}`,
      categoria: "dicas",
      prioridade: 3,
      titulo: dica.titulo,
      pergunta: dica.pergunta,
      acoes: [dica.acao],
    },
  ];
}

export function montarSugestoes(dados: DadosAssistente, agora: Date = new Date()): Sugestao[] {
  const lista: Sugestao[] = [];

  if (dados.reclamacoes) {
    const n = dados.reclamacoes;
    lista.push({
      chave: `reclamacoes:${n}`,
      categoria: "whatsapp",
      prioridade: 1,
      titulo: `${n} ${plural(n, "reclamação", "reclamações")} na pesquisa de satisfação`,
      pergunta: "Um cliente não ficou satisfeito. Quer ver e entrar em contato?",
      acoes: [{ rotulo: "Ver reclamações", to: "/whatsapp-conexao" }],
    });
  }
  if (dados.whatsappNaoLidas) {
    const n = dados.whatsappNaoLidas;
    lista.push({
      chave: `whatsapp:${n}`,
      categoria: "whatsapp",
      prioridade: 1,
      titulo: `${n} ${plural(n, "conversa esperando", "conversas esperando")} resposta`,
      pergunta: "Tem cliente aguardando no WhatsApp. Quer responder agora?",
      acoes: [{ rotulo: "Abrir WhatsApp", to: "/whatsapp" }],
    });
  }

  if (dados.os) lista.push(...sugestoesDeOs(dados.os, agora));

  if (dados.cobrancasVencidas?.length) {
    const n = dados.cobrancasVencidas.length;
    lista.push({
      chave: `cobrancas:${n}`,
      categoria: "financeiro",
      prioridade: 1,
      titulo: `${n} ${plural(n, "cobrança vencida", "cobranças vencidas")}`,
      pergunta: `São ${reais(soma(dados.cobrancasVencidas))} em cobranças Pix que venceram sem pagamento. Quer ver e reenviar?`,
      acoes: [{ rotulo: "Ver cobranças", to: "/cobrancas" }],
    });
  }
  if (dados.contasPagarVencidas?.length) {
    const n = dados.contasPagarVencidas.length;
    lista.push({
      chave: `pagar:${hojeLocal(agora)}:${n}`,
      categoria: "financeiro",
      prioridade: 1,
      titulo: `${n} ${plural(n, "conta a pagar vence", "contas a pagar vencem")} hoje ou já ${plural(n, "venceu", "venceram")}`,
      pergunta: `Total de ${reais(soma(dados.contasPagarVencidas))}. Quer conferir no financeiro?`,
      acoes: [{ rotulo: "Abrir financeiro", to: "/financeiro" }],
    });
  }
  if (dados.receberAtrasados?.length) {
    const n = dados.receberAtrasados.length;
    lista.push({
      chave: `receber:${hojeLocal(agora)}:${n}`,
      categoria: "financeiro",
      prioridade: 2,
      titulo: `${n} ${plural(n, "recebimento atrasado", "recebimentos atrasados")}`,
      pergunta: `${reais(soma(dados.receberAtrasados))} a receber já passaram do vencimento. Quer cobrar?`,
      acoes: [{ rotulo: "Abrir financeiro", to: "/financeiro" }],
    });
  }

  if (dados.estoqueBaixo?.length) {
    const n = dados.estoqueBaixo.length;
    const nomes = dados.estoqueBaixo
      .slice(0, 3)
      .map((p) => p.nome)
      .join(", ");
    lista.push({
      chave: `estoque:${n}`,
      categoria: "estoque",
      prioridade: 2,
      titulo: `${n} ${plural(n, "produto abaixo", "produtos abaixo")} do mínimo`,
      pergunta: `${nomes}${n > 3 ? " e outros" : ""}. Quer fazer um pedido de compra?`,
      acoes: [
        { rotulo: "Ver estoque", to: "/estoque" },
        { rotulo: "Nova compra", to: "/compras" },
      ],
    });
  }

  if (dados.agendaHoje?.length) {
    const n = dados.agendaHoje.length;
    const proximo = [...dados.agendaHoje].sort((a, b) => a.inicio.localeCompare(b.inicio))[0]!;
    const hora = new Date(proximo.inicio).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    lista.push({
      chave: `agenda:${hojeLocal(agora)}:${n}`,
      categoria: "agenda",
      prioridade: 2,
      titulo: `${n} ${plural(n, "compromisso", "compromissos")} hoje`,
      pergunta: `O próximo é às ${hora}: ${proximo.titulo}. Quer abrir a agenda?`,
      acoes: [{ rotulo: "Abrir agenda", to: "/agenda" }],
    });
  }

  lista.push(...sugestoesDeDicas(dados, agora));

  // Estável: dentro da mesma prioridade mantém a ordem acima.
  return lista
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.prioridade - b.s.prioridade || a.i - b.i)
    .map(({ s }) => s);
}

export type PreferenciasAssistente = {
  ativo: boolean;
  categorias_desligadas: string[];
  silenciado_ate: string | null;
  dispensados: Record<string, string>;
};

export const PREFERENCIAS_PADRAO: PreferenciasAssistente = {
  ativo: true,
  categorias_desligadas: [],
  silenciado_ate: null,
  dispensados: {},
};

/** O que sobra para mostrar depois das escolhas da pessoa. */
export function filtrarSugestoes(
  sugestoes: Sugestao[],
  prefs: PreferenciasAssistente,
  agora: Date = new Date(),
): Sugestao[] {
  if (!prefs.ativo) return [];
  const agoraIso = agora.toISOString();
  return sugestoes.filter((s) => {
    if (prefs.categorias_desligadas.includes(s.categoria)) return false;
    const ate = prefs.dispensados[s.chave];
    return !ate || ate <= agoraIso;
  });
}

export function silenciado(prefs: PreferenciasAssistente, agora: Date = new Date()): boolean {
  return !!prefs.silenciado_ate && prefs.silenciado_ate > agora.toISOString();
}

/** Marca uma sugestão como dispensada e joga fora as que já expiraram. */
export function dispensar(
  dispensados: Record<string, string>,
  chave: string,
  ate: Date,
  agora: Date = new Date(),
): Record<string, string> {
  const agoraIso = agora.toISOString();
  const limpo: Record<string, string> = {};
  for (const [k, v] of Object.entries(dispensados)) {
    if (v > agoraIso) limpo[k] = v;
  }
  limpo[chave] = ate.toISOString();
  return limpo;
}

/** Fim do dia de hoje no fuso do navegador ("silenciar por hoje"). */
export function fimDoDia(agora: Date = new Date()): Date {
  const fim = new Date(agora);
  fim.setHours(23, 59, 59, 999);
  return fim;
}
