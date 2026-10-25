// Limite diário de uso da SPACE TECH IA por empresa (tabela ia_uso_diario,
// migration 20261025060000). Cada pergunta no chat, ou geração de texto na
// OS, conta 1 uso; o contador zera à meia-noite de Brasília. O limite vem de
// IA_LIMITE_DIARIO_EMPRESA no .env (padrão 30).
import { IAIndisponivelError } from "./provider.server";

const LIMITE_PADRAO = 30;

function limiteDiario(): number {
  const n = Number(process.env["IA_LIMITE_DIARIO_EMPRESA"]);
  return Number.isInteger(n) && n > 0 ? n : LIMITE_PADRAO;
}

async function resolverEmpresaId(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: membership } = await supabaseAdmin
    .from("user_empresas")
    .select("empresa_id")
    .eq("user_id", userId);
  return (
    membership?.find((m) => m.empresa_id !== userId)?.empresa_id ??
    membership?.[0]?.empresa_id ??
    userId
  );
}

// As funções são novas e ainda não estão nos tipos gerados do Supabase.
type RpcSemTipo = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: Error | null }>;

async function rpc(fn: string, args: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return (supabaseAdmin.rpc as unknown as RpcSemTipo).call(supabaseAdmin, fn, args);
}

/** Conta 1 uso da IA para a empresa do usuário; erro amigável se o limite do dia acabou. */
export async function consumirUsoIA(userId: string): Promise<void> {
  const limite = limiteDiario();
  const { data, error } = await rpc("consumir_uso_ia", {
    p_empresa: await resolverEmpresaId(userId),
    p_limite: limite,
  });
  if (error) throw error;
  if (data !== true) {
    throw new IAIndisponivelError(
      `Sua empresa já usou os ${limite} pedidos de IA de hoje. O limite renova à meia-noite.`,
    );
  }
}

/** Devolve o uso quando a IA não chegou a responder (provedor fora do ar etc.). */
export async function devolverUsoIA(userId: string): Promise<void> {
  await rpc("devolver_uso_ia", { p_empresa: await resolverEmpresaId(userId) }).catch(() => {});
}
