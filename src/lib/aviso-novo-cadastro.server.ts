// Aviso ao dono da plataforma no WhatsApp quando uma empresa se cadastra.
// Sai na hora pela página /cadastro (avisarNovoCadastro) e, se não saiu —
// WhatsApp da SPACE TECH desconectado, envio que falhou, página fechada
// antes da chamada —, a conferência do cron da fila (a cada minuto) manda
// depois. O índice whatsapp_messages_aviso_novo_cadastro_key garante um
// aviso por empresa mesmo com as duas tentando juntas.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { avisarDonoDaPlataforma } from "@/lib/whatsapp/whatsapp-service";

/** Cadastros dos últimos dias que a conferência ainda cobre. */
const JANELA_CONFERENCIA_MS = 3 * 24 * 60 * 60 * 1000;
/** Dá tempo da página de cadastro mandar antes do cron. */
const ESPERA_PAGINA_MS = 3 * 60 * 1000;
/** Envio que falhou só é tentado de novo depois disso. */
const ESPERA_NOVA_TENTATIVA_MS = 10 * 60 * 1000;

export function templateAvisoNovoCadastro(empresaId: string) {
  return `aviso_novo_cadastro_${empresaId}`;
}

export async function enviarAvisoNovoCadastro(empresaId: string): Promise<void> {
  const [{ data: perfil }, { data: usuario }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("nome, loja, whatsapp, cidade, created_at")
      .eq("id", empresaId)
      .maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(empresaId),
  ]);
  if (!perfil) return;

  const quando = new Date(perfil.created_at).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  await avisarDonoDaPlataforma(
    templateAvisoNovoCadastro(empresaId),
    [
      `🎉 *Nova empresa cadastrada* — ${perfil.loja || "Loja sem nome"}`,
      `Responsável: ${perfil.nome || "-"}`,
      `WhatsApp: ${perfil.whatsapp || "-"}`,
      `Email: ${usuario?.user?.email || "-"}`,
      ...(perfil.cidade ? [`Cidade: ${perfil.cidade}`] : []),
      "Plano: Teste grátis (7 dias)",
      `Cadastrou em: ${quando.replace(", ", " às ")}`,
      "",
      `Ver no painel: ${import.meta.env["VITE_SITE_URL"] ?? ""}/admin`,
    ].join("\n"),
  );
}

/**
 * Manda o aviso das empresas cadastradas nos últimos dias que ainda não
 * tiveram um aviso enviado. Funcionários de outra empresa (que criaram a
 * conta e depois foram adicionados a uma loja) ficam de fora. Não lança.
 */
export async function conferirAvisosDeCadastro(): Promise<number> {
  try {
    const agora = Date.now();
    const { data: perfis, error } = await supabaseAdmin
      .from("profiles")
      .select("id, created_at")
      .gte("created_at", new Date(agora - JANELA_CONFERENCIA_MS).toISOString())
      .lte("created_at", new Date(agora - ESPERA_PAGINA_MS).toISOString());
    if (error) throw error;
    if (!perfis?.length) return 0;

    const ids = perfis.map((p) => p.id);
    const [{ data: avisos }, { data: membros }] = await Promise.all([
      supabaseAdmin
        .from("whatsapp_messages")
        .select("id, template_id, status, created_at")
        .in("template_id", ids.map(templateAvisoNovoCadastro)),
      supabaseAdmin.from("user_empresas").select("user_id, empresa_id").in("user_id", ids),
    ]);
    const funcionarios = new Set(
      (membros ?? []).filter((m) => m.empresa_id !== m.user_id).map((m) => m.user_id),
    );

    let enviados = 0;
    for (const { id } of perfis) {
      if (funcionarios.has(id)) continue;
      const aviso = avisos?.find((a) => a.template_id === templateAvisoNovoCadastro(id));
      if (aviso) {
        const falhouHaTempo =
          aviso.status === "falhou" &&
          agora - new Date(aviso.created_at).getTime() > ESPERA_NOVA_TENTATIVA_MS;
        if (!falhouHaTempo) continue;
        await supabaseAdmin.from("whatsapp_messages").delete().eq("id", aviso.id);
      }
      await enviarAvisoNovoCadastro(id);
      enviados++;
    }
    return enviados;
  } catch (erro) {
    console.error("[Aviso plataforma] Conferência de avisos de cadastro:", erro);
    return 0;
  }
}
