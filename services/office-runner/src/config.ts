// Configuração do runner, validada na subida. Falha cedo com mensagem clara.
import { z } from "zod";

const esquema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4317),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  // Opcional: sem ela o runner roda só em memória (sem histórico).
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  // Missões por dia (UTC). Cada missão consome o limite do plano Pro.
  OFFICE_MAX_MISSOES_DIA: z.coerce.number().int().min(1).max(20).default(3),
  // Lotes de sincronização da Equipe por dia (UTC). Cada lote consome o plano Pro.
  OFFICE_MAX_LOTES_SYNC_DIA: z.coerce.number().int().min(1).max(10).default(1),
  ADMIN_EMAIL: z.email().default("admin@spacetech.app"),
  ALLOWED_ORIGIN: z.url().default("https://srmpretech.online"),
  OFFICE_PROJECTS_ROOT: z.string().min(1).default("/srv/office/projects"),
  OFFICE_CLAUDE_HOME: z.string().min(1).default(""),
  OFFICE_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  OFFICE_MAX_COST_USD: z.coerce.number().positive().max(50).default(3),
  OFFICE_MAX_MINUTES: z.coerce.number().positive().max(120).default(30),
  OFFICE_MAX_TURNS: z.coerce.number().int().min(1).max(60).default(10),
  OFFICE_APPROVAL_TIMEOUT_MIN: z.coerce.number().positive().max(60).default(10),
});

export type Config = z.infer<typeof esquema>;

export function carregarConfig(ambiente: Record<string, string | undefined>): Config {
  const resultado = esquema.safeParse(ambiente);
  if (!resultado.success) {
    const campos = resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração inválida do office-runner: ${campos}`);
  }
  return resultado.data;
}
