// Worker da agenda de marketing (crontab, a cada minuto):
//   * * * * * cd /root/space-tech-os && /usr/bin/node scripts/marketing-agenda-worker.mjs >> marketing/.agendamentos.log 2>&1
//
// Lê marketing/agenda.json. Se não houver nada vencido, sai sem carregar o
// servidor (barato, a VPS tem pouca memória). Se houver, carrega o mesmo código
// do site e publica pelo mesmo caminho do botão "Publicar".
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const raiz = process.cwd();
const agora = new Date();
const stamp = () => new Date().toISOString();

let agenda;
try {
  agenda = JSON.parse(await readFile(join(raiz, "marketing", "agenda.json"), "utf8"));
} catch {
  process.exit(0); // sem agenda ainda
}
const vencidos = (agenda.itens ?? []).filter(
  (i) => i.status === "agendado" && Date.parse(i.quando) <= agora.getTime(),
);
if (!vencidos.length) process.exit(0);

const { createServer } = await import("vite");
const server = await createServer({
  configFile: false,
  root: raiz,
  envDir: raiz,
  logLevel: "error",
  resolve: { alias: { "@": `${raiz}/src` } },
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});

let falhou = false;
try {
  const { executarAgendados } = await server.ssrLoadModule("/src/lib/marketing/agenda.server.ts");
  const linhas = await executarAgendados(agora);
  for (const l of linhas) console.log(`${stamp()} ${l}`);
  if (linhas.some((l) => l.includes(" ERRO "))) falhou = true;
} catch (e) {
  falhou = true;
  console.error(`${stamp()} worker ERRO ${e instanceof Error ? e.message : e}`);
} finally {
  await server.close();
}
process.exit(falhou ? 1 : 0);
