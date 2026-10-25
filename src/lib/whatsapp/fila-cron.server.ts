// POST /api/whatsapp/fila/cron — worker da Fila WhatsApp, chamado a cada
// minuto pelo cron do servidor (scripts/whatsapp-fila.sh). Para cada empresa
// com o WhatsApp conectado: a cada 10 minutos gera as mensagens automáticas
// (pesquisas, aniversário, boas-vindas, resumo semanal) e, sempre, envia a
// fila por até ~50 s respeitando intervalo, horário e limite da empresa.
// Assim nada depende de alguém estar com o sistema aberto. Fica fora do
// roteador do TanStack Start (sem sessão); token derivado da service role
// key, como o das contas inativas.
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evolutionConfigurado } from "./evolution-api";
import { processarFila, rodarAutomacoes } from "./whatsapp-service";

const TEMPO_FILA_MS = 50_000;

function tokenValido(recebido: string | null): boolean {
  const chave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!chave || !recebido) return false;
  const esperado = Buffer.from(
    createHmac("sha256", chave).update("whatsapp-fila-cron").digest("hex"),
  );
  const obtido = Buffer.from(recebido);
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}

async function rodarEmpresa(empresaId: string, automacoes: boolean) {
  if (automacoes) {
    await rodarAutomacoes(empresaId).catch((e: unknown) =>
      console.error(
        `[Fila WhatsApp] Automações da empresa ${empresaId}:`,
        e instanceof Error ? e.message : e,
      ),
    );
  }
  return processarFila(empresaId, { tempoMaxMs: TEMPO_FILA_MS });
}

export async function handleWhatsappFilaCron(request: Request): Promise<Response> {
  if (!tokenValido(request.headers.get("x-cron-token"))) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!evolutionConfigurado()) return Response.json({ empresas: 0 });
  try {
    const { data: conexoes, error } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("user_id")
      .eq("status", "conectado");
    if (error) throw error;

    const automacoes = new Date().getUTCMinutes() % 10 === 0;
    const resultados = await Promise.all(
      (conexoes ?? []).map(async ({ user_id }) => {
        try {
          return { empresa: user_id, ...(await rodarEmpresa(user_id, automacoes)) };
        } catch (e) {
          const motivo = e instanceof Error ? e.message : String(e);
          console.error(`[Fila WhatsApp] Empresa ${user_id}:`, motivo);
          return { empresa: user_id, erro: motivo };
        }
      }),
    );
    return Response.json({ automacoes, empresas: resultados });
  } catch (erro) {
    console.error("[Fila WhatsApp] Falha no worker:", erro instanceof Error ? erro.message : erro);
    return new Response("erro", { status: 500 });
  }
}
