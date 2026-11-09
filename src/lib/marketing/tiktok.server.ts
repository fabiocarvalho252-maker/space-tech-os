// Integração com o TikTok (Login Kit + Content Posting API) para enviar
// vídeos de marketing APROVADOS, só por ordem do administrador (botão
// "Enviar ao TikTok" com confirmação em /admin/marketing).
//
// Dois modos:
//  - rascunho: o vídeo vai para a caixa de entrada do TikTok do usuário
//    (escopo video.upload); ele termina e publica pelo app.
//  - direto: publica no perfil (escopo video.publish). Enquanto o app não
//    passar na auditoria do TikTok, só é aceito com privacidade SELF_ONLY.
//
// Fluxo de conexão igual ao do Meta: URL com "state" assinado (15 min) →
// login no TikTok → /api/marketing/tiktok/callback. Tokens em arquivo fora do
// repositório, legível só pelo root: /root/.space-tech-marketing/tiktok.json
// (access token dura 24 h e é renovado com o refresh token, que dura 1 ano).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { origemSite } from "./meta.server";

const API = "https://open.tiktokapis.com/v2";
const ARQUIVO = "/root/.space-tech-marketing/tiktok.json";
const ESCOPOS = ["user.info.basic", "video.upload", "video.publish"];

type ContasTikTok = {
  conectadoEm: string;
  openId: string;
  nome: string;
  avatar: string;
  escopos: string[];
  accessToken: string;
  expiraEm: number; // epoch ms
  refreshToken: string;
  refreshExpiraEm: number;
};

export type ContasTikTokPublico = {
  configurado: boolean;
  conectado: boolean;
  conectadoEm?: string;
  nome?: string;
  avatar?: string;
  podeDireto: boolean;
  renovarAte?: string;
};

export type InfoCriadorTikTok = {
  nome: string;
  usuario: string;
  avatar: string;
  privacidades: string[];
  comentarioBloqueado: boolean;
  dueteBloqueado: boolean;
  costuraBloqueada: boolean;
  duracaoMaxSeg: number;
};

export type OpcoesDiretoTikTok = {
  privacidade: string;
  permitirComentario: boolean;
  permitirDueto: boolean;
  permitirCostura: boolean;
  // Divulgação de conteúdo comercial: promove a própria marca (SPACE TECH).
  marcaPropria: boolean;
};

function credenciais() {
  const id = process.env["TIKTOK_CLIENT_KEY"];
  const segredo = process.env["TIKTOK_CLIENT_SECRET"];
  if (!id || !segredo)
    throw new Error("TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET não configurados no .env.");
  return { id, segredo };
}

export const redirectUriTikTok = () => `${origemSite()}/api/marketing/tiktok/callback`;

function assinar(valor: string): string {
  return createHmac("sha256", `tiktok-state|${credenciais().segredo}`)
    .update(valor)
    .digest("base64url");
}

export function urlConexaoTikTok(): string {
  const { id } = credenciais();
  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  const corpo = `${exp}.${randomBytes(12).toString("base64url")}`;
  const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
  u.searchParams.set("client_key", id);
  u.searchParams.set("scope", ESCOPOS.join(","));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", redirectUriTikTok());
  u.searchParams.set("state", `${corpo}.${assinar(corpo)}`);
  return u.toString();
}

function stateValido(state: string): boolean {
  const partes = state.split(".");
  if (partes.length !== 3) return false;
  const [exp, nonce, sig] = partes as [string, string, string];
  if (!(Number(exp) > Date.now() / 1000)) return false;
  const esperado = Buffer.from(assinar(`${exp}.${nonce}`));
  const recebido = Buffer.from(sig);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

type RespostaToken = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  error?: string;
  error_description?: string;
};

async function pedirToken(params: Record<string, string>): Promise<RespostaToken> {
  const { id, segredo } = credenciais();
  const r = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: id, client_secret: segredo, ...params }),
  });
  const d = (await r.json().catch(() => ({}))) as RespostaToken;
  if (!r.ok || d.error || !d.access_token)
    throw new Error(`TikTok: ${d.error_description || d.error || `HTTP ${r.status}`}`);
  return d;
}

// Chamada à API v2: o TikTok responde { data, error: { code: "ok" | ... } }.
async function api<T>(caminho: string, token: string, corpo?: unknown, query = ""): Promise<T> {
  const r = await fetch(
    `${API}${caminho}${query}`,
    corpo === undefined
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: JSON.stringify(corpo),
        },
  );
  const d = (await r.json().catch(() => ({}))) as {
    data?: T;
    error?: { code?: string; message?: string };
  };
  if (!r.ok || (d.error?.code && d.error.code !== "ok"))
    throw new Error(`TikTok: ${d.error?.message || d.error?.code || `HTTP ${r.status}`}`);
  return d.data as T;
}

