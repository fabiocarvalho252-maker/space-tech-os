// Avaliação de 1 a 5 estrelas + comentário, usada na Área do Cliente (OS) e
// na página de avaliação da venda (/avaliar/venda/:id). Quem dá 5 estrelas e
// a loja tem o link do Google configurado é convidado a avaliar lá também.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SituacaoAvaliacao = {
  pode_avaliar: boolean;
  nota: number | null;
  comentario: string | null;
  google?: string | null;
};

export const ROTULO_NOTA = ["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"];

function Estrelas({ nota }: { nota: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${nota} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-5 w-5 ${n <= nota ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
      <span className="ml-2 font-semibold">{ROTULO_NOTA[nota]}</span>
    </div>
  );
}

function ConviteGoogle({ link }: { link: string }) {
  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
      <p className="text-sm font-medium">Que bom que gostou! 💜</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Pode deixar essa avaliação também no Google? Ajuda muito outras pessoas a nos encontrar.
      </p>
      <Button asChild size="sm" className="mt-2 gap-1.5">
        <a href={link} target="_blank" rel="noopener noreferrer">
          Avaliar no Google <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}

export function AvaliacaoEstrelas({
  chave,
  carregar,
  enviar,
  titulo,
  agradecimento,
  cabecalho,
}: {
  /** queryKey da situação (invalidada depois do envio). */
  chave: readonly unknown[];
  carregar: () => Promise<SituacaoAvaliacao | null>;
  /** Devolve o código do banco ('ok', 'ja_avaliada', ...). */
  enviar: (nota: number, comentario: string) => Promise<string | null>;
  titulo: string;
  agradecimento: string;
  /** Renderiza o título da seção (ícone + texto) no estilo da página. */
  cabecalho: (texto: string) => React.ReactNode;
}) {
  const qc = useQueryClient();
  const [nota, setNota] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");

  const { data: situacao } = useQuery({ queryKey: chave, queryFn: carregar });

  const mandar = useMutation({
    mutationFn: async () => {
      const r = await enviar(nota, comentario.trim());
      if (r !== "ok" && r !== "ja_avaliada") throw new Error(r ?? "erro");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  });

  if (!situacao?.pode_avaliar) return null;

  if (situacao.nota) {
    return (
      <section className="space-y-3">
        {cabecalho("Sua avaliação")}
        <div className="rounded-xl border border-border/50 bg-muted/40 p-4 text-sm">
          <Estrelas nota={situacao.nota} />
          {situacao.comentario && (
            <p className="mt-2 text-muted-foreground whitespace-pre-line">
              &ldquo;{situacao.comentario}&rdquo;
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{agradecimento}</p>
          {situacao.google && <ConviteGoogle link={situacao.google} />}
        </div>
      </section>
    );
  }

  const ativa = hover || nota;
  return (
    <section className="space-y-3">
      {cabecalho(titulo)}
      <div className="rounded-xl border border-border/50 bg-muted/40 p-4 space-y-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} de 5 — ${ROTULO_NOTA[n]}`}
                onClick={() => setNota(n)}
                onMouseEnter={() => setHover(n)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 ${
                    n <= ativa ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="h-4 text-xs font-medium text-muted-foreground">{ROTULO_NOTA[ativa]}</p>
        </div>
        {nota > 0 && (
          <>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Quer deixar um comentário? (opcional)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <Button className="w-full" disabled={mandar.isPending} onClick={() => mandar.mutate()}>
              {mandar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar avaliação
            </Button>
            {mandar.error && (
              <p className="text-xs text-destructive text-center">
                Não foi possível enviar agora. Tente de novo em instantes.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
