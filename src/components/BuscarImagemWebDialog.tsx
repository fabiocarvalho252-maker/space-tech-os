// Mostra imagens da internet uma de cada vez: o usuário só diz "É esta" ou "Não é".
import { useEffect, useState } from "react";
import { Check, ChevronLeft, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  baixarImagemWebFn,
  buscarImagensProdutoFn,
  type ImagemWeb,
} from "@/lib/produto-imagem-web.functions";

export function BuscarImagemWebDialog({
  open,
  onOpenChange,
  termoInicial,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  termoInicial: string;
  onConfirmar: (f: File) => void;
}) {
  const [termo, setTermo] = useState(termoInicial);
  const [imagens, setImagens] = useState<ImagemWeb[]>([]);
  const [indice, setIndice] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar(t: string) {
    const q = t.trim();
    if (q.length < 2) return setErro("Digite o nome do produto para buscar.");
    setBuscando(true);
    setErro(null);
    setImagens([]);
    setIndice(0);
    try {
      const r = await buscarImagensProdutoFn({ data: { termo: q } });
      if (!r.ok) return setErro(r.erro);
      if (!r.imagens.length) return setErro("Nenhuma imagem encontrada. Tente outro nome.");
      setImagens(r.imagens);
    } catch {
      setErro("Não foi possível buscar agora.");
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setTermo(termoInicial);
    void buscar(termoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const atual = imagens[indice];
  const acabou = imagens.length > 0 && indice >= imagens.length;

  async function confirmar() {
    if (!atual) return;
    setBaixando(true);
    try {
      const r = await baixarImagemWebFn({ data: { url: atual.url } });
      if (!r.ok) {
        toast.error(r.erro);
        setIndice((i) => i + 1);
        return;
      }
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const ext = r.contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      onConfirmar(new File([bytes], `produto.${ext}`, { type: r.contentType }));
      onOpenChange(false);
      toast.success("Imagem escolhida — clique em Salvar para gravar.");
    } catch {
      toast.error("Não foi possível baixar essa imagem. Tente outra.");
      setIndice((i) => i + 1);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Imagem da internet</DialogTitle>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void buscar(termo);
          }}
        >
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Nome do produto"
          />
          <Button type="submit" variant="outline" disabled={buscando} aria-label="Buscar">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
          {buscando ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : erro ? (
            <p className="px-6 text-center text-sm text-muted-foreground">{erro}</p>
          ) : acabou ? (
            <p className="px-6 text-center text-sm text-muted-foreground">
              Acabaram as opções. Mude o nome acima e busque de novo.
            </p>
          ) : atual ? (
            <img
              key={atual.url}
              src={atual.url}
              alt={atual.titulo}
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Imagem grande bloqueada pelo site: mostra a miniatura.
                const img = e.currentTarget;
                if (img.src !== atual.thumb) img.src = atual.thumb;
              }}
              className="h-full w-full object-contain"
            />
          ) : null}
        </div>

        {atual && !buscando && !erro && (
          <p className="truncate text-xs text-muted-foreground" title={atual.titulo}>
            {indice + 1} de {imagens.length} · {atual.fonte || atual.titulo}
          </p>
        )}

        <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={indice === 0 || buscando || baixando}
            onClick={() => setIndice((i) => Math.max(0, i - 1))}
            aria-label="Voltar para a anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!atual || buscando || baixando}
            onClick={() => setIndice((i) => i + 1)}
          >
            <X className="h-4 w-4" /> Não é
          </Button>
          <Button type="button" disabled={!atual || buscando || baixando} onClick={confirmar}>
            {baixando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}{" "}
            É esta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
