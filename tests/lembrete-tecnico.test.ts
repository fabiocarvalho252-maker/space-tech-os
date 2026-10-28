// Lembrete diário ao técnico (src/lib/whatsapp/lembrete-tecnico.ts). Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { montarLembreteTecnico } from "../src/lib/whatsapp/lembrete-tecnico.ts";

test("sem OS nem visita no dia não manda nada", () => {
  assert.equal(
    montarLembreteTecnico({
      texto: "Olá {{tecnico}}",
      tecnico: "Ana",
      loja: "X",
      os: [],
      visitas: [],
    }),
    null,
  );
});

test("lista agenda em ordem de horário e OS por número", () => {
  const texto = montarLembreteTecnico({
    texto: "Olá {{tecnico}}, sua agenda na {{loja}}:",
    tecnico: "Ana Paula",
    loja: "SPACE TECH",
    os: [
      { numero: 12, aparelho: "iPhone 11", cliente: "Maria", status: "pronto" },
      { numero: 7, aparelho: null, cliente: null, status: "em_reparo" },
    ],
    visitas: [
      { inicio: "2026-10-28T17:00:00Z", titulo: "Entrega", cliente: null },
      { inicio: "2026-10-28T12:30:00Z", titulo: "Visita técnica", cliente: "João" },
    ],
  });
  assert.equal(
    texto,
    [
      "Olá Ana, sua agenda na SPACE TECH:",
      "",
      "📅 *Agenda de hoje*",
      "• 09:30 — Visita técnica (João)",
      "• 14:00 — Entrega",
      "",
      "🔧 *OS com entrega prevista para hoje*",
      "• OS #7 · em reparo",
      "• OS #12 — iPhone 11 (Maria) · pronta para entregar",
    ].join("\n"),
  );
});
