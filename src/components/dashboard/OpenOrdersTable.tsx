import { Link } from "@tanstack/react-router";
import { AlertTriangle, ClipboardList, Eye } from "lucide-react";
import { dataBR, statusLabel } from "@/lib/format";

export type OsAberta = {
  id: string;
  numero: number;
  cliente: string;
  previsao: string | null;
  status: string;
};

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
  return (
    <section className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-base font-bold">Ordens de Serviço em Aberto</h2>
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
                {ordens.map((o) => (
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
          <div className="grid gap-2 md:hidden">
            {ordens.map((o) => (
              <div key={o.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">#{o.numero}</p>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{o.cliente}</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Previsão: {dataBR(o.previsao)}</p>
                  <VisualizarLink id={o.id} />
                </div>
              </div>
            ))}
          </div>
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
