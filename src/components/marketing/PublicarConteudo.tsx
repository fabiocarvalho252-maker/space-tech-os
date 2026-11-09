// Bloco "Publicar" do detalhe de um conteúdo aprovado: um botão por
// plataforma autorizada (Instagram/Facebook). Cada publicação mostra o texto
// exato e pede confirmação; o servidor confere tudo de novo antes de postar.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Facebook, Instagram, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { publicarConteudoMeta } from "@/lib/marketing/meta.functions";
import {
  plataformasPublicaveis,
  textoParaPublicar,
  type ConteudoMarketing,
  type PlataformaMeta,
} from "@/lib/marketing/conteudo";
import { useContasMeta } from "./ContasMeta";

const NOME: Record<PlataformaMeta, string> = { instagram: "Instagram", facebook: "Facebook" };

function linkPublicado(c: ConteudoMarketing, p: PlataformaMeta): string | null {
  const m = (c.secoes["Publicação"] ?? "").match(
    new RegExp(`^- Publicado no ${NOME[p]}: (\\S+)`, "m"),
  );
  return m?.[1] ?? null;
}

export function PublicarConteudo({
  c,
  onPublicado,
  onIrParaContas,
}: {
  c: ConteudoMarketing;
  onPublicado: () => void;
  onIrParaContas: () => void;
}) {
  const plataformas = plataformasPublicaveis(c);
  const { data: contas } = useContasMeta();
  const [confirmar, setConfirmar] = useState<PlataformaMeta | null>(null);
  const publicar = useMutation({
    mutationFn: (plataforma: PlataformaMeta) =>
      publicarConteudoMeta({ data: { id: c.id, plataforma, versao: c.atualizadoEm } }),
    onSuccess: (r, plataforma) => {
      setConfirmar(null);
      toast.success(`${c.id} publicado no ${NOME[plataforma]}.`, {
        action: { label: "Ver post", onClick: () => window.open(r.link, "_blank") },
      });
      onPublicado();
    },
    onError: (e) => {
      setConfirmar(null);
      toast.error(e instanceof Error ? e.message : "Não foi possível publicar.");
    },
  });

  if (!plataformas.length) return null;
  const pagina = contas?.paginas.find((p) => p.id === contas.paginaId);
  const temMidia = Boolean(c.midia?.video || c.midia?.slides?.length);
  const qtdMidia = c.midia?.video
    ? "1 vídeo (Reels)"
    : `${c.midia?.slides?.length ?? 0} imagem(ns)`;

  return (
    <section className="rounded-2xl border-2 border-sky-500/40 bg-sky-500/5 p-5 shadow-sm">
      <h2 className="text-base font-bold">Publicar</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Só as plataformas autorizadas na aprovação. Cada publicação pede confirmação.
      </p>
      {!contas?.conectado ? (
        <p className="mt-3 text-sm">
          Conecte o Instagram e o Facebook primeiro.{" "}
          <button
            type="button"
            onClick={onIrParaContas}
            className="font-semibold text-primary underline"
          >
            Ir para Contas
          </button>
        </p>
      ) : !pagina ? (
        <p className="mt-3 text-sm">
          Escolha a Página na aba{" "}
          <button
            type="button"
            onClick={onIrParaContas}
            className="font-semibold text-primary underline"
          >
            Contas
          </button>
          .
        </p>
      ) : !temMidia ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Gere a imagem ou o vídeo deste conteúdo antes de publicar.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {plataformas.map((p) => {
          const feito = linkPublicado(c, p);
          if (feito)
            return (
              <a
                key={p}
                href={feito}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
              >
                <ExternalLink className="h-4 w-4" /> Publicado no {NOME[p]}
              </a>
            );
          const semIg = p === "instagram" && pagina && !pagina.instagram;
          return (
            <Button
              key={p}
              onClick={() => setConfirmar(p)}
              disabled={!pagina || !temMidia || Boolean(semIg) || publicar.isPending}
              title={
                semIg ? "A Página escolhida não tem Instagram profissional vinculado" : undefined
              }
            >
              {p === "instagram" ? (
                <Instagram className="h-4 w-4" />
              ) : (
                <Facebook className="h-4 w-4" />
              )}
              Publicar no {NOME[p]}
            </Button>
          );
        })}
      </div>

      <Dialog
        open={confirmar !== null}
        onOpenChange={(v) => !v && !publicar.isPending && setConfirmar(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Publicar o {c.id} no {confirmar ? NOME[confirmar] : ""} agora?
            </DialogTitle>
            <DialogDescription>
              Vai para{" "}
              {confirmar === "instagram"
                ? `@${pagina?.instagram ?? ""}`
                : `a Página “${pagina?.nome ?? ""}”`}{" "}
              com {qtdMidia} e o texto abaixo. Fica público na hora.
            </DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap rounded-xl bg-muted p-3 font-sans text-sm">
            {confirmar ? textoParaPublicar(c, confirmar) : ""}
          </pre>
          {c.midia?.video && confirmar && (
            <p className="text-xs text-muted-foreground">
              Vídeos podem levar 1–2 minutos para o {NOME[confirmar]} processar. Não feche a página.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmar(null)}
              disabled={publicar.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => confirmar && publicar.mutate(confirmar)}
              disabled={publicar.isPending}
            >
              {publicar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {publicar.isPending ? "Publicando…" : "Publicar agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
