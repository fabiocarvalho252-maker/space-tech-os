// Controle mínimo do Chromium headless (já instalado em ~/.cache/ms-playwright)
// pelo protocolo DevTools, sem dependências: abrir página, esperar, digitar,
// clicar e tirar captura. Usado para gravar telas reais da conta de
// demonstração e para renderizar as cenas HTML dos vídeos.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function caminhoChromium() {
  const base = join(homedir(), ".cache/ms-playwright");
  const pasta = readdirSync(base).find((n) => n.startsWith("chromium_headless_shell-"));
  if (!pasta) throw new Error("chrome-headless-shell não encontrado em ~/.cache/ms-playwright");
  const sub = readdirSync(join(base, pasta)).find((n) => n.startsWith("chrome-"));
  return join(base, pasta, sub, "chrome-headless-shell");
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrirNavegador({
  largura = 412,
  altura = 915,
  escala = 2.625,
  mobile = true,
} = {}) {
  const porta = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(
    caminhoChromium(),
    [
      "--no-sandbox",
      "--hide-scrollbars",
      "--disable-gpu",
      `--remote-debugging-port=${porta}`,
      "--lang=pt-BR",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let alvo;
  for (let i = 0; i < 50 && !alvo; i++) {
    await espera(200);
    alvo = await fetch(`http://127.0.0.1:${porta}/json/list`)
      .then((r) => r.json())
      .then((l) => l.find((t) => t.type === "page"))
      .catch(() => undefined);
  }
  if (!alvo) {
    proc.kill();
    throw new Error("Chromium não respondeu");
  }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((ok, erro) => {
    ws.onopen = ok;
    ws.onerror = erro;
  });
  let seq = 0;
  const pendentes = new Map();
  const ouvintes = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendentes.has(d.id)) {
      const { ok, erro } = pendentes.get(d.id);
      pendentes.delete(d.id);
      d.error ? erro(new Error(d.error.message)) : ok(d.result);
    } else if (d.method) ouvintes.forEach((f) => f(d));
  };
  const cmd = (method, params = {}) =>
    new Promise((ok, erro) => {
      const id = ++seq;
      pendentes.set(id, { ok, erro });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await cmd("Page.enable");
  await cmd("Runtime.enable");
  await cmd("Emulation.setDeviceMetricsOverride", {
    width: largura,
    height: altura,
    deviceScaleFactor: escala,
    mobile,
  });
  if (mobile) await cmd("Emulation.setTouchEmulationEnabled", { enabled: true });
  await cmd("Emulation.setTimezoneOverride", { timezoneId: "America/Sao_Paulo" }).catch(() => {});

  const avaliar = async (expr) => {
    const r = await cmd("Runtime.evaluate", {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description ?? "erro no script");
    return r.result.value;
  };

  const api = {
    cmd,
    avaliar,
    async ir(url, esperarMs = 2500) {
      const carregou = new Promise((ok) => {
        const f = (d) => d.method === "Page.loadEventFired" && ok();
        ouvintes.push(f);
      });
      await cmd("Page.navigate", { url });
      await Promise.race([carregou, espera(15000)]);
      await espera(esperarMs);
    },
    async esperarTexto(texto, ms = 15000) {
      const fim = Date.now() + ms;
      while (Date.now() < fim) {
        if (
          await avaliar(
            `document.body && document.body.innerText.includes(${JSON.stringify(texto)})`,
          )
        )
          return;
        await espera(300);
      }
      throw new Error(`Texto não apareceu: ${texto}`);
    },
    // Preenche um input controlado pelo React (setter nativo + evento input).
    async digitar(seletor, valor) {
      await avaliar(`(() => {
        const el = document.querySelector(${JSON.stringify(seletor)});
        if (!el) throw new Error("campo não encontrado: " + ${JSON.stringify(seletor)});
        const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(valor)});
        el.dispatchEvent(new Event("input", { bubbles: true }));
      })()`);
    },
    // Preenche o n-ésimo input/textarea visível dentro de `escopo`.
    async digitarN(escopo, n, valor) {
      await avaliar(`(() => {
        const els = [...document.querySelectorAll(${JSON.stringify(escopo)} + " input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), " + ${JSON.stringify(escopo)} + " textarea")].filter((e) => e.offsetParent !== null);
        const el = els[${n}];
        if (!el) throw new Error("campo " + ${n} + " não encontrado");
        const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(valor)});
        el.dispatchEvent(new Event("input", { bubbles: true }));
      })()`);
    },
    // Clica no primeiro elemento clicável cujo texto contém `texto`.
    async clicarTexto(texto) {
      const ok = await avaliar(`(() => {
        const alvo = [...document.querySelectorAll("button, a, [role=button], label")]
          .find((e) => e.innerText && e.innerText.trim().includes(${JSON.stringify(texto)}));
        if (!alvo) return false;
        alvo.scrollIntoView({ block: "center" });
        alvo.click();
        return true;
      })()`);
      if (!ok) throw new Error(`Botão não encontrado: ${texto}`);
      await espera(1200);
    },
    // Anexa arquivos a um <input type=file> (o primeiro que casar com o seletor).
    async enviarArquivos(seletor, arquivos) {
      const { root } = await cmd("DOM.getDocument", { depth: -1 });
      const { nodeId } = await cmd("DOM.querySelector", { nodeId: root.nodeId, selector: seletor });
      if (!nodeId) throw new Error("input de arquivo não encontrado: " + seletor);
      await cmd("DOM.setFileInputFiles", { nodeId, files: arquivos });
      await espera(1500);
    },
    async rolar(y) {
      await avaliar(`window.scrollTo({ top: ${y}, behavior: "instant" })`);
      await espera(500);
    },
    async captura(arquivo) {
      const { writeFile } = await import("node:fs/promises");
      const r = await cmd("Page.captureScreenshot", { format: "png" });
      await writeFile(arquivo, Buffer.from(r.data, "base64"));
    },
    async fechar() {
      try {
        ws.close();
      } catch {}
      proc.kill();
    },
  };
  return api;
}
