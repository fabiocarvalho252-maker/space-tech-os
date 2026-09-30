import { useEffect, useMemo, useRef } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { randomId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Fotos de entrada escolhidas na criação da OS. Ficam só em memória até a
// OS ser criada — aí `enviarFotosEntrada` sobe para o bucket "os-fotos" com
// o mesmo caminho/categoria que a galeria da OS (OsFotos) usa.
// Também reaproveitada na compra de seminovo (CadastroSeminovoModal), que
// sobe os arquivos no próprio bucket depois de criar o aparelho.
export function NovaOsFotos({
  fotos,
  onChange,
  titulo = "Fotos de entrada",
}: {
  fotos: File[];
  onChange: (fotos: File[]) => void;
  titulo?: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function adicionar(e: React.ChangeEvent<HTMLInputElement>) {
    // Copia os arquivos antes de limpar o input — a FileList é viva.
    const selecionados = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selecionados.length) onChange([...fotos, ...selecionados]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" /> {titulo}
        </Label>
        <div className="flex gap-2">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={adicionar}
          />
          <input
            ref={galeriaRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={adicionar}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="h-4 w-4" /> Tirar foto
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => galeriaRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" /> Da galeria
          </Button>
        </div>
      </div>
      {fotos.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map((src, idx) => (
            <figure
              key={src}
              className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/30"
            >
              <img src={src} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remover foto"
                onClick={() => onChange(fotos.filter((_, i) => i !== idx))}
                className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-destructive shadow"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </figure>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border py-3 text-center text-xs text-muted-foreground">
          Nenhuma foto adicionada.
        </p>
      )}
    </div>
  );
}

export async function enviarFotosEntrada(empresaId: string, osId: string, fotos: File[]) {
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
    });
    if (error) throw error;
  }
}
