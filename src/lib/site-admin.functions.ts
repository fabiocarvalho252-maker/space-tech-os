import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SITE_ADMIN_EMAIL } from "@/lib/site-admin";
import {
  atualizarStatusSistema,
  conectarSistema,
  desconectarSistema,
  obterStatusSistemaSalvo,
  type WhatsappSistemaConexao,
} from "@/lib/whatsapp/system-instance";

// getRequest().url reflects whatever host/port this Node process is actually
// bound to behind the reverse proxy (the internal dev port), not the public
// https:// domain — using it as the magic-link redirect sent an admin
// "entering" an empresa's panel to an unreachable internal URL instead of
// the real site. VITE_-prefixed vars in this project are only injected into
// import.meta.env (verified: process.env has none of them at runtime, even
// though client.ts:33 already reads VITE_SUPABASE_URL this same way) — read
// VITE_SITE_URL from there instead of process.env.
function origemPublicaServer(): string {
  return import.meta.env["VITE_SITE_URL"] ?? "";
}

// Hardcoded on purpose: this is a single-operator platform-wide view (every
// empresa that has ever signed up, across every tenant), not a permission a
// company admin can be granted — there is no "site owner" role/flag in the
// schema, and adding one just for a single person isn't worth the surface
// area. Authorization is enforced here, server-side, not by hiding a link.
export { SITE_ADMIN_EMAIL };

export function checarSiteAdmin(claims: Record<string, unknown>) {
  if (claims["email"] !== SITE_ADMIN_EMAIL) {
    throw new Error("Acesso restrito ao administrador do site.");
  }
}

export type EmpresaDoSite = {
  id: string;
  nome: string | null;
  loja: string | null;
  email: string | null;
  whatsapp: string | null;
  cnpjCpf: string | null;
  endereco: string | null;
  cidade: string | null;
  criadoEm: string;
  ultimoLogin: string | null;
  totalOrdens: number;
  totalMembros: number;
  plano: string;
  acessoAte: string | null;
  planoSolicitado: string | null;
  planoSolicitadoEm: string | null;
  iaCreditos: number;
};

export const listarEmpresasDoSite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ empresas: EmpresaDoSite[] }> => {
    checarSiteAdmin(context.claims);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: empresas, error: empresasErro } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, nome, loja, whatsapp, cnpj_cpf, endereco, cidade, created_at, plano, acesso_ate, plano_solicitado, plano_solicitado_em, ia_creditos",
      )
      .order("created_at", { ascending: false });
    if (empresasErro) throw empresasErro;
    if (!empresas?.length) return { empresas: [] };

    const ids = empresas.map((e) => e.id);

    const [{ data: usersPage, error: usersErro }, { data: ordens }, { data: membros }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
        supabaseAdmin.from("ordens_servico").select("user_id").in("user_id", ids),
        supabaseAdmin.from("user_empresas").select("empresa_id").in("empresa_id", ids),
      ]);
    if (usersErro) throw usersErro;

    const porId = new Map(usersPage.users.map((u) => [u.id, u]));
    const totalOrdensPorEmpresa = new Map<string, number>();
    for (const o of ordens ?? []) {
      totalOrdensPorEmpresa.set(o.user_id, (totalOrdensPorEmpresa.get(o.user_id) ?? 0) + 1);
    }
    const totalMembrosPorEmpresa = new Map<string, number>();
    for (const m of membros ?? []) {
      totalMembrosPorEmpresa.set(m.empresa_id, (totalMembrosPorEmpresa.get(m.empresa_id) ?? 0) + 1);
    }

    return {
      empresas: empresas.map((e) => {
        const u = porId.get(e.id);
        return {
          id: e.id,
          nome: e.nome,
          loja: e.loja,
          email: u?.email ?? null,
          whatsapp: e.whatsapp,
          cnpjCpf: e.cnpj_cpf,
          endereco: e.endereco,
          cidade: e.cidade,
          criadoEm: e.created_at,
          ultimoLogin: u?.last_sign_in_at ?? null,
          totalOrdens: totalOrdensPorEmpresa.get(e.id) ?? 0,
          totalMembros: totalMembrosPorEmpresa.get(e.id) ?? 0,
          plano: e.plano,
          acessoAte: e.acesso_ate,
          planoSolicitado: e.plano_solicitado,
          planoSolicitadoEm: e.plano_solicitado_em,
          iaCreditos: e.ia_creditos,
        };
      }),
    };
  });

