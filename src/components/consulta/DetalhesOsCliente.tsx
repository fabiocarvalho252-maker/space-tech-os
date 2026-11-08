// Área do Cliente (/consulta/:id): o que a loja já mostra no PDF da OS, em
// tela — como o aparelho entrou, laudo, linha do tempo, pagamento, garantia,
// fotos e o próprio PDF. Os dados vêm de detalhes_os_publica() (sem senha,
// anotações internas, e com IMEI/série mascarados).
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  Camera,
  ClipboardCheck,
  Download,
  History,
  Loader2,
  ShieldCheck,
  Smartphone,
  Wallet,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { brl, dataBR, dataHoraBR, statusLabel } from "@/lib/format";
import {
  CHECKLIST_LABELS,
  CHECKLIST_STATUS_LABELS,
  ESTADO_FISICO_LABELS,
} from "@/lib/os-checklist-labels";
import { fotosOsPublicaFn, pdfOsPublicaFn } from "@/lib/consulta-publica.functions";

export type DetalhesOsPublica = {
  cor: string | null;
  imei: string | null;
  serie: string | null;
  acessorios: string | null;
  checklist_entrada: Record<string, string>;
  estado_fisico: Record<string, boolean>;
  estado_fisico_obs: string | null;
  laudo_tecnico: string | null;
  previsao: string | null;
  data_entrega: string | null;
  garantia_dias: number | null;
  garantia_vencimento: string | null;
  historico: {
    data: string;
    evento: "criacao" | "status" | "aprovacao_cliente";
    status: string | null;
    descricao: string | null;
  }[];
  desconto: number;
  valor_pago: number;
  status_pagamento: string | null;
  pagamentos: {
    parcela: number | null;
    total_parcelas: number | null;
    valor: number;
    forma: string | null;
    status: string | null;
    vencimento: string | null;
    recebido_em: string | null;
  }[];
  termos: string | null;
  qtd_fotos: number;
};

const CATEGORIA_FOTO: Record<string, string> = {
  entrada: "Entrada",
  antes: "Antes",
  durante: "Durante",
  depois: "Depois",
  documento: "Documento",
  documentos: "Documentos",
};

function Titulo({ icon: Icon, children }: { icon: typeof Wallet; children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" /> {children}
    </h3>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
        {rotulo}
      </Label>
      <p className="text-sm mt-0.5 break-words">{valor}</p>
    </div>
  );
}

function textoEvento(h: DetalhesOsPublica["historico"][number]) {
  if (h.evento === "criacao") return "Aparelho recebido na assistência";
  if (h.evento === "aprovacao_cliente") return h.descricao || "Resposta do cliente ao orçamento";
  return h.status ? `Status: ${statusLabel(h.status)}` : "Status atualizado";
}

