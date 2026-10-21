# SPACE TECH OS — Aplicativo Desktop para Windows

Invólucro desktop (Electron) que abre o sistema web já publicado em
**https://srmpretech.online** dentro de uma janela própria, com ícone,
atalhos e instalador `.exe` para Windows.

> **Não é um sistema novo.** Backend, banco, autenticação, permissões e todas
> as regras de negócio continuam no servidor web. O app apenas exibe o site
> numa janela nativa. Nada é duplicado.

Todos os arquivos do desktop ficam isolados na pasta [`desktop/`](desktop/),
sem alterar o projeto web.

---

## Pré-requisitos

- **Node.js 18+ e npm** (para instalar dependências e empacotar).
- Para **gerar o instalador `.exe`**: um dos dois:
  - **Windows** (recomendado) — produz o `.exe` nativamente; ou
  - **Linux/macOS com Wine** instalado — o `electron-builder` usa o Wine para
    montar o instalador NSIS do Windows.
- Conexão à internet no primeiro build (baixa o runtime do Electron, ~106 MB).

---

## Instalação das dependências

```bash
cd desktop
npm install
```

> Em npm 9+ o download do binário do Electron pode ser bloqueado como
> "install script". Se, após o `npm install`, a pasta
> `desktop/node_modules/electron/dist/` não existir, rode uma vez:
> ```bash
> node node_modules/electron/install.js
> ```

---

## Executar em desenvolvimento

A partir da **raiz do projeto**:

```bash
npm run desktop:dev
```

ou dentro de `desktop/`:

```bash
npm run dev
```

Abre a janela do app carregando `https://srmpretech.online`. Requer um
ambiente gráfico (não funciona num servidor headless sem display).

---

## Gerar o instalador Windows (`.exe`)

Rodar **em Windows** (ou em Linux/macOS com Wine):

```bash
# da raiz do projeto
npm run desktop:build:win

# ou dentro de desktop/
npm run build:win
```

O instalador é salvo em:

```
desktop/dist/SPACE-TECH-OS-Setup-1.0.0.exe
```

O instalador NSIS:

- instala o app no Windows (com opção de escolher a pasta);
- cria **atalho na área de trabalho** e **no menu Iniciar**;
- registra o app com **nome e versão** corretos (SPACE TECH OS);
- permite **desinstalação** normal pelo Painel de Controle;
- **não apaga** dados do usuário (sessão/cache) ao desinstalar.

### Validar o empacotamento sem gerar o `.exe`

Para conferir que o empacotamento funciona sem produzir o instalador Windows
(útil em Linux sem Wine), gere a versão desempacotada:

```bash
npm run desktop:pack        # build --dir (pasta do app, sem instalador)
# ou, no Linux, uma pasta Linux só para validação:
npm run desktop:build:linux
```

---

## Gerar o `.exe` por CI (GitHub Actions)

Se não tiver uma máquina Windows, o repositório já inclui um workflow que
gera o instalador num runner `windows-latest`:
[`.github/workflows/desktop.yml`](.github/workflows/desktop.yml).

Dispare pela aba **Actions → Build desktop (Windows) → Run workflow** e baixe o
`.exe` em **Artifacts** ao terminar. O workflow também roda ao criar uma tag
`desktop-v*` (ex.: `git tag desktop-v1.0.0 && git push origin desktop-v1.0.0`).

---

## Segurança

O app é configurado para ser um invólucro seguro do site:

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- O **site remoto não tem acesso ao Node** (`require`/`module` indisponíveis).
- Navegação da janela principal **restrita** a `srmpretech.online` (e `www`);
  qualquer outro destino é aberto no **navegador padrão**.
- Pop-ups e novas janelas vão para o navegador padrão (nunca abrem dentro do
  app).
- Protocolos perigosos (`javascript:`, `file:`, `data:`, etc.) são bloqueados.
- Permissões sensíveis (câmera, microfone, localização) **negadas por padrão**;
  só a área de transferência é liberada (para "copiar Pix/código").
- Verificações de TLS/HTTPS **nunca** são desabilitadas.
- Nenhum `.env`, chave ou segredo do servidor é incluído no pacote — só os
  arquivos do Electron (`main.cjs`, `preload.cjs`, `package.json`).

---

## Como testar

1. **Abertura:** o app abre maximizado em `https://srmpretech.online`.
2. **Login/logout:** entre com um usuário; a sessão persiste entre reaberturas
   (mesmo comportamento do site, via `localStorage`).
3. **Navegação:** circule pelos módulos (Ordens, PDV, Crediário, etc.).
4. **Links externos:** um link para fora do domínio deve abrir no navegador
   padrão, não dentro do app.
5. **Downloads:** gerar um PDF (ex.: contrato de crediário, OS) deve baixar
   normalmente.
6. **Segurança:** no console do app (Ctrl+Shift+I), `typeof require` deve ser
   `"undefined"`.

---

## O que já foi validado neste repositório

Testado em ambiente Linux (headless, com display virtual):

- ✅ Dependências instaladas e runtime do Electron (33.2.1) baixado.
- ✅ Empacotamento `electron-builder` funciona (gerou o app empacotado; o
  `app.asar` contém **apenas** `main.cjs`, `preload.cjs` e `package.json` —
  nenhum segredo).
- ✅ O app abre e **carrega `https://srmpretech.online`** (título da página:
  "SPACE TECH OS | Sistema para Assistência Técnica").
- ✅ Isolamento de segurança: na página remota, `require` e `module` são
  `undefined`; o único objeto exposto é `window.spaceTechDesktop`
  (`{ isDesktop, platform, version }`, somente leitura).

---

## Limitações conhecidas e pendências

- ⏳ **O instalador `.exe` ainda não foi gerado** neste repositório: o servidor
  de desenvolvimento é Linux e **não tem Wine**. Gere o `.exe` em Windows, em
  Linux/macOS com Wine, ou pelo workflow de CI acima. O arquivo final será
  `desktop/dist/SPACE-TECH-OS-Setup-1.0.0.exe`.
- A versão do app é definida em `desktop/package.json` (`"version"`). Atualize-a
  a cada release.
- **Auto-atualização** não está configurada. Para atualizações automáticas no
  futuro, usar `electron-updater` com um servidor/ças de releases (ex.: GitHub
  Releases). Como o conteúdo vem do site, só é preciso republicar o app quando
  mudar o invólucro, não a cada mudança do sistema web.
- A **assinatura de código** do executável (code signing) não está configurada;
  sem ela, o Windows SmartScreen pode exibir um aviso na primeira execução.
  Para produção, adquira um certificado de assinatura e configure-o no
  `electron-builder`.
