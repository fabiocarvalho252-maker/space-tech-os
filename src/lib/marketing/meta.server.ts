// Integração com o Meta (Facebook Página + Instagram profissional) para
// publicar conteúdos de marketing APROVADOS, só por ordem do administrador
// (botão "Publicar" com confirmação em /admin/marketing).
//
// Fluxo de conexão: o admin pede a URL (iniciarConexaoMeta, só admin) → login
// no Facebook → volta em /api/marketing/meta/callback com ?code&state. O
// "state" é assinado e expira em 15 min, então só uma conexão iniciada pelo
// admin é aceita. Os tokens (de Página, que não expiram) ficam em um arquivo
// fora do repositório, legível só pelo root: /root/.space-tech-marketing/meta.json
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const GRAPH = "https://graph.facebook.com/v21.0";
const ARQUIVO = "/root/.space-tech-marketing/meta.json";
const ESCOPOS = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

export type PaginaMeta = {
  id: string;
  nome: string;
  token: string;
  instagram: { id: string; usuario: string } | null;
};
export type ContasMeta = {
  conectadoEm: string;
  usuario: string;
  paginas: PaginaMeta[];
  paginaId: string | null;
};
export type ContasMetaPublico = {
  configurado: boolean;
  conectado: boolean;
  conectadoEm?: string;
  usuario?: string;
  paginas: { id: string; nome: string; instagram: string | null }[];
  paginaId: string | null;
};

function credenciais() {
  const id = process.env["META_APP_ID"];
  const segredo = process.env["META_APP_SECRET"];
  if (!id || !segredo) throw new Error("META_APP_ID / META_APP_SECRET não configurados no .env.");
  return { id, segredo };
}

export function origemSite(): string {
  return (import.meta.env["VITE_SITE_URL"] as string | undefined) || "https://srmpretech.online";
}
export const redirectUri = () => `${origemSite()}/api/marketing/meta/callback`;

function assinar(valor: string): string {
  return createHmac("sha256", `meta-state|${credenciais().segredo}`)
    .update(valor)
    .digest("base64url");
}

