// Converte a resposta crua da Graph API (mídia + insights) no formato do painel.
// Pura: não faz rede. Métrica que a API não devolveu vira null (nunca 0 inventado),
// exceto contagens de engajamento que vêm de like_count/comments_count (0 quando ausentes).
import { diaBrasil, linkSeguro, type PostMetricas } from "./ig-metricas.calc.ts";

export const LEGENDA_MAX = 160;

export type MidiaBruta = {
  id: string;
  media_type?: string;
  media_product_type?: string;
  timestamp?: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  like_count?: number;
  comments_count?: number;
  insights?: { data?: { name: string; values?: { value?: number }[] }[] };
};

function tipoDaMidia(bruta: MidiaBruta): string {
  if (bruta.media_product_type === "REELS") return "REELS";
  if (bruta.media_type === "CAROUSEL_ALBUM") return "CARROSSEL";
  if (bruta.media_type === "VIDEO") return "VIDEO";
  return "IMAGE";
}

function valorDaMetrica(bruta: MidiaBruta, nome: string): number | null {
  const item = bruta.insights?.data?.find((m) => m.name === nome);
  const valor = item?.values?.[0]?.value;
  return typeof valor === "number" ? valor : null;
}

export function normalizarMidia(bruta: MidiaBruta): PostMetricas {
  const legenda = (bruta.caption ?? "").slice(0, LEGENDA_MAX);
  return {
    id: bruta.id,
    tipo: tipoDaMidia(bruta),
    data: bruta.timestamp ? diaBrasil(new Date(bruta.timestamp)) : "",
    legenda,
    miniatura: linkSeguro(bruta.thumbnail_url ?? bruta.media_url ?? null) ?? null,
    permalink: bruta.permalink ?? null,
    alcance: valorDaMetrica(bruta, "reach") ?? null,
    curtidas: bruta.like_count ?? 0,
    comentarios: bruta.comments_count ?? 0,
    salvamentos: valorDaMetrica(bruta, "saved"),
    compartilhamentos: valorDaMetrica(bruta, "shares"),
    visualizacoes: valorDaMetrica(bruta, "views"),
  };
}
