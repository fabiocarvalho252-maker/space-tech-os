#!/usr/bin/env node
// Gera as imagens de um carrossel (1080×1350, JPEG) a partir de um JSON, com a
// identidade SPACE TECH e telas reais do sistema dentro de um celular.
//
//   node marketing/ferramentas/video/gerar-carrossel.mjs marketing/midia/IG-06/carrossel.json
//
// Saída ao lado do JSON: slide-1.jpg … slide-N.jpg. Nada é publicado.
import { existsSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { abrirNavegador } from "./navegador.mjs";

const L = 1080;
const A = 1350;
const arq = resolve(process.argv[2] ?? "");
if (!existsSync(arq)) {
  console.error("Uso: node gerar-carrossel.mjs <carrossel.json>");
  process.exit(1);
}
const pasta = dirname(arq);
const cfg = JSON.parse(readFileSync(arq, "utf8"));
const total = cfg.slides.length;

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch],
  );
const destaque = (s) => esc(s).replace(/\*(.+?)\*/g, '<span class="dest">$1</span>');
const img = (p) => `file://${resolve(pasta, p)}`;

const CSS = `
*{box-sizing:border-box;margin:0}
html,body{width:${L}px;height:${A}px;overflow:hidden;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#fff;background:#09090b}
.fundo{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(124,58,237,.55),transparent 60%),linear-gradient(160deg,#18181b 0%,#09090b 55%,#1e1036 100%)}
.grade{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:72px 72px;mask-image:radial-gradient(ellipse at top,#000 30%,transparent 75%)}
.topo{position:absolute;top:48px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:center;font-size:24px;font-weight:700;letter-spacing:4px;color:rgba(221,214,254,.8)}
.num{letter-spacing:0;background:rgba(0,0,0,.4);padding:8px 18px;border-radius:999px;color:#fff;font-size:24px}
.conteudo{position:absolute;inset:120px 72px 90px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;text-align:center}
.titulo{font-size:92px;line-height:1.04;font-weight:800;letter-spacing:-2px}
.legenda{font-size:62px;line-height:1.08;font-weight:800;letter-spacing:-1px}
.sub{font-size:40px;font-weight:600;color:#d4d4d8;line-height:1.25}
.dest{background:linear-gradient(90deg,#a78bfa,#e879f9);-webkit-background-clip:text;color:transparent}
.seta{font-size:44px;font-weight:800;color:#c4b5fd}
.celular{width:470px;height:860px;border-radius:64px;padding:16px;background:#111;box-shadow:0 0 0 4px #3f3f46,0 40px 110px rgba(124,58,237,.45);flex:none}
.tela{width:100%;height:100%;border-radius:50px;overflow:hidden;background:#fff}
.tela img{width:100%;display:block}
.recorte{border-radius:36px;overflow:hidden;background:#fff;box-shadow:0 0 0 4px rgba(167,139,250,.5),0 40px 110px rgba(124,58,237,.45);flex:none}
.recorte img{display:block;max-width:none}
.icone{width:220px;height:220px;border-radius:60px;background:rgba(124,58,237,.25);box-shadow:0 0 0 4px rgba(167,139,250,.35);display:flex;align-items:center;justify-content:center;font-size:120px}
.chat{display:flex;flex-direction:column;gap:22px;width:100%;align-items:flex-start}
.bolha{background:#202c33;color:#e9edef;font-size:40px;font-weight:600;padding:22px 32px;border-radius:30px 30px 30px 8px;text-align:left}
.sinal-num{font-size:150px;font-weight:800;line-height:1;background:linear-gradient(90deg,#a78bfa,#e879f9);-webkit-background-clip:text;color:transparent}
.lista{list-style:none;padding:0;display:flex;flex-direction:column;gap:24px;text-align:left;width:100%}
.lista li{font-size:44px;font-weight:700;display:flex;gap:22px;align-items:center;background:rgba(255,255,255,.06);border-radius:26px;padding:22px 28px}
.ok{flex:none;width:58px;height:58px;border-radius:50%;background:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:34px}
.oferta-txt{position:absolute;top:130px;left:60px;right:60px;text-align:center;display:flex;flex-direction:column;gap:22px}
.mega{font-size:130px;line-height:1;font-weight:800;letter-spacing:-3px}
.celular-baixo{position:absolute;left:50%;margin-left:-235px}
.rodape-marca{position:absolute;left:0;right:0;bottom:0;height:150px;display:flex;align-items:center;justify-content:center;gap:18px;font-size:46px;font-weight:800;background:linear-gradient(to top,#09090b 55%,transparent)}
.rodape-marca b{color:#a78bfa}.rodape-marca small{font-size:24px;color:#a1a1aa}
.foguete.pequeno{width:72px;height:72px;border-radius:20px;font-size:38px}
.nota-topo{font-size:24px;color:#a1a1aa}
.nota{position:absolute;bottom:40px;left:0;right:0;text-align:center;font-size:22px;color:#a1a1aa}
.marca{display:flex;align-items:center;gap:22px;font-size:66px;font-weight:800}
.marca b{color:#a78bfa}.marca small{font-size:32px;color:#a1a1aa}
.foguete{display:flex;align-items:center;justify-content:center;width:110px;height:110px;border-radius:30px;background:linear-gradient(135deg,#7c3aed,#a78bfa);font-size:58px}
.cta{font-size:46px;font-weight:800;background:#7c3aed;padding:28px 56px;border-radius:999px;box-shadow:0 20px 60px rgba(124,58,237,.6)}
.prateleira{display:flex;gap:26px;align-items:flex-end;padding:0 30px 20px;border-bottom:14px solid #52525b;border-radius:6px}
.caixa{width:130px;height:130px;border-radius:18px;background:linear-gradient(160deg,#a16207,#713f12);box-shadow:inset 0 0 0 4px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;color:rgba(255,255,255,.7)}
.vazio{width:130px;height:130px;border-radius:18px;border:5px dashed #a78bfa;display:flex;align-items:center;justify-content:center;font-size:70px;font-weight:800;color:#a78bfa}
.lado{display:flex;align-items:center;gap:48px;text-align:left}
.lado .textos{display:flex;flex-direction:column;gap:28px;width:430px}
`;