export function urlConexao(): string {
  const { id } = credenciais();
  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  const nonce = randomBytes(12).toString("base64url");
  const corpo = `${exp}.${nonce}`;
  const state = `${corpo}.${assinar(corpo)}`;
  const u = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  u.searchParams.set("client_id", id);
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("state", state);
  u.searchParams.set("scope", ESCOPOS.join(","));
  u.searchParams.set("response_type", "code");
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

async function graph<T>(
  caminho: string,
  params: Record<string, string>,
  metodo: "GET" | "POST" = "GET",
): Promise<T> {
  const u = new URL(caminho.startsWith("http") ? caminho : `${GRAPH}${caminho}`);
  let corpo: URLSearchParams | undefined;
  if (metodo === "GET") for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  else corpo = new URLSearchParams(params);
  const r = await fetch(u, corpo ? { method: metodo, body: corpo } : { method: metodo });
  const d = (await r.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!r.ok || d.error) throw new Error(`Meta: ${d.error?.message ?? `HTTP ${r.status}`}`);
  return d;
}

export async function lerContas(): Promise<ContasMeta | null> {
  try {
    return JSON.parse(await readFile(ARQUIVO, "utf8")) as ContasMeta;
  } catch {
    return null;
  }
}

async function salvarContas(c: ContasMeta) {
  await mkdir(dirname(ARQUIVO), { recursive: true, mode: 0o700 });
  await writeFile(ARQUIVO, JSON.stringify(c, null, 2), { encoding: "utf8", mode: 0o600 });
  await chmod(ARQUIVO, 0o600);
}

export async function desconectar() {
  await rm(ARQUIVO, { force: true });
}

export async function escolherPagina(paginaId: string) {
  const c = await lerContas();
  if (!c) throw new Error("Nenhuma conta conectada.");
  if (!c.paginas.some((p) => p.id === paginaId)) throw new Error("Página não encontrada.");
  await salvarContas({ ...c, paginaId });
}

export function contasPublico(c: ContasMeta | null): ContasMetaPublico {
  const configurado = Boolean(process.env["META_APP_ID"] && process.env["META_APP_SECRET"]);
  if (!c) return { configurado, conectado: false, paginas: [], paginaId: null };
  return {
    configurado,
    conectado: true,
    conectadoEm: c.conectadoEm,
    usuario: c.usuario,
    paginas: c.paginas.map((p) => ({
      id: p.id,
      nome: p.nome,
      instagram: p.instagram?.usuario ?? null,
    })),
    paginaId: c.paginaId,
  };
}

// Volta do login do Facebook (navegação de facebook.com — sem sessão nem
// mesma origem; a autorização é o "state" assinado).
export function ehCallbackMeta(request: Request): boolean {
  return (
    request.method === "GET" && new URL(request.url).pathname === "/api/marketing/meta/callback"
  );
}

export async function handleCallbackMeta(request: Request): Promise<Response> {
  const u = new URL(request.url);
  const voltar = (status: string) =>
    new Response(null, { status: 302, headers: { location: `/admin/marketing?meta=${status}` } });
  if (u.searchParams.get("error")) return voltar("cancelado");
  const code = u.searchParams.get("code") ?? "";
  const state = u.searchParams.get("state") ?? "";
  if (!code || !stateValido(state)) return voltar("invalido");
  try {
    const { id, segredo } = credenciais();
    const curto = await graph<{ access_token: string }>("/oauth/access_token", {
      client_id: id,
      client_secret: segredo,
      redirect_uri: redirectUri(),
      code,
    });
    const longo = await graph<{ access_token: string }>("/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: id,
      client_secret: segredo,
      fb_exchange_token: curto.access_token,
    });
    const eu = await graph<{ name?: string }>("/me", {
      fields: "name",
      access_token: longo.access_token,
    });
    const contas = await graph<{
      data: {
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string; username?: string };
      }[];
    }>("/me/accounts", {
      fields: "id,name,access_token,instagram_business_account{id,username}",
      limit: "50",
      access_token: longo.access_token,
    });
    // Com "Login do Facebook para Empresas", Páginas de um portfólio
    // empresarial podem não vir em /me/accounts. Os IDs liberados no login
    // ficam nos granular_scopes do token; busca cada Página direto.
    if (!contas.data.length) {
      const dbg = await graph<{
        data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] };
      }>("/debug_token", { input_token: longo.access_token, access_token: `${id}|${segredo}` });
      const ids = new Set(
        (dbg.data?.granular_scopes ?? [])
          .filter((s) => s.scope.startsWith("pages_"))
          .flatMap((s) => s.target_ids ?? []),
      );
      for (const pid of ids) {
        try {
          contas.data.push(
            await graph<(typeof contas.data)[number]>(`/${pid}`, {
              fields: "id,name,access_token,instagram_business_account{id,username}",
              access_token: longo.access_token,
            }),
          );
        } catch (e) {
          console.error("[marketing/meta] página", pid, e);
        }
      }
    }
    const paginas: PaginaMeta[] = contas.data.map((p) => ({
      id: p.id,
      nome: p.name,
      token: p.access_token,
      instagram: p.instagram_business_account
        ? {
            id: p.instagram_business_account.id,
            usuario: p.instagram_business_account.username ?? "",
          }
        : null,
    }));
    await salvarContas({
      conectadoEm: new Date().toISOString(),
      usuario: eu.name ?? "",
      paginas,
      paginaId:
        paginas.length === 1 ? paginas[0]!.id : (paginas.find((p) => p.instagram)?.id ?? null),
    });
    return voltar(paginas.length ? "ok" : "sem-pagina");
  } catch (e) {
    console.error("[marketing/meta] callback:", e);
    return voltar("erro");
  }
}

// ---------------------------------------------------------------------------
// Publicação

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function esperarContainerIg(containerId: string, token: string, maxMs = 240_000) {
  const fim = Date.now() + maxMs;
  while (Date.now() < fim) {
    const s = await graph<{ status_code?: string; status?: string }>(`/${containerId}`, {
      fields: "status_code,status",
      access_token: token,
    });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED")
      throw new Error(`Instagram recusou a mídia: ${s.status ?? s.status_code}`);
    await espera(4000);
  }
  throw new Error(
    "O Instagram demorou demais para processar a mídia. Tente de novo em alguns minutos.",
  );
}

