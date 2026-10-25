import { Check, ClipboardList, Loader2, RefreshCw, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl, statusLabel } from "@/lib/format";
import type { AcaoIA, ChatMessage } from "@/lib/ai/types";

function titulo(acao: AcaoIA) {
  switch (acao.tipo) {
    case "criar_cliente":
      return { icone: UserPlus, texto: "Cadastrar cliente" };
    case "abrir_os":
      return { icone: ClipboardList, texto: "Abrir Ordem de Serviço" };
    case "mudar_status_os":
      return { icone: RefreshCw, texto: `Mudar status da OS #${acao.numero}` };
  }
}

function linhas(acao: AcaoIA): [string, string][] {
  switch (acao.tipo) {
    case "criar_cliente":
      return [
        ["Nome", acao.nome],
        ["Telefone", acao.telefone ?? "—"],
        ["CPF/CNPJ", acao.documento ?? "—"],
      ];
    case "abrir_os":
      return [
        [
          "Cliente",
          acao.cliente_nome ??
            (acao.novo_cliente ? `${acao.novo_cliente.nome} (novo cadastro)` : "Sem cliente"),
        ],
        ["Aparelho", [acao.aparelho, acao.marca, acao.modelo].filter(Boolean).join(" · ")],
        ["Defeito", acao.defeito ?? "—"],
        ["Valor", acao.valor != null ? brl(acao.valor) : "A definir"],
      ];
    case "mudar_status_os":
      return [
        ["Aparelho", acao.aparelho],
        ["De", statusLabel(acao.status_atual)],
        ["Para", statusLabel(acao.status_novo)],
      ];
  }
}

/** Cartão de confirmação de uma ação que a IA preparou (nada é gravado antes do Confirmar). */
export function AcaoCard({
  mensagem,
  executando,
  onConfirmar,
  onCancelar,
}: {
  mensagem: ChatMessage & { acao: AcaoIA };
  executando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const { icone: Icone, texto } = titulo(mensagem.acao);
  const estado = mensagem.acaoEstado ?? "pendente";
  return (
    <div className="ml-9 max-w-[85%] rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <Icone className="h-4 w-4 text-primary" />
        {texto}
      </div>
      <dl className="space-y-1">
        {linhas(mensagem.acao).map(([rotulo, valor]) => (
          <div key={rotulo} className="flex gap-2">
            <dt className="w-16 shrink-0 text-muted-foreground">{rotulo}</dt>
            <dd className="min-w-0 break-words">{valor}</dd>
          </div>
        ))}
      </dl>
      {estado === "pendente" ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" disabled={executando} onClick={onConfirmar}>
            {executando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Confirmar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={executando}
            onClick={onCancelar}
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {estado === "feita" ? "✅ Confirmado" : "Cancelado"}
        </p>
      )}
    </div>
  );
}
