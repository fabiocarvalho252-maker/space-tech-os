// Envio da "Consultar Peças" pelo WhatsApp conectado da empresa (Evolution).
// Mesmo caminho da Central de WhatsApp (iniciarConversa): a mensagem fica na
// conversa do fornecedor em /whatsapp, e a resposta dele chega lá — o
// trigger consultas_pecas_resposta marca a consulta como respondida.
// A empresa vem da sessão verificada (empresaDoUsuario), nunca do navegador.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import * as central from "@/lib/whatsapp/central.server";
import { empresaDoUsuario } from "@/lib/whatsapp/whatsapp.functions";

export type ResultadoEnvioConsulta = { ok: true; conversaId: string } | { ok: false; erro: string };

export const enviarConsultaPecaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ consultaId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<ResultadoEnvioConsulta> => {
    let empresaId: string;
    try {
      empresaId = await empresaDoUsuario(context, "fornecedores", "ver");
    } catch {
      return { ok: false, erro: "Seu usuário não tem acesso a Fornecedores." };
    }

    const { data: consulta } = await supabaseAdmin
      .from("fornecedor_consultas_pecas")
      .select("id, status, whatsapp, mensagem, fornecedor_nome")
      .eq("user_id", empresaId)
      .eq("id", data.consultaId)
      .maybeSingle();
    if (!consulta) return { ok: false, erro: "Consulta não encontrada." };
    // Não manda duas vezes a mesma consulta (clique duplo, aba repetida).
    if (consulta.status !== "preparada" && consulta.status !== "falhou") {
      return { ok: false, erro: "Esta consulta já foi enviada." };
    }

    const { data: papel } = await context.supabase.rpc("empresa_role", {
      p_empresa_id: empresaId,
    });
    const ator: central.Ator = {
      id: context.userId,
      papel: (papel as central.Papel | null) ?? null,
    };

    try {
      const { conversaId } = await central.iniciarConversa({
        empresaId,
        ator,
        numero: consulta.whatsapp,
        texto: consulta.mensagem,
      });
      await supabaseAdmin
        .from("fornecedor_consultas_pecas")
        .update({
          status: "enviada",
          enviada_em: new Date().toISOString(),
          erro: null,
          conversa_id: conversaId,
        })
        .eq("id", consulta.id);
      // Conversa nova de fornecedor aparece com o nome dele na Central.
      await supabaseAdmin
        .from("whatsapp_conversas")
        .update({ contact_name: consulta.fornecedor_nome })
        .eq("user_id", empresaId)
        .eq("id", conversaId)
        .is("contact_name", null);
      return { ok: true, conversaId };
    } catch (e) {
      const erro = e instanceof Error ? e.message : "Falha ao enviar.";
      await supabaseAdmin
        .from("fornecedor_consultas_pecas")
        .update({ status: "falhou", erro })
        .eq("id", consulta.id);
      return { ok: false, erro };
    }
  });
