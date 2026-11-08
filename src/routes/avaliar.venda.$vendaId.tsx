// Página pública (sem login) para o cliente avaliar uma compra no balcão/PDV.
// O link vai na pesquisa pós-venda do WhatsApp; só abre pelo UUID da venda.
// Dados: venda_publica_avaliacao() — loja, itens e total, sem dados internos.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, ShoppingBag, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, dataBR } from "@/lib/format";
import { primeiroNome } from "@/lib/whatsapp/robo";
import { avisarAvaliacaoBaixaFn } from "@/lib/aviso-avaliacao.functions";
import { LogoMark, LogoWord } from "@/components/Logo";
import { NotaDaLoja } from "@/components/consulta/NotaDaLoja";
import { Badge } from "@/components/ui/badge";
import { AvaliacaoEstrelas, type SituacaoAvaliacao } from "@/components/consulta/AvaliacaoEstrelas";

export const Route = createFileRoute("/avaliar/venda/$vendaId")({
  head: () => ({ meta: [{ title: "Avalie sua compra" }, { name: "robots", content: "noindex" }] }),
  component: AvaliarVenda,
});

type VendaPublica = SituacaoAvaliacao & {
  numero: number | null;
  data: string;
  total: number;
  loja: string | null;
  logo: string | null;
  whatsapp: string | null;
  cliente: string | null;
  itens: { descricao: string; quantidade: number }[];
};

async function carregarVenda(vendaId: string) {
  const { data, error } = await supabase.rpc("venda_publica_avaliacao", {
    p_identificador: vendaId,
  });
  if (error) throw error;
  return (data ?? null) as VendaPublica | null;
}

function AvaliarVenda() {
  const { vendaId } = Route.useParams();
  const chave = ["venda-publica-avaliacao", vendaId] as const;
  const { data: venda, isLoading } = useQuery({
    queryKey: chave,
    queryFn: () => carregarVenda(vendaId),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!venda) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold">Compra não encontrada</h1>
        <p className="text-muted-foreground text-center mt-2 max-w-xs">
          Confira o link que recebeu no WhatsApp e tente novamente.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <header className="bg-background border-b border-border px-4 py-6 mb-6">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8 text-primary" />
            <LogoWord className="text-lg" />
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            Avaliação
          </Badge>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 space-y-6">
        <NotaDaLoja tipo="venda" id={vendaId} />
        <div className="rounded-2xl bg-card p-5 shadow-soft space-y-4">
          <div className="flex items-center gap-3">
            {venda.logo ? (
              <img
                src={venda.logo}
                alt=""
                className="h-12 w-12 rounded-xl object-cover border border-border"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <ShoppingBag className="h-6 w-6 text-primary" />
              </span>
            )}
            <div>
              <p className="text-lg font-bold leading-tight">
                {primeiroNome(venda.cliente) ? `Olá, ${primeiroNome(venda.cliente)}!` : "Olá!"}
              </p>
              <p className="text-sm text-muted-foreground">
                Como foi sua compra na {venda.loja || "loja"}?
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/40 p-4 text-sm space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Compra{venda.numero ? ` nº ${venda.numero}` : ""} · {dataBR(venda.data)}
              </span>
              <span className="font-semibold text-foreground">{brl(venda.total)}</span>
            </div>
            <ul className="space-y-1">
              {venda.itens.map((i, k) => (
                <li key={k} className="flex justify-between gap-3">
                  <span className="min-w-0 break-words">{i.descricao}</span>
                  <span className="shrink-0 text-muted-foreground">×{Number(i.quantidade)}</span>
                </li>
              ))}
            </ul>
          </div>

          <AvaliacaoEstrelas
            chave={chave}
            carregar={() => carregarVenda(vendaId)}
            enviar={async (nota, comentario) => {
              const { data, error } = await supabase.rpc("avaliar_venda_publica", {
                p_identificador: vendaId,
                p_nota: nota,
                p_comentario: comentario,
              });
              if (error) throw error;
              // Nota baixa: alerta a loja no WhatsApp na hora (o cron cobre falhas).
              if (data === "ok" && nota <= 2) {
                void avisarAvaliacaoBaixaFn({ data: { tipo: "venda", id: vendaId } }).catch(
                  () => {},
                );
              }
              return data;
            }}
            titulo="Avalie sua compra"
            agradecimento="Obrigado por avaliar a sua compra!"
            cabecalho={(texto) => (
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" /> {texto}
              </h3>
            )}
          />
          {!venda.pode_avaliar && (
            <p className="text-sm text-muted-foreground">
              A avaliação abre assim que a compra for finalizada.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
