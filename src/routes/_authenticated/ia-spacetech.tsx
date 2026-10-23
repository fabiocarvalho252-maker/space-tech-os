import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Sparkles,
  Cpu,
  Camera,
  Copy,
  X,
  ImagePlus,
  Images,
  PlayCircle,
  ScanSearch,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  pesquisarTestPoint,
  identificarModeloPorFoto,
  prepararGoogleLens,
} from "@/lib/ia-spacetech.functions";
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
  const [pesquisado, setPesquisado] = useState("");
  const [resultado, setResultado] = useState<RespostaConsulta | null>(null);

  const pesquisar = useMutation({
    mutationFn: (termo: string) => pesquisarTestPoint({ data: { modelo: termo } }),
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
          const termo = modelo.trim();
          if (termo.length < 2 || pesquisar.isPending) return;
          setPesquisado(termo);
          setResultado(null);
          pesquisar.mutate(termo);
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
      {pesquisado && <FotosReaisTestPoint modelo={pesquisado} />}
      {resultado && <Resultado resultado={resultado} aviso="Confira a placa antes de jumpear." />}
    </Cartao>
  );
}

// Real photos/videos of the board instead of an IA-drawn image: a generated
// picture would invent where the points are, and jumping the wrong pads can
// kill the board. Plain search links need no API key or quota.
function FotosReaisTestPoint({ modelo }: { modelo: string }) {
  const termo = encodeURIComponent(`${modelo} test point`);
  const links = [
    {
      href: `https://www.google.com/search?tbm=isch&q=${termo}`,
      label: "Fotos no Google Imagens",
      icon: Images,
    },
    {
      href: `https://www.youtube.com/results?search_query=${termo}`,
      label: "Vídeos no YouTube",
      icon: PlayCircle,
    },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(({ href, label, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary"
        >
          <Icon className="h-4 w-4" /> {label}
        </a>
      ))}
    </div>
  );
}

// Shrinks each photo to LADO_MAX on its longest side as JPEG so a few phone
// photos fit in one request; createImageBitmap applies the EXIF rotation so
// portrait shots reach the IA upright.
async function prepararFoto(arquivo: File): Promise<Imagem & { preview: string }> {
  // Older mobile Safari rejects createImageBitmap's options (or the API
  // entirely); an <img> also applies EXIF rotation in current browsers.
  let fonte: ImageBitmap | HTMLImageElement;
  try {
    fonte = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(arquivo);
    try {
      fonte = await new Promise<HTMLImageElement>((ok, falha) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = falha;
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const escala = Math.min(1, LADO_MAX / Math.max(fonte.width, fonte.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(fonte.width * escala);
  canvas.height = Math.round(fonte.height * escala);
  canvas.getContext("2d")!.drawImage(fonte, 0, 0, canvas.width, canvas.height);
  if ("close" in fonte) fonte.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { mime: "image/jpeg", base64: dataUrl.split(",")[1]!, preview: dataUrl };
}

function IdentificarPorFoto() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fotos, setFotos] = useState<(Imagem & { preview: string })[]>([]);
  const [observacao, setObservacao] = useState("");
  const [resultado, setResultado] = useState<RespostaConsulta | null>(null);
  const [lensFoto, setLensFoto] = useState<number | null>(null);

  // The tab is opened synchronously in the click handler — mobile browsers
  // block window.open after an await — and pointed at Lens once the signed
  // link is ready.
  async function abrirNoLens(i: number) {
    const foto = fotos[i];
    if (!foto || lensFoto !== null) return;
    const aba = window.open("", "_blank");
    setLensFoto(i);
    try {
      const { url } = await prepararGoogleLens({
        data: { imagem: { mime: foto.mime, base64: foto.base64 } },
      });
      if (aba) aba.location.href = url;
      else window.location.href = url;
    } catch (e) {
      aba?.close();
      toast.error(e instanceof Error ? e.message : "Erro ao abrir o Google Lens");
    } finally {
      setLensFoto(null);
    }
  }

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
      descricao="Envie até 4 fotos (traseira, etiqueta, tela Sobre ou placa) para a IA dizer qual é o aparelho, ou toque em Lens numa foto para pesquisar no Google Lens."
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
            <button
              type="button"
              onClick={() => abrirNoLens(i)}
              disabled={lensFoto !== null}
              className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 py-0.5 text-[10px] font-semibold text-white"
              aria-label="Pesquisar esta foto no Google Lens"
            >
              {lensFoto === i ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ScanSearch className="h-3 w-3" />
              )}
              Lens
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
