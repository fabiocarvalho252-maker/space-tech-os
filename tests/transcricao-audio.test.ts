// Testes das regras da transcrição de áudio do WhatsApp. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEM_FALA,
  TRANSCRICAO_MAX_CARACTERES,
  deveTranscrever,
  limparTranscricao,
  textoParaRobo,
} from "../src/lib/whatsapp/transcricao.ts";
import { lerMensagem } from "../src/lib/whatsapp/webhook-parse.ts";

test("deveTranscrever: só áudio, curto e pequeno", () => {
  assert.equal(deveTranscrever({ tipo: "audio", mime: "audio/ogg", segundos: 12 }), true);
  assert.equal(deveTranscrever({ tipo: "audio", mime: "audio/ogg", segundos: 600 }), false);
  assert.equal(deveTranscrever({ tipo: "audio", mime: "audio/ogg", tamanho: 10e6 }), false);
  assert.equal(deveTranscrever({ tipo: "imagem", mime: "image/jpeg" }), false);
  assert.equal(deveTranscrever({ tipo: "audio", mime: "application/octet-stream" }), false);
});

test("limparTranscricao: tira prefixo/aspas e reconhece silêncio", () => {
  assert.equal(limparTranscricao('Transcrição: "Minha tela quebrou"'), "Minha tela quebrou");
  assert.equal(limparTranscricao("  oi,\n tudo bem?  "), "oi, tudo bem?");
  assert.equal(limparTranscricao(""), SEM_FALA);
  assert.equal(limparTranscricao("[inaudível]"), SEM_FALA);
  assert.equal(limparTranscricao(`${SEM_FALA}.`), SEM_FALA);
  assert.equal(limparTranscricao("a".repeat(5000)).length, TRANSCRICAO_MAX_CARACTERES + 1);
});

test("textoParaRobo: silêncio não vira texto", () => {
  assert.equal(textoParaRobo(SEM_FALA), null);
  assert.equal(textoParaRobo(null), null);
  assert.equal(textoParaRobo("quero um orçamento"), "quero um orçamento");
});

test("lerMensagem: nota de voz traz a duração", () => {
  const m = lerMensagem({
    key: { id: "AUD1", remoteJid: "5574998125994@s.whatsapp.net" },
    messageType: "audioMessage",
    message: { audioMessage: { mimetype: "audio/ogg; codecs=opus", seconds: 7, ptt: true } },
  });
  assert.equal(m.midia?.tipo, "audio");
  assert.equal(m.midia?.mime, "audio/ogg");
  assert.equal(m.midia?.segundos, 7);
});
