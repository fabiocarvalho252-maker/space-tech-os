// Imagem do produto (bucket público "produtos-imagens", pasta = empresa).
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "produtos-imagens";
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

/** Sobe a imagem e devolve a URL pública. */
export async function enviarImagemProduto(file: File, empresaId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > TAMANHO_MAXIMO) throw new Error("A imagem deve ter no máximo 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${empresaId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Apaga do storage a imagem antiga (ignora URLs de fora do bucket). */
export async function removerImagemProduto(url: string | null | undefined) {
  if (!url) return;
  const marca = `/${BUCKET}/`;
  const i = url.indexOf(marca);
  if (i < 0) return;
  await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + marca.length))]);
}
