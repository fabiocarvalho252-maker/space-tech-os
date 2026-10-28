// Testes das partes puras da Central de WhatsApp (sem banco nem Evolution).
// Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveTelefone, formatarTelefone, paraE164BR } from "../src/lib/whatsapp/telefone.ts";
import { detectarFormato, nomeSeguro, validarAnexo } from "../src/lib/whatsapp/midia.ts";
import {
  lerApagada,
  lerHorarioEnvio,
  lerMensagem,
  lerStatus,
} from "../src/lib/whatsapp/webhook-parse.ts";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

test("chaveTelefone casa com/sem 55 e com/sem o nono dígito", () => {
  const esperado = "7498125994";
  assert.equal(chaveTelefone("557498125994"), esperado);
  assert.equal(chaveTelefone("5574998125994"), esperado);
  assert.equal(chaveTelefone("(74) 99812-5994"), esperado);
  assert.equal(chaveTelefone("74 9812-5994"), esperado);
  assert.notEqual(chaveTelefone("(11) 99812-5994"), esperado, "DDD diferente não pode casar");
});

test("paraE164BR e formatarTelefone", () => {
  assert.equal(paraE164BR("(74) 99812-5994"), "5574998125994");
  assert.equal(paraE164BR("5574998125994"), "5574998125994");
  assert.equal(formatarTelefone("5574998125994"), "(74) 99812-5994");
  assert.equal(formatarTelefone("557498125994"), "(74) 9812-5994");
});

test("detectarFormato usa os bytes, não o nome", () => {
  assert.equal(detectarFormato(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime, "image/jpeg");
  assert.equal(detectarFormato(ascii("%PDF-1.7 ..."), "foto.jpg")?.mime, "application/pdf");
  assert.equal(detectarFormato(ascii("<html><script>"), "nota.pdf"), null, "HTML com nome .pdf");
  assert.equal(
    detectarFormato(ascii("MZ\x90\x00"), "boleto.pdf"),
    null,
    "executável com nome .pdf",
  );
  assert.equal(detectarFormato(ascii("<svg onload=alert(1)>"), "a.png"), null, "SVG bloqueado");
});

test("zip só passa como docx/xlsx", () => {
  const zip = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0);
  assert.equal(detectarFormato(zip, "orcamento.docx")?.extensao, "docx");
  assert.equal(detectarFormato(zip, "planilha.xlsx")?.extensao, "xlsx");
  assert.equal(detectarFormato(zip, "arquivos.zip"), null);
  assert.equal(detectarFormato(zip, "app.apk"), null);
});

test("validarAnexo: tamanho, vazio e nome seguro com extensão real", () => {
  assert.equal(validarAnexo("a.pdf", new Uint8Array()).ok, false);
  const grande = new Uint8Array(11);
  grande.set(ascii("%PDF-"));
  const r = validarAnexo("a.pdf", grande, 10);
  assert.equal(r.ok, false);
  const ok = validarAnexo("../../etc/Orçamento OS 12.jpg", ascii("%PDF-1.4"));
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.nome, "Orçamento OS 12.pdf", "extensão vem do conteúdo, caminho some");
    assert.equal(ok.tipo, "documento");
  }
});

test("nomeSeguro remove caminho e caracteres perigosos", () => {
  assert.equal(nomeSeguro("C:\\Users\\x\\nota<script>.pdf"), "nota_script_.pdf");
  assert.equal(nomeSeguro("...."), "arquivo");
});

test("lerMensagem: texto simples de contato", () => {
  const m = lerMensagem({
    key: { id: "ABC", fromMe: false, remoteJid: "5574998125994@s.whatsapp.net" },
    pushName: "Maria",
    message: { conversation: "Meu celular ficou pronto?" },
  });
  assert.equal(m.numero, "5574998125994");
  assert.equal(m.texto, "Meu celular ficou pronto?");
  assert.equal(m.nomeContato, "Maria");
  assert.equal(m.midia, null);
  assert.equal(m.fromMe, false);
});

