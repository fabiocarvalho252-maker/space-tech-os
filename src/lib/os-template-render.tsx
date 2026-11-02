// Shared HTML render engine for "Modelos de OS" — the single place that
// turns an os_templates row + OS data into the actual A4 document, reused
// by three callers that used to each hardcode their own copy of this HTML:
// ordens.tsx's imprimir() (print popup), the "Modelos de OS" library's
// preview modal/thumbnails (against sample data), and — indirectly, via its
// section-visibility flags — os-pdf.server.ts's PDF generator. Client-safe
// (uses react-dom/server's renderToString the same way ordens.tsx already
// did for the QR code before this file existed).
import { renderToString } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { dataHoraBR } from "@/lib/format";

export type OsTemplateTema = "azul" | "verde" | "roxo" | "preto" | "vermelho" | "minimalista";
export type OsTemplateOrientacao = "retrato" | "paisagem";
export type OsTemplateFotosLayout = "0" | "2" | "4" | "6" | "grande";

export type OsTemplateSecao =
  | "cabecalho"
  | "cliente"
  | "aparelho"
  | "defeito"
  | "diagnostico"
  | "checklist"
  | "estado_fisico"
  | "itens"
  | "valores"
  | "garantia"
  | "termos"
  | "fotos"
  | "qrcode"
  | "assinaturas"
  | "quebra_pagina";

export const SECAO_LABEL: Record<OsTemplateSecao, string> = {
  cabecalho: "Cabeçalho",
  cliente: "Dados do cliente",
  aparelho: "Dados do aparelho",
  defeito: "Defeito relatado",
  diagnostico: "Diagnóstico técnico",
  checklist: "Checklist de entrada",
  estado_fisico: "Estado físico",
  itens: "Produtos e serviços",
  valores: "Valores",
  garantia: "Garantia",
  termos: "Termos e condições",
  fotos: "Fotos",
  qrcode: "QR Code",
  assinaturas: "Assinaturas",
  quebra_pagina: "Quebra de página",
};

// Sections every template always has, whether or not the user included them
// in `secoes` — a cabeçalho/valores you can't remove keeps every document
// legible and matches "não remover" from the request that inspired this.
const SECOES_OBRIGATORIAS: OsTemplateSecao[] = ["cabecalho", "valores"];

export type OsTemplateConfig = {
  secoes: OsTemplateSecao[];
  fotos_layout: OsTemplateFotosLayout;
};

/** Tipo de documento do modelo (Configurações → Modelos): cada tipo tem o seu padrão. */
export type OsTemplateUso = "os" | "orcamento" | "venda_aparelho";

export const USO_LABEL: Record<OsTemplateUso, string> = {
  os: "Faturamento (OS)",
  orcamento: "Orçamento",
  venda_aparelho: "Venda de aparelho",
};

/** Seções que cada tipo de documento pode ter (o editor só oferece estas). */
export const SECOES_POR_USO: Record<OsTemplateUso, OsTemplateSecao[]> = {
  os: [
    "cabecalho",
    "cliente",
    "aparelho",
    "defeito",
    "diagnostico",
    "checklist",
    "estado_fisico",
    "itens",
    "valores",
    "garantia",
    "termos",
    "fotos",
    "qrcode",
    "assinaturas",
    "quebra_pagina",
  ],
  orcamento: [
    "cabecalho",
    "cliente",
    "aparelho",
    "defeito",
    "diagnostico",
    "checklist",
    "estado_fisico",
    "itens",
    "valores",
    "fotos",
    "qrcode",
    "assinaturas",
    "quebra_pagina",
  ],
  venda_aparelho: [
    "cabecalho",
    "cliente",
    "aparelho",
    "valores",
    "garantia",
    "termos",
    "assinaturas",
    "quebra_pagina",
  ],
};

export type OsTemplateRow = {
  id: string;
  uso?: OsTemplateUso;
  nome: string;
  categoria: string;
  orientacao: OsTemplateOrientacao;
  paginas: number;
  tema: OsTemplateTema;
  config: OsTemplateConfig;
};

