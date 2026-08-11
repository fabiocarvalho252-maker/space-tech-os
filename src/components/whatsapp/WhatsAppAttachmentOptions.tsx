import { Check, File, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function WhatsAppAttachmentOptions({
  osSelecionado,
  orcamentoSelecionado,
  orcamentoDisponivel,
  onToggleOs,
  onToggleOrcamento,
}: {
  osSelecionado: boolean;
  orcamentoSelecionado: boolean;
  orcamentoDisponivel: boolean;
  onToggleOs: () => void;
  onToggleOrcamento: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Enviar anexo PDF junto?</Label>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onToggleOs}
          aria-pressed={osSelecionado}
          className={cn(
            "relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors",
            osSelecionado
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:bg-muted/50",
          )}
        >
          {osSelecionado && (
            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-3 w-3" />
            </span>
          )}
          <File className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">PDF da OS</span>
          <span className="text-xs text-muted-foreground">Enviar PDF da OS junto</span>
        </button>

        <button
          type="button"
          onClick={onToggleOrcamento}
          disabled={!orcamentoDisponivel}
          aria-pressed={orcamentoSelecionado}
          title={orcamentoDisponivel ? undefined : "Esta OS ainda não tem valor para orçamento."}
          className={cn(
            "relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            orcamentoSelecionado
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:bg-muted/50",
          )}
        >
          {orcamentoSelecionado && (
            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-3 w-3" />
            </span>
          )}
          <FileText className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Documento</span>
          <span className="text-xs text-muted-foreground">Enviar Orçamento junto</span>
        </button>
      </div>
    </div>
  );
}
