#!/usr/bin/env node
// Gera um vídeo vertical (1080×1920, 30 fps, H.264 + AAC) a partir de um
// roteiro JSON — tudo com ferramentas gratuitas no próprio servidor:
//   - narração: Kokoro (vozes pt-BR mais naturais, Apache-2.0) em /opt/kokoro —
//     padrão; ou Piper (CC0) em /opt/piper com "motor": "piper" no roteiro;
//   - imagem: cenas HTML animadas, renderizadas quadro a quadro no Chromium
//     headless (navegador.mjs), com telas reais do sistema;
//   - montagem: ffmpeg.
//
//   node marketing/ferramentas/video/gerar-video.mjs marketing/midia/IG-02/roteiro.json
//
// O vídeo sai ao lado do roteiro (video.mp4 + capa.jpg). Ele NÃO é publicado:
// vai para a aprovação como qualquer outro conteúdo.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { abrirNavegador } from "./navegador.mjs";

const FPS = 30;
const L = 1080;
const A = 1920;
const PIPER = "/opt/piper/bin/piper";
const KOKORO_PY = "/opt/kokoro/bin/python";
const KOKORO_APP = "/opt/kokoro/app/falar.py";
const VOZES = "/opt/piper/vozes";

const arquivoRoteiro = resolve(process.argv[2] ?? "");
if (!existsSync(arquivoRoteiro)) {
  console.error("Uso: node gerar-video.mjs <roteiro.json>");
  process.exit(1);
}
const pasta = dirname(arquivoRoteiro);
const roteiro = JSON.parse(readFileSync(arquivoRoteiro, "utf8"));
const tmp = join(pasta, ".tmp");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(tmp, "quadros"), { recursive: true });

const duracao = (arq) =>
  Number(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      arq,
    ])
      .toString()
      .trim(),
  );

// 1) Narração de cada cena.
const motor = roteiro.motor ?? "kokoro";
const PAUSA = roteiro.pausa ?? 0.55;
const comFala = roteiro.cenas.map((c, i) =>
  c.narracao ? { texto: c.narracao, saida: join(tmp, `voz-${i}.wav`) } : null,
);
if (motor === "kokoro") {
  const lote = comFala.filter(Boolean);
  if (lote.length)
    execFileSync(
      "systemd-run",
      [
        "--scope",
        "--quiet",
        "-p",
        "MemoryMax=3G",
        KOKORO_PY,
        KOKORO_APP,
        "--lote",
        roteiro.voz ?? "pm_alex",
        String(roteiro.velocidade ?? 1),
      ],
      { input: JSON.stringify(lote), stdio: ["pipe", "ignore", "inherit"] },
    );
} else {
  const voz = join(VOZES, `pt_BR-${roteiro.voz ?? "faber"}-medium.onnx`);
  for (const f of comFala.filter(Boolean))
    execFileSync(
      PIPER,
      ["-m", voz, "-f", f.saida, "--length-scale", String(roteiro.velocidade ?? 1)],
      {
        input: f.texto,
        stdio: ["pipe", "ignore", "ignore"],
      },
    );
}
let t = 0;
const cenas = roteiro.cenas.map((c, i) => {
  const wav = comFala[i]?.saida ?? null;
  const fala = wav ? duracao(wav) : 0;
  const dur = Math.max(c.minimo ?? 2.5, fala + PAUSA + (c.extra ?? 0));
  const cena = { ...c, i, inicio: t, dur, wav, fala };
  t += dur;
  return cena;
});
const total = t;
console.log(`Cenas: ${cenas.length} · duração ${total.toFixed(1)} s`);

// 2) Página HTML com todas as cenas numa linha do tempo (animações CSS com
// atraso = início da cena). Cada quadro: pausa tudo e posiciona no tempo t.
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch],
  );
const destaque = (s) => esc(s).replace(/\*(.+?)\*/g, '<span class="dest">$1</span>');
const img = (p) => `file://${resolve(pasta, p)}`;

