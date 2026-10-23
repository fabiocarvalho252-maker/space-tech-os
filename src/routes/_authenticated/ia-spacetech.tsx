import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Sparkles, Cpu, Camera, Copy, X, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { pesquisarTestPoint, identificarModeloPorFoto } from "@/lib/ia-spacetech.functions";
import type { Imagem, RespostaConsulta } from "@/lib/ai/consulta.server";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { usePlanoFeatures, temFeature } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/ia-spacetech")({
  head: () => ({
    meta: [
      { title: "IA SPACE TECH — SpaceTech" },
      {
        name: "description",
        content: "Pesquisa de test point e identificação de modelo por foto.",
      },
    ],
  }),
  component: IaSpaceTech,
});

const MAX_FOTOS = 4;
const LADO_MAX = 1280;

function IaSpaceTech() {
  const navigate = useNavigate();
  const { data: features } = usePlanoFeatures();
  const temIa = temFeature(features, "IA_BASICA");

  return (
    <div>
      <PageHeader
        title="IA SPACE TECH"
        subtitle="Pesquisa de test point e identificação de aparelho por foto"
      />
      {temIa ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <PesquisaTestPoint />
          <IdentificarPorFoto />
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="IA não disponível no seu plano"
          description="As ferramentas de IA não estão liberadas no plano atual da sua empresa."
          actionLabel="Ver planos"
          onAction={() => navigate({ to: "/planos" })}
        />
      )}
    </div>
  );
}

function Cartao({
  icon: Icon,
  titulo,
  descricao,
  children,
}: {
  icon: typeof Cpu;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-bold">{titulo}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{descricao}</p>
      {children}
    </div>
  );
}

function PesquisaTestPoint() {
  const [modelo, setModelo] = useState("");
  const [resultado, setResultado] = useState<RespostaConsulta | null>(null);

  const pesquisar = useMutation({
    mutationFn: () => pesquisarTestPoint({ data: { modelo: modelo.trim() } }),
    onSuccess: (res) => setResultado(res),
    onError: (e: Error) => toast.error(e.message || "Erro ao consultar a IA"),
  });

  return (
    <Cartao
      icon={Cpu}
      titulo="Pesquisa de test point"
      descricao="Digite o modelo para ver onde fica o test point na placa, o modo (EDL/BROM) e o passo a passo."
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (modelo.trim().length >= 2 && !pesquisar.isPending) pesquisar.mutate();
        }}
      >
        <Input
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          placeholder="Ex.: Galaxy A24, Redmi Note 12, SM-A245M"
          className="flex-1 text-sm"
        />
        <Button type="submit" disabled={modelo.trim().length < 2 || pesquisar.isPending}>
          <Sparkles className="h-4 w-4" />
          {pesquisar.isPending ? "Pesquisando..." : "Pesquisar"}
        </Button>
      </form>
      {resultado && <Resultado resultado={resultado} aviso="Confira a placa antes de jumpear." />}
    </Cartao>
  );
}

// Shrinks each photo to LADO_MAX on its longest side as JPEG so a few phone
// photos fit in one request; createImageBitmap applies the EXIF rotation so
// portrait shots reach the IA upright.
async function prepararFoto(arquivo: File): Promise<Imagem & { preview: string }> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { mime: "image/jpeg", base64: dataUrl.split(",")[1]!, preview: dataUrl };
}

function IdentificarPorFoto() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fotos, setFotos] = useState<(Imagem & { preview: string })[]>([]);
  const [observacao, setObservacao] = useState("");
  const [resultado, setResultado] = useState<RespostaConsulta | null>(null);

  async function adicionar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    const livres = MAX_FOTOS - fotos.length;
    if (arquivos.length > livres) toast.info(`Máximo de ${MAX_FOTOS} fotos por consulta.`);
    try {
      const novas = await Promise.all(
        Array.from(arquivos)
          .filter((a) => a.type.startsWith("image/"))
          .slice(0, livres)
          .map(prepararFoto),
      );
      setFotos((atuais) => [...atuais, ...novas]);
      setResultado(null);
    } catch {
      toast.error("Não foi possível ler uma das fotos.");
    }
  }

  const identificar = useMutation({
    mutationFn: () =>
      identificarModeloPorFoto({
        data: {
          imagens: fotos.map(({ mime, base64 }) => ({ mime, base64 })),
          observacao: observacao.trim(),
        },
      }),
    onSuccess: (res) => setResultado(res),
    onError: (e: Error) => toast.error(e.message || "Erro ao consultar a IA"),
  });

  return (
    <Cartao
      icon={Camera}
      titulo="Identificar modelo por foto"
      descricao="Envie até 4 fotos (traseira, etiqueta, tela Sobre ou placa) para a IA dizer qual é o aparelho."
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          adicionar(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        {fotos.map((f, i) => (
          <div
            key={i}
            className="relative h-20 w-20 overflow-hidden rounded-xl border border-border"
          >
            <img src={f.preview} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                setFotos((atuais) => atuais.filter((_, j) => j !== i));
                setResultado(null);
              }}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
              aria-label="Remover foto"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {fotos.length < MAX_FOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <ImagePlus className="h-5 w-5" />
            Adicionar
          </button>
        )}
      </div>
      <Input
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Observação opcional (ex.: veio sem tampa, só a placa)"
        className="text-sm"
      />
      <Button
        onClick={() => identificar.mutate()}
        disabled={!fotos.length || identificar.isPending}
        className="self-start"
      >
        <Sparkles className="h-4 w-4" />
        {identificar.isPending ? "Analisando..." : "Identificar modelo"}
      </Button>
      {resultado && (
        <Resultado
          resultado={resultado}
          aviso="Confirme pela etiqueta ou por *#06# antes de pedir peça."
        />
      )}
    </Cartao>
  );
}

function Resultado({ resultado, aviso }: { resultado: RespostaConsulta; aviso: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{resultado.texto}</p>
      {resultado.fontes.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-primary">Fontes pesquisadas</p>
          <ul className="space-y-0.5">
            {resultado.fontes.map((f) => (
              <li key={f.url} className="truncate text-xs">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {f.titulo || f.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">Sugestão da IA — {aviso}</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(resultado.texto);
            toast.success("Texto copiado");
          }}
          className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <Copy className="h-3 w-3" /> Copiar
        </button>
      </div>
    </div>
  );
}
