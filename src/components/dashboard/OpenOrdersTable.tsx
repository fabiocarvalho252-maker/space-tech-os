import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardList, Eye } from "lucide-react";
import { dataBR, statusLabel } from "@/lib/format";

export type OsAberta = {
  id: string;
  numero: number;
  cliente: string;
  previsao: string | null;
  status: string;
};

// O painel mostra só as mais recentes — com todas as OS abertas o quadro
// ficava comprido demais; "Mostrar mais" expande ali mesmo.
const QTD_INICIAL = 5;

export function OpenOrdersTable({
  ordens,
  carregando,
  erro,
  onTentarNovamente,
}: {
  ordens: OsAberta[];
  carregando: boolean;
  erro: boolean;
  onTentarNovamente: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const visiveis = expandido ? ordens : ordens.slice(0, QTD_INICIAL);
  const ocultas = ordens.length - visiveis.length;

  return (
    <section className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-3 shadow-soft sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-9 sm:w-9 sm:rounded-xl">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-sm font-bold sm:text-base">
            <span className="sm:hidden">OS em aberto</span>
            <span className="hidden sm:inline">Ordens de Serviço em Aberto</span>
          </h2>
          {!carregando && !erro && ordens.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {ordens.length}
            </span>
          )}
        </div>
        <Link to="/ordens" className="text-sm font-semibold text-primary hover:underline">
          Ver tudo
        </Link>
      </div>

      {carregando ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-secondary/40" />
          ))}
        </div>
      ) : erro ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar as Ordens de Serviço.
          </p>
          <button
            onClick={onTentarNovamente}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-secondary"
          >
            Tentar novamente
          </button>
        </div>
      ) : !ordens.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma Ordem de Serviço em aberto.
        </p>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Nº</th>
                  <th className="py-2 pr-3 font-semibold">Cliente</th>
                  <th className="py-2 pr-3 font-semibold">Previsão</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((o) => (
                  <tr key={o.id} className="border-t border-border/60">
                    <td className="py-2.5 pr-3 font-semibold">{o.numero}</td>
                    <td className="py-2.5 pr-3">{o.cliente}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{dataBR(o.previsao)}</td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <VisualizarLink id={o.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="divide-y divide-border/60 md:hidden">
            {visiveis.map((o) => (
              <Link
                key={o.id}
                to="/ordens"
                search={{ os: o.id }}
                className="flex items-center gap-2 py-2 text-[13px]"
              >
                <span className="w-9 shrink-0 font-bold">#{o.numero}</span>
                <span className="min-w-0 flex-1 truncate">{o.cliente}</span>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>

          {ordens.length > QTD_INICIAL && (
            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-primary hover:bg-primary/5"
            >
              {expandido ? (
                <>
                  <ChevronUp className="h-4 w-4" /> Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" /> Mostrar mais ({ocultas})
                </>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function VisualizarLink({ id }: { id: string }) {
  return (
    <Link
      to="/ordens"
      search={{ os: id }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-secondary"
    >
      <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Visualizar
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
      {statusLabel(status)}
    </span>
  );
}
