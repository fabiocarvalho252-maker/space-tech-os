// Leitura dos arquivos de marketing (pasta marketing/ na raiz do projeto) —
// funções puras, sem acesso a disco, usadas pelo servidor (leitura.server.ts)
// e pela tela /admin/marketing (prévias). O formato dos arquivos está em
// marketing/conteudos/_modelo.md; a conferência dele fica em
// marketing/ferramentas/verificar.mjs.

export const STATUS_MARKETING = [
  "AGUARDANDO APROVAÇÃO",
  "APROVADO",
  "PUBLICADO",
  "RASCUNHO",
] as const;
export type StatusMarketing = (typeof STATUS_MARKETING)[number];

// Pasta → status esperado (o fluxo do marketing/README.md).
export const PASTAS_MARKETING = {
  conteudos: "RASCUNHO",
  aprovacao: "AGUARDANDO APROVAÇÃO",
  aprovados: "APROVADO",
  publicados: "PUBLICADO",
} as const satisfies Record<string, StatusMarketing>;
export type PastaMarketing = keyof typeof PASTAS_MARKETING;

export type CampoMarketing = { rotulo: string; valor: string };

export type ConteudoMarketing = {
  arquivo: string;
  pasta: PastaMarketing;
  id: string;
  titulo: string;
  status: StatusMarketing | null;
  plataforma: string;
  formato: string;
  objetivo: string;
  dataSugerida: string;
  campos: CampoMarketing[];
  links: { rotulo: string; url: string }[];
  // Texto entre os campos e a primeira seção (pré-requisitos, regras, aviso
  // de anúncio pago), em Markdown.
  notas: string;
  // Título da seção ("Texto pronto para publicar") → corpo em Markdown.
  secoes: Record<string, string>;
  aprovacao: {
    aprovadoPor: string;
    data: string;
    plataformas: string;
    observacoes: string;
  };
  publicacao: { dataHora: string; link: string };
  anuncioPago: boolean;
  atualizadoEm: string;
  // Vídeo/capa gerados em marketing/midia/<ID>/ (links assinados e
  // temporários; preenchido só no servidor, para o administrador).
  midia?: {
    video?: { url: string; atualizadoEm: string; tamanho: number };
    capa?: string;
    slides?: string[];
  };
};

export const SECAO_TEXTO = "Texto pronto para publicar";
export const SECAO_CTA = "Chamada para ação";
export const SECAO_ARTE = "Ideia de arte ou roteiro";
export const SECAO_FATOS = "Fatos usados";

function linhaDoBloco(bloco: string, rotulo: string): string {
  const m = bloco.match(new RegExp(`^- ${rotulo}:[ \\t]*(.*)$`, "m"));
  return m?.[1]?.trim() ?? "";
}

