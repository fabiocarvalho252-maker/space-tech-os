// POST /api/contas-inativas/cron — disparado uma vez por dia pelo cron do
// servidor (scripts/contas-inativas.sh). Fica fora do roteador do TanStack
// Start pelo mesmo motivo dos webhooks (sem sessão). O token é derivado da
// service role key, como o do crediário; ?simular=1 só lista o que faria.
import { createHmac, timingSafeEqual } from "node:crypto";
import { processarContasInativas } from "./contas-inativas.server";

function tokenValido(recebido: string | null): boolean {
  const chave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!chave || !recebido) return false;
  const esperado = Buffer.from(
    createHmac("sha256", chave).update("contas-inativas-cron").digest("hex"),
  );
  const obtido = Buffer.from(recebido);
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}

export async function handleContasInativasCron(request: Request): Promise<Response> {
  if (!tokenValido(request.headers.get("x-cron-token"))) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const simular = new URL(request.url).searchParams.get("simular") === "1";
    return Response.json(await processarContasInativas({ simular }));
  } catch (erro) {
    console.error(
      "[Contas inativas] Falha na rotina:",
      erro instanceof Error ? erro.message : erro,
    );
    return new Response("erro", { status: 500 });
  }
}
