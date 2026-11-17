// Coleta diária das métricas do Instagram (ver src/lib/marketing/ig-metricas.server.ts).
// Uso manual:   node --env-file=.env scripts/marketing-ig-coleta.mjs
// Crontab (NÃO instalado ainda, precisa de aprovação): 30 3 * * * cd /root/space-tech-os && /usr/bin/node --env-file=.env scripts/marketing-ig-coleta.mjs >> marketing/.ig-coleta.log 2>&1
//
// Usa o mesmo código do site (vite SSR), como o worker da agenda. Sai com
// código 1 se a coleta falhar, para o log deixar isso visível.
const raiz = process.cwd();
const stamp = () => new Date().toISOString();

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
  const { coletarDiaria } = await server.ssrLoadModule("/src/lib/marketing/ig-metricas.server.ts");
  const resultado = await coletarDiaria();
  console.log(
    `${stamp()} ig-coleta OK permissoesOk=${resultado.permissoesOk} posts=${resultado.midias} | ${resultado.mensagem}`,
  );
} catch (erro) {
  falhou = true;
  console.error(`${stamp()} ig-coleta ERRO ${erro instanceof Error ? erro.message : erro}`);
} finally {
  await server.close();
}
process.exit(falhou ? 1 : 0);