export function DetalhesOsCliente({
  osId,
  numero,
  d,
}: {
  osId: string;
  numero: number;
  d: DetalhesOsPublica;
}) {
  const checklist = Object.keys(CHECKLIST_LABELS).filter((k) => d.checklist_entrada?.[k]);
  const avarias = Object.keys(ESTADO_FISICO_LABELS).filter((k) => d.estado_fisico?.[k]);
  const temEntrada =
    d.cor || d.imei || d.serie || d.acessorios || checklist.length || avarias.length || d.estado_fisico_obs;
  const garantiaVigente =
    d.garantia_vencimento && new Date(`${d.garantia_vencimento}T23:59:59`) >= new Date();

  return (
    <div className="space-y-8">
      {(d.previsao || d.data_entrega) && (
        <section className="grid grid-cols-2 gap-4 rounded-xl border border-border/50 bg-muted/40 p-4">
          {d.data_entrega ? (
            <Campo rotulo="Entregue em" valor={<strong>{dataHoraBR(d.data_entrega)}</strong>} />
          ) : (
            <Campo
              rotulo="Previsão de entrega"
              valor={
                <span className="inline-flex items-center gap-1.5 font-bold">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  {dataHoraBR(d.previsao)}
                </span>
              }
            />
          )}
        </section>
      )}

      {d.laudo_tecnico && (
        <section className="space-y-3">
          <Titulo icon={FileText}>Laudo Técnico</Titulo>
          <p className="text-sm whitespace-pre-line rounded-xl border border-border/50 bg-muted/40 p-4">
            {d.laudo_tecnico}
          </p>
        </section>
      )}

      {temEntrada && (
        <section className="space-y-4">
          <Titulo icon={Smartphone}>Como o aparelho chegou</Titulo>
          <div className="rounded-xl border border-border/50 bg-muted/40 p-4 space-y-4">
            {(d.cor || d.imei || d.serie || d.acessorios) && (
              <div className="grid grid-cols-2 gap-4">
                {d.cor && <Campo rotulo="Cor" valor={d.cor} />}
                {d.imei && <Campo rotulo="IMEI" valor={d.imei} />}
                {d.serie && <Campo rotulo="Nº de série" valor={d.serie} />}
                {d.acessorios && <Campo rotulo="Acessórios deixados" valor={d.acessorios} />}
              </div>
            )}
            {(avarias.length > 0 || d.estado_fisico_obs) && (
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                  Estado físico
                </Label>
                {avarias.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {avarias.map((k) => (
                      <span
                        key={k}
                        className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400"
                      >
                        {ESTADO_FISICO_LABELS[k]}
                      </span>
                    ))}
                  </div>
                )}
                {d.estado_fisico_obs && (
                  <p className="text-sm text-muted-foreground mt-1.5">{d.estado_fisico_obs}</p>
                )}
              </div>
            )}
            {checklist.length > 0 && (
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1">
                  <ClipboardCheck className="h-3 w-3" /> Testes na entrada
                </Label>
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {checklist.map((k) => {
                    const st = d.checklist_entrada[k]!;
                    return (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{CHECKLIST_LABELS[k]}</span>
                        <span
                          className={
                            st === "ok"
                              ? "font-semibold text-emerald-600"
                              : st === "defeito"
                                ? "font-semibold text-rose-600"
                                : "text-muted-foreground"
                          }
                        >
                          {CHECKLIST_STATUS_LABELS[st] ?? st}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {d.historico.length > 0 && (
        <section className="space-y-4">
          <Titulo icon={History}>Acompanhamento</Titulo>
          <ol className="relative ml-2 border-l border-border pl-5 space-y-4">
            {d.historico.map((h, i) => {
              const ultimo = i === d.historico.length - 1;
              return (
                <li key={i} className="relative">
                  <span
                    className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-background ${
                      ultimo ? "bg-primary ring-2 ring-primary/30" : "bg-muted-foreground/40"
                    }`}
                  />
                  <p className={`text-sm ${ultimo ? "font-bold" : "font-medium"}`}>{textoEvento(h)}</p>
                  <p className="text-xs text-muted-foreground">{dataHoraBR(h.data)}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {(d.pagamentos.length > 0 || Number(d.valor_pago) > 0) && (
        <section className="space-y-3">
          <Titulo icon={Wallet}>Pagamento</Titulo>
          <div className="rounded-xl border border-border/50 divide-y divide-border/50">
            {d.pagamentos.map((p, i) => {
              const pago = p.status === "recebido" || p.status === "pago" || !!p.recebido_em;
              return (
                <div key={i} className="flex items-start justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.forma || "Pagamento"}
                      {(p.total_parcelas ?? 1) > 1 && ` · ${p.parcela}/${p.total_parcelas}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pago
                        ? `Pago${p.recebido_em ? ` em ${dataBR(p.recebido_em)}` : ""}`
                        : `A pagar${p.vencimento ? ` · vence ${dataBR(p.vencimento)}` : ""}`}
                    </p>
                  </div>
                  <span className={`shrink-0 font-semibold ${pago ? "text-emerald-600" : ""}`}>
                    {brl(p.valor)}
                  </span>
                </div>
              );
            })}
            {Number(d.valor_pago) > 0 && (
              <div className="flex justify-between p-3 text-sm">
                <span>Total pago</span>
                <span className="font-bold text-emerald-600">{brl(d.valor_pago)}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {(d.garantia_dias || d.termos) && (
        <section className="space-y-3">
          <Titulo icon={ShieldCheck}>Garantia</Titulo>
          {d.garantia_dias ? (
            <div
              className={`rounded-xl border p-4 text-sm ${
                garantiaVigente
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-border/50 bg-muted/40"
              }`}
            >
              <p className="font-bold">{d.garantia_dias} dias de garantia</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {d.garantia_vencimento
                  ? `${garantiaVigente ? "Válida até" : "Venceu em"} ${dataBR(d.garantia_vencimento)}`
                  : "Contados a partir da entrega do aparelho."}
              </p>
            </div>
          ) : null}
          {d.termos && (
            <details className="group rounded-xl border border-border/50 bg-muted/40 p-4">
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Ler termos de garantia
              </summary>
              <p className="mt-3 text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
                {d.termos}
              </p>
            </details>
          )}
        </section>
      )}

      {d.qtd_fotos > 0 && <FotosOs osId={osId} qtd={d.qtd_fotos} />}

      <BaixarPdf osId={osId} numero={numero} />
    </div>
  );
}

function FotosOs({ osId, qtd }: { osId: string; qtd: number }) {
  const [abrir, setAbrir] = useState(false);
  const { data: fotos = [], isLoading, error } = useQuery({
    queryKey: ["os-publica-fotos", osId],
    queryFn: () => fotosOsPublicaFn({ data: { osId } }),
    enabled: abrir,
    // Links assinados valem 1h.
    staleTime: 30 * 60 * 1000,
  });

  return (
    <section className="space-y-3">
      <Titulo icon={Camera}>Fotos do aparelho</Titulo>
      {!abrir ? (
        <Button variant="outline" className="w-full gap-2" onClick={() => setAbrir(true)}>
          <Camera className="h-4 w-4" /> Ver {qtd} {qtd === 1 ? "foto" : "fotos"}
        </Button>
      ) : isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Não foi possível carregar as fotos.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {fotos.map((f, i) => (
            <a
              key={i}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="group relative block aspect-square overflow-hidden rounded-lg border border-border/50 bg-muted"
            >
              <img
                src={f.url}
                alt={CATEGORIA_FOTO[f.categoria] ?? f.categoria}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {CATEGORIA_FOTO[f.categoria] ?? f.categoria}
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function BaixarPdf({ osId, numero }: { osId: string; numero: number }) {
  const baixar = useMutation({
    mutationFn: async () => {
      const { base64 } = await pdfOsPublicaFn({ data: { osId } });
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `OS-${numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  });

  return (
    <div className="space-y-2">
      <Button className="w-full h-12 gap-2" disabled={baixar.isPending} onClick={() => baixar.mutate()}>
        {baixar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Baixar PDF da OS
      </Button>
      {baixar.error && (
        <p className="text-xs text-destructive text-center">
          Não foi possível gerar o PDF agora. Tente de novo em instantes.
        </p>
      )}
    </div>
  );
}
