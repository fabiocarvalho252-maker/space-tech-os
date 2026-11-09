// Bloco "Sua decisão" do /admin/marketing: aprovar UM conteúdo para as
// plataformas marcadas (nenhuma vem marcada) ou recusá-lo com motivo. As duas
// ações pedem confirmação; o servidor confere de novo o administrador, o
// status e se o arquivo não mudou desde que foi aberto. Nada é publicado.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { decidirConteudoMarketing } from "@/lib/marketing/marketing.functions";
import { opcoesPlataforma, type ConteudoMarketing } from "@/lib/marketing/conteudo";

export function DecisaoConteudo({
  c,
  onDecidido,
}: {
  c: ConteudoMarketing;
  onDecidido: () => void;
}) {
  const opcoes = opcoesPlataforma(c.plataforma);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState<"aprovar" | "recusar" | null>(null);

  const decidir = useMutation({
    mutationFn: (acao: "aprovar" | "recusar") =>
      decidirConteudoMarketing({
        data: {
          id: c.id,
          acao,
          plataformas: acao === "aprovar" ? opcoes.filter((p) => marcadas.includes(p)) : [],
          motivo: acao === "recusar" ? motivo : "",
          versao: c.atualizadoEm,
        },
      }),
    onSuccess: (r) => {
      setConfirmar(null);
      toast.success(
        r.status === "APROVADO"
          ? `${c.id} aprovado. Nada foi publicado.`
          : `${c.id} recusado e devolvido para rascunho.`,
      );
      onDecidido();
    },
    onError: (e) => {
      setConfirmar(null);
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a decisão.");
    },
  });

  const alternar = (p: string, v: boolean) =>
    setMarcadas((m) => (v ? [...m, p] : m.filter((x) => x !== p)));
  const escolhidas = opcoes.filter((p) => marcadas.includes(p));
  const fora = opcoes.filter((p) => !marcadas.includes(p));

  return (
    <section className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 shadow-sm">
      <h2 className="text-base font-bold">Sua decisão</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Vale só para o <strong className="text-foreground">{c.id}</strong>. Marque as plataformas
        que você autoriza; as não marcadas ficam de fora. Aprovar <strong>não publica</strong>.
        {c.anuncioPago && " Este é um anúncio pago: aprovar o texto não autoriza orçamento."}
      </p>

      <div className="mt-4 space-y-2">
        {opcoes.map((p) => (
          <label
            key={p}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
          >
            <Checkbox
              checked={marcadas.includes(p)}
              onCheckedChange={(v) => alternar(p, v === true)}
              disabled={decidir.isPending}
            />
            {p}
          </label>
        ))}
      </div>

      {recusando && (
        <div className="mt-4">
          <label className="text-sm font-semibold" htmlFor="motivo-recusa">
            Motivo da recusa (opcional)
          </label>
          <Textarea
            id="motivo-recusa"
            className="mt-1"
            maxLength={300}
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: trocar o gancho, usar outra foto, mudar a data…"
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!recusando ? (
          <>
            <Button
              onClick={() => setConfirmar("aprovar")}
              disabled={!escolhidas.length || decidir.isPending}
            >
              {decidir.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Aprovar {escolhidas.length ? `(${escolhidas.length})` : ""}
            </Button>
            <Button
              variant="outline"
              onClick={() => setRecusando(true)}
              disabled={decidir.isPending}
            >
              <XCircle className="h-4 w-4" /> Recusar
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="destructive"
              onClick={() => setConfirmar("recusar")}
              disabled={decidir.isPending}
            >
              <XCircle className="h-4 w-4" /> Confirmar recusa
            </Button>
            <Button
              variant="ghost"
              onClick={() => setRecusando(false)}
              disabled={decidir.isPending}
            >
              Cancelar
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmar === "aprovar"}
        onOpenChange={(v) => !v && setConfirmar(null)}
        title={`Aprovar o ${c.id}?`}
        description={`Autorizadas: ${escolhidas.join(", ")}.${fora.length ? ` Ficam de fora: ${fora.join(", ")}.` : ""} Nada será publicado agora.`}
        confirmLabel="Aprovar"
        loading={decidir.isPending}
        onConfirm={() => decidir.mutate("aprovar")}
      />
      <ConfirmDialog
        open={confirmar === "recusar"}
        onOpenChange={(v) => !v && setConfirmar(null)}
        title={`Recusar o ${c.id}?`}
        description={`Ele volta para rascunho${motivo.trim() ? ` com o motivo: “${motivo.trim()}”` : ""}.`}
        confirmLabel="Recusar"
        destructive
        loading={decidir.isPending}
        onConfirm={() => decidir.mutate("recusar")}
      />
    </section>
  );
}