test("lerMensagem: grupo não vira conversa", () => {
  const m = lerMensagem({
    key: { id: "G", fromMe: false, remoteJid: "1203630@g.us" },
    message: { conversation: "oi" },
  });
  assert.equal(m.numero, null);
});

test("lerMensagem: reação, edição e 'aguardando mensagem' não são mensagem nova", () => {
  const key = { id: "R", fromMe: false, remoteJid: "5574998125994@s.whatsapp.net" };
  const reacao = lerMensagem({
    key,
    messageType: "reactionMessage",
    message: { reactionMessage: { key: { id: "X" }, text: "❤️" } },
  });
  const edicao = lerMensagem({
    key,
    messageType: "protocolMessage",
    message: { protocolMessage: { type: 14, editedMessage: { conversation: "Oi boa tarde" } } },
  });
  const temporarias = lerMensagem({
    key,
    message: { protocolMessage: { type: 3, ephemeralExpiration: 0 } },
  });
  const aguardando = lerMensagem({
    key,
    messageType: "placeholderMessage",
    message: { messageContextInfo: { threadId: [] } },
  });
  for (const m of [reacao, edicao, temporarias, aguardando]) assert.equal(m.semConteudo, true);
  const texto = lerMensagem({ key, message: { conversation: "4" } });
  const audio = lerMensagem({ key, messageType: "audioMessage", message: { audioMessage: {} } });
  assert.equal(texto.semConteudo, false);
  assert.equal(audio.semConteudo, false);
});

test("lerMensagem: mensagem temporária é desembrulhada", () => {
  const m = lerMensagem({
    key: { id: "E", fromMe: false, remoteJid: "5574998125994@s.whatsapp.net" },
    messageType: "ephemeralMessage",
    message: { ephemeralMessage: { message: { extendedTextMessage: { text: "2" } } } },
  });
  assert.equal(m.texto, "2");
  assert.equal(m.semConteudo, false);
});

test("lerApagada: chave da mensagem apagada", () => {
  assert.deepEqual(lerApagada({ id: "A1", fromMe: true, remoteJid: "x@s.whatsapp.net" }), {
    id: "A1",
    fromMe: true,
  });
  assert.deepEqual(lerApagada({ key: { id: "A2", fromMe: false } }), { id: "A2", fromMe: false });
  assert.equal(lerApagada({}), null);
});

test("lerMensagem: @lid usa o número real", () => {
  const m = lerMensagem({
    key: { id: "L", remoteJid: "123456@lid", remoteJidAlt: "5574998125994@s.whatsapp.net" },
    message: { conversation: "oi" },
  });
  assert.equal(m.numero, "5574998125994");
});

test("lerMensagem: imagem com legenda, base64 e resposta citada", () => {
  const m = lerMensagem({
    key: { id: "IMG1", fromMe: false, remoteJid: "5574998125994@s.whatsapp.net" },
    messageType: "imageMessage",
    message: {
      imageMessage: {
        caption: "Olha a tela",
        mimetype: "image/jpeg",
        contextInfo: { stanzaId: "ORIGINAL" },
      },
      base64: "/9j/4AAQ",
    },
  });
  assert.equal(m.texto, "Olha a tela");
  assert.equal(m.midia?.tipo, "imagem");
  assert.equal(m.midia?.mime, "image/jpeg");
  assert.equal(m.midia?.base64, "/9j/4AAQ");
  assert.equal(m.respostaA, "ORIGINAL");
});

test("lerMensagem: documento com legenda embrulhado", () => {
  const m = lerMensagem({
    key: { id: "DOC1", remoteJid: "5574998125994@s.whatsapp.net" },
    messageType: "documentWithCaptionMessage",
    message: {
      documentWithCaptionMessage: {
        message: {
          documentMessage: { fileName: "nota.pdf", mimetype: "application/pdf", caption: "segue" },
        },
      },
    },
  });
  assert.equal(m.midia?.tipo, "documento");
  assert.equal(m.midia?.nome, "nota.pdf");
  assert.equal(m.texto, "segue");
});