async function lerContas(): Promise<ContasTikTok | null> {
  try {
    return JSON.parse(await readFile(ARQUIVO, "utf8")) as ContasTikTok;
  } catch {
    return null;
  }
}

async function salvarContas(c: ContasTikTok) {
  await mkdir(dirname(ARQUIVO), { recursive: true, mode: 0o700 });
  await writeFile(ARQUIVO, JSON.stringify(c, null, 2), { encoding: "utf8", mode: 0o600 });
  await chmod(ARQUIVO, 0o600);
}

export async function desconectarTikTok() {
  const c = await lerContas();
  if (c) {
    const { id, segredo } = credenciais();
    await fetch(`${API}/oauth/revoke/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: id, client_secret: segredo, token: c.accessToken }),
    }).catch(() => null);
  }
  await rm(ARQUIVO, { force: true });
}

function deResposta(t: RespostaToken, antes?: ContasTikTok): ContasTikTok {
  const agora = Date.now();
  return {
    conectadoEm: antes?.conectadoEm ?? new Date(agora).toISOString(),
    openId: t.open_id,
    nome: antes?.nome ?? "",
    avatar: antes?.avatar ?? "",
    escopos: t.scope.split(",").map((s) => s.trim()),
    accessToken: t.access_token,
    expiraEm: agora + t.expires_in * 1000,
    refreshToken: t.refresh_token,
    refreshExpiraEm: agora + t.refresh_expires_in * 1000,
  };
}

// Token válido (renova se faltar menos de 10 min).
async function tokenAtual(): Promise<ContasTikTok> {
  const c = await lerContas();
  if (!c) throw new Error("Conecte o TikTok na aba Contas.");
  if (c.expiraEm - Date.now() > 10 * 60_000) return c;
  if (c.refreshExpiraEm < Date.now())
    throw new Error("O acesso ao TikTok expirou. Reconecte na aba Contas.");
  const novo = deResposta(
    await pedirToken({ grant_type: "refresh_token", refresh_token: c.refreshToken }),
    c,
  );
  await salvarContas(novo);
  return novo;
}

export async function contasTikTokPublico(): Promise<ContasTikTokPublico> {
  const configurado = Boolean(
    process.env["TIKTOK_CLIENT_KEY"] && process.env["TIKTOK_CLIENT_SECRET"],
  );
  const c = await lerContas();
  if (!c) return { configurado, conectado: false, podeDireto: false };
  return {
    configurado,
    conectado: true,
    conectadoEm: c.conectadoEm,
    nome: c.nome,
    avatar: c.avatar,
    podeDireto: c.escopos.includes("video.publish"),
    renovarAte: new Date(c.refreshExpiraEm).toISOString(),
  };
}

export function ehCallbackTikTok(request: Request): boolean {
  return (
    request.method === "GET" && new URL(request.url).pathname === "/api/marketing/tiktok/callback"
  );
}

export async function handleCallbackTikTok(request: Request): Promise<Response> {
  const u = new URL(request.url);
  const voltar = (status: string) =>
    new Response(null, {
      status: 302,
      headers: { location: `/admin/marketing?tiktok=${status}` },
    });
  if (u.searchParams.get("error")) return voltar("cancelado");
  const code = u.searchParams.get("code") ?? "";
  const state = u.searchParams.get("state") ?? "";
  if (!code || !stateValido(state)) return voltar("invalido");
  try {
    const t = await pedirToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUriTikTok(),
    });
    const c = deResposta(t);
    const info = await api<{ user?: { display_name?: string; avatar_url?: string } }>(
      "/user/info/",
      c.accessToken,
      undefined,
      "?fields=open_id,display_name,avatar_url",
    ).catch(() => null);
    c.nome = info?.user?.display_name ?? "";
    c.avatar = info?.user?.avatar_url ?? "";
    await salvarContas(c);
    return voltar("ok");
  } catch (e) {
    console.error("[marketing/tiktok] callback:", e);
    return voltar("erro");
  }
}

// ---------------------------------------------------------------------------
// Envio

export async function infoCriadorTikTok(): Promise<InfoCriadorTikTok> {
  const c = await tokenAtual();
  const d = await api<{
    creator_avatar_url: string;
    creator_username: string;
    creator_nickname: string;
    privacy_level_options: string[];
    comment_disabled: boolean;
    duet_disabled: boolean;
    stitch_disabled: boolean;
    max_video_post_duration_sec: number;
  }>("/post/publish/creator_info/query/", c.accessToken, {});
  return {
    nome: d.creator_nickname,
    usuario: d.creator_username,
    avatar: d.creator_avatar_url,
    privacidades: d.privacy_level_options,
    comentarioBloqueado: d.comment_disabled,
    dueteBloqueado: d.duet_disabled,
    costuraBloqueada: d.stitch_disabled,
    duracaoMaxSeg: d.max_video_post_duration_sec,
  };
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Envia o arquivo inteiro num pedaço só (aceito até 64 MB).
async function enviarArquivo(uploadUrl: string, video: Buffer) {
  const r = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(video.length),
      "Content-Range": `bytes 0-${video.length - 1}/${video.length}`,
    },
    body: new Uint8Array(video),
  });
  if (!r.ok) throw new Error(`TikTok: falha ao enviar o vídeo (HTTP ${r.status}).`);
}

async function esperarStatus(
  token: string,
  publishId: string,
  final: "SEND_TO_USER_INBOX" | "PUBLISH_COMPLETE",
  maxMs = 240_000,
): Promise<string[]> {
  const fim = Date.now() + maxMs;
  while (Date.now() < fim) {
    const s = await api<{
      status: string;
      fail_reason?: string;
      publicaly_available_post_id?: (string | number)[];
    }>("/post/publish/status/fetch/", token, { publish_id: publishId });
    if (s.status === "FAILED") throw new Error(`TikTok recusou o vídeo: ${s.fail_reason ?? "?"}`);
    if (s.status === final || s.status === "PUBLISH_COMPLETE")
      return (s.publicaly_available_post_id ?? []).map(String);
    await espera(4000);
  }
  throw new Error("O TikTok demorou demais para processar o vídeo. Confira no app em instantes.");
}

async function lerVideo(id: string): Promise<Buffer> {
  const caminho = join(process.cwd(), "marketing", "midia", id, "video.mp4");
  const s = await stat(caminho).catch(() => null);
  if (!s?.isFile()) throw new Error("Este conteúdo não tem vídeo gerado.");
  if (s.size > 64 * 1024 * 1024) throw new Error("Vídeo maior que 64 MB.");
  return readFile(caminho);
}

export async function enviarRascunhoTikTok(id: string): Promise<{ publishId: string }> {
  const c = await tokenAtual();
  const video = await lerVideo(id);
  const init = await api<{ publish_id: string; upload_url: string }>(
    "/post/publish/inbox/video/init/",
    c.accessToken,
    {
      source_info: {
        source: "FILE_UPLOAD",
        video_size: video.length,
        chunk_size: video.length,
        total_chunk_count: 1,
      },
    },
  );
  await enviarArquivo(init.upload_url, video);
  await esperarStatus(c.accessToken, init.publish_id, "SEND_TO_USER_INBOX");
  return { publishId: init.publish_id };
}

export async function publicarDiretoTikTok(
  id: string,
  legenda: string,
  o: OpcoesDiretoTikTok,
): Promise<{ publishId: string; link: string }> {
  const c = await tokenAtual();
  if (!c.escopos.includes("video.publish"))
    throw new Error("A conta conectada não liberou a publicação direta. Reconecte o TikTok.");
  const criador = await infoCriadorTikTok();
  if (!criador.privacidades.includes(o.privacidade))
    throw new Error("Essa opção de privacidade não está disponível para a conta.");
  const video = await lerVideo(id);
  const init = await api<{ publish_id: string; upload_url: string }>(
    "/post/publish/video/init/",
    c.accessToken,
    {
      post_info: {
        title: legenda.slice(0, 2200),
        privacy_level: o.privacidade,
        disable_comment: criador.comentarioBloqueado || !o.permitirComentario,
        disable_duet: criador.dueteBloqueado || !o.permitirDueto,
        disable_stitch: criador.costuraBloqueada || !o.permitirCostura,
        brand_content_toggle: false,
        brand_organic_toggle: o.marcaPropria,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: video.length,
        chunk_size: video.length,
        total_chunk_count: 1,
      },
    },
  );
  await enviarArquivo(init.upload_url, video);
  const ids = await esperarStatus(c.accessToken, init.publish_id, "PUBLISH_COMPLETE");
  const perfil = `https://www.tiktok.com/@${criador.usuario}`;
  return { publishId: init.publish_id, link: ids[0] ? `${perfil}/video/${ids[0]}` : perfil };
}
