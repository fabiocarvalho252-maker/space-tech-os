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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BUCKET = "os-fotos";

const CATEGORIAS = [
  { value: "entrada", label: "Entrada" },
  { value: "durante", label: "Durante o reparo" },
  { value: "saida", label: "Saída" },
] as const;

type Categoria = typeof CATEGORIAS[number]["value"];

export function OsFotos({ osId, numero }: { osId: string; numero: number }) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [tabAtiva, setTabAtiva] = useState<Categoria>("entrada");

  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ["os-fotos", osId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_photos")
        .select("*")
        .eq("service_order_id", osId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const comUrl = await Promise.all(
        (data ?? []).map(async (f) => {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(f.url, 3600);
          return { ...f, src: signed?.signedUrl ?? "" };
        }),
      );
      return comUrl;
    },
  });

  const enviar = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user!.id}/${osId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
        if (upErr) throw upErr;
        const { error } = await supabase.from("service_order_photos").insert({
          user_id: user!.id,
          service_order_id: osId,
          url: path,
          category: tabAtiva,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Fotos enviadas");
      qc.invalidateQueries({ queryKey: ["os-fotos", osId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (foto: { id: string; url: string }) => {
      await supabase.storage.from(BUCKET).remove([foto.url]);
      const { error } = await supabase.from("service_order_photos").delete().eq("id", foto.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto removida");
      qc.invalidateQueries({ queryKey: ["os-fotos", osId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fotosPorCategoria = (cat: string) => fotos.filter((f) => f.category === cat);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Fotos da OS">
          <Camera className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Galeria da OS #{numero}
          </DialogTitle>
        </DialogHeader>

        <Tabs 
          value={tabAtiva} 
          onValueChange={(v) => setTabAtiva(v as Categoria)} 
          className="mt-4"
        >
          <TabsList className="grid h-auto w-full grid-cols-3 bg-secondary/50">
            {CATEGORIAS.map((c) => (
              <TabsTrigger
                key={c.value}
                value={c.value}
                className="px-1.5 py-1.5 text-[11px] data-[state=active]:bg-background data-[state=active]:shadow-sm sm:px-3 sm:text-sm"
              >
                {c.label}
                <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[10px]">
                  {fotosPorCategoria(c.value).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-6 flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div>
                <h4 className="font-semibold text-foreground capitalize">Fotos de {tabAtiva}</h4>
                <p className="text-xs text-muted-foreground">Arraste fotos ou clique no botão ao lado</p>
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

            {CATEGORIAS.map((c) => (
              <TabsContent key={c.value} value={c.value} className="m-0 focus-visible:outline-none">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Loader2 className="mb-2 h-8 w-8 animate-spin opacity-20" />
                    <p className="text-sm">Carregando galeria...</p>
                  </div>
                ) : fotosPorCategoria(c.value).length ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {fotosPorCategoria(c.value).map((f) => (
                      <figure 
                        key={f.id} 
                        className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted/30"
                      >
                        <img
                          src={f.src}
                          alt={`Foto ${f.category ?? ""} da OS ${numero}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                        <button
                          onClick={() => remover.mutate({ id: f.id, url: f.url })}
                          aria-label="Remover foto"
                          className="absolute right-2 top-2 rounded-lg bg-white/90 p-2 text-destructive shadow-lg backdrop-blur-sm transition-transform hover:scale-105 active:scale-95 sm:opacity-0 sm:group-hover:opacity-100"
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
                    <p className="text-sm font-medium text-foreground">Sem fotos nesta fase</p>
                    <p className="mt-1 text-xs text-muted-foreground">Inicie o envio de fotos para o registro da OS</p>
                  </div>
                )}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

