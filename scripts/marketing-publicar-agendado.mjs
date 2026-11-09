// Publicação AGENDADA de um conteúdo de marketing aprovado, por ordem do
// administrador (a ordem e a data ficam registradas no commit/memória).
// Usa a mesma função do botão "Publicar" (publicacao.server.ts), então faz as
// mesmas conferências: aprovado, plataforma autorizada, ainda não publicado.
//
// Uso: node scripts/marketing-publicar-agendado.mjs IG-02 instagram,facebook "<quem ordenou>" [marcador-cron]
// Se receber o marcador, remove do crontab a própria linha depois de rodar
// (agendamento de uma vez só).
import { execSync } from "node:child_process";
import { stat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";

const [id, plats, quem, marcador] = process.argv.slice(2);
if (!/^[A-Z]{2}-\d{2}$/.test(id ?? "") || !plats || !quem) {
  console.error("uso: marketing-publicar-agendado.mjs <ID> <instagram,facebook> <quem>");
  process.exit(2);
}
const root = process.cwd();
const agora = () => new Date().toISOString();

const server = await createServer({
  configFile: false,
  root,
  envDir: root,
  logLevel: "error",
  resolve: { alias: { "@": `${root}/src` } },
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});

let falhou = false;
try {
  const { publicarConteudo } = await server.ssrLoadModule("/src/lib/marketing/publicacao.server.ts");
  for (const plataforma of plats.split(",")) {
    // versão = data do arquivo agora (o conteúdo aprovado é o que está no disco)
    let caminho = null;
    for (const pasta of ["aprovados", "publicados"]) {
      const nomes = await readdir(join(root, "marketing", pasta)).catch(() => []);
      const n = nomes.find((x) => x.startsWith(`${id}-`) && x.endsWith(".md"));
      if (n) caminho = join(root, "marketing", pasta, n);
    }
    if (!caminho) throw new Error(`${id} não está aprovado`);
    const versao = (await stat(caminho)).mtime.toISOString();
    try {
      const r = await publicarConteudo({ id, plataforma, versao, email: quem });
      console.log(`${agora()} ${id} ${plataforma} OK ${r.link}`);
    } catch (e) {
      falhou = true;
      console.error(`${agora()} ${id} ${plataforma} ERRO ${e instanceof Error ? e.message : e}`);
    }
  }
} finally {
  await server.close();
}

if (marcador) {
  try {
    execSync(`crontab -l | grep -v -F '${marcador}' | crontab -`, { shell: "/bin/bash" });
    console.log(`${agora()} agendamento ${marcador} removido do crontab`);
  } catch (e) {
    console.error(`${agora()} não consegui remover ${marcador} do crontab: ${e}`);
  }
}

// Commit do registro (arquivo movido para publicados/ e registro-decisoes.md).
try {
  execSync(
    `git add marketing && git commit -q -m "Marketing: ${id} publicado (agendado) em ${plats} — por ordem do Fabio" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push -q`,
    { cwd: root, shell: "/bin/bash" },
  );
} catch (e) {
  console.error(`${agora()} commit/push do registro falhou: ${e}`);
}
process.exit(falhou ? 1 : 0);