// Used by every caller (print popup, PDF generator) when the empresa hasn't
// visited "Configurações → Modelos de OS" yet, so os_templates has no rows
// for it — the same layout imprimir() always used before the template
// library existed, kept as the zero-setup default.
export const FALLBACK_TEMPLATE: OsTemplateRow = {
  id: "fallback",
  nome: "Padrão",
  categoria: "profissional",
  orientacao: "retrato",
  paginas: 1,
  tema: "roxo",
  config: {
    secoes: [
      "cabecalho",
      "cliente",
      "aparelho",
      "defeito",
      "diagnostico",
      "checklist",
      "estado_fisico",
      "itens",
      "valores",
      "garantia",
      "termos",
      "fotos",
      "qrcode",
      "assinaturas",
    ],
    fotos_layout: "0",
  },
};

/** Sem nenhum modelo do tipo: layout padrão de cada documento. */
export const FALLBACK_TEMPLATE_POR_USO: Record<OsTemplateUso, OsTemplateRow> = {
  os: FALLBACK_TEMPLATE,
  orcamento: {
    ...FALLBACK_TEMPLATE,
    uso: "orcamento",
    config: {
      secoes: [
        "cabecalho",
        "cliente",
        "aparelho",
        "defeito",
        "diagnostico",
        "estado_fisico",
        "itens",
        "valores",
        "qrcode",
        "assinaturas",
      ],
      fotos_layout: "0",
    },
  },
  venda_aparelho: {
    ...FALLBACK_TEMPLATE,
    uso: "venda_aparelho",
    config: {
      secoes: ["cabecalho", "cliente", "aparelho", "valores", "garantia", "termos", "assinaturas"],
      fotos_layout: "0",
    },
  },
};

export const TEMA_LABEL: Record<OsTemplateTema, string> = {
  azul: "Azul",
  verde: "Verde",
  roxo: "Roxo",
  preto: "Preto",
  vermelho: "Vermelho",
  minimalista: "Minimalista",
};

const TEMA_COR: Record<OsTemplateTema, { accent: string; accentSoft: string; text: string }> = {
  azul: { accent: "#2563eb", accentSoft: "#eff6ff", text: "#1e293b" },
  verde: { accent: "#16a34a", accentSoft: "#f0fdf4", text: "#1e293b" },
  roxo: { accent: "#4f46e5", accentSoft: "#eef2ff", text: "#1b1b2b" },
  preto: { accent: "#111827", accentSoft: "#f3f4f6", text: "#111827" },
  vermelho: { accent: "#dc2626", accentSoft: "#fef2f2", text: "#1e293b" },
  minimalista: { accent: "#374151", accentSoft: "#ffffff", text: "#111827" },
};

/** Same rgb() triplets as TEMA_COR's accent, for callers (pdf-lib) that need numeric components instead of a CSS hex string. */
export const TEMA_RGB: Record<OsTemplateTema, { r: number; g: number; b: number }> = {
  azul: { r: 0.145, g: 0.388, b: 0.922 },
  verde: { r: 0.086, g: 0.639, b: 0.29 },
  roxo: { r: 0.31, g: 0.27, b: 0.9 },
  preto: { r: 0.067, g: 0.094, b: 0.153 },
  vermelho: { r: 0.863, g: 0.149, b: 0.149 },
  minimalista: { r: 0.216, g: 0.255, b: 0.318 },
};

export type RenderOsFoto = { src: string; category: string };

