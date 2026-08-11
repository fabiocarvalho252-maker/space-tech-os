import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { WhatsAppMessageTemplate } from "@/lib/whatsapp";

export function WhatsAppMessageTemplates({
  templates,
  selecionadoId,
  destacado,
  onSelecionar,
  onNovaMensagem,
}: {
  templates: WhatsAppMessageTemplate[];
  selecionadoId: string;
  /** false quando o texto foi editado manualmente — nenhuma pill fica "ativa" nesse estado */
  destacado: boolean;
  onSelecionar: (id: string) => void;
  onNovaMensagem: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Sugestões de mensagem
        </span>
        <Link
          to="/configuracoes"
          className="text-xs font-medium text-green-700 underline hover:text-green-800 dark:text-green-400"
        >
          Editar
        </Link>
      </div>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-green-600/20 bg-green-50 p-3 dark:border-green-500/20 dark:bg-green-950/20">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelecionar(t.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selecionadoId === t.id && destacado
                ? "border-green-600 bg-green-600 text-white shadow-sm"
                : "border-green-600/30 bg-white text-foreground hover:bg-green-600/10 dark:bg-background"
            }`}
          >
            {t.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onNovaMensagem}
          className="flex items-center gap-1 rounded-full border border-dashed border-green-600/40 bg-transparent px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-600/10 dark:text-green-400"
        >
          <Plus className="h-3 w-3" /> Nova mensagem
        </button>
      </div>
    </div>
  );
}
