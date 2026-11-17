// "Pergunte ao Claude": pergunta sobre as métricas do Instagram. Sem a chave
// ANTHROPIC_API_KEY no servidor, o campo fica desabilitado com o aviso.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { perguntarMetricasInstagram } from "@/lib/marketing/ig-metricas.functions";
import { TAMANHO_PERGUNTA_MAX } from "@/lib/marketing/ig-metricas.calc";

const SUGESTOES = [
  "Qual post teve mais alcance?",
  "Quais posts geraram mais salvamentos?",
  "Como está o crescimento de seguidores?",
];

export function PergunteClaude({ disponivel }: { disponivel: boolean }) {
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);

  const perguntar = useMutation({
    mutationFn: (texto: string) => perguntarMetricasInstagram({ data: { pergunta: texto } }),
    onSuccess: (r) => {
      if (r.disponivel) setResposta(r.resposta);
      else setResposta(null);
      if (!r.disponivel) toast.info(r.motivo);
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Falha ao consultar o assistente."),
  });

  const podeEnviar = disponivel && pergunta.trim().length >= 3 && !perguntar.isPending;

  return (
    <section aria-labelledby="titulo-pergunte" className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h3 id="titulo-pergunte" className="font-semibold">
          Pergunte ao Claude
        </h3>
      </div>

      {!disponivel && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Configure ANTHROPIC_API_KEY no .env para usar o Pergunte ao Claude.
        </p>
      )}

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (podeEnviar) perguntar.mutate(pergunta.trim());
        }}
      >
        <Textarea
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value.slice(0, TAMANHO_PERGUNTA_MAX))}
          placeholder="Ex.: Qual tipo de post engaja mais?"
          disabled={!disponivel}
          rows={2}
          maxLength={TAMANHO_PERGUNTA_MAX}
          aria-label="Pergunta sobre as métricas"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!disponivel}
                onClick={() => setPergunta(s)}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <Button type="submit" size="sm" disabled={!podeEnviar} className="rounded-full">
            {perguntar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Perguntar
          </Button>
        </div>
      </form>

      {resposta && (
        <div
          className="whitespace-pre-line rounded-xl border bg-primary/5 p-4 text-sm leading-relaxed"
          aria-live="polite"
        >
          {resposta}
        </div>
      )}
    </section>
  );
}