function htmlCena(c) {
  const d = (x) => `${(c.inicio + x).toFixed(3)}s`;
  const base = `style="--ini:${d(0)};--fim:${d(c.dur)};--dur:${c.dur.toFixed(3)}s"`;
  if (c.tipo === "titulo") {
    const bolhas = (c.bolhas ?? [])
      .map(
        (b, k) =>
          `<div class="bolha ${b.lado === "eu" ? "eu" : ""}" style="animation-delay:${d(0.35 + k * 0.45)}">${esc(b.texto)}</div>`,
      )
      .join("");
    return `<section class="cena" ${base}>
      ${c.icone ? `<div class="icone-grande" style="animation-delay:${d(0.1)}"><span style="animation-delay:${d(0.4)}">${esc(c.icone)}</span></div>` : ""}
      ${bolhas ? `<div class="chat">${bolhas}</div>` : ""}
      <h1 class="titulo${c.grande ? " grande" : ""}" style="animation-delay:${d(0.15)}">${destaque(c.texto)}</h1>
      ${c.subtitulo ? `<p class="sub" style="animation-delay:${d(0.35 + (c.bolhas?.length ?? 0) * 0.45)}">${destaque(c.subtitulo)}</p>` : ""}
    </section>`;
  }
  if (c.tipo === "tela") {
    const r = c.recorte ?? { y: 0, altura: 2400 };
    return `<section class="cena" ${base}>
      <h2 class="legenda" style="animation-delay:${d(0.1)}">${destaque(c.texto)}</h2>
      <div class="celular" style="animation-delay:${d(0)}">
        <div class="tela"><img src="${img(c.imagem)}" style="--y:${r.y}px;--y2:${r.y2 ?? r.y}px;animation-delay:${d(0)};animation-duration:${c.dur.toFixed(3)}s" /></div>
      </div>
      ${c.nota ? `<p class="nota">${esc(c.nota)}</p>` : ""}
    </section>`;
  }
  if (c.tipo === "cartao") {
    return `<section class="cena" ${base}>
      <h2 class="legenda" style="animation-delay:${d(0.1)}">${destaque(c.texto)}</h2>
      <div class="cartao" style="animation-delay:${d(0.2)}"><img src="${img(c.imagem)}" style="animation-delay:${d(0.2)};animation-duration:${c.dur.toFixed(3)}s" /></div>
      ${c.legendaImagem ? `<p class="sub" style="animation-delay:${d(0.6)}">${destaque(c.legendaImagem)}</p>` : ""}
      ${c.nota ? `<p class="nota">${esc(c.nota)}</p>` : ""}
    </section>`;
  }
  // final
  return `<section class="cena final" ${base}>
    <div class="marca" style="animation-delay:${d(0.1)}"><span class="foguete">🚀</span><span>SPACE <b>TECH</b> <small>OS</small></span></div>
    <h1 class="titulo" style="animation-delay:${d(0.4)}">${destaque(c.texto)}</h1>
    ${c.subtitulo ? `<p class="sub" style="animation-delay:${d(0.8)}">${destaque(c.subtitulo)}</p>` : ""}
    ${c.cta ? `<div class="cta" style="animation-delay:${d(1.2)}">${esc(c.cta)}</div>` : ""}
    ${c.nota ? `<p class="nota">${esc(c.nota)}</p>` : ""}
  </section>`;
}

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=block">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:${L}px;height:${A}px;overflow:hidden;background:#09090b;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#fff}
.fundo{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(124,58,237,.55),transparent 60%),linear-gradient(160deg,#18181b 0%,#09090b 55%,#1e1036 100%)}
.grade{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:72px 72px;mask-image:radial-gradient(ellipse at top,#000 30%,transparent 75%)}
.cena{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px;padding:120px 80px;opacity:0;animation:aparece var(--dur) linear var(--ini) both}
@keyframes aparece{0%{opacity:0}6%{opacity:1}94%{opacity:1}100%{opacity:0}}
.titulo{font-size:96px;line-height:1.05;font-weight:800;text-align:center;letter-spacing:-2px;animation:sobe .6s cubic-bezier(.2,.8,.2,1) both}
.titulo.grande{font-size:170px;letter-spacing:-4px;line-height:1}
.sub{font-size:52px;font-weight:700;color:#d4d4d8;text-align:center;animation:sobe .6s cubic-bezier(.2,.8,.2,1) both}
.dest{background:linear-gradient(90deg,#a78bfa,#e879f9);-webkit-background-clip:text;color:transparent}
@keyframes sobe{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:none}}
.chat{display:flex;flex-direction:column;gap:22px;width:100%}
.bolha{align-self:flex-start;max-width:78%;background:#202c33;color:#e9edef;font-size:40px;font-weight:500;padding:22px 30px;border-radius:30px 30px 30px 8px;animation:pop .35s cubic-bezier(.2,.9,.3,1.3) both}
.bolha.eu{align-self:flex-end;background:#005c4b;border-radius:30px 30px 8px 30px}
@keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
.icone-grande{width:300px;height:300px;border-radius:80px;background:rgba(124,58,237,.25);box-shadow:0 0 0 6px rgba(167,139,250,.35),0 0 120px rgba(124,58,237,.6);display:flex;align-items:center;justify-content:center;font-size:170px;animation:pop .5s cubic-bezier(.2,.9,.3,1.3) both}
.icone-grande span{display:block;animation:toca .5s ease-in-out 6 both}
@keyframes toca{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}
.legenda{font-size:64px;line-height:1.1;font-weight:800;text-align:center;letter-spacing:-1px;animation:sobe .6s cubic-bezier(.2,.8,.2,1) both}
.celular{width:700px;height:1300px;border-radius:84px;padding:22px;background:#111;box-shadow:0 0 0 4px #3f3f46,0 50px 140px rgba(124,58,237,.45);animation:entra .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes entra{from{opacity:0;transform:translateY(120px) scale(.94)}to{opacity:1;transform:none}}
.tela{width:100%;height:100%;border-radius:64px;overflow:hidden;background:#fff}
.tela img{width:100%;display:block;animation-name:pan;animation-timing-function:ease-in-out;animation-fill-mode:both}
@keyframes pan{from{transform:translateY(calc(var(--y) * -0.6063))}to{transform:translateY(calc(var(--y2) * -0.6063))}}
.cartao{width:920px;border-radius:36px;background:#fff;padding:36px;box-shadow:0 0 0 4px rgba(167,139,250,.5),0 50px 140px rgba(124,58,237,.45);overflow:hidden;animation:entra .7s cubic-bezier(.2,.8,.2,1) both}
.cartao img{width:100%;display:block;animation-name:zoom;animation-timing-function:ease-out;animation-fill-mode:both}
@keyframes zoom{from{transform:scale(1)}to{transform:scale(1.06)}}
.nota{position:absolute;bottom:60px;font-size:26px;color:#a1a1aa}
.marca{display:flex;align-items:center;gap:24px;font-size:72px;font-weight:800;animation:sobe .6s both}
.marca b{color:#a78bfa}.marca small{font-size:36px;color:#a1a1aa}
.foguete{display:flex;align-items:center;justify-content:center;width:120px;height:120px;border-radius:32px;background:linear-gradient(135deg,#7c3aed,#a78bfa);font-size:64px}
.cta{font-size:50px;font-weight:800;background:#7c3aed;padding:30px 60px;border-radius:999px;box-shadow:0 20px 60px rgba(124,58,237,.6);animation:pop .5s both}
</style></head><body><div class="fundo"></div><div class="grade"></div>
${cenas.map(htmlCena).join("\n")}
</body></html>`;
const arqHtml = join(tmp, "composicao.html");
writeFileSync(arqHtml, html);

// 3) Quadros.
const nav = await abrirNavegador({ largura: L, altura: A, escala: 1, mobile: false });
const nQuadros = Math.ceil(total * FPS);
try {
  await nav.ir(`file://${arqHtml}`, 1500);
  await nav.avaliar("document.fonts.ready.then(() => true)");
  await nav.avaliar(
    "Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })))",
  );
  for (let q = 0; q < nQuadros; q++) {
    const ms = (q / FPS) * 1000;
    await nav.avaliar(
      `document.getAnimations().forEach(a => { a.pause(); a.currentTime = ${ms}; })`,
    );
    const r = await nav.cmd("Page.captureScreenshot", { format: "jpeg", quality: 92 });
    writeFileSync(
      join(tmp, "quadros", `q${String(q).padStart(5, "0")}.jpg`),
      Buffer.from(r.data, "base64"),
    );
    if (q % 150 === 0) console.log(`quadro ${q}/${nQuadros}`);
  }
} finally {
  await nav.fechar();
}

// 4) Áudio: narrações nos seus inícios (+0,25 s), mixadas numa faixa só.
const entradas = [];
const filtros = [];
cenas
  .filter((c) => c.wav)
  .forEach((c, k) => {
    entradas.push("-i", c.wav);
    const atraso = Math.round((c.inicio + 0.25) * 1000);
    filtros.push(`[${k}:a]adelay=${atraso}|${atraso},aresample=44100[a${k}]`);
  });
const nAud = filtros.length;
const mix = `${filtros.join(";")};${Array.from({ length: nAud }, (_, k) => `[a${k}]`).join("")}amix=inputs=${nAud}:normalize=0,apad,atrim=0:${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`;
const audio = join(tmp, "narracao.m4a");
execFileSync("ffmpeg", [
  "-y",
  "-v",
  "error",
  ...entradas,
  "-filter_complex",
  mix,
  "-map",
  "[aout]",
  "-c:a",
  "aac",
  "-b:a",
  "160k",
  audio,
]);

// 5) Vídeo final + capa.
const saida = join(pasta, "video.mp4");
execFileSync("ffmpeg", [
  "-y",
  "-v",
  "error",
  "-framerate",
  String(FPS),
  "-i",
  join(tmp, "quadros", "q%05d.jpg"),
  "-i",
  audio,
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "20",
  "-pix_fmt",
  "yuv420p",
  "-profile:v",
  "high",
  "-c:a",
  "copy",
  "-shortest",
  "-movflags",
  "+faststart",
  saida,
]);
const capaQuadro = Math.min(nQuadros - 1, Math.round((roteiro.capaEm ?? 1.5) * FPS));
execFileSync("ffmpeg", [
  "-y",
  "-v",
  "error",
  "-i",
  join(tmp, "quadros", `q${String(capaQuadro).padStart(5, "0")}.jpg`),
  "-q:v",
  "3",
  join(pasta, "capa.jpg"),
]);
rmSync(tmp, { recursive: true, force: true });
console.log(`Pronto: ${saida} (${total.toFixed(1)} s)`);
