// Ponto de entrada do office-runner. Escuta só em 127.0.0.1 (o Nginx é a
// frente pública). Falha na subida se a configuração estiver incompleta.
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { carregarConfig } from "./config.ts";
import { criarApp } from "./app.ts";
import type { VerificarToken } from "./autenticacao/admin.ts";

const HOST = "127.0.0.1";

async function main(): Promise<void> {
  // Garante que nenhuma chave de API seja usada: só o login do plano Pro.
  delete process.env["ANTHROPIC_API_KEY"];
  delete process.env["ANTHROPIC_AUTH_TOKEN"];
  const config = carregarConfig(process.env);
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verificar: VerificarToken = async (token) => {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  };

  const claudeHome = config.OFFICE_CLAUDE_HOME || join(homedir(), ".claude");
  const app = await criarApp({ config, verificar, consulta: query, claudeHome });
  await app.listen({ port: config.PORT, host: HOST });
  app.log.info({ porta: config.PORT, host: HOST }, "office-runner no ar");
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
