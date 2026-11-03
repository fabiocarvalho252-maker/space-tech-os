// Busca de imagem do produto na internet (o usuário só confirma "é / não é").
// Busca: API Serper.dev (resultados do Google Imagens), chave SERPER_API_KEY no .env.
// Download: feito no servidor (evita CORS) e devolvido ao navegador, que sobe
// para o bucket no "Salvar" pelo mesmo caminho do upload manual.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresaDoUsuario } from "@/lib/whatsapp/whatsapp.functions";

export type ImagemWeb = { url: string; thumb: string; titulo: string; fonte: string };
export type ResultadoBuscaImagens =
  { ok: true; imagens: ImagemWeb[] } | { ok: false; erro: string };
export type ResultadoBaixarImagem =
  { ok: true; base64: string; contentType: string } | { ok: false; erro: string };

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

async function exigirPermissao(context: Parameters<typeof empresaDoUsuario>[0]) {
  await empresaDoUsuario(context, "produtos", "gerenciar");
}

export const buscarImagensProdutoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ termo: z.string().trim().min(2).max(150) }).parse(data))
  .handler(async ({ data, context }): Promise<ResultadoBuscaImagens> => {
    try {
      await exigirPermissao(context);
    } catch {
      return { ok: false, erro: "Seu usuário não pode alterar produtos." };
    }
    const chave = process.env["SERPER_API_KEY"];
    if (!chave)
      return { ok: false, erro: "Busca de imagens ainda não configurada (falta a chave)." };

    try {
      const r = await fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: { "X-API-KEY": chave, "Content-Type": "application/json" },
        body: JSON.stringify({ q: data.termo, gl: "br", hl: "pt-br", num: 20 }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) return { ok: false, erro: `Busca indisponível no momento (${r.status}).` };
      const json = (await r.json()) as {
        images?: {
          imageUrl?: string;
          thumbnailUrl?: string;
          title?: string;
          domain?: string;
          source?: string;
        }[];
      };
      const imagens = (json.images ?? [])
        .filter((i) => i.imageUrl?.startsWith("http"))
        .map((i) => ({
          url: i.imageUrl!,
          thumb: i.thumbnailUrl || i.imageUrl!,
          titulo: i.title ?? "",
          fonte: i.domain || i.source || "",
        }));
      return { ok: true, imagens };
    } catch {
      return { ok: false, erro: "Não foi possível buscar imagens agora." };
    }
  });

// Bloqueia endereços internos (localhost, rede privada, metadados da nuvem).
function ipPrivado(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return ipPrivado(v.slice(7));
    return (
      v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")
    );
  }
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function urlPublica(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((x) => x.address);
  return ips.length > 0 && !ips.some(ipPrivado);
}

export const baixarImagemWebFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ url: z.string().url().max(2000) }).parse(data))
  .handler(async ({ data, context }): Promise<ResultadoBaixarImagem> => {
    try {
      await exigirPermissao(context);
    } catch {
      return { ok: false, erro: "Seu usuário não pode alterar produtos." };
    }
    try {
      // Segue redirecionamentos manualmente, validando cada destino.
      let atual = data.url;
      let r: Response | null = null;
      for (let i = 0; i < 4; i++) {
        if (!(await urlPublica(atual)))
          return { ok: false, erro: "Endereço da imagem não permitido." };
        r = await fetch(atual, {
          redirect: "manual",
          headers: { "User-Agent": "SpaceTechOS/1.0 (imagem de produto)", Accept: "image/*" },
          signal: AbortSignal.timeout(12_000),
        });
        const destino = r.headers.get("location");
        if (r.status >= 300 && r.status < 400 && destino) {
          atual = new URL(destino, atual).toString();
          r = null;
          continue;
        }
        break;
      }
      if (!r || !r.ok || !r.body)
        return { ok: false, erro: "O site não liberou essa imagem. Tente outra." };
      const contentType = (r.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      if (!contentType.startsWith("image/") || contentType.includes("svg"))
        return { ok: false, erro: "Esse link não é uma imagem válida. Tente outra." };
      if (Number(r.headers.get("content-length") ?? 0) > TAMANHO_MAXIMO)
        return { ok: false, erro: "Imagem muito grande. Tente outra." };

      const partes: Uint8Array[] = [];
      let total = 0;
      const leitor = r.body.getReader();
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        total += value.byteLength;
        if (total > TAMANHO_MAXIMO) {
          await leitor.cancel();
          return { ok: false, erro: "Imagem muito grande. Tente outra." };
        }
        partes.push(value);
      }
      return { ok: true, base64: Buffer.concat(partes).toString("base64"), contentType };
    } catch {
      return { ok: false, erro: "Não foi possível baixar essa imagem. Tente outra." };
    }
  });
