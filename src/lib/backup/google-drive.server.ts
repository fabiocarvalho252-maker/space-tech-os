// Google Drive para os backups (ver backup.server.ts). OAuth 2.0 "web
// server" com o escopo drive.file: o SPACE TECH só enxerga as pastas e
// arquivos que ele mesmo criou no Drive da pessoa, nunca o resto do Drive.
// Credenciais do app no .env (GOOGLE_OAUTH_CLIENT_ID/SECRET), criadas no
// Google Cloud Console — passo a passo em docs/backup-google-drive.md.
// Server-only.
import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

const ESCOPOS = ["https://www.googleapis.com/auth/drive.file", "openid", "email"];
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const VALIDADE_STATE_MS = 15 * 60_000;

export class GoogleDriveError extends Error {
  constructor(
    message: string,
    /** O usuário removeu o acesso (ou o token expirou): precisa conectar de novo. */
    readonly acessoRevogado = false,
  ) {
    super(message);
    this.name = "GoogleDriveError";
  }
}

function credenciais(): { clientId: string; clientSecret: string } {
  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new GoogleDriveError("O backup no Google Drive não foi configurado no servidor.");
  }
  return { clientId, clientSecret };
}

export function googleDriveConfigurado(): boolean {
  return !!process.env["GOOGLE_OAUTH_CLIENT_ID"] && !!process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
}

export function redirectUri(): string {
  const site = process.env["VITE_SITE_URL"] || "https://srmpretech.online";
  return `${site.replace(/\/$/, "")}/api/google-drive/callback`;
}

// ---- state assinado (liga o retorno do Google à conta que pediu) ----

export type StateConexao = { id: string; userId: string; exp: number };

function chaveState(): string {
  const chave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!chave) throw new GoogleDriveError("SUPABASE_SERVICE_ROLE_KEY ausente no servidor.");
  return chave;
}

function assinar(corpo: string): string {
  return createHmac("sha256", chaveState())
    .update("google-drive-state." + corpo)
    .digest("base64url");
}

function criarState(dados: Omit<StateConexao, "exp">): string {
  const corpo = Buffer.from(
    JSON.stringify({ ...dados, exp: Date.now() + VALIDADE_STATE_MS }),
  ).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

export function lerState(state: string | null): StateConexao | null {
  if (!state) return null;
  const [corpo, assinatura] = state.split(".");
  if (!corpo || !assinatura) return null;
  const esperado = Buffer.from(assinar(corpo));
  const obtido = Buffer.from(assinatura);
  if (esperado.length !== obtido.length || !timingSafeEqual(esperado, obtido)) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString()) as StateConexao;
    return dados.exp > Date.now() ? dados : null;
  } catch {
    return null;
  }
}

export function urlDeAutorizacao(dados: Omit<StateConexao, "exp">): string {
  const { clientId } = credenciais();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: ESCOPOS.join(" "),
    access_type: "offline",
    // Sem prompt=consent o Google não devolve refresh_token numa 2ª conexão.
    prompt: "consent",
    include_granted_scopes: "true",
    state: criarState(dados),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ---- tokens ----

type RespostaToken = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function pedirToken(corpo: Record<string, string>): Promise<RespostaToken> {
  const { clientId, clientSecret } = credenciais();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...corpo }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as RespostaToken;
  if (!res.ok || json.error) {
    const revogado = json.error === "invalid_grant";
    throw new GoogleDriveError(
      revogado
        ? "O acesso ao Google Drive foi removido ou expirou. Conecte o Google Drive de novo."
        : `Google recusou o pedido: ${json.error_description ?? json.error ?? res.status}`,
      revogado,
    );
  }
  return json;
}

function emailDoIdToken(idToken: string | undefined): string | null {
  // Veio direto do Google pelo canal TLS do token endpoint, sem passar pelo navegador.
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const dados = JSON.parse(Buffer.from(payload, "base64url").toString()) as { email?: string };
    return dados.email ?? null;
  } catch {
    return null;
  }
}

export async function trocarCodigo(
  code: string,
): Promise<{ refreshToken: string; email: string | null }> {
  const json = await pedirToken({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });
  if (!json.refresh_token) {
    throw new GoogleDriveError("O Google não liberou o acesso permanente. Tente conectar de novo.");
  }
  if (!json.scope?.includes("drive.file")) {
    throw new GoogleDriveError(
      "É preciso marcar a permissão de acesso ao Google Drive na tela do Google.",
    );
  }
  return { refreshToken: json.refresh_token, email: emailDoIdToken(json.id_token) };
}