export type RenderOsData = {
  numero: number | string;
  statusLabel: string;
  createdAt: string;
  cliente: { nome: string; telefone: string | null } | null;
  aparelho: string;
  marca: string | null;
  modelo: string | null;
  imei: string | null;
  serialNumber: string | null;
  cor: string | null;
  senhaDispositivo: string | null;
  padraoDesbloqueio: string | null;
  defeito: string | null;
  diagnostico: string | null;
  itens: { descricao: string; tipo: string; quantidade: number; precoUnitario: number }[];
  valor: number;
  desconto: number;
  garantiaDias: number | null;
  garantiaVencimento: string | null;
  checklist: Record<string, string>;
  estadoFisico: Record<string, boolean>;
  estadoFisicoObs: string | null;
  acessorios: string | null;
  fotos: RenderOsFoto[];
  assinaturaClienteSrc: string | null;
  assinaturaTecnicoSrc: string | null;
  /** Nome de quem finalizou a OS (assinou pela loja). */
  assinaturaTecnicoNome?: string | null;
  termoGarantiaTexto: string | null;
  condicoesTexto: string | null;
  empresa: {
    nome: string;
    logoUrl: string | null;
    cnpj: string | null;
    endereco: string | null;
    telefone: string | null;
    responsavel: string | null;
  };
  qrCodeUrl: string | null;
  modo: "os" | "orcamento" | "nao_fiscal" | "venda_aparelho";
  duasVias: boolean;
};

const CHECKLIST_LABELS: Record<string, string> = {
  liga: "Liga",
  desliga: "Desliga",
  tela: "Tela",
  touch: "Touch",
  cameras: "Câmeras",
  flash: "Flash",
  alto_falante: "Alto-falante",
  microfone: "Microfone",
  vibracao: "Vibração",
  wifi: "Wi-Fi",
  bluetooth: "Bluetooth",
  rede_movel: "Rede móvel",
  carregamento: "Carregamento",
  biometria: "Biometria",
  face_id: "Face ID",
  botoes: "Botões",
  sensores: "Sensores",
  nfc: "NFC",
};
const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  ok: "OK",
  defeito: "Defeito",
  nao_testado: "Não testado",
  nao_se_aplica: "N/A",
};
const ESTADO_FISICO_LABELS: Record<string, string> = {
  tela_trincada: "Tela trincada",
  tela_riscada: "Tela riscada",
  tampa_quebrada: "Tampa traseira quebrada",
  carcaca_amassada: "Carcaça amassada",
  camera_danificada: "Câmera danificada",
  oxidacao: "Oxidação",
  sinais_liquido: "Sinais de líquido",
  parafusos_ausentes: "Parafusos ausentes",
  lacre_violado: "Lacre violado",
  outros: "Outros",
};