function slideHtml(s, n) {
  const topo = `<div class="topo"><span>SPACE TECH OS</span>${total > 1 ? `<span class="num">${n}/${total}</span>` : ""}</div>`;
  let meio = "";
  if (s.tipo === "capa") {
    meio = `<div class="conteudo">
      ${s.icone ? `<div class="icone">${esc(s.icone)}</div>` : `<div class="prateleira"><div class="caixa">TELA</div><div class="vazio">?</div><div class="caixa">BAT</div></div>`}
      <h1 class="titulo">${destaque(s.titulo)}</h1>
      ${s.sub ? `<p class="sub">${destaque(s.sub)}</p>` : ""}
    </div>`;
  } else if (s.tipo === "recorte") {
    const { x = 0, y = 0, w = 1082, h = 600, fonte = 1082 } = s.recorte ?? {};
    const larg = 900;
    const esc2 = larg / w;
    meio = `<div class="conteudo">
      <p class="legenda">${destaque(s.titulo)}</p>
      ${s.seta ? `<p class="seta">${destaque(s.seta)}</p>` : ""}
      <div class="recorte" style="width:${larg}px;height:${Math.round(h * esc2)}px"><img src="${img(s.imagem)}" style="width:${Math.round(fonte * esc2)}px;transform:translate(-${Math.round(x * esc2)}px,-${Math.round(y * esc2)}px)"></div>
      ${s.sub ? `<p class="sub">${destaque(s.sub)}</p>` : ""}
    </div>`;
  } else if (s.tipo === "baloes") {
    meio = `<div class="conteudo">
      <div class="chat">${(s.baloes ?? []).map((t, k) => `<div class="bolha" style="opacity:${Math.max(0.35, 1 - k * 0.12)}">${esc(t)}</div>`).join("")}</div>
      <p class="legenda">${destaque(s.titulo)}</p>
      ${s.sub ? `<p class="sub">${destaque(s.sub)}</p>` : ""}
    </div>`;
  } else if (s.tipo === "sinal") {
    meio = `<div class="conteudo">
      <div class="sinal-num">${esc(s.numero)}</div>
      <div class="icone">${esc(s.icone)}</div>
      <p class="legenda">${destaque(s.titulo)}</p>
    </div>`;
  } else if (s.tipo === "lista") {
    meio = `<div class="conteudo">
      <p class="legenda">${destaque(s.titulo)}</p>
      <ul class="lista">${(s.itens ?? []).map((t) => `<li><span class="ok">✓</span>${destaque(t)}</li>`).join("")}</ul>
      ${s.cta ? `<div class="cta">${esc(s.cta)}</div>` : ""}
    </div>`;
  } else if (s.tipo === "oferta") {
    const desloc = s.telefoneTopo ?? 700;
    meio = `<div class="oferta-txt">
      <h1 class="mega">${destaque(s.titulo)}</h1>
      ${s.sub ? `<p class="sub">${destaque(s.sub)}</p>` : ""}
      ${s.notaTopo ? `<p class="nota-topo">${esc(s.notaTopo)}</p>` : ""}
    </div>
    <div class="celular celular-baixo" style="top:${desloc}px;transform:scale(${s.escalaTelefone ?? 1});transform-origin:top center"><div class="tela"><img src="${img(s.imagem)}"></div></div>
    <div class="rodape-marca"><span class="foguete pequeno">🚀</span><span>SPACE <b>TECH</b> <small>OS</small></span></div>`;
  } else if (s.tipo === "tela") {
    const y = s.y ?? 0;
    meio = `<div class="conteudo"><div class="lado">
      <div class="textos">
        <p class="legenda">${destaque(s.titulo)}</p>
        ${s.seta ? `<p class="seta">${destaque(s.seta)}</p>` : ""}
        ${s.sub ? `<p class="sub">${destaque(s.sub)}</p>` : ""}
      </div>
      <div class="celular"><div class="tela"><img src="${img(s.imagem)}" style="transform:translateY(-${Math.round(y * (438 / 1082))}px)"></div></div>
    </div></div>`;
  } else {
    meio = `<div class="conteudo">
      <div class="marca"><span class="foguete">🚀</span><span>SPACE <b>TECH</b> <small>OS</small></span></div>
      <h1 class="titulo">${destaque(s.titulo)}</h1>
      ${s.sub ? `<p class="sub">${destaque(s.sub)}</p>` : ""}
      ${s.cta ? `<div class="cta">${esc(s.cta)}</div>` : ""}
    </div>`;
  }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=block">
<style>${CSS}</style></head><body><div class="fundo"></div><div class="grade"></div>${topo}${meio}
${s.nota ? `<p class="nota">${esc(s.nota)}</p>` : ""}</body></html>`;
}

for (const f of readdirSync(pasta)) if (/^slide-\d+\.jpg$/.test(f)) rmSync(join(pasta, f));
const nav = await abrirNavegador({ largura: L, altura: A, escala: 1, mobile: false });
try {
  for (let i = 0; i < total; i++) {
    const tmp = join(pasta, `.slide-${i + 1}.html`);
    writeFileSync(tmp, slideHtml(cfg.slides[i], i + 1));
    await nav.ir(`file://${tmp}`, 800);
    await nav.avaliar("document.fonts.ready.then(() => true)");
    await nav.avaliar(
      "Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })))",
    );
    const r = await nav.cmd("Page.captureScreenshot", { format: "jpeg", quality: 92 });
    writeFileSync(join(pasta, `slide-${i + 1}.jpg`), Buffer.from(r.data, "base64"));
    rmSync(tmp);
    console.log(`slide-${i + 1}.jpg`);
  }
} finally {
  await nav.fechar();
}