export async function tokenDeAcesso(refreshToken: string): Promise<string> {
  const json = await pedirToken({ refresh_token: refreshToken, grant_type: "refresh_token" });
  if (!json.access_token) throw new GoogleDriveError("O Google não devolveu o token de acesso.");
  return json.access_token;
}

export async function revogar(refreshToken: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

// ---- Drive ----

async function drive<T>(token: string, caminho: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${caminho}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    throw new GoogleDriveError(`Google Drive retornou ${res.status}: ${texto.slice(0, 200)}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Devolve a pasta de backups, criando de novo se a pessoa apagou a anterior. */
export async function garantirPasta(
  token: string,
  pastaId: string | null,
  nome: string,
): Promise<string> {
  if (pastaId) {
    const atual = await drive<{ id: string; trashed: boolean }>(
      token,
      `/files/${pastaId}?fields=id,trashed`,
    ).catch(() => null);
    if (atual && !atual.trashed) return atual.id;
  }
  const criada = await drive<{ id: string }>(token, "/files?fields=id", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder" }),
  });
  return criada.id;
}

export type ArquivoEnviado = { id: string; name: string; size: number };

/**
 * Upload resumable numa requisição só: serve para um Buffer (ZIP da empresa)
 * ou para um arquivo em disco enviado em streaming (dump da plataforma, que
 * não precisa caber na memória).
 */
export async function enviarArquivo(
  token: string,
  pastaId: string,
  nome: string,
  mimeType: string,
  conteudo: { buffer: Buffer } | { caminho: string; tamanho: number },
): Promise<ArquivoEnviado> {
  const tamanho = "buffer" in conteudo ? conteudo.buffer.length : conteudo.tamanho;
  const sessao = await fetch(`${UPLOAD}?uploadType=resumable&fields=id,name,size`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": mimeType,
      "x-upload-content-length": String(tamanho),
    },
    body: JSON.stringify({ name: nome, parents: [pastaId] }),
    signal: AbortSignal.timeout(30_000),
  });
  const destino = sessao.headers.get("location");
  if (!sessao.ok || !destino) {
    const texto = await sessao.text().catch(() => "");
    throw new GoogleDriveError(
      `Google Drive recusou o envio (${sessao.status}): ${texto.slice(0, 200)}`,
    );
  }

  const corpo =
    "buffer" in conteudo
      ? new Uint8Array(conteudo.buffer)
      : (Readable.toWeb(createReadStream(conteudo.caminho)) as ReadableStream<Uint8Array>);
  const res = await fetch(destino, {
    method: "PUT",
    headers: { "content-type": mimeType, "content-length": String(tamanho) },
    body: corpo,
    // Corpo em streaming exige duplex no fetch do Node.
    duplex: "half",
    signal: AbortSignal.timeout(30 * 60_000),
  } as RequestInit & { duplex: "half" });
  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    throw new GoogleDriveError(`Falha ao enviar ${nome} (${res.status}): ${texto.slice(0, 200)}`);
  }
  const arquivo = (await res.json()) as { id: string; name: string; size?: string };
  return { id: arquivo.id, name: arquivo.name, size: Number(arquivo.size ?? tamanho) };
}

/** Mantém só os `manter` arquivos mais novos de cada prefixo de nome na pasta. */
export async function apagarAntigos(
  token: string,
  pastaId: string,
  prefixos: string[],
  manter: number,
): Promise<number> {
  const q = encodeURIComponent(`'${pastaId}' in parents and trashed = false`);
  const lista = await drive<{ files: { id: string; name: string }[] }>(
    token,
    `/files?q=${q}&orderBy=createdTime desc&pageSize=1000&fields=files(id,name)`,
  );
  let apagados = 0;
  for (const prefixo of prefixos) {
    const antigos = lista.files.filter((f) => f.name.startsWith(prefixo)).slice(manter);
    for (const arquivo of antigos) {
      await drive(token, `/files/${arquivo.id}`, { method: "DELETE" });
      apagados++;
    }
  }
  return apagados;
}
