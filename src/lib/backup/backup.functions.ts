// Server functions da tela de backup no Google Drive (Configurações → Backup
// para a empresa; /admin para a plataforma). A empresa vem sempre da sessão
// verificada e só o dono da conta mexe no backup — o ZIP leva todos os dados
// da empresa. O refresh_token nunca sai do servidor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const escopoSchema = z.object({ escopo: z.enum(["empresa", "plataforma"]) });

export type StatusBackupDrive = {
  configurado: boolean;
  podeGerenciar: boolean;
  conectado: boolean;
  email: string | null;
  automatico: boolean;
  incluirFotos: boolean;
  ultimoBackupEm: string | null;
  ultimoStatus: "ok" | "erro" | null;
  ultimoErro: string | null;
  ultimoArquivo: string | null;
  ultimoTamanho: number | null;
};

type Ctx = {
  supabase: SupabaseClient<Database>;
  userId: string;
  claims: Record<string, unknown>;
};

// Mesma regra de empresaDoUsuario (whatsapp.functions.ts): um convite para
// outra empresa vence a conta própria. Só o dono (empresa = o próprio login)
// gerencia; null = funcionário.
async function idDaConexao(context: Ctx, escopo: "empresa" | "plataforma"): Promise<string | null> {
  if (escopo === "plataforma") {
    const { checarSiteAdmin } = await import("@/lib/site-admin.functions");
    checarSiteAdmin(context.claims);
    return "plataforma";
  }
  const { data } = await context.supabase
    .from("user_empresas")
    .select("empresa_id")
    .eq("user_id", context.userId);
  const outra = (data ?? []).find((m) => m.empresa_id !== context.userId);
  return outra ? null : context.userId;
}

async function exigirDono(context: Ctx, escopo: "empresa" | "plataforma"): Promise<string> {
  const id = await idDaConexao(context, escopo);
  if (!id) throw new Error("Somente o dono da conta pode configurar o backup.");
  return id;
}

export const statusBackupDrive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => escopoSchema.parse(data))
  .handler(async ({ data, context }): Promise<StatusBackupDrive> => {
    const { googleDriveConfigurado } = await import("./google-drive.server");
    const id = await idDaConexao(context, data.escopo);
    const vazio: StatusBackupDrive = {
      configurado: googleDriveConfigurado(),
      podeGerenciar: !!id,
      conectado: false,
      email: null,
      automatico: true,
      incluirFotos: true,
      ultimoBackupEm: null,
      ultimoStatus: null,
      ultimoErro: null,
      ultimoArquivo: null,
      ultimoTamanho: null,
    };
    if (!id) return vazio;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c, error } = await supabaseAdmin
      .from("backup_google_drive")
      .select(
        "email, automatico, incluir_fotos, ultimo_backup_em, ultimo_status, ultimo_erro, ultimo_arquivo, ultimo_tamanho",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!c) return vazio;
    return {
      ...vazio,
      conectado: true,
      email: c.email,
      automatico: c.automatico,
      incluirFotos: c.incluir_fotos,
      ultimoBackupEm: c.ultimo_backup_em,
      ultimoStatus: c.ultimo_status as "ok" | "erro" | null,
      ultimoErro: c.ultimo_erro,
      ultimoArquivo: c.ultimo_arquivo,
      ultimoTamanho: c.ultimo_tamanho,
    };
  });

export const iniciarConexaoDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => escopoSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const id = await exigirDono(context, data.escopo);
    const { urlDeAutorizacao } = await import("./google-drive.server");
    return { url: urlDeAutorizacao({ id, userId: context.userId }) };
  });

export const desconectarDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => escopoSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const id = await exigirDono(context, data.escopo);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { revogarSeNinguemMaisUsa } = await import("./backup.server");
    const { data: c } = await supabaseAdmin
      .from("backup_google_drive")
      .select("refresh_token, email")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("backup_google_drive").delete().eq("id", id);
    if (error) throw error;
    if (c) await revogarSeNinguemMaisUsa(c.refresh_token, c.email);
    return { ok: true };
  });

export const salvarOpcoesBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ automatico: z.boolean(), incluirFotos: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const id = await exigirDono(context, "empresa");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("backup_google_drive")
      .update({
        automatico: data.automatico,
        incluir_fotos: data.incluirFotos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const fazerBackupAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => escopoSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ arquivo: string; tamanho: number }> => {
    const id = await exigirDono(context, data.escopo);
    const { backupEmpresa, backupPlataforma } = await import("./backup.server");
    const r = id === "plataforma" ? await backupPlataforma() : await backupEmpresa(id);
    return { arquivo: r.arquivo, tamanho: r.tamanho };
  });
