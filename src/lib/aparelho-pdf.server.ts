// Generates the two PDF documents the "Aparelhos" module needs — comprovante
// de venda and termo de garantia — reusing the pdf-lib layout primitives
// extracted into pdf-writer.server.ts (same Escritor os-pdf.server.ts uses
// for OS documents) instead of building a third parallel text-layout engine.
// Server-only: uses supabaseAdmin to read across tables regardless of the
// caller's RLS session.
import { rgb } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMA_RGB, secoesOrdenadas } from "@/lib/os-template-render";
import { buscarTemplatePadrao } from "@/lib/os-template-busca";
import { criarEscritor } from "@/lib/pdf-writer.server";
import { dataHoraBR } from "@/lib/format";
import { linhaHorarioLoja } from "@/lib/horario-loja";

const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
const dataBR = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

async function carregarEmpresa(empresaId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("loja, nome, cnpj_cpf, endereco, whatsapp, logo_url, horario_funcionamento")
    .eq("id", empresaId)
    .maybeSingle();
  return data;
}

function linhasDaLoja(empresa: Awaited<ReturnType<typeof carregarEmpresa>>): string[] {
  return [
    empresa?.cnpj_cpf ? `CNPJ/CPF: ${empresa.cnpj_cpf}` : null,
    empresa?.endereco ?? null,
    empresa?.whatsapp ? `WhatsApp: ${empresa.whatsapp}` : null,
    linhaHorarioLoja(empresa?.horario_funcionamento),
  ].filter((l): l is string => !!l);
}

async function baixarLogo(url: string | null | undefined) {
  if (!url) return null;
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    return {
      bytes: new Uint8Array(await resposta.arrayBuffer()),
      ehPng: url.toLowerCase().includes(".png"),
    };
  } catch {
    return null;
  }
}