test("lerMensagem: enviada pelo celular da loja", () => {
  const m = lerMensagem({
    key: { id: "ME1", fromMe: true, remoteJid: "5574998125994@s.whatsapp.net" },
    pushName: "Loja",
    message: { extendedTextMessage: { text: "Já está pronto!" } },
  });
  assert.equal(m.fromMe, true);
  assert.equal(m.nomeContato, null, "pushName do fromMe é o da loja, não do cliente");
  assert.equal(m.texto, "Já está pronto!");
});

test("lerMensagem: outro aparelho da mesma conta (:16) não entra no telefone", () => {
  const m = lerMensagem({
    key: { id: "D1", fromMe: false, remoteJid: "557499294500:16@s.whatsapp.net" },
    message: { conversation: "oi" },
  });
  assert.equal(m.numero, "557499294500");
});

test("lerStatus: entregue/lido e ignora o resto", () => {
  assert.deepEqual(lerStatus({ keyId: "X", status: "DELIVERY_ACK" }), {
    id: "X",
    entrega: "entregue",
  });
  assert.deepEqual(lerStatus({ keyId: "X", status: "READ" }), { id: "X", entrega: "lido" });
  assert.deepEqual(lerStatus({ key: { id: "Y" }, update: { status: "PLAYED" } }), {
    id: "Y",
    entrega: "lido",
  });
  assert.equal(lerStatus({ keyId: "X", status: "SERVER_ACK" }), null);
  assert.equal(lerStatus({ status: "READ" }), null);
});

import { chaveAutomacao, pedidoDeParar, pedidoDeVoltar } from "../src/lib/whatsapp/automacoes.ts";

test("PARAR só vale como mensagem inteira", () => {
  for (const t of ["PARAR", "parar.", " Pare! ", "Não quero receber", "SAIR", "stop"]) {
    assert.equal(pedidoDeParar(t), true, t);
  }
  for (const t of [
    "quero cancelar o conserto",
    "não para de travar",
    "pode parar o conserto?",
    "",
    null,
  ]) {
    assert.equal(pedidoDeParar(t), false, String(t));
  }
  assert.equal(pedidoDeVoltar("Voltar"), true);
  assert.equal(pedidoDeVoltar("vou voltar amanhã"), false);
});

test("chaveAutomacao igual à função do banco", () => {
  assert.equal(chaveAutomacao("os_pronta"), "os_pronta");
  assert.equal(chaveAutomacao("pos_venda_123"), "pos_venda");
  assert.equal(chaveAutomacao("cobranca_pix_abc"), "cobranca_lembrete");
  assert.equal(chaveAutomacao("cobranca_paga_abc"), "cobranca_paga");
  assert.equal(chaveAutomacao("cobranca_atraso_abc_7"), "cobranca_atraso");
  assert.equal(chaveAutomacao("cobranca_atrasopix_abc_7"), "cobranca_atraso");
  assert.equal(chaveAutomacao("padrao"), null, "modelo manual da OS não é automação");
  assert.equal(chaveAutomacao(null), null);
});

test("horário de envio do WhatsApp: segundos, texto e {low}; absurdo vira null", () => {
  const agora = Date.parse("2026-10-28T01:00:00Z");
  const seg = agora / 1000 - 3600;
  const iso = new Date(agora - 3_600_000).toISOString();
  assert.equal(lerHorarioEnvio(seg, agora), iso);
  assert.equal(lerHorarioEnvio(String(seg), agora), iso);
  assert.equal(lerHorarioEnvio({ low: seg, high: 0 }, agora), iso);
  assert.equal(lerHorarioEnvio(agora / 1000 + 3600, agora), null, "no futuro");
  assert.equal(lerHorarioEnvio(agora / 1000 - 40 * 86400, agora), null, "velho demais");
  assert.equal(lerHorarioEnvio(undefined, agora), null);
});
