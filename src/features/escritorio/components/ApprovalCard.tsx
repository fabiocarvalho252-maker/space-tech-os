import { getAgentLabel } from "../rotulos.ts";
import { ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DecisaoAprovacao } from "../simulador.ts";
import type { PedidoAprovacao } from "../estado.ts";

type Props = {
  pedido: PedidoAprovacao;
  onDecidir: (decisao: DecisaoAprovacao) => void;
};

export function ApprovalCard({ pedido, onDecidir }: Props) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="titulo-aprovacao"
      className="rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-4"
    >
      <div className="flex items-start gap-3">
        <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
        <div className="min-w-0">
          <p id="titulo-aprovacao" className="font-semibold">
            {pedido.ferramenta}
          </p>
          <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
            {pedido.resumo}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pedido por {getAgentLabel(pedido.agenteId)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => onDecidir("permitir")}>
          Permitir
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => onDecidir("negar")}>
          Negar
        </Button>
      </div>
    </div>
  );
}
