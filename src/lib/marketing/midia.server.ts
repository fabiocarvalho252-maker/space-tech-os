// Mídias geradas para o marketing (marketing/midia/<ID>/video.mp4, capa.jpg e
// as imagens de carrossel slide-1.jpg … slide-10.jpg)
// servidas por um endereço com assinatura temporária:
//   /api/marketing/midia/IG-02/video.mp4?exp=<unix>&sig=<hmac>
// O link é gerado só para o administrador (leitura.server.ts, que roda depois
// de checarSiteAdmin) e expira; sem ele o arquivo não é entregue. O mesmo
// formato servirá para o Meta buscar o vídeo na hora de publicar.
import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

type ArquivoMidia = "video.mp4" | "capa.jpg" | `slide-${number}.jpg`;
const ROTA =
  /^\/api\/marketing\/midia\/([A-Z]{2}-\d{2})\/(video\.mp4|capa\.jpg|slide-(?:[1-9]|10)\.jpg)$/;
const tipoDe = (arq: string) => (arq.endsWith(".mp4") ? "video/mp4" : "image/jpeg");

function chave(): Buffer {
  const base = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!base) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createHmac("sha256", "space-tech-marketing-midia").update(base).digest();
}

function assinatura(caminho: string, exp: number): string {
  return createHmac("sha256", chave()).update(`${caminho}|${exp}`).digest("base64url");
}

function pastaMidia(id: string): string {
  return join(process.cwd(), "marketing", "midia", id);
}

export function ehRotaMidiaMarketing(request: Request): boolean {
  return (
    (request.method === "GET" || request.method === "HEAD") &&
    ROTA.test(new URL(request.url).pathname)
  );
}

export async function assinarMidias(
  id: string,
  validadeSeg = 2 * 3600,
): Promise<{
  video?: { url: string; atualizadoEm: string; tamanho: number };
  capa?: string;
  slides?: string[];
}> {
  if (!/^[A-Z]{2}-\d{2}$/.test(id)) return {};
  const exp = Math.floor(Date.now() / 1000) + validadeSeg;
  const url = (arq: ArquivoMidia) => {
    const caminho = `/api/marketing/midia/${id}/${arq}`;
    return `${caminho}?exp=${exp}&sig=${assinatura(caminho, exp)}`;
  };
  const r: Awaited<ReturnType<typeof assinarMidias>> = {};
  const v = await stat(join(pastaMidia(id), "video.mp4")).catch(() => null);
  if (v?.isFile())
    r.video = { url: url("video.mp4"), atualizadoEm: v.mtime.toISOString(), tamanho: v.size };
  const c = await stat(join(pastaMidia(id), "capa.jpg")).catch(() => null);
  if (c?.isFile()) r.capa = url("capa.jpg");
  const slides: string[] = [];
  for (let n = 1; n <= 10; n++) {
    const sl = await stat(join(pastaMidia(id), `slide-${n}.jpg`)).catch(() => null);
    if (!sl?.isFile()) break;
    slides.push(`${url(`slide-${n}.jpg`)}&v=${sl.mtimeMs.toFixed(0)}`);
  }
  if (slides.length) r.slides = slides;
  return r;
}

export async function handleMidiaMarketing(request: Request): Promise<Response> {
  const u = new URL(request.url);
  const m = u.pathname.match(ROTA);
  const exp = Number(u.searchParams.get("exp"));
  const sig = u.searchParams.get("sig") ?? "";
  const negado = () => new Response("Link inválido ou expirado.", { status: 403 });
  if (!m || !Number.isFinite(exp) || exp < Date.now() / 1000) return negado();
  const esperado = Buffer.from(assinatura(u.pathname, exp));
  const recebido = Buffer.from(sig);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return negado();

  const [, id, arquivo] = m as unknown as [string, string, ArquivoMidia];
  const caminho = join(pastaMidia(id), arquivo);
  const info = await stat(caminho).catch(() => null);
  if (!info?.isFile()) return new Response("Não encontrado.", { status: 404 });

  const base: Record<string, string> = {
    "content-type": tipoDe(arquivo),
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=600",
  };
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  let inicio = 0;
  let fim = info.size - 1;
  let status = 200;
  if (range) {
    if (range[1]) inicio = Number(range[1]);
    if (range[2]) fim = Math.min(Number(range[2]), info.size - 1);
    if (!range[1] && range[2]) inicio = Math.max(0, info.size - Number(range[2]));
    if (inicio > fim || inicio >= info.size)
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${info.size}` },
      });
    status = 206;
    base["content-range"] = `bytes ${inicio}-${fim}/${info.size}`;
  }
  base["content-length"] = String(fim - inicio + 1);
  if (request.method === "HEAD") return new Response(null, { status, headers: base });
  const corpo = Readable.toWeb(
    createReadStream(caminho, { start: inicio, end: fim }),
  ) as ReadableStream;
  return new Response(corpo, { status, headers: base });
}
