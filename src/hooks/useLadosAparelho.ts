import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Fotos de frente/traseira do aparelho (marcadas na galeria da OS) para o
// AparelhoCard3D.

const BUCKET = "os-fotos";

export type LadosAparelho = {
  frente?: { path: string; thumb: string };
  traseira?: { path: string; thumb: string };
};

export async function urlAssinada(path: string, largura: number) {
  // O storage (imgproxy) entrega a foto já reduzida: a miniatura da lista
  // fica com ~10 KB em vez dos ~3 MB da foto original.
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600, {
    transform: { width: largura, height: largura, resize: "contain" },
  });
  return data?.signedUrl ?? "";
}

/** Frente/traseira de todas as OS da empresa, de uma vez (para a lista). */
export function useLadosAparelhos() {
  return useQuery({
    queryKey: ["os-fotos-lados"],
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_photos")
        .select("service_order_id, url, lado")
        .not("lado", "is", null);
      if (error) throw error;
      const mapa: Record<string, LadosAparelho> = {};
      await Promise.all(
        (data ?? []).map(async (f) => {
          const lado = f.lado as "frente" | "traseira";
          const thumb = await urlAssinada(f.url, 160);
          (mapa[f.service_order_id] ??= {})[lado] = { path: f.url, thumb };
        }),
      );
      return mapa;
    },
  });
}

/** Mesma coisa para uma OS só (tela de edição). */
export function useLadosAparelho(osId: string | null) {
  return useQuery({
    queryKey: ["os-fotos-lados", osId],
    enabled: !!osId,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_photos")
        .select("url, lado")
        .eq("service_order_id", osId as string)
        .not("lado", "is", null);
      if (error) throw error;
      const lados: LadosAparelho = {};
      for (const f of data ?? []) {
        lados[f.lado as "frente" | "traseira"] = {
          path: f.url,
          thumb: await urlAssinada(f.url, 160),
        };
      }
      return lados;
    },
  });
}
