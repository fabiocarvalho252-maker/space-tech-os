// Rotas fora do roteador do TanStack Start (ver src/server.ts):
//
// GET /api/google-drive/callback — volta do Google depois que a pessoa
//   autoriza o Drive. Não dá para ser server function: é uma navegação de
//   topo vinda de accounts.google.com. Quem pediu vem do `state` assinado
//   (google-drive.server.ts), não da sessão.
// POST /api/backup-drive/cron — rotina diária, chamada por
//   scripts/backup-banco.sh. Token derivado da service role key, como o das
//   contas inativas.
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ID_PLATAFORMA, rodarBackupsAgendados } from "./backup.server";
import { GoogleDriveError, lerState, revogar, trocarCodigo } from "./google-drive.server";

function voltar(id: string | null, resultado: "conectado" | "erro", motivo?: string): Response {
  const destino = new URLSearchParams({ drive: resultado });
  if (motivo) destino.set("motivo", motivo);
  const caminho =
    id === ID_PLATAFORMA ? `/admin?${destino}` : `/configuracoes?aba=backup&${destino}`;
  return new Response(null, { status: 302, headers: { location: caminho } });
}

export async function handleGoogleDriveCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const state = lerState(url.searchParams.get("state"));
  if (!state) return voltar(null, "erro", "O link de conexão expirou. Tente de novo.");
  const code = url.searchParams.get("code");
  if (!code) {
    const negado = url.searchParams.get("error") === "access_denied";
    return voltar(state.id, "erro", negado ? "Você não autorizou o acesso." : "Falha no Google.");
  }
  try {
    const { refreshToken, email } = await trocarCodigo(code);
    const { data: anterior } = await supabaseAdmin
      .from("backup_google_drive")
      .select("refresh_token, email")
      .eq("id", state.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("backup_google_drive").upsert({
      id: state.id,
      user_id: state.id === ID_PLATAFORMA ? null : state.userId,
      email,
      refresh_token: refreshToken,
      // Outra conta Google: a pasta antiga não existe nesse Drive.
      ...(anterior && anterior.email !== email ? { pasta_id: null } : {}),
      ultimo_erro: null,
      ultimo_status: null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    if (anterior && anterior.refresh_token !== refreshToken) await revogar(anterior.refresh_token);
    return voltar(state.id, "conectado");
  } catch (erro) {
    console.error("[Backup Drive] Falha ao conectar:", erro instanceof Error ? erro.message : erro);
    return voltar(
      state.id,
      "erro",
      erro instanceof GoogleDriveError ? erro.message : "Não foi possível conectar.",
    );
  }
}

function tokenCronValido(recebido: string | null): boolean {
  const chave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!chave || !recebido) return false;
  const esperado = Buffer.from(
    createHmac("sha256", chave).update("backup-drive-cron").digest("hex"),
  );
  const obtido = Buffer.from(recebido);
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}

export async function handleBackupDriveCron(request: Request): Promise<Response> {
  if (!tokenCronValido(request.headers.get("x-cron-token"))) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    return Response.json(await rodarBackupsAgendados());
  } catch (erro) {
    console.error("[Backup Drive] Falha na rotina:", erro instanceof Error ? erro.message : erro);
    return new Response("erro", { status: 500 });
  }
}