const PLANOS_COM_VALIDADE = ["mensal", "anual"] as const;
const PLANOS_PAGOS = [...PLANOS_COM_VALIDADE, "vitalicio"] as const;
const BONUS_CREDITOS_IA_POR_PLANO = 10;

const planoSchema = z.object({
  empresaId: z.guid(),
  plano: z.enum(["trial", "mensal", "anual", "vitalicio", "suspenso"]),
  acessoAte: z.string().nullable(),
  // Renovação mensal: descontar os créditos de indicação disponíveis
  // (R$ 10 por indicação convertida) desta mensalidade.
  usarDescontoIndicacao: z.boolean().optional(),
});

export const atualizarPlanoEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => planoSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ descontoIndicacao: number }> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Contratar (ou renovar) um plano pago dá um bônus de créditos de IA —
    // teste grátis não dá, só quando a empresa vira cliente pagante.
    let iaCreditosBonus: { ia_creditos: number } | Record<string, never> = {};
    if ((PLANOS_PAGOS as readonly string[]).includes(data.plano)) {
      const { data: atual, error: erroLeitura } = await supabaseAdmin
        .from("profiles")
        .select("ia_creditos")
        .eq("id", data.empresaId)
        .single();
      if (erroLeitura) throw erroLeitura;
      iaCreditosBonus = { ia_creditos: atual.ia_creditos + BONUS_CREDITOS_IA_POR_PLANO };
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plano: data.plano,
        acesso_ate: (PLANOS_COM_VALIDADE as readonly string[]).includes(data.plano)
          ? data.acessoAte
          : null,
        // Setting a plano from here always resolves whatever the empresa
        // asked for on /assinatura, even if a different plano was granted.
        plano_solicitado: null,
        plano_solicitado_em: null,
        ...iaCreditosBonus,
      })
      .eq("id", data.empresaId);
    if (error) throw error;

    const indicacoes = await import("@/lib/referrals/commission-service");
    // Empresa virou pagante: se ela foi indicada, quem indicou ganha o
    // crédito de desconto (só na primeira ativação paga).
    if (data.plano === "mensal" || data.plano === "anual" || data.plano === "vitalicio") {
      await indicacoes.processarIndicacaoAtivacaoManual(data.empresaId, data.plano);
    }

    let descontoIndicacao = 0;
    if (data.plano === "mensal" && data.usarDescontoIndicacao) {
      const mensalidade = await indicacoes.mensalidadeDaEmpresa(data.empresaId);
      if (mensalidade) {
        descontoIndicacao = await indicacoes.aplicarDescontoIndicacao(
          data.empresaId,
          mensalidade,
          `Renovação mensal pelo admin${data.acessoAte ? ` (acesso até ${data.acessoAte})` : ""}`,
        );
      }
    }
    return { descontoIndicacao };
  });

export type DescontoIndicacaoEmpresa = {
  disponivel: number;
  creditos: number;
  mensalidade: number | null;
  /** Quanto seria descontado agora numa renovação mensal. */
  previa: number;
};

export const obterDescontoIndicacaoEmpresa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ empresaId: z.guid() }).parse(data))
  .handler(async ({ data, context }): Promise<DescontoIndicacaoEmpresa> => {
    checarSiteAdmin(context.claims);
    const indicacoes = await import("@/lib/referrals/commission-service");
    const [saldo, mensalidade] = await Promise.all([
      indicacoes.saldoDescontoIndicacao(data.empresaId),
      indicacoes.mensalidadeDaEmpresa(data.empresaId),
    ]);
    const previa = mensalidade
      ? await indicacoes.previaDescontoIndicacao(data.empresaId, mensalidade)
      : 0;
    return { ...saldo, mensalidade, previa };
  });

const creditosIASchema = z.object({
  empresaId: z.guid(),
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0, "Informe uma quantidade diferente de zero."),
});

export const ajustarCreditosIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => creditosIASchema.parse(data))
  .handler(async ({ data, context }): Promise<{ iaCreditos: number }> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: atual, error: erroLeitura } = await supabaseAdmin
      .from("profiles")
      .select("ia_creditos")
      .eq("id", data.empresaId)
      .single();
    if (erroLeitura) throw erroLeitura;

    const novoSaldo = Math.max(0, atual.ia_creditos + data.delta);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ ia_creditos: novoSaldo })
      .eq("id", data.empresaId);
    if (error) throw error;
    return { iaCreditos: novoSaldo };
  });

function gerarSenhaAleatoria(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let senha = "";
  for (let i = 0; i < 12; i++) senha += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return senha;
}

