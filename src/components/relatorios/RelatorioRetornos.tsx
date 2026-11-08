// Relatórios → Retornos em garantia: OS abertas como retorno no período
// (os_origem_id), a taxa de retorno por técnico (retornos sobre as OS que ele
// entregou no período) e a lista com o defeito do retorno.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { dataBR } from "@/lib/format";
import { exportarTabela, type FormatoExportacao } from "@/lib/exports";

type Retorno = {
  numero: number;
  created_at: string;
  defeito: string | null;
  responsavel: string | null;
  origem: { numero: number; responsavel: string | null; data_entrega: string | null } | null;
  clientes: { nome: string | null } | null;
};

export function RelatorioRetornos({ inicioISO, fimISO }: { inicioISO: string; fimISO: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["relatorio-retornos", inicioISO, fimISO],
    queryFn: async () => {
      const [retornos, entregues] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select(
            "numero, created_at, defeito, responsavel, clientes(nome), origem:os_origem_id(numero, responsavel, data_entrega)",
          )
          .not("os_origem_id", "is", null)
          .gte("created_at", inicioISO)
          .lte("created_at", fimISO)
          .order("created_at", { ascending: false }),
        supabase
          .from("ordens_servico")
          .select("responsavel")
          .is("os_origem_id", null)
          .gte("data_entrega", inicioISO)
          .lte("data_entrega", fimISO),
      ]);
      if (retornos.error) throw retornos.error;
      if (entregues.error) throw entregues.error;
      return {
        retornos: (retornos.data ?? []) as unknown as Retorno[],
        entregues: entregues.data ?? [],
      };
    },
  });

  const porTecnico = useMemo(() => {
    const mapa = new Map<string, { entregues: number; retornos: number }>();
    const t = (nome: string | null | undefined) => {
      const chave = nome?.trim() || "Sem técnico";
      let v = mapa.get(chave);
      if (!v) mapa.set(chave, (v = { entregues: 0, retornos: 0 }));
      return v;
    };
    for (const e of data?.entregues ?? []) t(e.responsavel).entregues++;
    // O retorno conta para quem fez o reparo original.
    for (const r of data?.retornos ?? []) t(r.origem?.responsavel ?? r.responsavel).retornos++;
    return [...mapa.entries()]
      .map(([nome, v]) => ({
        nome,
        ...v,
        taxa: v.entregues ? (v.retornos / v.entregues) * 100 : null,
      }))
      .filter((v) => v.entregues || v.retornos)
      .sort((a, b) => b.retornos - a.retornos || b.entregues - a.entregues);
  }, [data]);

  const retornos = data?.retornos ?? [];
  const totalEntregues = data?.entregues.length ?? 0;

  function exportar(formato: FormatoExportacao) {
    exportarTabela(
      formato,
      retornos.map((r) => ({
        "Aberto em": dataBR(r.created_at),
        "OS do retorno": r.numero,
        "OS original": r.origem?.numero ?? "",
        Cliente: r.clientes?.nome ?? "",
        "Técnico do reparo": r.origem?.responsavel ?? "",
        Defeito: r.defeito ?? "",
      })),
      "relatorio-retornos-garantia",
    );
  }

  return (
    <section
      id="retornos"
      className="scroll-mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">Retornos em garantia</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportar("csv")}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportar("excel")}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-5">
          <p className="text-sm">
            <b>{retornos.length}</b> retorno{retornos.length === 1 ? "" : "s"} em garantia para{" "}
            <b>{totalEntregues}</b> OS entregue{totalEntregues === 1 ? "" : "s"} no período
            {totalEntregues > 0 && (
              <>
                {" "}
                — taxa de{" "}
                <b className={retornos.length / totalEntregues > 0.05 ? "text-destructive" : ""}>
                  {((retornos.length / totalEntregues) * 100).toFixed(1).replace(".", ",")}%
                </b>
              </>
            )}
            .
          </p>
          {porTecnico.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2">Técnico</th>
                    <th className="pb-2 text-right">Entregues</th>
                    <th className="pb-2 text-right">Retornos</th>
                    <th className="pb-2 text-right">Taxa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {porTecnico.map((t) => (
                    <tr key={t.nome}>
                      <td className="py-2">{t.nome}</td>
                      <td className="py-2 text-right">{t.entregues}</td>
                      <td className="py-2 text-right">{t.retornos}</td>
                      <td
                        className={`py-2 text-right font-semibold ${t.taxa !== null && t.taxa > 5 ? "text-destructive" : ""}`}
                      >
                        {t.taxa === null ? "—" : `${t.taxa.toFixed(1).replace(".", ",")}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {retornos.length > 0 ? (
            <div className="divide-y divide-border rounded-xl border border-border">
              {retornos.map((r) => (
                <div key={r.numero} className="p-3 text-sm">
                  <p className="font-semibold">
                    OS #{r.numero}{" "}
                    <span className="font-normal text-muted-foreground">
                      (retorno da #{r.origem?.numero ?? "?"}) · {r.clientes?.nome ?? "Cliente"} ·{" "}
                      {dataBR(r.created_at)}
                      {r.origem?.responsavel ? ` · ${r.origem.responsavel}` : ""}
                    </span>
                  </p>
                  {r.defeito && <p className="text-muted-foreground">{r.defeito}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum retorno no período. Abra pelo menu ⋮ da OS entregue → “Abrir retorno em
              garantia”.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
