// POST /api/crediario/cron — disparado de hora em hora pelo pg_cron (job
// "crediario-avisos", via pg_net) para enviar os avisos de WhatsApp do
// crediário. Fica fora do roteador do TanStack Start pelo mesmo motivo dos
// webhooks (sem sessão, sem mesma origem). O token vem do Supabase Vault e
// é conferido contra o derivado da service role key.
import { processarAvisosCrediario, tokenCronValido } from "./crediario.server";

export async function handleCrediarioCron(request: Request): Promise<Response> {
  if (!tokenCronValido(request.headers.get("x-cron-token"))) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const resultado = await processarAvisosCrediario(new URL(request.url).origin);
    return Response.json(resultado);
  } catch (erro) {
    console.error(
      "[Crediário] Falha na rotina de avisos:",
      erro instanceof Error ? erro.message : erro,
    );
    return new Response("erro", { status: 500 });
  }
}