/** Termos digitados com emoji e separadores "---" (a fonte do PDF não tem emoji). */
function textoSemEmoji(texto: string): string {
  return texto
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}|\u{20E3}/gu, "")
    .split(/\r?\n/)
    .map((l) => (/^\s*-{3,}\s*$/.test(l) ? "" : l.replace(/^\s+/, "")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

// ============================================================
// Comprovante de venda
// ============================================================

export type GerarComprovanteAparelhoInput = { vendaId: string; empresaId: string };

export async function gerarPdfComprovanteAparelho({
  vendaId,
  empresaId,
}: GerarComprovanteAparelhoInput): Promise<Uint8Array> {
  const { data: venda, error: erroVenda } = await supabaseAdmin
    .from("vendas")
    .select("*, clientes(nome, telefone, email, documento)")
    .eq("id", vendaId)
    .eq("user_id", empresaId)
    .single();
  if (erroVenda || !venda) throw new Error("Venda não encontrada para gerar o comprovante.");

  const { data: item } = await supabaseAdmin
    .from("venda_itens")
    .select("*, aparelhos(*)")
    .eq("venda_id", vendaId)
    .not("aparelho_id", "is", null)
    .maybeSingle();
  if (!item?.aparelhos) throw new Error("Esta venda não corresponde a uma venda de aparelho.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined row shape, matches os-pdf.server.ts's osAny pattern
  const aparelho = item.aparelhos as any;

  const [{ data: garantia }, empresa, template] = await Promise.all([
    supabaseAdmin
      .from("aparelho_garantias")
      .select("dias, inicio, fim, termo_id")
      .eq("venda_id", vendaId)
      .maybeSingle(),
    carregarEmpresa(empresaId),
    // Modelo padrão de "Venda de aparelho" (Configurações → Modelos): cor,
    // seções e ordem.
    buscarTemplatePadrao(supabaseAdmin, empresaId, "venda_aparelho"),
  ]);

  // Termo: o da garantia emitida na venda; sem ele, o termo padrão da loja.
  const { data: termo } = garantia?.termo_id
    ? await supabaseAdmin
        .from("termos_garantia")
        .select("conteudo")
        .eq("id", garantia.termo_id)
        .maybeSingle()
    : await supabaseAdmin
        .from("termos_garantia")
        .select("conteudo")
        .eq("user_id", empresaId)
        .eq("is_default", true)
        .eq("ativo", true)
        .maybeSingle();

  const cor = TEMA_RGB[template.tema];
  const { pdf, w } = await criarEscritor(rgb(cor.r, cor.g, cor.b));
  const nomeLoja = empresa?.loja || empresa?.nome || "SPACE TECH";
  const cliente = venda.clientes as {
    nome?: string | null;
    telefone?: string | null;
    email?: string | null;
    documento?: string | null;
  } | null;
  const numero = String(venda.numero).padStart(6, "0");

  await w.cabecalhoDocumento({
    logo: await baixarLogo(empresa?.logo_url),
    loja: nomeLoja,
    linhasLoja: linhasDaLoja(empresa),
    documento: "Comprovante de venda",
    numero: `Nº ${numero}`,
    data: `Vendido em ${dataHoraBR(venda.created_at)}`,
    status: null,
  });
  w.aviso(
    "Obrigado pela compra!",
    `Este é o comprovante da compra do seu aparelho${garantia ? ` e da garantia de ${garantia.dias} dias, válida até ${dataBR(garantia.fim)}` : ""}. Guarde este documento: ele é necessário para qualquer atendimento em garantia.`,
    "verde",
  );

  for (const secao of secoesOrdenadas(template)) {
    switch (secao) {
      case "cliente":
        w.secao("Comprador");
        w.grade([
          ["Nome", cliente?.nome ?? "Não informado"],
          ["CPF / CNPJ", cliente?.documento ?? ""],
          ["Telefone / WhatsApp", cliente?.telefone ?? ""],
          ["E-mail", cliente?.email ?? ""],
        ]);
        break;

      case "aparelho":
        w.secao("Aparelho");
        w.grade([
          [
            "Marca / Modelo",
            [aparelho.marca, aparelho.modelo, aparelho.variante].filter(Boolean).join(" "),
          ],
          ["Tipo", aparelho.tipo === "lacrado" ? "Lacrado (novo)" : "Seminovo"],
          ["Armazenamento", aparelho.armazenamento ?? ""],
          ["RAM", aparelho.ram ?? ""],
          ["Cor", aparelho.cor ?? ""],
          ["IMEI", aparelho.imei1 ?? ""],
          ["IMEI 2", aparelho.imei2 ?? ""],
          ["Número de série", aparelho.numero_serie ?? ""],
          ["Condição", aparelho.tipo === "seminovo" ? (aparelho.estado_conservacao ?? "") : ""],
          [
            "Saúde da bateria",
            aparelho.tipo === "seminovo" && aparelho.saude_bateria != null
              ? `${aparelho.saude_bateria}%`
              : "",
          ],
        ]);
        break;

      case "valores": {
        const desconto = Number(venda.desconto ?? 0);
        const linhas: [string, string][] = [
          ["Preço do aparelho", brl(Number(venda.total) + desconto)],
        ];
        if (desconto > 0) linhas.push(["Desconto", `- ${brl(desconto)}`]);
        linhas.push(["Forma de pagamento", venda.forma_pagamento || "Não informada"]);
        w.secao("Valores e pagamento");
        w.totais(linhas, ["Total pago", brl(venda.total)]);
        if (venda.observacoes) {
          w.grade([["Observações", venda.observacoes]], 1);
        }
        break;
      }

      case "garantia":
        if (garantia) {
          w.secao("Garantia");
          w.grade(
            [
              ["Prazo", `${garantia.dias} dias`],
              ["Início", dataBR(garantia.inicio)],
              ["Válida até", dataBR(garantia.fim)],
            ],
            3,
          );
        }
        break;

      case "termos": {
        const texto =
          termo?.conteudo ||
          (garantia
            ? `Este aparelho tem garantia de ${garantia.dias} dias contra defeitos de funcionamento, a partir da data da venda. A garantia não cobre danos causados por mau uso, quedas, contato com líquidos, violação do aparelho por terceiros ou desgaste natural de peças e bateria.`
            : null);
        if (texto) {
          w.secao("Termos da garantia");
          w.paragrafo(textoSemEmoji(texto), 7.5, rgb(0.3, 0.3, 0.36));
        }
        break;
      }

      case "assinaturas":
        w.secao("Declaração e assinaturas");
        w.paragrafo(
          "Declaro ter recebido o aparelho descrito acima, junto com os acessórios combinados, em perfeito estado e nas condições aqui apresentadas.",
          8.5,
          rgb(0.35, 0.35, 0.4),
        );
        await w.assinaturas([
          { rotulo: "Comprador", nome: cliente?.nome ?? null },
          { rotulo: nomeLoja },
        ]);
        break;

      case "quebra_pagina":
        w.novaPagina();
        break;

      default:
        break;
    }
  }

  w.rodape(
    [
      nomeLoja,
      empresa?.whatsapp ? `WhatsApp ${empresa.whatsapp}` : null,
      `Venda nº ${numero}`,
      `Emitido em ${dataHoraBR(new Date().toISOString())}`,
    ]
      .filter(Boolean)
      .join("  ·  "),
  );

  return pdf.save();
}

export async function salvarPdfComprovanteAparelhoNoStorage(
  params: GerarComprovanteAparelhoInput,
): Promise<{ path: string; bytes: Uint8Array }> {
  const bytes = await gerarPdfComprovanteAparelho(params);
  const path = `${params.empresaId}/documentos/comprovante-aparelho-${params.vendaId}-${Date.now()}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from("aparelhos-fotos")
    .upload(path, bytes, { contentType: "application/pdf" });
  if (error) throw error;
  return { path, bytes };
}

// ============================================================
// Termo de garantia
// ============================================================

export type GerarTermoGarantiaAparelhoInput = { garantiaId: string; empresaId: string };

export async function gerarPdfTermoGarantiaAparelho({
  garantiaId,
  empresaId,
}: GerarTermoGarantiaAparelhoInput): Promise<Uint8Array> {
  const { data: garantia, error: erroGarantia } = await supabaseAdmin
    .from("aparelho_garantias")
    .select("*, aparelhos(*), clientes(nome, telefone, documento), vendas(numero, total)")
    .eq("id", garantiaId)
    .eq("user_id", empresaId)
    .single();
  if (erroGarantia || !garantia) throw new Error("Garantia não encontrada para gerar o termo.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined row shape, matches os-pdf.server.ts's osAny pattern
  const aparelho = garantia.aparelhos as any;

  let conteudoTermo: string | null = null;
  if (garantia.termo_id) {
    const { data: termo } = await supabaseAdmin
      .from("termos_garantia")
      .select("conteudo")
      .eq("id", garantia.termo_id)
      .maybeSingle();
    conteudoTermo = termo?.conteudo ?? null;
  }

  const [empresa, template] = await Promise.all([
    carregarEmpresa(empresaId),
    buscarTemplatePadrao(supabaseAdmin, empresaId, "venda_aparelho"),
  ]);
  const cor = TEMA_RGB[template.tema];
  const { pdf, w } = await criarEscritor(rgb(cor.r, cor.g, cor.b));
  const nomeLoja = empresa?.loja || empresa?.nome || "SPACE TECH";
  const numero = `GAR-${String(garantia.numero).padStart(6, "0")}`;

  await w.cabecalhoDocumento({
    logo: await baixarLogo(empresa?.logo_url),
    loja: nomeLoja,
    linhasLoja: linhasDaLoja(empresa),
    documento: "Termo de garantia",
    numero,
    data: `Emitido em ${dataBR(garantia.created_at)}`,
    status: null,
  });
  w.aviso(
    `Garantia válida até ${dataBR(garantia.fim)}`,
    `Este aparelho tem ${garantia.dias} dias de garantia, de ${dataBR(garantia.inicio)} a ${dataBR(garantia.fim)}. Para usar a garantia, traga o aparelho e este termo (ou o número ${numero}) à loja.`,
    "verde",
  );

  w.secao("Cliente");
  w.grade([
    ["Nome", garantia.clientes?.nome ?? "Não informado"],
    ["CPF / CNPJ", garantia.clientes?.documento ?? ""],
    ["Telefone / WhatsApp", garantia.clientes?.telefone ?? ""],
  ]);

  w.secao("Aparelho");
  w.grade([
    [
      "Marca / Modelo",
      [aparelho.marca, aparelho.modelo, aparelho.variante].filter(Boolean).join(" "),
    ],
    ["IMEI", aparelho.imei1 ?? ""],
    ["Número de série", aparelho.numero_serie ?? ""],
    ["Cor", aparelho.cor ?? ""],
  ]);

  w.secao("Garantia");
  w.grade(
    [
      ["Venda", garantia.vendas ? `nº ${String(garantia.vendas.numero).padStart(6, "0")}` : ""],
      ["Valor da venda", garantia.vendas ? brl(garantia.vendas.total) : ""],
      ["Prazo", `${garantia.dias} dias`],
      ["Início", dataBR(garantia.inicio)],
      ["Válida até", dataBR(garantia.fim)],
    ],
    3,
  );

  w.secao("Condições da garantia");
  w.paragrafo(
    textoSemEmoji(
      conteudoTermo ||
        `Este termo garante o aparelho descrito acima contra defeitos de fabricação pelo prazo de ${garantia.dias} dias a partir da data da venda. A garantia não cobre danos causados por mau uso, quedas, contato com líquidos, violação do aparelho por terceiros ou desgaste natural de peças e bateria.`,
    ),
    7.5,
    rgb(0.3, 0.3, 0.36),
  );

  w.secao("Assinaturas");
  await w.assinaturas([
    { rotulo: "Cliente", nome: garantia.clientes?.nome ?? null },
    { rotulo: nomeLoja },
  ]);

  w.rodape(
    [nomeLoja, empresa?.whatsapp ? `WhatsApp ${empresa.whatsapp}` : null, `Termo ${numero}`]
      .filter(Boolean)
      .join("  ·  "),
  );

  return pdf.save();
}

export async function salvarPdfTermoGarantiaAparelhoNoStorage(
  params: GerarTermoGarantiaAparelhoInput,
): Promise<{ path: string; bytes: Uint8Array }> {
  const bytes = await gerarPdfTermoGarantiaAparelho(params);
  const path = `${params.empresaId}/documentos/termo-garantia-${params.garantiaId}-${Date.now()}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from("aparelhos-fotos")
    .upload(path, bytes, { contentType: "application/pdf" });
  if (error) throw error;
  return { path, bytes };
}
