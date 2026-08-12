import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eraser, Loader2, PenTool } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { randomId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BUCKET = "os-fotos";

const TIPOS = [
  { value: "cliente", label: "Cliente", category: "assinatura_cliente" },
  { value: "tecnico", label: "Técnico", category: "assinatura_tecnico" },
] as const;

type Tipo = (typeof TIPOS)[number]["value"];

export function AssinaturaDigitalModal({
  os,
  open,
  onOpenChange,
}: {
  os: { id: string; numero: number; user_id: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<Tipo>("cliente");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [temTraco, setTemTraco] = useState(false);

  const { data: assinaturas = [] } = useQuery({
    queryKey: ["os-assinaturas", os?.id],
    enabled: open && !!os,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_photos")
        .select("*")
        .eq("service_order_id", os!.id)
        .in(
          "category",
          TIPOS.map((t) => t.category),
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const comUrl = await Promise.all(
        (data ?? []).map(async (f) => {
          const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(f.url, 3600);
          return { ...f, src: signed?.signedUrl ?? "" };
        }),
      );
      return comUrl;
    },
  });

  const assinaturaAtual = (t: Tipo) =>
    assinaturas.find((a) => a.category === TIPOS.find((x) => x.value === t)?.category);

  function limparCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
  }

  // Reset the pad every time the modal opens or the signer tab switches, so
  // the previous signer's strokes never bleed into the next capture.
  useEffect(() => {
    if (!open) return;
    limparCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipo]);

  function posicaoNoCanvas(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const escalaX = canvas.width / rect.width;
    const escalaY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * escalaX, y: (e.clientY - rect.top) * escalaY };
  }

  function iniciarTraco(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    desenhando.current = true;
    const { x, y } = posicaoNoCanvas(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function continuarTraco(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicaoNoCanvas(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y);
    ctx.stroke();
    setTemTraco(true);
  }

  function finalizarTraco() {
    desenhando.current = false;
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!os) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem"))), "image/png"),
      );
      const category = TIPOS.find((t) => t.value === tipo)!.category;
      // Path prefix must be the empresa's id, not the signer's own login —
      // storage RLS checks has_permission() on this folder segment.
      const path = `${os.user_id}/${os.id}/${category}-${randomId()}.png`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "image/png",
      });
      if (upErr) throw upErr;
      const { error } = await supabase.from("service_order_photos").insert({
        user_id: os.user_id,
        service_order_id: os.id,
        url: path,
        category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assinatura salva.");
      limparCanvas();
      qc.invalidateQueries({ queryKey: ["os-assinaturas", os?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" /> Assinatura digital
          </DialogTitle>
          <DialogDescription>{os ? `OS ${os.numero}` : ""}</DialogDescription>
        </DialogHeader>

        <Tabs value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
          <TabsList className="grid w-full grid-cols-2">
            {TIPOS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                {assinaturaAtual(t.value) && (
                  <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-success" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {TIPOS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="space-y-3">
              {assinaturaAtual(t.value) && (
                <div className="rounded-lg border border-border bg-muted/30 p-2">
                  <p className="mb-1 text-xs text-muted-foreground">Assinatura já registrada — capture novamente para substituir.</p>
                  <img
                    src={assinaturaAtual(t.value)!.src}
                    alt={`Assinatura do ${t.label} já registrada`}
                    className="h-16 rounded bg-white object-contain"
                  />
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full touch-none rounded-lg border border-dashed border-border bg-white"
                onPointerDown={iniciarTraco}
                onPointerMove={continuarTraco}
                onPointerUp={finalizarTraco}
                onPointerLeave={finalizarTraco}
              />
              <p className="text-xs text-muted-foreground">Assine com o mouse, caneta ou dedo na área acima.</p>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={limparCanvas} disabled={!temTraco} className="gap-2">
            <Eraser className="h-4 w-4" /> Limpar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={!temTraco || salvar.isPending} className="gap-2">
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar assinatura
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
