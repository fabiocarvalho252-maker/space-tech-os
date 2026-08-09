import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2, Camera, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const BUCKET = "seminovos-fotos";

export function SeminovosFotos({ seminovoId, fotos }: { seminovoId: string; fotos: string[] }) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const { data: urls = [], isLoading } = useQuery({
    queryKey: ["seminovos-fotos", seminovoId, fotos],
    enabled: open,
    queryFn: async () => {
      const assinadas = await Promise.all(
        fotos.map(async (path) => {
          const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
          return { path, src: data?.signedUrl ?? "" };
        }),
      );
      return assinadas;
    },
  });

  const enviar = useMutation({
    mutationFn: async (files: FileList) => {
      const novosPaths: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user!.id}/${seminovoId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
        if (upErr) throw upErr;
        novosPaths.push(path);
      }
      const { error } = await supabase
        .from("seminovos")
        .update({ fotos: [...fotos, ...novosPaths] })
        .eq("id", seminovoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fotos enviadas");
      qc.invalidateQueries({ queryKey: ["seminovos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (path: string) => {
      await supabase.storage.from(BUCKET).remove([path]);
      const { error } = await supabase
        .from("seminovos")
        .update({ fotos: fotos.filter((f) => f !== path) })
        .eq("id", seminovoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto removida");
      qc.invalidateQueries({ queryKey: ["seminovos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Fotos do aparelho">
          <Camera className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Fotos do aparelho
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
          <div>
            <h4 className="font-semibold text-foreground">Entrada, avarias e estado geral</h4>
            <p className="text-xs text-muted-foreground">
              Adicione fotos para documentar a avaliação
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) enviar.mutate(e.target.files);
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

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mb-2 h-8 w-8 animate-spin opacity-20" />
            <p className="text-sm">Carregando fotos...</p>
          </div>
        ) : urls.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {urls.map((f) => (
              <figure
                key={f.path}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted/30"
              >
                <img
                  src={f.src}
                  alt="Foto do aparelho"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => remover.mutate(f.path)}
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
