// Generates the two PDF documents the "Aparelhos" module needs — comprovante
// de venda and termo de garantia — reusing the pdf-lib layout primitives
// extracted into pdf-writer.server.ts (same Escritor os-pdf.server.ts uses
// for OS documents) instead of building a third parallel text-layout engine.
// Server-only: uses supabaseAdmin to read across tables regardless of the
// caller's RLS session.
import { rgb } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMA_RGB } from "@/lib/os-template-render";
import { criarEscritor } from "@/lib/pdf-writer.server";

const CORREGIONAL = rgb(TEMA_RGB.roxo.r, TEMA_RGB.roxo.g, TEMA_RGB.roxo.b);

const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
const dataBR = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

async function carregarEmpresa(empresaId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("loja, nome, cnpj_cpf, endereco, whatsapp, logo_url")
    .eq("id", empresaId)
    .maybeSingle();
  return data;
}

async function desenharCabecalhoEmpresa(
  w: Awaited<ReturnType<typeof criarEscritor>>["w"],
  empresa: Awaited<ReturnType<typeof carregarEmpresa>>,
) {
  w.titulo(empresa?.loja || empresa?.nome || "SPACE TECH", 16);
  const infoEmpresa = [empresa?.cnpj_cpf, empresa?.endereco, empresa?.whatsapp]
    .filter(Boolean)
    .join("  ·  ");
  if (infoEmpresa) w.paragrafo(infoEmpresa, 8, rgb(0.5, 0.5, 0.55));
  w.espaco(6);
  w.linhaDivisoria();
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

  const { data: garantia } = await supabaseAdmin
    .from("aparelho_garantias")
    .select("dias, inicio, fim")
    .eq("venda_id", vendaId)
    .maybeSingle();

  const empresa = await carregarEmpresa(empresaId);

  const { pdf, w } = await criarEscritor(CORREGIONAL);
  await desenharCabecalhoEmpresa(w, empresa);

  w.subtitulo(
    `Comprovante de Venda de Aparelho nº ${String(venda.numero).padStart(6, "0")}`,
    rgb(0.1, 0.1, 0.15),
  );
  w.paragrafo(`Data: ${dataBR(venda.created_at)}`, 8, rgb(0.5, 0.5, 0.55));
  w.espaco(8);

  w.subtitulo("Cliente");
  w.linhaCampo("Nome", venda.clientes?.nome ?? "—");
  w.linhaCampo("CPF/CNPJ", venda.clientes?.documento ?? "—");
  w.linhaCampo("Telefone", venda.clientes?.telefone ?? "—");
  if (venda.clientes?.email) w.linhaCampo("E-mail", venda.clientes.email);
  w.espaco(6);

  w.subtitulo("Aparelho");
  w.linhaCampo("Tipo", aparelho.tipo === "lacrado" ? "Lacrado" : "Seminovo");
  w.linhaCampo(
    "Marca / Modelo",
    [aparelho.marca, aparelho.modelo, aparelho.variante].filter(Boolean).join(" "),
  );
  w.linhaCampo("Armazenamento", aparelho.armazenamento ?? "—");
  if (aparelho.ram) w.linhaCampo("RAM", aparelho.ram);
  w.linhaCampo("Cor", aparelho.cor ?? "—");
  w.linhaCampo("IMEI", aparelho.imei1 ?? "—");
  if (aparelho.imei2) w.linhaCampo("IMEI 2", aparelho.imei2);
  if (aparelho.numero_serie) w.linhaCampo("Número de série", aparelho.numero_serie);
  if (aparelho.tipo === "seminovo" && aparelho.estado_conservacao)
    w.linhaCampo("Condição", aparelho.estado_conservacao);
  w.espaco(6);

  w.subtitulo("Valores");
  w.linhaCampo("Preço", brl(Number(venda.total) + Number(venda.desconto ?? 0)));
  w.linhaCampo("Desconto", brl(venda.desconto ?? 0));
  w.subtitulo(`Total: ${brl(venda.total)}`, rgb(0.1, 0.1, 0.15));
  w.espaco(6);

  w.subtitulo("Pagamento");
  w.linhaCampo("Forma de pagamento", venda.forma_pagamento ?? "—");
  w.espaco(6);

  if (garantia) {
    w.subtitulo("Garantia");
    w.linhaCampo("Prazo", `${garantia.dias} dias`);
    w.linhaCampo("Início", dataBR(garantia.inicio));
    w.linhaCampo("Fim", dataBR(garantia.fim));
    w.espaco(6);
  }

  if (venda.observacoes) {
    w.subtitulo("Observações");
    w.paragrafo(venda.observacoes, 9, rgb(0.35, 0.35, 0.4));
    w.espaco(6);
  }

  w.subtitulo("Declaração");
  w.paragrafo(
    "Declaro ter recebido o aparelho descrito acima, junto com os acessórios e itens combinados no ato da venda, nas condições aqui apresentadas.",
    9,
    rgb(0.35, 0.35, 0.4),
  );
  w.espaco(30);

  w.linhaDivisoria();
  w.espaco(6);
  w.paragrafo("________________________________", 9);
  w.paragrafo(venda.clientes?.nome ?? "Cliente", 8, rgb(0.5, 0.5, 0.55));
  w.espaco(20);
  w.paragrafo("________________________________", 9);
  w.paragrafo(empresa?.loja || empresa?.nome || "SPACE TECH", 8, rgb(0.5, 0.5, 0.55));

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

  const empresa = await carregarEmpresa(empresaId);

  const { pdf, w } = await criarEscritor(CORREGIONAL);
  await desenharCabecalhoEmpresa(w, empresa);

  w.titulo("Termo de Garantia", 14);
  w.paragrafo(
    `Documento nº GAR-${String(garantia.numero).padStart(6, "0")}`,
    8,
    rgb(0.5, 0.5, 0.55),
  );
  w.espaco(8);

  w.subtitulo("Cliente");
  w.linhaCampo("Nome", garantia.clientes?.nome ?? "—");
  w.linhaCampo("CPF/CNPJ", garantia.clientes?.documento ?? "—");
  w.linhaCampo("Telefone", garantia.clientes?.telefone ?? "—");
  w.espaco(6);

  w.subtitulo("Aparelho");
  w.linhaCampo(
    "Marca / Modelo",
    [aparelho.marca, aparelho.modelo, aparelho.variante].filter(Boolean).join(" "),
  );
  w.linhaCampo("IMEI", aparelho.imei1 ?? "—");
  if (aparelho.numero_serie) w.linhaCampo("Número de série", aparelho.numero_serie);
  w.linhaCampo("Cor", aparelho.cor ?? "—");
  w.espaco(6);

  w.subtitulo("Garantia");
  if (garantia.vendas) w.linhaCampo("Venda", `#${String(garantia.vendas.numero).padStart(4, "0")}`);
  w.linhaCampo("Data da venda", dataBR(garantia.created_at));
  w.linhaCampo("Início da garantia", dataBR(garantia.inicio));
  w.linhaCampo("Fim da garantia", dataBR(garantia.fim));
  if (garantia.vendas) w.linhaCampo("Valor da venda", brl(garantia.vendas.total));
  w.espaco(6);

  w.subtitulo("Condições da garantia");
  w.paragrafo(
    conteudoTermo ||
      `Este termo garante o aparelho descrito acima contra defeitos de fabricação pelo prazo de ${garantia.dias} dias a partir da data da venda. A garantia não cobre danos causados por mau uso, quedas, contato com líquidos, violação do aparelho por terceiros ou desgaste natural de peças e bateria.`,
    9,
    rgb(0.35, 0.35, 0.4),
  );
  w.espaco(20);

  w.linhaDivisoria();
  w.espaco(6);
  w.paragrafo("________________________________", 9);
  w.paragrafo(garantia.clientes?.nome ?? "Cliente", 8, rgb(0.5, 0.5, 0.55));
  w.espaco(20);
  w.paragrafo("________________________________", 9);
  w.paragrafo(empresa?.loja || empresa?.nome || "SPACE TECH", 8, rgb(0.5, 0.5, 0.55));

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