export type MidiaPublicar = { imagens: string[]; video: string | null };

export async function publicarInstagram(
  pagina: PaginaMeta,
  legenda: string,
  midia: MidiaPublicar,
): Promise<{ id: string; link: string }> {
  if (!pagina.instagram)
    throw new Error("Esta Página não tem um Instagram profissional vinculado.");
  const ig = pagina.instagram.id;
  const token = pagina.token;
  let container: string;
  if (midia.video) {
    const c = await graph<{ id: string }>(
      `/${ig}/media`,
      {
        media_type: "REELS",
        video_url: midia.video,
        caption: legenda,
        share_to_feed: "true",
        access_token: token,
      },
      "POST",
    );
    container = c.id;
  } else if (midia.imagens.length === 1) {
    const c = await graph<{ id: string }>(
      `/${ig}/media`,
      {
        image_url: midia.imagens[0]!,
        caption: legenda,
        access_token: token,
      },
      "POST",
    );
    container = c.id;
  } else if (midia.imagens.length > 1) {
    const filhos: string[] = [];
    for (const url of midia.imagens.slice(0, 10)) {
      const f = await graph<{ id: string }>(
        `/${ig}/media`,
        {
          image_url: url,
          is_carousel_item: "true",
          access_token: token,
        },
        "POST",
      );
      filhos.push(f.id);
    }
    for (const f of filhos) await esperarContainerIg(f, token);
    const c = await graph<{ id: string }>(
      `/${ig}/media`,
      {
        media_type: "CAROUSEL",
        children: filhos.join(","),
        caption: legenda,
        access_token: token,
      },
      "POST",
    );
    container = c.id;
  } else {
    throw new Error("Este conteúdo não tem imagem nem vídeo gerados.");
  }
  await esperarContainerIg(container, token);
  const pub = await graph<{ id: string }>(
    `/${ig}/media_publish`,
    { creation_id: container, access_token: token },
    "POST",
  );
  const info = await graph<{ permalink?: string }>(`/${pub.id}`, {
    fields: "permalink",
    access_token: token,
  }).catch(() => ({ permalink: undefined }));
  return {
    id: pub.id,
    link: info.permalink ?? `https://www.instagram.com/${pagina.instagram.usuario}/`,
  };
}

export async function publicarFacebook(
  pagina: PaginaMeta,
  mensagem: string,
  midia: MidiaPublicar,
): Promise<{ id: string; link: string }> {
  const token = pagina.token;
  let postId: string;
  if (midia.video) {
    const v = await graph<{ id: string }>(
      `/${pagina.id}/videos`,
      {
        file_url: midia.video,
        description: mensagem,
        access_token: token,
      },
      "POST",
    );
    postId = v.id;
  } else if (midia.imagens.length === 1) {
    const f = await graph<{ id: string; post_id?: string }>(
      `/${pagina.id}/photos`,
      {
        url: midia.imagens[0]!,
        caption: mensagem,
        access_token: token,
      },
      "POST",
    );
    postId = f.post_id ?? f.id;
  } else if (midia.imagens.length > 1) {
    const ids: string[] = [];
    for (const url of midia.imagens.slice(0, 10)) {
      const f = await graph<{ id: string }>(
        `/${pagina.id}/photos`,
        {
          url,
          published: "false",
          access_token: token,
        },
        "POST",
      );
      ids.push(f.id);
    }
    const params: Record<string, string> = { message: mensagem, access_token: token };
    ids.forEach((id, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
    const p = await graph<{ id: string }>(`/${pagina.id}/feed`, params, "POST");
    postId = p.id;
  } else {
    throw new Error("Este conteúdo não tem imagem nem vídeo gerados.");
  }
  const info = await graph<{ permalink_url?: string }>(`/${postId}`, {
    fields: "permalink_url",
    access_token: token,
  }).catch(() => ({ permalink_url: undefined }));
  return { id: postId, link: info.permalink_url ?? `https://www.facebook.com/${postId}` };
}