// Permanently deletes an empresa's account. profiles.id → auth.users(id) ON
// DELETE CASCADE, and every tenant table's own user_id also references
// auth.users(id) ON DELETE CASCADE (see the schema migrations) — deleting
// the auth user is enough for Postgres to cascade through the whole
// company's data (OS, vendas, estoque, financeiro, user_empresas
// memberships, etc). There is no undo.
export const excluirEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ empresaId: z.guid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);
    if (data.empresaId === context.userId) {
      throw new Error("Você não pode excluir a própria conta de administrador.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.empresaId);
    if (error) throw error;
    return { ok: true };
  });

export const resetarSenhaEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ empresaId: z.guid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ senha: string }> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const senha = gerarSenhaAleatoria();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.empresaId, {
      password: senha,
    });
    if (error) throw error;
    return { senha };
  });

const alterarEmailEmpresaSchema = z.object({
  empresaId: z.guid(),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});

// email_confirm: true skips Supabase's "confirm your new address" email —
// the site admin is changing this on the empresa's behalf (e.g. they lost
// access to the old inbox), so the new address must work immediately,
// mirroring resetarSenhaEmpresa above (also an instant, admin-driven change).
export const alterarEmailEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => alterarEmailEmpresaSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ email: string }> => {
    checarSiteAdmin(context.claims);
    // SITE_ADMIN_EMAIL is a hardcoded literal (see checarSiteAdmin above), not
    // a role — changing it here would lock the operator out of /admin
    // immediately, since the code would no longer recognize the new address.
    if (data.empresaId === context.userId) {
      throw new Error(
        "Este é o e-mail fixo do administrador do site — não pode ser trocado por aqui.",
      );
    }
    if (data.email === SITE_ADMIN_EMAIL) {
      throw new Error("Este e-mail é reservado para o administrador do site.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.empresaId, {
      email: data.email,
      email_confirm: true,
    });
    if (error) throw error;
    return { email: data.email };
  });

// "Entrar no painel" from /admin — reuses the exact same passwordless
// mechanism as gerarAcessoCliente (src/lib/cliente-conta/cliente-conta.functions.ts):
// an admin-generated Supabase magic link, never emailed, just handed back to
// the caller to navigate to directly. Unlike resetarSenhaEmpresa, this never
// touches the empresa's own password — it's the site admin borrowing a
// session, not changing how the empresa logs in.
export const entrarComoEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ empresaId: z.guid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ link: string }> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error: userErro } = await supabaseAdmin.auth.admin.getUserById(
      data.empresaId,
    );
    if (userErro || !userData?.user?.email) {
      throw new Error("Esta empresa não tem um e-mail de login válido.");
    }

    const origin = origemPublicaServer() || new URL(getRequest().url).origin;
    const { data: gerado, error: erroLink } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
      options: { redirectTo: `${origin}/dashboard` },
    });
    if (erroLink || !gerado?.properties?.action_link) {
      throw new Error(erroLink?.message ?? "Não foi possível gerar o acesso a essa empresa.");
    }

    return { link: gerado.properties.action_link };
  });

// The platform-wide "spacetech_system" WhatsApp instance that sends
// activation codes for every empresa signup (see
// src/lib/auth/ativacao-whatsapp.functions.ts) — paired once by the SPACE
// TECH operator from this screen, distinct from each empresa's own
// WhatsApp connection at /whatsapp.
export const conectarWhatsappSistema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappSistemaConexao> => {
    checarSiteAdmin(context.claims);
    const origin = new URL(getRequest().url).origin;
    return conectarSistema(origin);
  });

export const statusWhatsappSistema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappSistemaConexao | null> => {
    checarSiteAdmin(context.claims);
    const existente = await obterStatusSistemaSalvo();
    if (!existente) return null;
    if (existente.status === "conectado") return existente;
    return atualizarStatusSistema();
  });

export const desconectarWhatsappSistema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappSistemaConexao | null> => {
    checarSiteAdmin(context.claims);
    return desconectarSistema();
  });

// "Planos" section of /admin — pricing (starts NULL, see the
// 20260817170000_plans_features migration) and per-plan feature toggles.
// plans/plan_features are read by every empresa (RLS: select for any
// authenticated user), but only the site admin can write — enforced here,
// not by RLS, same pattern as every other write in this file.
export type PlanoDoSite = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  monthlyPrice: number | null;
  annualPrice: number | null;
  annualDiscountPct: number | null;
  features: { feature: string; enabled: boolean }[];
};

