// Cupom de venda para impressora térmica (80 mm ou 58 mm). Imprime direto
// pelo navegador, num iframe escondido — sem PDF no meio e sem pop-up —
// com @page do tamanho da bobina, para o driver da impressora não encolher
// o conteúdo como faria com uma folha A4.
import { supabase } from "@/integrations/supabase/client";
import { linhaHorarioLoja } from "@/lib/horario-loja";

export type LarguraCupom = "80" | "58";

const CHAVE_LARGURA = "space-tech-cupom-largura";

// A largura depende da impressora daquele computador/celular, então fica
// guardada no próprio navegador.
export function lerLarguraCupom(): LarguraCupom {
  try {
    return window.localStorage.getItem(CHAVE_LARGURA) === "58" ? "58" : "80";
  } catch {
    return "80";
  }
}

export function salvarLarguraCupom(largura: LarguraCupom) {
  try {
    window.localStorage.setItem(CHAVE_LARGURA, largura);
  } catch {
    // sem armazenamento (aba anônima etc.) — só não lembra a escolha.
  }
}

const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

const esc = (t: unknown) =>
  String(t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function montarHtmlCupom(vendaId: string, largura: LarguraCupom): Promise<string> {
  const { data: venda, error } = await supabase
    .from("vendas")
    .select("*, clientes(nome, documento, telefone)")
    .eq("id", vendaId)
    .single();
  if (error || !venda) throw new Error("Venda não encontrada.");

  const [{ data: itens }, { data: loja }] = await Promise.all([
    supabase
      .from("venda_itens")
      .select("descricao, quantidade, preco_unitario")
      .eq("venda_id", vendaId),
    supabase
      .from("profiles")
      .select("loja, nome, cnpj_cpf, endereco, whatsapp, horario_funcionamento")
      .eq("id", venda.user_id)
      .maybeSingle(),
  ]);

  const nomeLoja = loja?.loja || loja?.nome || "SPACE TECH";
  const horarioLoja = linhaHorarioLoja(loja?.horario_funcionamento);
  const data = new Date(venda.created_at).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  let subtotal = 0;
  const linhasItens = (itens ?? [])
    .map((i) => {
      const total = Number(i.quantidade) * Number(i.preco_unitario);
      subtotal += total;
      return `<div class="item">${esc(i.descricao)}</div>
        <div class="linha"><span>${i.quantidade} x ${brl(i.preco_unitario)}</span><span>${brl(total)}</span></div>`;
    })
    .join("");

  // Área imprimível real das bobinas: ~72 mm na de 80 mm e ~48 mm na de 58 mm.
  const util = largura === "58" ? 48 : 72;
  const fonte = largura === "58" ? 10 : 12;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Cupom venda ${venda.numero}</title>
<style>
  @page { size: ${largura}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: ${util}mm; margin: 0 auto; padding: 3mm 0 6mm;
    font: ${fonte}px/1.35 "Courier New", Courier, monospace; }
  .c { text-align: center; }
  .b { font-weight: bold; }
  .loja { font-size: ${fonte + 3}px; font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 2mm 0; }
  .linha { display: flex; justify-content: space-between; gap: 2mm; }
  .linha span:last-child { white-space: nowrap; }
  .item { word-break: break-word; }
  .total { font-size: ${fonte + 4}px; font-weight: bold; }
  .pequeno { font-size: ${fonte - 2}px; }
</style></head><body>
  <div class="c loja">${esc(nomeLoja)}</div>
  ${loja?.cnpj_cpf ? `<div class="c pequeno">CNPJ/CPF: ${esc(loja.cnpj_cpf)}</div>` : ""}
  ${loja?.endereco ? `<div class="c pequeno">${esc(loja.endereco)}</div>` : ""}
  ${loja?.whatsapp ? `<div class="c pequeno">WhatsApp: ${esc(loja.whatsapp)}</div>` : ""}
  ${horarioLoja ? `<div class="c pequeno">${esc(horarioLoja)}</div>` : ""}
  <div class="sep"></div>
  <div class="c b">CUPOM NÃO FISCAL</div>
  <div class="linha"><span>Venda nº ${String(venda.numero).padStart(4, "0")}</span><span>${esc(data)}</span></div>
  ${venda.status === "cancelado" ? `<div class="c b">*** VENDA CANCELADA ***</div>` : ""}
  <div>Cliente: ${esc(venda.clientes?.nome ?? "Consumidor final")}</div>
  ${venda.clientes?.documento ? `<div>CPF/CNPJ: ${esc(venda.clientes.documento)}</div>` : ""}
  <div class="sep"></div>
  ${linhasItens || `<div class="c">Sem itens</div>`}
  <div class="sep"></div>
  <div class="linha"><span>Subtotal</span><span>${brl(subtotal)}</span></div>
  ${Number(venda.desconto ?? 0) > 0 ? `<div class="linha"><span>Desconto</span><span>- ${brl(venda.desconto)}</span></div>` : ""}
  <div class="linha total"><span>TOTAL</span><span>${brl(venda.total)}</span></div>
  <div class="linha"><span>Pagamento</span><span>${esc(venda.forma_pagamento ?? "—")}</span></div>
  ${venda.observacoes ? `<div class="sep"></div><div>Obs.: ${esc(venda.observacoes)}</div>` : ""}
  <div class="sep"></div>
  <div class="c">Obrigado pela preferência!</div>
  <div class="c pequeno">Não é documento fiscal</div>
</body></html>`;
}

export async function imprimirCupomVenda(vendaId: string, largura: LarguraCupom) {
  const html = await montarHtmlCupom(vendaId, largura);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    throw new Error("Não foi possível abrir a impressão.");
  }
  doc.open();
  doc.write(html);
  doc.close();
  // Dá um instante para o layout ficar pronto antes de chamar a impressão;
  // o iframe some depois que a janela de impressão fecha.
  await new Promise((r) => setTimeout(r, 150));
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  setTimeout(() => iframe.remove(), 60_000);
}