export function lerConteudoMarketing(
  texto: string,
  pasta: PastaMarketing,
  arquivo: string,
  atualizadoEm = "",
): ConteudoMarketing {
  const normalizado = texto.replace(/\r\n/g, "\n");
  const inicioSecoes = normalizado.search(/^## /m);
  const cabecalho = inicioSecoes === -1 ? normalizado : normalizado.slice(0, inicioSecoes);
  const corpo = inicioSecoes === -1 ? "" : normalizado.slice(inicioSecoes);

  const h1 = cabecalho.match(/^# (.+)$/m)?.[1]?.trim() ?? arquivo;
  const campos: CampoMarketing[] = [];
  const notas: string[] = [];
  for (const linha of cabecalho.split("\n")) {
    if (linha.startsWith("# ")) continue;
    const m = linha.match(/^- \*\*(.+?):\*\*[ \t]*(.*)$/);
    if (m) campos.push({ rotulo: m[1]!.trim(), valor: m[2]!.trim() });
    else notas.push(linha);
  }
  const campo = (nome: string) =>
    campos.find((c) => c.rotulo.toLowerCase() === nome.toLowerCase())?.valor ?? "";

  const links = campos
    .filter((c) => /^link/i.test(c.rotulo) && /^https?:\/\//.test(c.valor))
    .map((c) => ({
      rotulo: c.rotulo.replace(/^link\s*/i, "").replace(/^\((.*)\)$/, "$1") || "Link",
      url: c.valor,
    }));

  const secoes: Record<string, string> = {};
  for (const parte of corpo.split(/^## /m).slice(1)) {
    const quebra = parte.indexOf("\n");
    const titulo = (quebra === -1 ? parte : parte.slice(0, quebra)).trim();
    secoes[titulo] = (quebra === -1 ? "" : parte.slice(quebra + 1)).trim();
  }

  const id = campo("ID") || arquivo.replace(/\.md$/, "");
  const statusBruto = campo("Status");
  const status = (STATUS_MARKETING as readonly string[]).includes(statusBruto)
    ? (statusBruto as StatusMarketing)
    : null;
  const blocoAprov = secoes["Aprovação"] ?? "";
  const blocoPub = secoes["Publicação"] ?? "";

  return {
    arquivo,
    pasta,
    id,
    // "# IG-01 — Carrossel: ..." → "Carrossel: ..."
    titulo: h1.replace(new RegExp(`^${id.replace(/[-]/g, "\\-")}\\s*[—–-]\\s*`), ""),
    status,
    plataforma: campo("Plataforma"),
    formato: campo("Formato"),
    objetivo: campo("Objetivo"),
    dataSugerida: campo("Data sugerida"),
    campos,
    links,
    notas: notas.join("\n").trim(),
    secoes,
    aprovacao: {
      aprovadoPor: linhaDoBloco(blocoAprov, "Aprovado por"),
      data: linhaDoBloco(blocoAprov, "Data da aprovação"),
      plataformas: linhaDoBloco(blocoAprov, "Plataformas autorizadas"),
      observacoes: linhaDoBloco(blocoAprov, "Observações"),
    },
    publicacao: {
      dataHora: linhaDoBloco(blocoPub, "Data e hora"),
      link: linhaDoBloco(blocoPub, "Link do post"),
    },
    anuncioPago: /an[úu]ncio pago/i.test(normalizado),
    atualizadoEm,
  };
}

// ---------------------------------------------------------------------------
// Extração para as prévias visuais (a partir de "Ideia de arte ou roteiro").

const ASPAS = /["“]([^"”]{2,160})["”]/g;

export function textosEntreAspas(texto: string): string[] {
  return (
    [...texto.matchAll(ASPAS)]
      .map((m) => m[1]!.trim())
      // "dados ilustrativos" é aviso de rodapé, não título da arte.
      .filter((t) => !/^(dados|valores) ilustrativos$/i.test(t))
  );
}

function semMarcacao(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export type SlidePrevia = { titulo: string; descricao: string };

// Lista numerada ("1. Capa: ... texto "X"...") → um slide por item. O título
// é o primeiro texto entre aspas; sem aspas, o trecho antes do primeiro "—"
// ou ":".
export function extrairSlides(arte: string): SlidePrevia[] {
  const slides: SlidePrevia[] = [];
  for (const linha of arte.split("\n")) {
    const m = linha.match(/^\s*\d+\.\s+(.+)$/);
    if (!m) continue;
    const descricao = semMarcacao(m[1]!);
    const aspas = textosEntreAspas(descricao);
    let titulo = aspas[0] ?? "";
    if (!titulo) {
      const corte = descricao.split(/\s[—–]\s|:\s/)[0] ?? descricao;
      titulo = corte.length > 70 ? `${corte.slice(0, 67)}…` : corte;
    }
    slides.push({ titulo, descricao });
  }
  return slides;
}

export type CenaPrevia = { tempo: string; textoNaTela: string; descricao: string };

// Itens "- **0–3 s (gancho):** descrição" → cenas do vídeo. O texto na tela é
// o que vem entre aspas (de preferência depois de "texto"), senão a própria
// descrição resumida.
export function extrairCenas(arte: string): CenaPrevia[] {
  const cenas: CenaPrevia[] = [];
  for (const linha of arte.split("\n")) {
    const m = linha.match(/^\s*[-*]\s+\*\*([^*]+?):?\*\*:?\s*(.+)$/);
    if (!m) continue;
    const tempo = m[1]!.replace(/:$/, "").trim();
    if (!/\d/.test(tempo) && !/tela dividida|final/i.test(tempo)) continue;
    const descricao = semMarcacao(m[2]!);
    const depoisDeTexto = descricao.match(/texto(?: na tela| final)?:?\s*["“]([^"”]+)["”]/i)?.[1];
    const aspas = textosEntreAspas(descricao);
    const resumo = descricao.length > 90 ? `${descricao.slice(0, 87)}…` : descricao;
    cenas.push({ tempo, textoNaTela: depoisDeTexto ?? aspas[0] ?? resumo, descricao });
  }
  return cenas;
}

// Lista numerada logo depois de uma linha "**Títulos ...**" (anúncio de
// pesquisa): devolve os itens.
export function extrairListaApos(texto: string, cabecalho: RegExp): string[] {
  const linhas = texto.split("\n");
  const inicio = linhas.findIndex((l) => cabecalho.test(l));
  if (inicio === -1) return [];
  const itens: string[] = [];
  for (const linha of linhas.slice(inicio + 1)) {
    const m = linha.match(/^\s*\d+\.\s+(.+)$/);
    if (m) itens.push(semMarcacao(m[1]!));
    else if (itens.length && linha.trim()) break;
  }
  return itens;
}

export type TipoPrevia =
  "carrossel" | "video" | "imagem" | "whatsapp" | "anuncio-pesquisa" | "perfil-google";

export function tipoPrevia(c: Pick<ConteudoMarketing, "formato" | "plataforma">): TipoPrevia {
  const f = c.formato.toLowerCase();
  const p = c.plataforma.toLowerCase();
  if (f.includes("pesquisa")) return "anuncio-pesquisa";
  if (f.includes("carrossel")) return "carrossel";
  if (f.includes("vídeo") || f.includes("video") || f.includes("reels")) return "video";
  if (p.includes("perfil da empresa")) return "perfil-google";
  if (p.startsWith("whatsapp") || f.includes("mensagem")) return "whatsapp";
  return "imagem";
}

// Próximo passo explicado para cada status (mostrado no detalhe).
export function proximoPasso(
  c: Pick<ConteudoMarketing, "status" | "id" | "plataforma" | "anuncioPago" | "aprovacao">,
): string {
  switch (c.status) {
    case "RASCUNHO":
      return c.anuncioPago
        ? "Rascunho de anúncio pago. Além de aprovar o texto, é preciso autorizar orçamento, conta de anúncios e público. Nada é gasto sem a sua ordem."
        : "Ainda em elaboração. Quando ficar pronto, vai para “Aguardando aprovação”.";
    case "AGUARDANDO APROVAÇÃO":
      return `Para aprovar, marque as plataformas em “Sua decisão” e clique em Aprovar (ou diga ao Claude: “Aprovo o ${c.id} para …”). Pode ser só algumas de: ${c.plataforma}. Para pedir mudança, use Recusar com o motivo.`;
    case "APROVADO":
      return `Aprovado para ${c.aprovacao.plataformas || "as plataformas registradas"}. Falta produzir a arte/vídeo e você dar a ordem de publicar — aprovar não publica.`;
    case "PUBLICADO":
      return "Publicado. Os números deste conteúdo entram em Resultados 7 dias depois da publicação.";
    default:
      return "Status não reconhecido no arquivo — confira o campo Status.";
  }
}

// ---------------------------------------------------------------------------
// Decisão do administrador em /admin/marketing (aprovar / recusar). Funções
// puras sobre o texto do arquivo; quem grava é decisao.server.ts.

// "Instagram (feed) + Facebook (página) + WhatsApp Status (mesma arte)" →
// ["Instagram (feed)", "Facebook (página)", "WhatsApp Status (mesma arte)"].
export function opcoesPlataforma(plataforma: string): string[] {
  return plataforma
    .split(/\s\+\s/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function trocarLinha(texto: string, rotulo: string, valor: string): string {
  const re = new RegExp(`^- ${rotulo}:.*$`, "m");
  if (!re.test(texto)) throw new Error(`O arquivo não tem a linha "- ${rotulo}:".`);
  return texto.replace(re, () => `- ${rotulo}: ${valor}`);
}

function trocarStatus(texto: string, de: StatusMarketing, para: StatusMarketing): string {
  const re = new RegExp(`^- \\*\\*Status:\\*\\* ${de}$`, "m");
  if (!re.test(texto)) throw new Error(`O conteúdo não está com status ${de}.`);
  return texto.replace(re, `- **Status:** ${para}`);
}

// Uma linha só, sem "|" (que quebraria a tabela do registro).
export function textoUmaLinha(valor: string, max = 300): string {
  return valor
    .replace(/[\r\n|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function aplicarAprovacao(
  texto: string,
  d: { quem: string; quando: string; plataformas: string[]; todas: string[]; anuncioPago: boolean },
): string {
  if (!d.plataformas.length) throw new Error("Marque ao menos uma plataforma.");
  const fora = d.todas.filter((p) => !d.plataformas.includes(p));
  const obs = [
    "aprovação só deste conteúdo, sem alteração no texto.",
    fora.length ? `NÃO autorizadas: ${fora.join(", ")}.` : "",
    d.anuncioPago ? "Anúncio pago: orçamento NÃO autorizado." : "",
    "Aprovar não autoriza publicar: a publicação depende de uma ordem sua.",
  ]
    .filter(Boolean)
    .join(" ");
  let t = trocarStatus(texto, "AGUARDANDO APROVAÇÃO", "APROVADO");
  t = trocarLinha(t, "Aprovado por", d.quem);
  t = trocarLinha(t, "Data da aprovação", d.quando);
  t = trocarLinha(t, "Plataformas autorizadas", d.plataformas.join(", "));
  t = trocarLinha(t, "Observações", obs);
  return t;
}

export function aplicarRecusa(
  texto: string,
  d: { quem: string; quando: string; motivo: string },
): string {
  let t = trocarStatus(texto, "AGUARDANDO APROVAÇÃO", "RASCUNHO");
  t = trocarLinha(t, "Aprovado por", "");
  t = trocarLinha(t, "Data da aprovação", "");
  t = trocarLinha(t, "Plataformas autorizadas", "");
  t = trocarLinha(
    t,
    "Observações",
    `RECUSADO em ${d.quando} por ${d.quem}.${d.motivo ? ` Motivo: ${d.motivo}` : " Sem motivo informado."}`,
  );
  return t;
}