export const listarPlanosDoSite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanoDoSite[]> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plans, error } = await supabaseAdmin
      .from("plans")
      .select("id, slug, name, description, monthly_price, annual_price, annual_discount_pct")
      // Planos desativados (ex.: Profissional) somem do painel também.
      .eq("active", true)
      .order("sort_order");
    if (error) throw error;

    const { data: features, error: featError } = await supabaseAdmin
      .from("plan_features")
      .select("plan_id, feature, enabled");
    if (featError) throw featError;

    return plans.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      monthlyPrice: p.monthly_price,
      annualPrice: p.annual_price,
      annualDiscountPct: p.annual_discount_pct,
      features: (features ?? [])
        .filter((f) => f.plan_id === p.id)
        .map((f) => ({ feature: f.feature, enabled: f.enabled })),
    }));
  });

// Preço em branco no formulário chega aqui como null — nunca 0. NULL
// continua significando "não configurado"; só o admin, digitando um valor
// de verdade, faz esse plano ficar contratável de fato.
const atualizarPlanoSchema = z.object({
  planoId: z.guid(),
  monthlyPrice: z.number().nonnegative().nullable(),
  annualPrice: z.number().nonnegative().nullable(),
  annualDiscountPct: z.number().min(0).max(100).nullable(),
});

export const atualizarPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => atualizarPlanoSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("plans")
      .update({
        monthly_price: data.monthlyPrice,
        annual_price: data.annualPrice,
        annual_discount_pct: data.annualDiscountPct,
      })
      .eq("id", data.planoId);
    if (error) throw error;
    return { ok: true };
  });

const atualizarPlanoFeatureSchema = z.object({
  planoId: z.guid(),
  feature: z.string().min(1),
  enabled: z.boolean(),
});

export const atualizarPlanoFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => atualizarPlanoFeatureSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("plan_features")
      .update({ enabled: data.enabled })
      .eq("plan_id", data.planoId)
      .eq("feature", data.feature);
    if (error) throw error;
    return { ok: true };
  });

const alterarPlanoEmpresaSchema = z.object({
  empresaId: z.guid(),
  planoId: z.guid(),
});

// Muda o tier (Básico/Profissional) de uma empresa específica — distinto de
// atualizarPlanoEmpresa (acima), que muda o ciclo de cobrança (plano/
// acesso_ate). Empresa e login não podem escolher o próprio plan_id: só
// chega aqui pela ação do site admin.
export const alterarPlanoEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => alterarPlanoEmpresaSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ plan_id: data.planoId })
      .eq("id", data.empresaId);
    if (error) throw error;
    return { ok: true };
  });

// ============================================================
// Convite para reativar a conta, pelo WhatsApp do sistema
// ============================================================
// Mensagem escrita pela IA da plataforma (não gasta créditos de IA da
// empresa — quem pede é o operador da SPACE TECH), revisada/editada pelo
// admin na tela e só então enviada pelo número do sistema.

const reativacaoSchema = z.object({ empresaId: z.guid() });

async function carregarEmpresaParaReativacao(empresaId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: perfil, error }, { count: totalOrdens }, { data: usuario }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("nome, loja, whatsapp, plano, acesso_ate")
      .eq("id", empresaId)
      .single(),
    supabaseAdmin
      .from("ordens_servico")
      .select("id", { count: "exact", head: true })
      .eq("user_id", empresaId),
    supabaseAdmin.auth.admin.getUserById(empresaId),
  ]);
  if (error || !perfil) throw new Error("Empresa não encontrada.");
  return {
    ...perfil,
    totalOrdens: totalOrdens ?? 0,
    ultimoLogin: usuario?.user?.last_sign_in_at ?? null,
  };
}

