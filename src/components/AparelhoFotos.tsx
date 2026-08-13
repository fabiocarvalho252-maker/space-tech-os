// Same recipe as SeminovosFotos.tsx, adapted for typed photos: aparelhos
// wants categorized fotos (frente/trás/lateral/tela/IMEI/caixa/acessórios/
// outras — pedido, seção 6), so this writes rows to the aparelho_fotos
// table (one per photo, carrying `tipo`) instead of a flat text[] column.
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, LayoutGrid, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { randomId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BUCKET = "aparelhos-fotos";

export type AparelhoFotoTipo =
  "front" | "back" | "side" | "screen" | "imei" | "box" | "accessories" | "other";

export const APARELHO_FOTO_TIPO_LABEL: Record<AparelhoFotoTipo, string> = {
  front: "Frente",
  back: "Traseira",
  side: "Lateral",
  screen: "Tela ligada",
  imei: "IMEI",
  box: "Caixa",
  accessories: "Acessórios",
  other: "Outras",
};

type FotoRow = { id: string; tipo: AparelhoFotoTipo; path: string };

export function AparelhoFotos({
  aparelhoId,
  empresaId,
  trigger,
}: {
  aparelhoId: string;
  empresaId: string;
  trigger?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<AparelhoFotoTipo>("front");

  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ["aparelho-fotos", aparelhoId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aparelho_fotos")
        .select("id, tipo, path")
        .eq("aparelho_id", aparelhoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const comUrl = await Promise.all(
        (data as FotoRow[]).map(async (f) => {
          const { data: assinada } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(f.path, 3600);
          return { ...f, src: assinada?.signedUrl ?? "" };
        }),
      );
      return comUrl;
    },
  });

  const enviar = useMutation({
    mutationFn: async ({ files, tipo }: { files: File[]; tipo: AparelhoFotoTipo }) => {
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "jpg";
        // Path prefix must be the empresa's id, not the uploader's own —
        // storage RLS checks has_permission() on this folder segment.
        const path = `${empresaId}/${aparelhoId}/${randomId()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
        if (upErr) throw upErr;
        const { error } = await supabase
          .from("aparelho_fotos")
          .insert({ user_id: empresaId, aparelho_id: aparelhoId, tipo, path });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Fotos enviadas");
      qc.invalidateQueries({ queryKey: ["aparelho-fotos", aparelhoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (foto: FotoRow) => {
      await supabase.storage.from(BUCKET).remove([foto.path]);
      const { error } = await supabase.from("aparelho_fotos").delete().eq("id", foto.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto removida");
      qc.invalidateQueries({ queryKey: ["aparelho-fotos", aparelhoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="icon" aria-label="Fotos do aparelho">
            <Camera className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Fotos do aparelho
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Select
              value={tipoSelecionado}
              onValueChange={(v) => setTipoSelecionado(v as AparelhoFotoTipo)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(APARELHO_FOTO_TIPO_LABEL) as AparelhoFotoTipo[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {APARELHO_FOTO_TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                // FileList is live and tied to the input — grab a real array
                // before resetting the input, or the mutation (which only
                // starts on a later tick) would see an already-emptied list.
                const selecionados = Array.from(e.target.files ?? []);
                if (selecionados.length)
                  enviar.mutate({ files: selecionados, tipo: tipoSelecionado });
                e.target.value = "";
              }}
            />
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={enviar.isPending}
              className="gap-2"
            >
              {enviar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              Adicionar fotos
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mb-2 h-8 w-8 animate-spin opacity-20" />
            <p className="text-sm">Carregando fotos...</p>
          </div>
        ) : fotos.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {fotos.map((f) => (
              <figure
                key={f.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted/30"
              >
                <img
                  src={f.src}
                  alt={APARELHO_FOTO_TIPO_LABEL[f.tipo]}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                  {APARELHO_FOTO_TIPO_LABEL[f.tipo]}
                </span>
                <button
                  onClick={() => remover.mutate(f)}
                  aria-label="Remover foto"
                  className="absolute right-2 top-2 rounded-lg bg-white/90 p-2 text-destructive shadow-lg backdrop-blur-sm sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </figure>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
              <LayoutGrid className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground">Sem fotos ainda</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
