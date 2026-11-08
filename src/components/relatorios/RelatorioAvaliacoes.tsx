// Relatórios → Avaliações: notas que os clientes deram pela Área do Cliente
// (os_avaliacoes) e pela página de avaliação da compra (venda_avaliacoes) no
// período — média, distribuição, média por técnico (só OS) e a lista com
// comentários. Avaliação baixa (1–2★) tem o botão de responder pelo WhatsApp:
// na OS, a janela de envio com o modelo de retorno; na venda, o wa.me.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Download, FileSpreadsheet, MessageCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { WhatsAppSendModal, type WhatsAppOsAlvo } from "@/components/WhatsAppSendModal";
import { dataHoraBR } from "@/lib/format";
import { buildWaMeLink } from "@/lib/whatsapp";
import { primeiroNome } from "@/lib/whatsapp/robo";
import { useProfile } from "@/hooks/useCurrentUser";
import { exportarTabela, type FormatoExportacao } from "@/lib/exports";

type Cliente = { nome: string | null; telefone: string | null } | null;

type Avaliacao = {
  id: string;
  tipo: "os" | "venda";
  numero: number | null;
  cliente: Cliente;
  tecnico: string | null;
  nota: number;
  comentario: string | null;
  created_at: string;
  /** Só nas OS: alvo da janela de envio do WhatsApp. */
  os: WhatsAppOsAlvo | null;
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

  const { data: profile } = useProfile();
  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ["relatorio-avaliacoes", inicioISO, fimISO],
    queryFn: async (): Promise<Avaliacao[]> => {
      const [os, vendas] = await Promise.all([
        supabase
          .from("os_avaliacoes")
          .select(
            "id, nota, comentario, created_at, ordens_servico(id, numero, status, valor, aparelho, marca, modelo, responsavel, created_at, garantia_dias, clientes(nome, telefone))",
          )
          .gte("created_at", inicioISO)
          .lte("created_at", fimISO),
        supabase
          .from("venda_avaliacoes")
          .select("id, nota, comentario, created_at, vendas(numero, clientes(nome, telefone))")
          .gte("created_at", inicioISO)
          .lte("created_at", fimISO),
      ]);
      if (os.error) throw os.error;
      // Sem permissão de vendas a parte das vendas só não aparece.
      const daOs = (os.data ?? []).map((a) => {
        const o = a.ordens_servico as unknown as (WhatsAppOsAlvo & { clientes: Cliente }) | null;
        return {
          id: a.id,
          tipo: "os" as const,
          numero: o?.numero ?? null,
          cliente: o?.clientes ?? null,
          tecnico: o?.responsavel?.trim() || null,
          nota: a.nota,
          comentario: a.comentario,
          created_at: a.created_at,
          os: o,
        };
      });
      const daVenda = (vendas.data ?? []).map((a) => {
        const v = a.vendas as unknown as { numero: number | null; clientes: Cliente } | null;
        return {
          id: a.id,
          tipo: "venda" as const,
          numero: v?.numero ?? null,
          cliente: v?.clientes ?? null,
          tecnico: null,
          nota: a.nota,
          comentario: a.comentario,
          created_at: a.created_at,
          os: null,
        };
      });
      return [...daOs, ...daVenda].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  });

  function linkRetornoVenda(a: Avaliacao): string | null {
    const telefone = a.cliente?.telefone ?? "";
    if (telefone.replace(/\D/g, "").length < 10) return null;
    const nome = primeiroNome(a.cliente?.nome);
    return buildWaMeLink(
      telefone,
      `Olá${nome ? ` ${nome}` : ""}, aqui é da ${profile?.loja || "loja"}. Vimos sua avaliação da compra${a.numero ? ` nº ${a.numero}` : ""} e sentimos muito que a experiência não tenha sido boa. Pode nos contar o que aconteceu? Queremos resolver.`,
    );
  }

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
      if (a.tipo !== "os") continue;
      const nome = a.tecnico || "Sem técnico";
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
        Tipo: a.tipo === "os" ? "OS" : "Venda",
        Número: a.numero ?? "",
        Cliente: a.cliente?.nome ?? "",
        Técnico: a.tecnico ?? "",
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
          da entrega, e pelo link de avaliação da compra que vai na pesquisa pós-venda.
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
                const baixa = a.nota <= 2;
                const waVenda = baixa && a.tipo === "venda" ? linkRetornoVenda(a) : null;
                return (
                  <div
                    key={a.id}
                    className={`flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-start sm:justify-between ${baixa ? "bg-destructive/5" : ""}`}
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <Estrelas nota={a.nota} />
                        <span className="font-semibold">
                          {a.tipo === "os" ? "OS" : "Venda"} #{a.numero ?? "?"} ·{" "}
                          {a.cliente?.nome ?? "Cliente"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dataHoraBR(a.created_at)}
                          {a.tecnico ? ` · ${a.tecnico}` : ""}
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
                    {baixa && a.os && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5 border-green-600/40 text-green-600 hover:bg-green-600/10"
                        onClick={() => setResponder(a.os)}
                      >
                        <MessageCircle className="h-4 w-4" /> Responder no WhatsApp
                      </Button>
                    )}
                    {waVenda && (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5 border-green-600/40 text-green-600 hover:bg-green-600/10"
                      >
                        <a href={waVenda} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="h-4 w-4" /> Responder no WhatsApp
                        </a>
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
