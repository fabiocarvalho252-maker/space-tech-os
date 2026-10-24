// Envio da logo da empresa (bucket público "logos"), usado por
// Configurações > Empresa e pela configuração inicial (/bem-vindo).
import { supabase } from "@/integrations/supabase/client";

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

/** Sobe a imagem, grava em profiles.logo_url e devolve a URL pública. */
export async function enviarLogoEmpresa(file: File, empresaId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > TAMANHO_MAXIMO) throw new Error("A imagem deve ter no máximo 5 MB.");

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const filePath = `logos/${empresaId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("logos").upload(filePath, file);
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("logos").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ logo_url: publicUrl })
    .eq("id", empresaId);
  if (updateError) throw updateError;

  return publicUrl;
}
