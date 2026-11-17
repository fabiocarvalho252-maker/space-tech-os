// Painel de métricas do Instagram (aba "Métricas" do /admin/marketing).
// Lê só o que o servidor já gravou; "Atualizar agora" dispara a coleta com trava.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Instagram, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import {
  atualizarMetricasInstagram,
  obterMetricasInstagram,
  type PainelInstagram,
} from "@/lib/marketing/ig-metricas.functions";
import {
  diaBrasil,
  engajamentoMedio,
  filtrarPorPeriodo,
  serieSeguidores,
  somarMetrica,
  variacaoSeguidores,
  type PontoSeguidores,
} from "@/lib/marketing/ig-metricas.calc";
import { cn } from "@/lib/utils";
import { CardsMetricas } from "./CardsMetricas";
import { GraficoSeguidores } from "./GraficoSeguidores";
import { RankingPosts } from "./RankingPosts";
import { PergunteClaude } from "./PergunteClaude";

const CHAVE_CONSULTA = ["metricas-instagram"] as const;
const PERIODOS = [7, 30, 90] as const;
type Periodo = (typeof PERIODOS)[number];
const MINUTOS_TRAVA = 10;

type Derivados = {
  serieJanela: PontoSeguidores[];
  variacao: ReturnType<typeof variacaoSeguidores>;
  postsDoPeriodo: ReturnType<typeof filtrarPorPeriodo>;
  alcance: number | null;
  engajamento: number | null;
  salvamentos: number | null;
  compartilhamentos: number | null;
};

/** Cálculos do período. Pura: o painel só recalcula quando dados, período ou o dia mudam. */
function calcularDerivados(painel: PainelInstagram, periodo: Periodo, hoje: string): Derivados {
  const pontosConta: PontoSeguidores[] = painel.conta
    .filter((c): c is typeof c & { seguidores: number } => c.seguidores !== null)
    .map((c) => ({ data: c.dia, seguidores: c.seguidores }));
  const postsDoPeriodo = filtrarPorPeriodo(painel.midias, periodo, hoje);
  return {
    serieJanela: serieSeguidores(pontosConta, periodo, hoje),
    variacao: variacaoSeguidores(pontosConta, periodo),
    postsDoPeriodo,
    alcance: somarMetrica(postsDoPeriodo, "alcance"),
    engajamento: engajamentoMedio(postsDoPeriodo),
    salvamentos: somarMetrica(postsDoPeriodo, "salvamentos"),
    compartilhamentos: somarMetrica(postsDoPeriodo, "compartilhamentos"),
  };
}

export function MetricasInstagram() {
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<Periodo>(30);
  // Dia de Brasília recalculado a cada render: com a aba aberta após a meia-noite, o período acompanha.
  const hoje = diaBrasil(new Date());

  const consulta = useQuery({
    queryKey: CHAVE_CONSULTA,
    queryFn: () => obterMetricasInstagram(),
  });

  const atualizar = useMutation({
    mutationFn: () => atualizarMetricasInstagram(),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.info(`Aguarde ${Math.ceil(r.esperarSegundos / 60)} min para atualizar de novo.`);
        return;
      }
      if (r.permissoesOk) toast.success(r.mensagem);
      else toast.warning(r.mensagem);
      qc.invalidateQueries({ queryKey: CHAVE_CONSULTA });
    },
    onError: (erro) => toast.error(erro instanceof Error ? erro.message : "Falha ao atualizar."),
  });

  const painelCarregado = consulta.data;
  const derivados = useMemo(
    () => (painelCarregado ? calcularDerivados(painelCarregado, periodo, hoje) : null),
    [painelCarregado, periodo, hoje],
  );

  if (consulta.isPending) return <CarregandoPainel />;
  if (consulta.isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Não foi possível carregar as métricas</AlertTitle>
        <AlertDescription>Verifique a conexão com a Meta e tente de novo.</AlertDescription>
      </Alert>
    );
  }

  if (!derivados) return <CarregandoPainel />;
  const painel = consulta.data;
  if (!painel.conectado) {
    return (
      <EmptyState
        icon={Instagram}
        title="Instagram não conectado"
        description="Conecte a Página com Instagram comercial na aba Contas para ver as métricas."
      />
    );
  }

  const { serieJanela, variacao } = derivados;
  const permissoesOk = painel.ultimaColeta?.permissoesOk !== false;
  const semColetas = painel.conta.length === 0;
  const minutosDesdeColeta = painel.ultimaColeta
    ? Math.round((Date.now() - Date.parse(painel.ultimaColeta.executadoEm)) / 60_000)
    : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Instagram className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Conta conectada</p>
            <p className="flex items-center gap-2 font-semibold">
              @{painel.usuario ?? "—"}
              <Badge variant="secondary">Somente leitura</Badge>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Período"
            className="inline-flex rounded-full border bg-background p-1"
          >
            {PERIODOS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={periodo === p}
                onClick={() => setPeriodo(p)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  periodo === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p} dias
              </button>
            ))}
          </div>
          <Button
            onClick={() => atualizar.mutate()}
            disabled={atualizar.isPending}
            className="rounded-full"
          >
            {atualizar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar agora
          </Button>
        </div>
      </header>

      {!permissoesOk && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Faltam permissões de insights</AlertTitle>
          <AlertDescription>
            Alcance, visitas ao perfil, cliques e salvamentos aparecem como "n/d". Reconecte a
            Página na aba Contas pedindo a permissão instagram_manage_insights.
          </AlertDescription>
        </Alert>
      )}

      {semColetas ? (
        <EmptyState
          icon={Instagram}
          title="Ainda não há coletas"
          description={`Clique em "Atualizar agora" para buscar os dados (a próxima atualização manual libera em ${MINUTOS_TRAVA} min).`}
        />
      ) : (
        <>
          <CardsMetricas
            seguidores={painel.seguidoresAtuais}
            variacao={variacao}
            periodo={periodo}
            alcance={derivados.alcance}
            engajamento={derivados.engajamento}
            salvamentos={derivados.salvamentos}
            compartilhamentos={derivados.compartilhamentos}
          />

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardContent className="p-5">
                <GraficoSeguidores serie={serieJanela} periodo={periodo} />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardContent className="p-5">
                <RankingPosts posts={derivados.postsDoPeriodo} permissoesOk={permissoesOk} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardContent className="p-5">
          <PergunteClaude disponivel={painel.anthropicDisponivel} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {minutosDesdeColeta === null
          ? "Nenhuma coleta registrada."
          : `Última coleta há ${minutosDesdeColeta < 1 ? "menos de 1" : minutosDesdeColeta} min${
              painel.ultimaColeta?.ok === false
                ? " — falhou: " + (painel.ultimaColeta.mensagem ?? "")
                : ""
            }.`}
      </p>
    </div>
  );
}

function CarregandoPainel() {
  return (
    <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando métricas…
    </div>
  );
}
