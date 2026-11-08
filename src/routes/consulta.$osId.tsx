import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { avisarOrcamentoRespondidoFn } from "@/lib/orcamento-link.functions";
import { DetalhesOsCliente, type DetalhesOsPublica } from "@/components/consulta/DetalhesOsCliente";
import { brl, dataBR, dataHoraBR, statusLabel } from "@/lib/format";
import { LogoMark, LogoWord } from "@/components/Logo";
import { NotaDaLoja } from "@/components/consulta/NotaDaLoja";
import { CashbackCliente } from "@/components/consulta/CashbackCliente";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  Wrench,
  AlertCircle,
  Search,
  Wallet,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  XCircle,
} from "lucide-react";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/consulta/$osId")({
  component: ConsultaPublica,
});

function ConsultaPublica() {
  const { osId } = Route.useParams();
  // Orçamento com opções: a escolha do cliente em cada grupo (id do item).
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});

  // Avisa a loja que o cliente abriu o link (histórico da OS + sino). O banco
  // ignora quem é da loja e repete no máximo a cada 6 h por OS.
  useEffect(() => {
    void supabase.rpc("registrar_visualizacao_os_publica", { p_identificador: osId });
  }, [osId]);

  const {
    data: os,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["os-publica", osId],
    queryFn: async () => {
      // consultar_os_publica() aceita só o UUID (o que o QR Code e o
      // link do WhatsApp levam; nunca o número sequencial), e roda com
      // SECURITY DEFINER — ordens_servico não tem nenhuma policy de RLS
      // liberada para o papel "anon", então uma consulta direta na tabela
      // sempre voltava vazia para um cliente sem login.
      const { data, error } = await supabase.rpc("consultar_os_publica", {
        p_identificador: osId,
      });

      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["os-publica-itens", osId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("itens_os_publica", { p_identificador: osId });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Como o aparelho entrou, laudo, linha do tempo, pagamento, garantia,
  // fotos e PDF — tudo sem dados internos (ver detalhes_os_publica).
  const { data: detalhes } = useQuery({
    queryKey: ["os-publica-detalhes", osId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("detalhes_os_publica", { p_identificador: osId });
      if (error) throw error;
      return (data ?? null) as DetalhesOsPublica | null;
    },
  });

  const fixos = itens.filter((i) => !i.opcao_grupo);
  const grupos = [
    ...itens
      .filter((i) => i.opcao_grupo)
      .reduce(
        (m, i) => m.set(i.opcao_grupo!, [...(m.get(i.opcao_grupo!) ?? []), i]),
        new Map<string, typeof itens>(),
      ),
  ];
  const aguardando = os?.status === "orcamento" || os?.status === "aguardando_aprovacao";
  const todasEscolhidas = grupos.every(([g]) => !!escolhas[g]);
  const valorItem = (i: (typeof itens)[number]) => i.quantidade * Number(i.preco_unitario);
  const totalComEscolhas = Math.max(
    fixos.reduce((t, i) => t + valorItem(i), 0) +
      grupos.reduce((t, [g, ops]) => {
        const escolhido = ops.find((o) => o.id === escolhas[g]);
        return t + (escolhido ? valorItem(escolhido) : Math.min(...ops.map(valorItem)));
      }, 0) -
      Number(itens[0]?.desconto ?? 0),
    0,
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <LogoMark className="h-12 w-12 opacity-50" />
          <p className="text-sm text-muted-foreground font-medium">
            Buscando informações da sua OS...
          </p>
        </div>
      </div>
    );
  }

  if (error || !os) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold">Ordem de Serviço não encontrada</h1>
        <p className="text-muted-foreground text-center mt-2 max-w-xs">
          Verifique o link ou o QR Code e tente novamente.
        </p>
        <a href="/" className="mt-6 text-primary font-medium hover:underline">
          Voltar ao início
        </a>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "recebido":
        return <Clock className="h-5 w-5 text-blue-500" />;
      case "em_analise":
        return <Search className="h-5 w-5 text-amber-500" />;
      case "orcamento":
        return <AlertCircle className="h-5 w-5 text-purple-500" />;
      case "aprovado":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "em_reparo":
        return <Wrench className="h-5 w-5 text-indigo-500" />;
      case "pronto":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <header className="bg-background border-b border-border px-4 py-6 mb-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8 text-primary" />
            <LogoWord className="text-lg" />
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            Área do Cliente
          </Badge>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4">
        <NotaDaLoja tipo="os" id={osId} />
        <CashbackCliente osId={osId} />
        <Card className="border-none shadow-soft overflow-hidden bg-card">
          <CardHeader className="bg-primary/5 border-b border-primary/10 py-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-tighter mb-1">
                  Ordem de Serviço
                </p>
                <CardTitle className="text-3xl font-black">#{os.numero}</CardTitle>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium mb-1">Status Atual</p>
                <div className="flex items-center gap-2 justify-end">
                  {getStatusIcon(os.status)}
                  <span className="font-bold text-sm">{statusLabel(os.status)}</span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-8">
            <section className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                  Aparelho
                </Label>
                <p className="font-bold text-lg mt-0.5">{os.aparelho}</p>
                <p className="text-sm text-muted-foreground">
                  {os.marca} {os.modelo}
                </p>
              </div>
              <div className="text-right">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                  Data de Entrada
                </Label>
                <p className="font-bold text-lg mt-0.5">{dataHoraBR(os.created_at)}</p>
              </div>
            </section>

            <Separator className="bg-border/50" />

            <section className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Detalhes do Serviço
              </h3>
              <div className="bg-muted/40 rounded-xl p-4 border border-border/50 space-y-4">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                    Defeito Relatado
                  </Label>
                  <p className="text-sm mt-1">{os.defeito || "Nenhuma descrição fornecida."}</p>
                </div>
                {os.diagnostico && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                      Diagnóstico Técnico
                    </Label>
                    <p className="text-sm mt-1">{os.diagnostico}</p>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />{" "}
                {itens.length ? "Orçamento" : "Resumo Financeiro"}
              </h3>
              {itens.length > 0 && (
                <div className="rounded-xl border border-border/50 divide-y divide-border/50">
                  {fixos.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium break-words">{item.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.tipo === "servico" ? "Serviço" : "Peça"}
                          {item.quantidade > 1 &&
                            ` · ${item.quantidade} × ${brl(item.preco_unitario)}`}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold">
                        {brl(item.quantidade * Number(item.preco_unitario))}
                      </span>
                    </div>
                  ))}
                  {grupos.map(([grupo, opcoes]) => (
                    <fieldset key={grupo} className="p-3 space-y-2">
                      <legend className="sr-only">{grupo}</legend>
                      <p className="text-sm font-bold">
                        {grupo}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {aguardando ? "— escolha uma opção" : ""}
                        </span>
                      </p>
                      {opcoes.map((op) => {
                        const marcado = escolhas[grupo] === op.id;
                        return (
                          <label
                            key={op.id}
                            className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 text-sm transition ${
                              marcado
                                ? "border-primary bg-primary/10"
                                : "border-border/60 hover:bg-muted/40"
                            }`}
                          >
                            <span className="flex min-w-0 items-start gap-2">
                              <input
                                type="radio"
                                name={`opcao-${grupo}`}
                                checked={marcado}
                                disabled={!aguardando}
                                onChange={() => setEscolhas({ ...escolhas, [grupo]: op.id })}
                                className="mt-1 accent-[hsl(var(--primary))]"
                              />
                              <span className="min-w-0">
                                <span className="block font-medium break-words">
                                  {op.descricao}
                                </span>
                                {op.quantidade > 1 && (
                                  <span className="text-xs text-muted-foreground">
                                    {op.quantidade} × {brl(op.preco_unitario)}
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className="shrink-0 font-semibold">
                              {brl(op.quantidade * Number(op.preco_unitario))}
                            </span>
                          </label>
                        );
                      })}
                    </fieldset>
                  ))}
                  {Number(itens[0]?.desconto) > 0 && (
                    <div className="flex justify-between p-3 text-sm text-emerald-600">
                      <span>Desconto</span>
                      <span className="font-semibold">− {brl(Number(itens[0]?.desconto))}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center p-4 bg-primary/5 rounded-xl border border-primary/10">
                <span className="text-sm font-medium">
                  {grupos.length && !todasEscolhidas ? "Valor a partir de" : "Valor Total"}
                </span>
                <span className="text-xl font-black text-primary">
                  {brl(grupos.length ? totalComEscolhas : os.valor)}
                </span>
              </div>
            </section>

            <DecisaoOrcamento
              osId={osId}
              status={os.status}
              grupos={grupos.map(([g]) => g)}
              escolhas={escolhas}
            />

            {detalhes && <DetalhesOsCliente osId={osId} numero={os.numero} d={detalhes} />}

            <footer className="pt-6 text-center border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-4">
                Em caso de dúvidas, entre em contato com a assistência:
              </p>
              <div className="flex flex-col items-center gap-1">
                <p className="font-bold text-sm">{os.loja || "SpaceTech"}</p>
                {os.whatsapp && (
                  <p className="text-xs text-muted-foreground">WhatsApp: {os.whatsapp}</p>
                )}
              </div>
            </footer>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Aprovar / recusar o orçamento pelo próprio link (decidir_orcamento_por_link
// só aceita enquanto a OS está em "orcamento" ou "aguardando_aprovacao").
function DecisaoOrcamento({
  osId,
  status,
  grupos,
  escolhas,
}: {
  osId: string;
  status: string;
  grupos: string[];
  escolhas: Record<string, string>;
}) {
  const faltam = grupos.filter((g) => !escolhas[g]);
  const qc = useQueryClient();
  const [confirmar, setConfirmar] = useState<boolean | null>(null);

  const decidir = useMutation({
    mutationFn: async (aprovar: boolean) => {
      const { error } = await supabase.rpc("decidir_orcamento_por_link", {
        p_os_id: osId,
        p_aprovar: aprovar,
        p_escolhas: Object.values(escolhas),
      });
      if (error) throw error;
      // Aviso à loja no WhatsApp; se falhar, o cron manda depois.
      avisarOrcamentoRespondidoFn({ data: { osId } }).catch(() => {});
    },
    onSettled: () => {
      setConfirmar(null);
      qc.invalidateQueries({ queryKey: ["os-publica", osId] });
      qc.invalidateQueries({ queryKey: ["os-publica-detalhes", osId] });
      qc.invalidateQueries({ queryKey: ["os-publica-itens", osId] });
    },
  });

  if (status === "aprovado" || status === "reprovado") {
    const aprovado = status === "aprovado";
    return (
      <div
        className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${
          aprovado
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
        }`}
      >
        {aprovado ? (
          <CheckCircle2 className="h-5 w-5 shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 shrink-0" />
        )}
        <p className="font-medium">
          {aprovado
            ? "Orçamento aprovado. Obrigado! Já vamos dar andamento ao serviço."
            : "Orçamento recusado. Se mudar de ideia, fale com a assistência."}
        </p>
      </div>
    );
  }

  if (status !== "orcamento" && status !== "aguardando_aprovacao") return null;

  return (
    <section className="space-y-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
      <p className="text-sm font-bold text-center">
        {confirmar === null
          ? "Você aprova este orçamento?"
          : confirmar
            ? "Confirmar a APROVAÇÃO do orçamento?"
            : "Confirmar que você RECUSA o orçamento?"}
      </p>
      {confirmar === null && faltam.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Para aprovar, escolha a opção de: <strong>{faltam.join(", ")}</strong>.
        </p>
      )}
      {decidir.error && (
        <p className="text-xs text-destructive text-center">
          {decidir.error.message || "Não foi possível registrar sua resposta. Tente de novo."}
        </p>
      )}
      {confirmar === null ? (
        <div className="grid grid-cols-2 gap-3">
          <Button
            className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            disabled={faltam.length > 0}
            onClick={() => setConfirmar(true)}
          >
            <ThumbsUp className="h-4 w-4" /> Aprovar
          </Button>
          <Button
            variant="outline"
            className="h-12 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 gap-2"
            onClick={() => setConfirmar(false)}
          >
            <ThumbsDown className="h-4 w-4" /> Recusar
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12"
            disabled={decidir.isPending}
            onClick={() => setConfirmar(null)}
          >
            Voltar
          </Button>
          <Button
            className={`h-12 gap-2 text-white ${
              confirmar ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
            disabled={decidir.isPending}
            onClick={() => decidir.mutate(confirmar)}
          >
            {decidir.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmar ? "Sim, aprovar" : "Sim, recusar"}
          </Button>
        </div>
      )}
    </section>
  );
}
