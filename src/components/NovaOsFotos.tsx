import { useEffect, useMemo, useRef } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import type { LadoFoto } from "@/lib/os-fotos-entrada";
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
  lados,
  onLadosChange,
}: {
  fotos: File[];
  onChange: (fotos: File[]) => void;
  titulo?: string;
  /** Frente/traseira do aparelho (cartão 3D da OS). Só a OS usa — o
   * seminovo não passa estas props e não vê os botões. */
  lados?: Map<File, LadoFoto>;
  onLadosChange?: (lados: Map<File, LadoFoto>) => void;
}) {
  function alternarLado(file: File, lado: LadoFoto) {
    if (!lados || !onLadosChange) return;
    const novo = new Map(lados);
    const ativo = novo.get(file) === lado;
    // Uma frente e uma traseira só: marcar outra foto tira a anterior.
    for (const [f, l] of novo) if (l === lado) novo.delete(f);
    if (!ativo) novo.set(file, lado);
    onLadosChange(novo);
  }

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
              {onLadosChange && (
                <div className="absolute inset-x-1 bottom-1 flex gap-1">
                  {(["frente", "traseira"] as const).map((lado) => (
                    <button
                      key={lado}
                      type="button"
                      onClick={() => alternarLado(fotos[idx]!, lado)}
                      className={`flex-1 rounded px-0.5 py-0.5 text-[9px] font-semibold shadow ${
                        lados?.get(fotos[idx]!) === lado
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/85 text-neutral-700"
                      }`}
                    >
                      {lado === "frente" ? "Frente" : "Traseira"}
                    </button>
                  ))}
                </div>
              )}
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
