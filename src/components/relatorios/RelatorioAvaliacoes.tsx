// Relatórios → Avaliações: notas que os clientes deram pela Área do Cliente
// (os_avaliacoes) no período — média, distribuição, média por técnico e a
// lista com comentários. Avaliação baixa (1–2★) tem o botão de responder
// pelo WhatsApp, já com a mensagem de retorno escolhida.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Download, FileSpreadsheet, MessageCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { WhatsAppSendModal, type WhatsAppOsAlvo } from "@/components/WhatsAppSendModal";
import { dataHoraBR } from "@/lib/format";
import { exportarTabela, type FormatoExportacao } from "@/lib/exports";

type Avaliacao = {
  id: string;
  nota: number;
  comentario: string | null;
  created_at: string;
  ordens_servico:
    (WhatsAppOsAlvo & { clientes: { nome: string | null; telefone: string | null } | null }) | null;
};

const ROTULO_NOTA = ["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"];

function Estrelas({ nota, tamanho = "h-3.5 w-3.5" }: { nota: number; tamanho?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${nota} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${tamanho} ${n <= nota ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

export function RelatorioAvaliacoes({ inicioISO, fimISO }: { inicioISO: string; fimISO: string }) {
  const [responder, setResponder] = useState<WhatsAppOsAlvo | null>(null);
  const [soBaixas, setSoBaixas] = useState(false);
  const secaoRef = useRef<HTMLElement>(null);
  const hash = useRouterState({ select: (s) => s.location.hash });

  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ["relatorio-avaliacoes", inicioISO, fimISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_avaliacoes")
        .select(
          "id, nota, comentario, created_at, ordens_servico(id, numero, status, valor, aparelho, marca, modelo, responsavel, created_at, garantia_dias, clientes(nome, telefone))",
        )
        .gte("created_at", inicioISO)
        .lte("created_at", fimISO)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Avaliacao[];
    },
  });

  // Vindo do sininho (/relatorios#avaliacoes): rola até aqui depois de carregar.
  useEffect(() => {
    if (hash === "avaliacoes" && !isLoading) {
      secaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hash, isLoading]);

  const resumo = useMemo(() => {
    const total = avaliacoes.length;
    const soma = avaliacoes.reduce((s, a) => s + a.nota, 0);
    const porNota = [0, 0, 0, 0, 0, 0];
    for (const a of avaliacoes) porNota[a.nota]!++;
    const tecnicos = new Map<string, { soma: number; qtd: number }>();
    for (const a of avaliacoes) {
      const nome = a.ordens_servico?.responsavel?.trim() || "Sem técnico";
      const t = tecnicos.get(nome) ?? { soma: 0, qtd: 0 };
      t.soma += a.nota;
      t.qtd++;
      tecnicos.set(nome, t);
    }
    return {
      total,
      media: total ? soma / total : 0,
      positivas: total ? ((porNota[4]! + porNota[5]!) / total) * 100 : 0,
      baixas: porNota[1]! + porNota[2]!,
      porNota,
      tecnicos: [...tecnicos.entries()]
        .map(([nome, t]) => ({ nome, media: t.soma / t.qtd, qtd: t.qtd }))
        .sort((a, b) => b.qtd - a.qtd),
    };
  }, [avaliacoes]);

  const lista = soBaixas ? avaliacoes.filter((a) => a.nota <= 2) : avaliacoes;

  function exportar(formato: FormatoExportacao) {
    exportarTabela(
      formato,
      avaliacoes.map((a) => ({
        Data: dataHoraBR(a.created_at),
        OS: a.ordens_servico?.numero ?? "",
        Cliente: a.ordens_servico?.clientes?.nome ?? "",
        Técnico: a.ordens_servico?.responsavel ?? "",
        Nota: a.nota,
        Avaliação: ROTULO_NOTA[a.nota],
        Comentário: a.comentario ?? "",
      })),
      "relatorio-avaliacoes",
    );
  }

  return (
    <section
      id="avaliacoes"
      ref={secaoRef}
      className="scroll-mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">Avaliações dos clientes</h2>
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
      ) : resumo.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma avaliação no período. Os clientes avaliam pela Área do Cliente (link da OS) depois
          da entrega.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Nota média</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
                {resumo.media.toFixed(1).replace(".", ",")}
                <Estrelas nota={Math.round(resumo.media)} tamanho="h-4 w-4" />
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Avaliações</p>
              <p className="mt-1 text-2xl font-extrabold">{resumo.total}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Satisfeitos (4–5★)</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-600">
                {Math.round(resumo.positivas)}%
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Baixas (1–2★)</p>
              <p
                className={`mt-1 text-2xl font-extrabold ${resumo.baixas ? "text-destructive" : ""}`}
              >
                {resumo.baixas}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Distribuição</p>
              {[5, 4, 3, 2, 1].map((n) => {
                const qtd = resumo.porNota[n]!;
                const pct = (qtd / resumo.total) * 100;
                return (
                  <div key={n} className="flex items-center gap-2 text-sm">
                    <span className="w-8 shrink-0 text-right">{n}★</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${n <= 2 ? "bg-destructive" : n === 3 ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-muted-foreground">{qtd}</span>
                  </div>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Por técnico</p>
              <div className="divide-y divide-border rounded-xl border border-border">
                {resumo.tecnicos.map((t) => (
                  <div key={t.nome} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="truncate">{t.nome}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Estrelas nota={Math.round(t.media)} />
                      <b>{t.media.toFixed(1).replace(".", ",")}</b>
                      <span className="text-xs text-muted-foreground">({t.qtd})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Comentários</p>
              {resumo.baixas > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={soBaixas}
                    onChange={(e) => setSoBaixas(e.target.checked)}
                  />
                  Só as baixas
                </label>
              )}
            </div>
            <div className="divide-y divide-border rounded-xl border border-border">
              {lista.map((a) => {
                const os = a.ordens_servico;
                const baixa = a.nota <= 2;
                return (
                  <div
                    key={a.id}
                    className={`flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-start sm:justify-between ${baixa ? "bg-destructive/5" : ""}`}
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <Estrelas nota={a.nota} />
                        <span className="font-semibold">
                          #{os?.numero ?? "?"} · {os?.clientes?.nome ?? "Cliente"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dataHoraBR(a.created_at)}
                          {os?.responsavel ? ` · ${os.responsavel}` : ""}
                        </span>
                      </p>
                      {a.comentario ? (
                        <p className="text-muted-foreground whitespace-pre-line">
                          &ldquo;{a.comentario}&rdquo;
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/70">Sem comentário</p>
                      )}
                    </div>
                    {baixa && os && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5 border-green-600/40 text-green-600 hover:bg-green-600/10"
                        onClick={() => setResponder(os)}
                      >
                        <MessageCircle className="h-4 w-4" /> Responder no WhatsApp
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <WhatsAppSendModal
        os={responder}
        open={!!responder}
        onOpenChange={(aberto) => !aberto && setResponder(null)}
        templateInicial="retorno_avaliacao"
      />
    </section>
  );
}
