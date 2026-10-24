// Painel "Criar termo com IA": a loja marca o que faz, escreve observações e
// a IA (gerarTermoGarantiaIA) devolve o texto do termo de garantia. Usado na
// configuração inicial (/bem-vindo) e em Termos de Garantia.
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { gerarTermoGarantiaIA } from "@/lib/termo-garantia-ia.functions";
import { cn } from "@/lib/utils";

const SERVICOS = [
  "Troca de tela",
  "Troca de bateria",
  "Conector de carga",
  "Câmera",
  "Alto-falante/microfone",
  "Reparo em placa",
  "Software",
  "Venda de acessórios",
];

export function GerarTermoGarantiaIA({
  loja,
  dias,
  onGerado,
}: {
  loja: string;
  dias: number;
  onGerado: (texto: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [cobertura, setCobertura] = useState<string[]>(["Troca de tela", "Troca de bateria"]);
  const [observacoes, setObservacoes] = useState("");
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    setGerando(true);
    try {
      const { texto } = await gerarTermoGarantiaIA({
        data: { loja, dias: Math.max(0, Math.round(dias || 0)), cobertura, observacoes },
      });
      onGerado(texto);
      setAberto(false);
      toast.success("Termo criado pela IA — revise antes de salvar.");
    } catch (e) {
      toast.error("Não foi possível gerar o termo", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setGerando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
      >
        <Sparkles className="h-3.5 w-3.5" /> Criar com IA
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" /> Criar termo de garantia com IA
      </p>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">O que a sua loja faz?</p>
        <div className="flex flex-wrap gap-2">
          {SERVICOS.map((s) => {
            const marcado = cobertura.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setCobertura((c) => (marcado ? c.filter((x) => x !== s) : [...c, s]))
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  marcado
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border hover:border-primary",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
      <textarea
        value={observacoes}
        onChange={(e) => setObservacoes(e.target.value.slice(0, 500))}
        rows={2}
        placeholder="Algo específico? Ex.: tela sem garantia contra trinca; bateria com 6 meses."
        className="w-full rounded-xl border border-input bg-card p-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/12"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setAberto(false)}
          disabled={gerando}
          className="h-9 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={gerar}
          disabled={gerando}
          className="flex h-9 items-center gap-2 rounded-xl bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {gerando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {gerando ? "Gerando..." : `Gerar termo de ${Math.max(0, Math.round(dias || 0))} dias`}
        </button>
      </div>
    </div>
  );
}
