// Landing page pública (/): leitura aberta (conteúdo + planos ativos) e
// edição restrita ao administrador do site (/admin/landing). As tabelas
// site_landing e plans não são legíveis por visitantes (RLS), por isso tudo
// passa por aqui com a service role.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checarSiteAdmin } from "@/lib/site-admin.functions";
import { landingSchema, normalizarLanding, LANDING_PADRAO, type LandingConteudo } from "./conteudo";

const BUCKET = "landing";

export type PlanoPublico = {
  id: string;
  nome: string;
  descricao: string | null;
  precoMensal: number | null;
  precoAnual: number | null;
  descontoAnualPct: number | null;
  recursos: string[];
};

async function lerConteudo(): Promise<LandingConteudo> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- site_landing not in the generated Database type yet
    .from("site_landing" as any)
    .select("conteudo")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return normalizarLanding((data as { conteudo?: unknown } | null)?.conteudo);
}

async function lerPlanos(): Promise<PlanoPublico[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plans, error } = await supabaseAdmin
    .from("plans")
    .select("id, name, description, monthly_price, annual_price, annual_discount_pct")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  if (!plans.length) return [];

  const { data: features, error: featError } = await supabaseAdmin
    .from("plan_features")
    .select("plan_id, feature")
    .eq("enabled", true)
    .in(
      "plan_id",
      plans.map((p) => p.id),
    );
  if (featError) throw featError;

  return plans.map((p) => ({
    id: p.id,
    nome: p.name,
    descricao: p.description,
    precoMensal: p.monthly_price,
    precoAnual: p.annual_price,
    descontoAnualPct: p.annual_discount_pct,
    recursos: (features ?? []).filter((f) => f.plan_id === p.id).map((f) => f.feature),
  }));
}

// Pública (sem login). Nunca derruba a landing: se o banco falhar, volta
// o conteúdo padrão e a seção de planos mostra "Consulte as condições".
export const obterLandingPublica = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ conteudo: LandingConteudo; planos: PlanoPublico[] }> => {
    const [conteudo, planos] = await Promise.all([
      lerConteudo().catch(() => LANDING_PADRAO),
      lerPlanos().catch(() => []),
    ]);
    return { conteudo, planos };
  },
);

export const obterLandingAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LandingConteudo> => {
    checarSiteAdmin(context.claims);
    return lerConteudo();
  });

export const salvarLanding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => landingSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- site_landing not in the generated Database type yet
      .from("site_landing" as any)
      .upsert({ id: 1, conteudo: data, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { ok: true };
  });

const EXTENSOES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Devolve o token de upload assinado para o navegador subir a foto direto
// no bucket (sem passar o arquivo pelo servidor). A URL pública é montada no
// navegador: aqui a URL do Supabase é a interna (localhost:8000).
export const prepararUploadLanding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ tipo: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ path: string; token: string }> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${crypto.randomUUID()}.${EXTENSOES[data.tipo]}`;
    const { data: assinada, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: assinada.token };
  });
