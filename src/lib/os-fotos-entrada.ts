import { supabase } from "@/integrations/supabase/client";
import { randomId } from "@/lib/utils";

export type LadoFoto = "frente" | "traseira";

// Sobe as fotos de entrada escolhidas na Nova OS (NovaOsFotos) depois que a
// OS existe, com o mesmo caminho/categoria que a galeria da OS (OsFotos) usa.
export async function enviarFotosEntrada(
  empresaId: string,
  osId: string,
  fotos: File[],
  lados?: Map<File, LadoFoto>,
) {
  for (const file of fotos) {
    const ext = file.name.split(".").pop() || "jpg";
    // Prefixo = id da empresa (RLS do storage checa esse segmento) — mesma
    // regra do upload em OsFotos.
    const path = `${empresaId}/${osId}/${randomId()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("os-fotos").upload(path, file);
    if (upErr) throw upErr;
    const { error } = await supabase.from("service_order_photos").insert({
      user_id: empresaId,
      service_order_id: osId,
      url: path,
      category: "entrada",
      lado: lados?.get(file) ?? null,
    });
    if (error) throw error;
  }
}
