// SPACE TECH OS — processo principal do Electron.
//
// Este app NÃO reimplementa o sistema: ele apenas abre, numa janela
// desktop, o sistema web já publicado em https://srmpretech.online. Todo o
// backend, banco, autenticação, permissões e regras de negócio continuam no
// servidor web. Ver DESKTOP-WINDOWS.md.
//
// Segurança: contextIsolation + sandbox ligados, sem nodeIntegration, sem
// expor Node ao site remoto, navegação principal restrita ao domínio
// autorizado, links externos abertos no navegador padrão e protocolos
// perigosos bloqueados. As verificações de TLS/certificado ficam no padrão
// do Chromium (nunca desabilitadas).

const { app, BrowserWindow, Menu, shell, session } = require("electron");
const path = require("node:path");

const APP_URL = "https://srmpretech.online";
const HOSTS_PERMITIDOS = new Set(["srmpretech.online", "www.srmpretech.online"]);
const PROTOCOLOS_EXTERNOS = new Set(["http:", "https:", "mailto:", "tel:"]);

function hostPermitido(urlStr) {
  try {
    const u = new URL(urlStr);
    return (u.protocol === "https:" || u.protocol === "http:") && HOSTS_PERMITIDOS.has(u.hostname);
  } catch {
    return false;
  }
}

// Abre no navegador padrão só o que for http/https/mailto/tel; qualquer
// outro esquema (javascript:, file:, data:, ...) é descartado.
function abrirExternoSeguro(urlStr) {
  try {
    const u = new URL(urlStr);
    if (PROTOCOLOS_EXTERNOS.has(u.protocol)) {
      shell.openExternal(urlStr);
    } else {
      console.warn("[SPACE TECH OS] Link com protocolo não autorizado bloqueado:", u.protocol);
    }
  } catch {
    /* URL inválida: ignora */
  }
}

let janela = null;

function paginaErro(mensagem) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SPACE TECH OS</title>
  <style>
    :root { color-scheme: dark; }
    html,body { height:100%; margin:0; }
    body { background:#0B0B14; color:#E5E7EB; font-family:system-ui,Segoe UI,Roboto,sans-serif;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; text-align:center; padding:24px; }
    h1 { margin:0; font-size:22px; } h1 span { color:#7C3AED; }
    p { margin:0; color:#9CA3AF; max-width:30rem; line-height:1.5; }
    button { background:#7C3AED; color:#fff; border:0; border-radius:10px; padding:12px 24px; font-size:15px; font-weight:600; cursor:pointer; }
    button:hover { background:#6D28D9; }
  </style></head><body>
  <h1>SPACE <span>TECH</span> OS</h1>
  <p>${mensagem}</p>
  <button onclick="location.href='${APP_URL}'">Tentar novamente</button>
  </body></html>`;
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#0B0B14",
    title: "SPACE TECH OS",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Nada do Node é exposto ao site remoto.
      webSecurity: true,
      spellcheck: true,
    },
  });

  // Abre maximizada, mas só mostra depois de pronta (sem flash branco).
  janela.once("ready-to-show", () => {
    janela.maximize();
    janela.show();
  });

  janela.loadURL(APP_URL);

  janela.webContents.on("did-fail-load", (_e, code, desc, urlFalhou, principal) => {
    // -3 = abortado (redirecionamentos normais); ignora.
    if (principal && code !== -3) {
      janela.loadURL(
        paginaErro(
          "Não foi possível conectar ao SPACE TECH OS. Verifique sua internet e tente novamente." +
            (desc ? `<br><br><small>${desc}</small>` : ""),
        ),
      );
    }
  });

  // Navegação na janela principal: só o domínio autorizado. Qualquer outro
  // destino é cancelado e aberto no navegador padrão.
  janela.webContents.on("will-navigate", (evento, urlDestino) => {
    if (urlDestino.startsWith("data:text/html")) return; // página de erro interna
    if (!hostPermitido(urlDestino)) {
      evento.preventDefault();
      abrirExternoSeguro(urlDestino);
    }
  });

  // Novas janelas/pop-ups nunca abrem dentro do app: vão para o navegador.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    abrirExternoSeguro(url);
    return { action: "deny" };
  });

  // Bloqueia a criação de webviews embutidas.
  janela.webContents.on("will-attach-webview", (evento) => evento.preventDefault());

  janela.on("closed", () => {
    janela = null;
  });
}

// Menu enxuto e escondido (aparece com Alt): mantém os atalhos essenciais
// (copiar/colar, recarregar, zoom, tela cheia) sem poluir a interface.
function configurarMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: "Arquivo",
      submenu: [{ role: "quit", label: "Sair" }],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Desfazer" },
        { role: "redo", label: "Refazer" },
        { type: "separator" },
        { role: "cut", label: "Recortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Colar" },
        { role: "selectAll", label: "Selecionar tudo" },
      ],
    },
    {
      label: "Exibir",
      submenu: [
        { role: "reload", label: "Recarregar" },
        { role: "forceReload", label: "Forçar recarregar" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom padrão" },
        { role: "zoomIn", label: "Aumentar zoom" },
        { role: "zoomOut", label: "Diminuir zoom" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Tela cheia" },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

function reforcarSessao() {
  const ses = session.defaultSession;

  // Nega por padrão permissões sensíveis (câmera, microfone, localização,
  // notificações); mantém só o que o sistema realmente usa (área de
  // transferência, para "copiar Pix / código").
  const permitidas = new Set(["clipboard-read", "clipboard-sanitized-write"]);
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permitidas.has(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission) => permitidas.has(permission));
}

// Instância única: uma segunda execução apenas foca a janela já aberta.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === "win32") app.setAppUserModelId("online.srmpretech.spacetechos");
    reforcarSessao();
    configurarMenu();
    criarJanela();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) criarJanela();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