export const gerarMensagemReativacaoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => reativacaoSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ texto: string }> => {
    checarSiteAdmin(context.claims);
    const empresa = await carregarEmpresaParaReativacao(data.empresaId);
    const { chamarProvedorIA, IAIndisponivelError } = await import("@/lib/ai/provider.server");

    const agora = Date.now();
    const vencido = empresa.acesso_ate && new Date(empresa.acesso_ate).getTime() < agora;
    const situacao =
      empresa.plano === "suspenso"
        ? "conta suspensa"
        : empresa.plano === "trial"
          ? vencido
            ? "período de teste grátis terminou"
            : "em período de teste"
          : vencido
            ? "plano venceu"
            : "plano ativo";
    const diasSemAcesso = empresa.ultimoLogin
      ? Math.floor((agora - new Date(empresa.ultimoLogin).getTime()) / 86_400_000)
      : null;

    const contexto = [
      `Nome do responsável: ${empresa.nome || "não informado"}`,
      `Nome da loja: ${empresa.loja || "não informado"}`,
      `Situação da conta: ${situacao}`,
      diasSemAcesso !== null
        ? `Dias desde o último acesso: ${diasSemAcesso}`
        : "Nunca acessou depois do cadastro",
      `Ordens de serviço já cadastradas no sistema: ${empresa.totalOrdens}`,
      origemPublicaServer()
        ? `Link para reativar o plano: ${origemPublicaServer()}/assinatura`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const resposta = await chamarProvedorIA({
        systemPrompt: `Você escreve mensagens de WhatsApp em nome da equipe SPACE TECH, um sistema de gestão (ordens de serviço, PDV, estoque, financeiro) para assistências técnicas de celular.
Escreva UMA mensagem curta perguntando se a empresa abaixo quer reativar o plano (a assinatura) do SPACE TECH.
Regras:
- Português do Brasil, tom cordial e próximo, como uma pessoa real escrevendo — nada de texto de propaganda.
- Use o primeiro nome do responsável se houver; senão, o nome da loja.
- No máximo 450 caracteres e 2 emojis. Pode usar *negrito* do WhatsApp em no máximo uma expressão.
- Se a empresa já tem ordens de serviço cadastradas, lembre que os dados continuam salvos e voltam a ficar disponíveis com o plano ativo.
- Se houver link para reativar o plano, inclua o link exatamente como foi dado.
- NÃO invente preços, descontos, prazos, brindes nem funcionalidades que não foram citadas.
- Antes da assinatura, faça uma pergunta direta e leve de sim/não, por exemplo "Quer reativar o seu plano?" — sem pressionar.
- A última linha deve ser exatamente: Equipe SPACE TECH
Responda apenas com o texto da mensagem, sem aspas e sem comentários.`,
        mensagens: [{ role: "user", content: contexto }],
        tools: [],
      });
      if (resposta.kind !== "text" || !resposta.text.trim()) {
        throw new Error("A IA não retornou nenhuma mensagem.");
      }
      return { texto: resposta.text.trim() };
    } catch (e) {
      if (e instanceof IAIndisponivelError) throw new Error(e.message);
      throw e;
    }
  });

const enviarReativacaoSchema = z.object({
  empresaId: z.guid(),
  texto: z.string().trim().min(1).max(2000),
});

export const enviarMensagemReativacaoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => enviarReativacaoSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true; via: "sistema" | "loja" }> => {
    checarSiteAdmin(context.claims);
    const empresa = await carregarEmpresaParaReativacao(data.empresaId);
    const numero = (empresa.whatsapp ?? "").replace(/\D/g, "");
    if (numero.length < 10) throw new Error("Esta empresa não tem um WhatsApp válido cadastrado.");

    // 1º: número do sistema. Se estiver desconectado, usa o WhatsApp da
    // própria loja do admin (a conta admin é a empresa SPACE TECH, conectada
    // em /whatsapp — hoje é o mesmo número do sistema), para o convite não
    // depender de reparear o QR do sistema.
    const { obterStatusSistemaSalvo, enviarMensagemSistema } =
      await import("@/lib/whatsapp/system-instance");
    const sistema = await obterStatusSistemaSalvo().catch(() => null);
    if (sistema?.status === "conectado") {
      await enviarMensagemSistema(numero, data.texto);
      return { ok: true, via: "sistema" };
    }

    const { enviarMensagem } = await import("@/lib/whatsapp/whatsapp-service");
    try {
      const msg = await enviarMensagem(context.userId, numero, data.texto);
      if ((msg as { status?: string }).status === "falhou") {
        throw new Error("O WhatsApp recusou o envio. Confira o número da empresa.");
      }
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "";
      if (motivo.includes("não está conectado")) {
        throw new Error(
          'Nenhum WhatsApp conectado: conecte o WhatsApp do sistema (Administração do site) ou o da sua loja (menu WhatsApp), ou use "Abrir no meu WhatsApp".',
        );
      }
      throw e;
    }
    return { ok: true, via: "loja" };
  });

export type PedidoPlanoPendente = { loja: string; plano: string };

/** Pedidos de plano ainda não atendidos — para o sininho do operador. */
export const listarPedidosPlanoPendentesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PedidoPlanoPendente[]> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("loja, nome, plano_solicitado")
      .not("plano_solicitado", "is", null)
      .order("plano_solicitado_em", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((p) => ({
      loja: p.loja || p.nome || "Loja sem nome",
      plano: p.plano_solicitado as string,
    }));
  });
