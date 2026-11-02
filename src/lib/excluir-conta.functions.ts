// "Excluir minha conta" (exigência da Google Play para apps que criam conta).
// Dono da empresa: apaga a empresa inteira — todos os dados (exclusão em
// cascata a partir do usuário, igual à limpeza de contas inativas) e os
// logins dos funcionários. Funcionário: apaga só o próprio login.
// A senha é conferida no navegador antes de chamar esta função.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SITE_ADMIN_EMAIL } from "@/lib/site-admin";

export const excluirMinhaContaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ confirmacao: z.literal("EXCLUIR") }).parse(data))
  .handler(async ({ context }): Promise<{ tipo: "empresa" | "funcionario" }> => {
    if (context.claims["email"] === SITE_ADMIN_EMAIL) {
      throw new Error("A conta do administrador do site não pode ser excluída por aqui.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    const { data: vinculos, error } = await supabaseAdmin
      .from("user_empresas")
      .select("user_id, empresa_id");
    if (error) throw error;
    const ehFuncionario = (vinculos ?? []).some((v) => v.user_id === uid && v.empresa_id !== uid);

    if (!ehFuncionario) {
      const funcionarios = (vinculos ?? [])
        .filter((v) => v.empresa_id === uid && v.user_id !== uid)
        .map((v) => v.user_id);
      for (const f of new Set(funcionarios)) {
        const { error: e } = await supabaseAdmin.auth.admin.deleteUser(f);
        if (e) console.error("[excluir-conta] funcionário", f, e.message);
        else await supabaseAdmin.from("audit_log").delete().eq("user_id", f);
      }
    }

    const { error: erroExclusao } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (erroExclusao) throw new Error("Não foi possível excluir a conta: " + erroExclusao.message);
    // A auditoria não tem chave para a conta (para não travar a cascata).
    await supabaseAdmin.from("audit_log").delete().eq("user_id", uid);
    return { tipo: ehFuncionario ? "funcionario" : "empresa" };
  });
