// Assinaturas da OS: a do cliente (quem recebe o aparelho / comprador) e a de
// quem finalizou a OS na loja. Abre sozinho pelo menu "Assinatura digital" ou
// como etapa antes de imprimir/gerar o PDF (com `aoConcluir`): aí os botões
// viram "Gerar sem assinar" e "Salvar e gerar", e o documento sai já com as
// assinaturas.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eraser, Loader2, PenTool, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { randomId } from "@/lib/utils";
import { useCurrentUser, useProfile } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BUCKET = "os-fotos";

const TIPOS = [
  { value: "cliente", label: "Cliente", category: "assinatura_cliente" },
  { value: "tecnico", label: "Quem finalizou a OS", category: "assinatura_tecnico" },
] as const;

type Tipo = (typeof TIPOS)[number]["value"];

export function AssinaturaDigitalModal({
  os,
  open,
  onOpenChange,
  aoConcluir,
  rotuloConcluir = "Salvar e gerar",
}: {
  os: {
    id: string;
    numero: number;
    user_id: string;
    clientes?: { nome?: string | null } | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Etapa antes do documento: chamado no clique (ainda dentro do gesto do
   * usuário, para a janela de impressão não ser bloqueada) com a promessa do
   * salvamento — quem chama espera por ela antes de montar o documento.
   */
  aoConcluir?: (salvando: Promise<void>) => void;
  rotuloConcluir?: string;
}) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: profile } = useProfile();
  const canvasCliente = useRef<HTMLCanvasElement>(null);
  const canvasTecnico = useRef<HTMLCanvasElement>(null);
  const [traco, setTraco] = useState<Record<Tipo, boolean>>({ cliente: false, tecnico: false });
  const [refazer, setRefazer] = useState<Record<Tipo, boolean>>({
    cliente: false,
    tecnico: false,
  });
  const [nomeFinalizou, setNomeFinalizou] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: assinaturas = [], isLoading } = useQuery({
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
      return Promise.all(
        (data ?? []).map(async (f) => {
          const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(f.url, 3600);
          return { ...f, src: signed?.signedUrl ?? "" };
        }),
      );
    },
  });

  const atual = (t: Tipo) =>
    assinaturas.find((a) => a.category === TIPOS.find((x) => x.value === t)!.category);

  // A cada abertura: quadros limpos e o nome de quem está logado (ou o que
  // já assinou) como "quem finalizou".
  useEffect(() => {
    if (!open) return;
    setTraco({ cliente: false, tecnico: false });
    setRefazer({ cliente: false, tecnico: false });
    setNomeFinalizou("");
  }, [open, os?.id]);

  useEffect(() => {
    if (!open || nomeFinalizou) return;
    const salvo = atual("tecnico")?.assinante_nome;
    setNomeFinalizou(salvo || profile?.nome || user?.email?.split("@")[0] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assinaturas, profile?.nome, user?.email]);

  function canvasDe(t: Tipo) {
    return t === "cliente" ? canvasCliente.current : canvasTecnico.current;
  }

  function limpar(t: Tipo) {
    const canvas = canvasDe(t);
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setTraco((v) => ({ ...v, [t]: false }));
  }

  async function salvarUma(t: Tipo) {
    const canvas = canvasDe(t);
    if (!os || !canvas) return;
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem"))),
        "image/png",
      ),
    );
    const category = TIPOS.find((x) => x.value === t)!.category;
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
      assinante_nome: t === "tecnico" ? nomeFinalizou.trim() || null : null,
    });
    if (error) throw error;
    // A nova substitui a anterior: o documento usa uma só por pessoa.
    const antigas = assinaturas.filter((a) => a.category === category);
    if (antigas.length) {
      await supabase
        .from("service_order_photos")
        .delete()
        .in(
          "id",
          antigas.map((a) => a.id),
        );
      await supabase.storage.from(BUCKET).remove(antigas.map((a) => a.url));
    }
  }

  async function salvarTudo() {
    const tecnicoAtual = atual("tecnico");
    await Promise.all(TIPOS.filter((t) => traco[t.value]).map((t) => salvarUma(t.value)));
    // Só o nome mudou (assinatura mantida).
    if (
      !traco.tecnico &&
      tecnicoAtual &&
      nomeFinalizou.trim() !== (tecnicoAtual.assinante_nome ?? "")
    ) {
      await supabase
        .from("service_order_photos")
        .update({ assinante_nome: nomeFinalizou.trim() || null })
        .eq("id", tecnicoAtual.id);
    }
    await qc.invalidateQueries({ queryKey: ["os-assinaturas", os?.id] });
  }

  function concluir(salvar: boolean) {
    const promessa = (salvar ? salvarTudo() : Promise.resolve()).then(
      () => {
        if (salvar) toast.success("Assinaturas salvas.");
      },
      (e: Error) => {
        toast.error(`Assinatura não salva: ${e.message}`);
      },
    );
    if (aoConcluir) {
      aoConcluir(promessa);
      onOpenChange(false);
      return;
    }
    setSalvando(true);
    void promessa.finally(() => {
      setSalvando(false);
      setTraco({ cliente: false, tecnico: false });
      setRefazer({ cliente: false, tecnico: false });
      limpar("cliente");
      limpar("tecnico");
    });
  }

  const algumTraco = traco.cliente || traco.tecnico;
  const nomeMudou =
    !!atual("tecnico") && nomeFinalizou.trim() !== (atual("tecnico")?.assinante_nome ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            {aoConcluir ? "Assinaturas antes de gerar" : "Assinatura digital"}
          </DialogTitle>
          <DialogDescription>
            {os ? `OS nº ${os.numero}` : ""}
            {aoConcluir
              ? " — peça para o cliente assinar e assine como quem finalizou. As assinaturas saem no documento."
              : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {TIPOS.map((t) => {
              const existente = atual(t.value);
              const mostrarQuadro = !existente || refazer[t.value];
              return (
                <div key={t.value} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-semibold">
                      {t.value === "cliente"
                        ? `Cliente${os?.clientes?.nome ? ` — ${os.clientes.nome}` : ""}`
                        : t.label}
                    </Label>
                    {mostrarQuadro ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => limpar(t.value)}
                        disabled={!traco[t.value]}
                      >
                        <Eraser className="h-3.5 w-3.5" /> Limpar
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setRefazer((v) => ({ ...v, [t.value]: true }))}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Assinar de novo
                      </Button>
                    )}
                  </div>

                  {t.value === "tecnico" && (
                    <Input
                      value={nomeFinalizou}
                      onChange={(e) => setNomeFinalizou(e.target.value)}
                      placeholder="Nome de quem finalizou"
                      className="h-9"
                    />
                  )}

                  {mostrarQuadro ? (
                    <QuadroAssinatura
                      canvasRef={t.value === "cliente" ? canvasCliente : canvasTecnico}
                      onTraco={() => setTraco((v) => ({ ...v, [t.value]: true }))}
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/5 p-2">
                      <img
                        src={existente!.src}
                        alt={`Assinatura — ${t.label}`}
                        className="h-14 rounded bg-white object-contain"
                      />
                      <span className="text-xs text-muted-foreground">Já assinada</span>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Assine com o dedo, caneta ou mouse dentro do quadro.
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          {aoConcluir ? (
            <>
              <Button variant="outline" onClick={() => concluir(false)}>
                Gerar sem assinar
              </Button>
              <Button onClick={() => concluir(algumTraco || nomeMudou)} disabled={isLoading}>
                {algumTraco || nomeMudou ? rotuloConcluir : "Continuar"}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => concluir(true)}
              disabled={(!algumTraco && !nomeMudou) || salvando}
              className="gap-2"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar assinaturas
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuadroAssinatura({
  canvasRef,
  onTraco,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onTraco: () => void;
}) {
  const desenhando = useRef(false);

  function posicao(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={180}
      className="w-full touch-none rounded-lg border border-dashed border-border bg-white"
      onPointerDown={(e) => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        desenhando.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        const { x, y } = posicao(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
      }}
      onPointerMove={(e) => {
        if (!desenhando.current) return;
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        const { x, y } = posicao(e);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#0f172a";
        ctx.lineTo(x, y);
        ctx.stroke();
        onTraco();
      }}
      onPointerUp={() => (desenhando.current = false)}
      onPointerCancel={() => (desenhando.current = false)}
    />
  );
}