function tituloDocumento(modo: RenderOsData["modo"]) {
  return modo === "orcamento"
    ? "Orçamento"
    : modo === "venda_aparelho"
      ? "Venda de aparelho"
      : "Ordem de Serviço";
}

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
const dataBR = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";
const esc = (v: string | null | undefined) =>
  (v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function fotosGridColunas(layout: OsTemplateFotosLayout): number {
  if (layout === "grande") return 2;
  if (layout === "6") return 3;
  if (layout === "4") return 2;
  return 3;
}

function renderSecao(
  secao: OsTemplateSecao,
  d: RenderOsData,
  cfg: OsTemplateConfig,
  cor: { accent: string; accentSoft: string },
): string {
  switch (secao) {
    case "cabecalho":
      return `
        <header class="cabecalho">
          <div class="cabecalho-empresa">
            ${d.empresa.logoUrl ? `<img class="logo" src="${esc(d.empresa.logoUrl)}" alt="Logo" />` : ""}
            <div>
              <h1>${esc(d.empresa.nome)}</h1>
              <p class="empresa-info">
                ${[d.empresa.cnpj, d.empresa.endereco, d.empresa.telefone].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}
              </p>
              ${d.empresa.responsavel ? `<p class="empresa-info">Responsável: ${esc(d.empresa.responsavel)}</p>` : ""}
            </div>
          </div>
          <div class="cabecalho-os">
            <strong>${tituloDocumento(d.modo)} nº ${esc(String(d.numero))}</strong>
            <span>Emissão: ${dataHoraBR(d.createdAt)}</span>
            <span class="status-badge">${esc(d.statusLabel)}</span>
          </div>
        </header>
      `;
    case "cliente":
      return `
        <section class="bloco">
          <h2>Dados do cliente</h2>
          <table>
            <tr><td>Nome</td><td>${esc(d.cliente?.nome) || "—"}</td></tr>
            <tr><td>Telefone</td><td>${esc(d.cliente?.telefone) || "—"}</td></tr>
          </table>
        </section>
      `;
    case "aparelho":
      return `
        <section class="bloco">
          <h2>Dados do aparelho</h2>
          <table>
            <tr><td>Aparelho</td><td>${esc(d.aparelho)} ${esc(d.marca)} ${esc(d.modelo)}</td></tr>
            ${d.cor ? `<tr><td>Cor</td><td>${esc(d.cor)}</td></tr>` : ""}
            ${d.imei ? `<tr><td>IMEI</td><td>${esc(d.imei)}</td></tr>` : ""}
            ${d.serialNumber ? `<tr><td>Número de série</td><td>${esc(d.serialNumber)}</td></tr>` : ""}
            ${
              d.modo === "venda_aparelho"
                ? ""
                : `<tr><td>Senha (PIN)</td><td>${esc(d.senhaDispositivo) || "—"}</td></tr>
            <tr><td>Padrão</td><td>${d.padraoDesbloqueio ? `Sequência: ${esc(d.padraoDesbloqueio)}` : "—"}</td></tr>`
            }
          </table>
        </section>
      `;
    case "defeito":
      return d.defeito
        ? `<section class="bloco"><h2>Defeito relatado</h2><p>${esc(d.defeito)}</p></section>`
        : "";
    case "diagnostico":
      return d.diagnostico
        ? `<section class="bloco"><h2>Diagnóstico técnico</h2><p>${esc(d.diagnostico)}</p></section>`
        : "";
    case "checklist": {
      const itens = Object.keys(CHECKLIST_LABELS).filter((k) => d.checklist[k]);
      if (!itens.length) return "";
      return `
        <section class="bloco">
          <h2>Checklist de Entrada</h2>
          <div class="grid-checklist">
            ${itens
              .map(
                (k) =>
                  `<div>${CHECKLIST_LABELS[k]}: <strong>${CHECKLIST_STATUS_LABELS[d.checklist[k]!] ?? d.checklist[k]}</strong></div>`,
              )
              .join("")}
          </div>
        </section>
      `;
    }
    case "estado_fisico": {
      const marcados = Object.keys(ESTADO_FISICO_LABELS).filter((k) => d.estadoFisico[k]);
      if (!marcados.length && !d.estadoFisicoObs && !d.acessorios) return "";
      return `
        <section class="bloco">
          <h2>Estado Físico do Aparelho</h2>
          <p>${marcados.map((k) => ESTADO_FISICO_LABELS[k]).join(", ") || "Sem avarias marcadas."}</p>
          ${d.estadoFisicoObs ? `<p class="muted">${esc(d.estadoFisicoObs)}</p>` : ""}
          ${d.acessorios ? `<p>Acessórios deixados: <strong>${esc(d.acessorios)}</strong></p>` : ""}
        </section>
      `;
    }
    case "itens":
      if (!d.itens.length) return "";
      return `
        <section class="bloco">
          <h2>Produtos e Serviços</h2>
          <table class="itens">
            <thead><tr><th>Descrição</th><th>Tipo</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead>
            <tbody>
              ${d.itens
                .map(
                  (i) => `
                <tr>
                  <td>${esc(i.descricao)}</td>
                  <td>${i.tipo === "servico" ? "Serviço" : "Produto"}</td>
                  <td>${i.quantidade}</td>
                  <td>${brl(i.precoUnitario)}</td>
                  <td>${brl(i.quantidade * i.precoUnitario)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </section>
      `;
    case "valores":
      return `
        <section class="bloco valores">
          ${d.desconto > 0 ? `<p class="muted">Desconto: ${brl(d.desconto)}</p>` : ""}
          <p class="total">Total: ${brl(d.valor)}</p>
          ${d.modo === "nao_fiscal" ? '<p class="muted">Documento sem valor fiscal.</p>' : ""}
        </section>
      `;
    case "garantia":
      // Garantia só se aplica a um serviço já executado e entregue — antes
      // da aprovação do orçamento não há o que garantir, então mostrar esse
      // bloco fazia o orçamento parecer uma OS já concluída.
      if (d.modo === "orcamento") return "";
      return `
        <section class="bloco">
          <h2>Garantia</h2>
          <p>${d.garantiaDias ? `${d.garantiaDias} dias` : "—"}${d.garantiaVencimento ? ` — válida até ${dataBR(d.garantiaVencimento)}` : ""}</p>
        </section>
      `;
    case "termos":
      // Mesmo raciocínio do case "garantia" acima: termo de garantia e
      // condições descrevem um serviço já realizado, não uma proposta ainda
      // em aprovação.
      if (d.modo === "orcamento") return "";
      // Com o texto de "Condições" (Configurações → OS, o termo do serviço)
      // preenchido, ele é o termo da OS; o termo padrão de Termos de Garantia
      // ("defeitos de fabricação do aparelho") fica para venda de aparelho e
      // só entra aqui quando não há Condições — antes saíam os dois.
      {
        const texto = d.condicoesTexto || d.termoGarantiaTexto;
        return texto
          ? `<section class="bloco"><h2>Termos e condições</h2><div class="termos">${esc(texto)}</div></section>`
          : "";
      }
    case "fotos": {
      const galeria = d.fotos.filter(
        (f) => f.category !== "assinatura_cliente" && f.category !== "assinatura_tecnico",
      );
      if (!galeria.length) return "";
      const cols = fotosGridColunas(cfg.fotos_layout);
      const altura = cfg.fotos_layout === "grande" ? 220 : 120;
      const legenda = (cat: string) =>
        cat === "entrada" ? "Entrada" : cat === "durante" ? "Durante" : "Saída";
      return `
        <section class="bloco">
          <h2>Fotos do Equipamento</h2>
          <div class="grid-fotos" style="grid-template-columns: repeat(${cols}, 1fr);">
            ${galeria
              .map(
                (f) => `
              <div class="foto-item">
                <img src="${esc(f.src)}" style="height:${altura}px" />
                <p>${legenda(f.category)}</p>
              </div>
            `,
              )
              .join("")}
          </div>
        </section>
      `;
    }
    case "qrcode": {
      if (!d.qrCodeUrl) return "";
      const svg = renderToString(<QRCodeSVG value={d.qrCodeUrl} size={100} />);
      return `<section class="bloco qrcode">${svg}<p>Acompanhe sua OS online</p></section>`;
    }
    case "assinaturas":
      return `
        <footer class="assinaturas">
          <div class="assinatura">
            ${d.assinaturaClienteSrc ? `<img src="${esc(d.assinaturaClienteSrc)}" />` : ""}
            <div class="linha">Assinatura do Cliente${d.cliente?.nome ? `<br/><small>${esc(d.cliente.nome)}</small>` : ""}</div>
          </div>
          <div class="assinatura">
            ${d.assinaturaTecnicoSrc ? `<img src="${esc(d.assinaturaTecnicoSrc)}" />` : ""}
            <div class="linha">Quem finalizou a OS${d.assinaturaTecnicoNome ? `<br/><small>${esc(d.assinaturaTecnicoNome)}</small>` : ""}</div>
          </div>
        </footer>
      `;
    case "quebra_pagina":
      return `<div class="quebra-pagina"></div>`;
    default:
      return "";
  }
}

// Sections in config order, with "cabecalho" pinned first. "valores" is
// mandatory: when a config lacks it, it goes right after "itens" (or at the
// end) — it used to be forced right after the cabeçalho, which put the total
// above the list of services in every template.
export function secoesOrdenadas(template: OsTemplateRow): OsTemplateSecao[] {
  const resto = Array.from(new Set(template.config.secoes)).filter((s) => s !== "cabecalho");
  if (!resto.includes("valores")) {
    const i = resto.indexOf("itens");
    resto.splice(i >= 0 ? i + 1 : resto.length, 0, "valores");
  }
  return ["cabecalho", ...resto];
}

/** Renders sections, dropping page breaks that would open an empty page
 * (break at the end, or followed only by sections with nothing to show —
 * e.g. "quebra_pagina, qrcode" with the QR Code switched off), the same
 * thing the PDF writer does with its pending page break. */
function renderSecoes(
  secoes: OsTemplateSecao[],
  d: RenderOsData,
  cfg: OsTemplateConfig,
  cor: { accent: string; accentSoft: string },
): string {
  const partes = secoes
    .map((s) => ({ s, html: renderSecao(s, d, cfg, cor) }))
    .filter((p) => p.s === "quebra_pagina" || p.html.trim());
  return partes
    .filter(
      (p, i) =>
        p.s !== "quebra_pagina" ||
        (i > 0 && partes[i - 1]!.s !== "quebra_pagina" && i < partes.length - 1),
    )
    .map((p) => p.html)
    .join("");
}

/** Renders one via (client copy / empresa copy) of the document body. */
function renderVia(template: OsTemplateRow, d: RenderOsData, viaLabel: string | null): string {
  const cor = TEMA_COR[template.tema];
  const cfg = template.config;
  return `
    <div class="via">
      ${viaLabel ? `<p class="via-label">${esc(viaLabel)}</p>` : ""}
      ${renderSecoes(secoesOrdenadas(template), d, cfg, cor)}
    </div>
  `;
}

/** Splits an ordered section list into page-groups at "quebra_pagina"
 * markers, dropping the marker itself (a structural break, not a rendered
 * section) — shared by the single-document print/PDF path (which lets CSS
 * page-break-before do the splitting) and the on-screen paginated preview
 * (which needs discrete page fragments since page-break CSS doesn't apply
 * to a scrollable screen). */
function agruparPorPagina(secoes: OsTemplateSecao[]): OsTemplateSecao[][] {
  const grupos: OsTemplateSecao[][] = [[]];
  for (const s of secoes) {
    if (s === "quebra_pagina") {
      grupos.push([]);
      continue;
    }
    grupos[grupos.length - 1]!.push(s);
  }
  return grupos.filter((g) => g.length > 0);
}

function buildStyleBlock(template: OsTemplateRow, multiplasPaginas: boolean): string {
  const cor = TEMA_COR[template.tema];
  const linhaFina = template.tema === "minimalista";
  return `<style>
      * { box-sizing: border-box; }
      body { font-family: system-ui, sans-serif; padding: 40px; color: ${cor.text}; line-height: 1.45; font-size: 13px; }
      h1 { margin: 0; font-size: 20px; }
      h2 { font-size: 13px; margin: 0 0 8px; color: ${cor.accent}; text-transform: uppercase; letter-spacing: .03em; }
      .cabecalho { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: ${linhaFina ? "1px solid #d1d5db" : `2px solid ${cor.accent}`}; padding-bottom: 14px; margin-bottom: 20px; }
      .cabecalho-empresa { display: flex; gap: 12px; align-items: center; }
      .logo { height: 48px; width: 48px; object-fit: contain; border-radius: 8px; }
      .empresa-info { margin: 2px 0 0; font-size: 10px; color: #6b7280; }
      .cabecalho-os { text-align: right; display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
      .status-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; background: ${cor.accentSoft}; color: ${cor.accent}; font-weight: 600; font-size: 10px; }
      .bloco { margin-bottom: 18px; ${linhaFina ? "border-top:1px solid #e5e7eb; padding-top:12px;" : ""} }
      table { width: 100%; border-collapse: collapse; }
      table td { padding: 4px 0; vertical-align: top; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
      table td:first-child { width: 150px; color: #666; font-weight: 600; }
      table.itens th, table.itens td { text-align: left; padding: 6px 4px; font-size: 11px; }
      table.itens th { color: #6b7280; text-transform: uppercase; font-size: 9px; border-bottom: 2px solid #e5e7eb; }
      table.itens td { border-bottom: 1px solid #f3f4f6; }
      table.itens td:nth-child(n+3), table.itens th:nth-child(n+3) { text-align: right; }
      .valores { text-align: right; }
      .total { font-size: 17px; font-weight: 800; color: ${cor.accent}; }
      .muted { color: #6b7280; font-size: 10px; }
      .grid-checklist { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; font-size: 10px; }
      .grid-fotos { display: grid; gap: 10px; }
      .foto-item { text-align: center; }
      .foto-item img { width: 100%; object-fit: cover; border-radius: 4px; border: 1px solid #eee; }
      .foto-item p { font-size: 8px; color: #999; margin: 2px 0 0; }
      .termos { padding: 10px; background: #f9fafb; border-radius: 8px; font-size: 9px; color: #444; white-space: pre-line; border: 1px solid #f3f4f6; margin-bottom: 8px; }
      .qrcode { text-align: center; }
      .qrcode p { font-size: 9px; margin-top: 4px; color: #6b7280; }
      .assinaturas { display: flex; justify-content: space-between; gap: 24px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 14px; }
      .assinatura { width: 45%; text-align: center; font-size: 10px; }
      .assinatura img { max-height: 60px; margin-bottom: 4px; }
      .assinatura .linha { border-top: 1px solid #000; margin-top: 6px; padding-top: 4px; }
      .via-label { font-size: 10px; color: #9ca3af; text-align: right; margin-bottom: 4px; }
      .quebra-pagina { page-break-before: always; margin-top: 30px; padding-top: 30px; border-top: ${multiplasPaginas ? "2px dashed #ccc" : "none"}; }
      @page { size: A4 ${template.orientacao === "paisagem" ? "landscape" : "portrait"}; margin: 16mm; }
    </style>`;
}

function wrapDocument(
  template: OsTemplateRow,
  titulo: string,
  corpo: string,
  multiplasPaginas: boolean,
): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>${esc(titulo)}</title>
    ${buildStyleBlock(template, multiplasPaginas)}
    </head><body>
    ${corpo}
    </body></html>`;
}

export function renderOsTemplateHtml(template: OsTemplateRow, d: RenderOsData): string {
  const vias = d.duasVias ? [["Via do Cliente"], ["Via da Empresa"]] : [[null]];
  const titulo = `${tituloDocumento(d.modo)} ${d.numero}`;

  const corpo = vias
    .map(([label], i) => {
      const html = renderVia(template, d, label as string | null);
      return i > 0 ? `<div class="quebra-pagina"></div>${html}` : html;
    })
    .join("");

  return wrapDocument(template, titulo, corpo, vias.length > 1);
}

/** Same content as renderOsTemplateHtml, but as one standalone HTML document
 * per printed page (split at "quebra_pagina" markers and at each via) — for
 * the "Modelos de OS" preview modal's page navigator, which needs to jump
 * between discrete pages on screen rather than relying on @page CSS that
 * only takes effect when actually printing. */
export function renderOsTemplatePages(template: OsTemplateRow, d: RenderOsData): string[] {
  const cor = TEMA_COR[template.tema];
  const cfg = template.config;
  const vias = d.duasVias ? [["Via do Cliente"], ["Via da Empresa"]] : [[null]];
  const titulo = `${tituloDocumento(d.modo)} ${d.numero}`;
  const grupos = agruparPorPagina(secoesOrdenadas(template));
  const multiplasPaginas = vias.length > 1 || grupos.length > 1;

  const paginas: string[] = [];
  for (const [label] of vias) {
    grupos.forEach((grupo, i) => {
      const conteudo = renderSecoes(grupo, d, cfg, cor);
      // Página sem nada para mostrar (ex.: só o QR Code, desligado) não
      // entra na pré-visualização — também não sai na impressão.
      if (i > 0 && !conteudo.trim()) return;
      const corpo = `
        <div class="via">
          ${label && i === 0 ? `<p class="via-label">${esc(label as string)}</p>` : ""}
          ${conteudo}
        </div>
      `;
      paginas.push(wrapDocument(template, titulo, corpo, multiplasPaginas));
    });
  }
  return paginas;
}

// 1x1 gray placeholder — real templates render real signed photo URLs, this
// only fills the sample photo grid used for card thumbnails and the "Modelos
// de OS" preview, which have no real OS (and therefore no real photos) to
// render against.
const FOTO_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect width='200' height='150' fill='%23e5e7eb'/%3E%3Cpath d='M60 100l25-30 20 22 15-16 20 24H60z' fill='%23cbd5e1'/%3E%3Ccircle cx='80' cy='55' r='12' fill='%23cbd5e1'/%3E%3C/svg%3E";

/** Amostra de cada tipo de documento para as prévias da biblioteca de modelos. */
export function amostraPorUso(
  empresa: RenderOsData["empresa"],
  uso: OsTemplateUso,
  overrides?: Partial<RenderOsData>,
): RenderOsData {
  if (uso === "orcamento") {
    return buildSampleOsRenderData(empresa, {
      ...overrides,
      modo: "orcamento",
      statusLabel: "Aguardando aprovação",
    });
  }
  if (uso === "venda_aparelho") {
    return buildSampleOsRenderData(empresa, {
      ...overrides,
      modo: "venda_aparelho",
      statusLabel: "Vendido",
      aparelho: "iPhone",
      marca: "Apple",
      modelo: "13 128GB — Seminovo",
      defeito: null,
      diagnostico: null,
      checklist: {},
      estadoFisico: {},
      estadoFisicoObs: null,
      acessorios: null,
      fotos: [],
      itens: [
        {
          descricao: "iPhone 13 128GB Meia-noite (seminovo)",
          tipo: "produto",
          quantidade: 1,
          precoUnitario: 3200,
        },
      ],
      valor: 3100,
      desconto: 100,
    });
  }
  return buildSampleOsRenderData(empresa, overrides);
}

/** Realistic sample data for a card thumbnail or the library's preview
 * modal, where there's no real Ordem de Serviço to render against — reuses
 * the real empresa data (nome/logo/etc.) so the preview reflects what the
 * user will actually see, but everything else is representative fake
 * content standing in for a typical assistência técnica OS. */
export function buildSampleOsRenderData(
  empresa: RenderOsData["empresa"],
  overrides?: Partial<RenderOsData>,
): RenderOsData {
  return {
    numero: 1042,
    statusLabel: "Em reparo",
    createdAt: new Date().toISOString(),
    cliente: { nome: "Maria Souza", telefone: "(11) 98888-7766" },
    aparelho: "Smartphone",
    marca: "Apple",
    modelo: "iPhone 13",
    imei: "35 462311 234567 1",
    serialNumber: "F2LN9X8HQP",
    cor: "Meia-noite",
    senhaDispositivo: "2468",
    padraoDesbloqueio: null,
    defeito: "Aparelho caiu e a tela trincou. Touch não responde na parte inferior.",
    diagnostico:
      "Substituição do conjunto de tela necessária. Placa e bateria sem avarias aparentes.",
    itens: [
      { descricao: "Tela OLED original", tipo: "produto", quantidade: 1, precoUnitario: 620 },
      {
        descricao: "Mão de obra — troca de tela",
        tipo: "servico",
        quantidade: 1,
        precoUnitario: 80,
      },
    ],
    valor: 700,
    desconto: 0,
    garantiaDias: 90,
    garantiaVencimento: null,
    checklist: { liga: "ok", tela: "defeito", touch: "defeito", wifi: "ok", carregamento: "ok" },
    estadoFisico: { tela_trincada: true },
    estadoFisicoObs: "Trinca no canto superior direito.",
    acessorios: "Capinha, chip",
    fotos: [
      { src: FOTO_PLACEHOLDER, category: "entrada" },
      { src: FOTO_PLACEHOLDER, category: "durante" },
      { src: FOTO_PLACEHOLDER, category: "saida" },
      { src: FOTO_PLACEHOLDER, category: "entrada" },
    ],
    assinaturaClienteSrc: null,
    assinaturaTecnicoSrc: null,
    termoGarantiaTexto:
      "A garantia cobre defeitos de fabricação da peça e do serviço executado, não cobrindo danos por queda, líquido ou mau uso após a entrega.",
    condicoesTexto:
      "Parcelamento em até 3x no cartão. Prazo de execução: até 5 dias úteis após aprovação.",
    empresa,
    qrCodeUrl: "https://spacetech.app/consulta/exemplo",
    modo: "os",
    duasVias: false,
    ...overrides,
  };
}
