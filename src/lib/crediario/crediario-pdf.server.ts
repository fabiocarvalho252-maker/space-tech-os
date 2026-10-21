// Contrato de crediário com termo de bloqueio, para imprimir e o cliente
// assinar. Mesmo Escritor (pdf-writer.server.ts) e mesmo cabeçalho de
// empresa dos outros comprovantes (seminovo-pdf.server.ts).
import { rgb } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMA_RGB } from "@/lib/os-template-render";
import { criarEscritor } from "@/lib/pdf-writer.server";
import { numeroContrato, termoBloqueio } from "@/lib/crediario";

const COR = rgb(TEMA_RGB.roxo.r, TEMA_RGB.roxo.g, TEMA_RGB.roxo.b);
const CINZA = rgb(0.5, 0.5, 0.55);
const TEXTO = rgb(0.35, 0.35, 0.4);

const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
// O servidor roda em UTC; timestamps vão para o fuso da loja.
const dataHoraBR = (v: string) =>
  new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const dataBR = (v: string | null | undefined) =>
  v ? v.slice(0, 10).split("-").reverse().join("/") : "—";

export async function gerarPdfContratoCrediario({
  contratoId,
  empresaId,
}: {
  contratoId: string;
  empresaId: string;
}): Promise<Uint8Array> {
  const { data: c, error } = await supabaseAdmin
    .from("crediario_contratos")
    .select("*, clientes(nome, documento, telefone, endereco)")
    .eq("id", contratoId)
    .eq("user_id", empresaId)
    .single();
  if (error || !c) throw new Error("Contrato não encontrado.");

  const { data: parcelas = [] } = await supabaseAdmin
    .from("crediario_parcelas")
    .select("numero, vencimento, valor, status")
    .eq("contrato_id", contratoId)
    .order("numero");

  const { data: empresa } = await supabaseAdmin
    .from("profiles")
    .select("loja, nome, cnpj_cpf, endereco, cidade, whatsapp")
    .eq("id", empresaId)
    .maybeSingle();
  const loja = empresa?.loja || empresa?.nome || "SPACE TECH";

  const { pdf, w } = await criarEscritor(COR);

  w.titulo(loja, 16);
  const infoEmpresa = [empresa?.cnpj_cpf, empresa?.endereco, empresa?.cidade, empresa?.whatsapp]
    .filter(Boolean)
    .join("  ·  ");
  if (infoEmpresa) w.paragrafo(infoEmpresa, 8, CINZA);
  w.espaco(6);
  w.linhaDivisoria();

  w.subtitulo(
    `Contrato de venda a prazo ${numeroContrato(c.numero)} e termo de bloqueio`,
    rgb(0.1, 0.1, 0.15),
  );
  w.paragrafo(`Emitido em ${dataHoraBR(c.created_at).slice(0, 10)}`, 8, CINZA);
  w.espaco(8);

  w.subtitulo("Comprador");
  w.linhaCampo("Nome", c.clientes?.nome ?? "—");
  w.linhaCampo("CPF/CNPJ", c.clientes?.documento ?? "—");
  w.linhaCampo("Telefone", c.clientes?.telefone ?? "—");
  w.linhaCampo("Endereço", c.clientes?.endereco ?? "—");
  w.espaco(6);

  w.subtitulo("Aparelho");
  w.linhaCampo("Marca / Modelo", `${c.marca} ${c.modelo}`);
  w.linhaCampo("IMEI", c.imei);
  w.espaco(6);

  const totalParcelas = (parcelas ?? []).reduce((s, p) => s + Number(p.valor), 0);
  w.subtitulo("Condições");
  w.linhaCampo("Valor do aparelho", brl(c.valor_aparelho));
  w.linhaCampo("Entrada", brl(c.entrada));
  w.linhaCampo("Parcelas", `${c.num_parcelas}x — total ${brl(totalParcelas)}`);
  w.linhaCampo("Total a prazo", brl(Number(c.entrada) + totalParcelas));
  w.linhaCampo("Multa por atraso", `${c.multa_pct}% (uma vez por parcela)`);
  w.linhaCampo("Juros de mora", `${c.juros_mes_pct}% ao mês, proporcional aos dias`);
  w.espaco(6);

  w.subtitulo("Parcelas");
  for (const p of parcelas ?? []) {
    w.linhaCampo(
      `${p.numero}/${c.num_parcelas} — vence ${dataBR(p.vencimento)}`,
      `${brl(p.valor)}${p.status === "paga" ? "  (paga)" : ""}`,
    );
  }
  w.espaco(8);

  w.subtitulo("Termo de bloqueio do aparelho");
  w.paragrafo(termoBloqueio(c.dias_tolerancia), 9, TEXTO);
  w.espaco(4);
  w.paragrafo(
    "O comprador declara que conferiu o aparelho, recebeu uma via deste contrato e autoriza " +
      "a instalação do aplicativo de proteção, que não acessa fotos, mensagens, contatos ou " +
      "localização, e serve exclusivamente para bloquear e liberar o aparelho conforme os " +
      "pagamentos acima. O bloqueio nunca impede chamadas de emergência.",
    9,
    TEXTO,
  );
  w.espaco(4);
  w.paragrafo(`Termo aceito em ${dataHoraBR(c.termo_aceito_em)}.`, 8, CINZA);
  w.espaco(30);

  w.paragrafo("________________________________________", 9);
  w.paragrafo(`Comprador: ${c.clientes?.nome ?? ""}`, 8, CINZA);
  w.espaco(30);
  w.paragrafo("________________________________________", 9);
  w.paragrafo(`Loja: ${loja}`, 8, CINZA);

  return pdf.save();
}
