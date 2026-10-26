import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  ListOrdered,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Settings2,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/EmptyState";
import { podeVer, usePermissoes } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { acessoCentralFn } from "@/lib/whatsapp/central.functions";
import { statusWhatsapp } from "@/lib/whatsapp/whatsapp.functions";
import { ListaConversas } from "@/components/whatsapp-central/ListaConversas";
import { JanelaConversa } from "@/components/whatsapp-central/JanelaConversa";
import { PainelContexto } from "@/components/whatsapp-central/PainelContexto";
import { RespostasRapidasDialog } from "@/components/whatsapp-central/RespostasRapidasDialog";
import { QK, mensagemDeErro } from "@/components/whatsapp-central/util";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — SpaceTech" },
      { name: "description", content: "Central de atendimento pelo WhatsApp da loja." },
    ],
  }),
  // ?c=<conversa> mantém a conversa aberta ao recarregar e no botão voltar do celular.
  validateSearch: (search: Record<string, unknown>): { c?: string } => {
    const c = search["c"];
    return typeof c === "string" ? { c } : {};
  },
  component: CentralWhatsapp,
});

function CentralWhatsapp() {
  const navigate = useNavigate({ from: "/whatsapp" });
  const { c: selecionada } = Route.useSearch();
  const { data: permissoes } = usePermissoes();
  const [painelAberto, setPainelAberto] = useState(false);
  const [respostasAbertas, setRespostasAbertas] = useState(false);

  const acesso = useQuery({ queryKey: QK.acesso, queryFn: () => acessoCentralFn(), retry: false });
  const status = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => statusWhatsapp(),
    retry: false,
    refetchInterval: 60_000,
  });

  function selecionar(id: string | null) {
    void navigate({ search: id ? { c: id } : {} });
  }

  if (acesso.isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (acesso.isError || !acesso.data) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Sem acesso ao WhatsApp"
        description={mensagemDeErro(acesso.error)}
      />
    );
  }
  const a = acesso.data;
  const conectado = status.data?.status === "conectado";
  const podeConfigurar = podeVer(permissoes, "configuracoes");

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-[480px] flex-col sm:h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-8rem)]">
      <PageHeader
        title="WhatsApp"
        subtitle="Central de atendimento da loja"
        action={
          <>
            <Button variant="outline" size="sm" onClick={() => setRespostasAbertas(true)}>
              <Zap className="mr-1.5 h-4 w-4" /> Respostas rápidas
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/whatsapp-fila">
                <ListOrdered className="mr-1.5 h-4 w-4" /> Fila e automações
              </Link>
            </Button>
            {podeConfigurar && (
              <Button asChild variant="outline" size="sm">
                <Link to="/whatsapp-conexao">
                  <Settings2 className="mr-1.5 h-4 w-4" /> Conexão
                </Link>
              </Button>
            )}
          </>
        }
      />

      {!status.isLoading && !conectado && (
        <div
          role="status"
          className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            WhatsApp {status.data?.status === "conectando" ? "conectando" : "desconectado"}: as
            conversas continuam visíveis, mas nada é enviado nem recebido até reconectar.
          </span>
          {podeConfigurar && (
            <Button asChild size="sm" variant="outline" className="h-7">
              <Link to="/whatsapp-conexao">Conectar</Link>
            </Button>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_300px]">
        <aside
          className={cn(
            "min-h-0 border-border lg:block lg:border-r",
            selecionada ? "hidden" : "block",
          )}
          aria-label="Conversas"
        >
          <ListaConversas
            selecionada={selecionada ?? null}
            onSelecionar={selecionar}
            equipe={a.equipe}
            euId={a.euId}
          />
        </aside>

        <section
          className={cn("min-h-0 min-w-0", selecionada ? "block" : "hidden lg:block")}
          aria-label="Conversa"
        >
          {selecionada ? (
            <JanelaConversa
              key={selecionada}
              conversaId={selecionada}
              acesso={a}
              onVoltar={() => selecionar(null)}
              onAbrirPainel={() => setPainelAberto(true)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <MessagesSquare className="h-10 w-10 text-primary/50" />
              Escolha uma conversa à esquerda.
            </div>
          )}
        </section>

        <aside
          className="hidden min-h-0 overflow-y-auto border-l border-border xl:block"
          aria-label="Cliente e OS"
        >
          {selecionada && (
            <PainelContexto
              conversaId={selecionada}
              podeResponder={a.podeResponder}
              verOrdens={a.verOrdens}
            />
          )}
        </aside>
      </div>

      <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
        <SheetContent side="right" className="w-[90vw] max-w-sm overflow-y-auto p-0">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>Cliente e OS</SheetTitle>
          </SheetHeader>
          {selecionada && (
            <PainelContexto
              conversaId={selecionada}
              podeResponder={a.podeResponder}
              verOrdens={a.verOrdens}
            />
          )}
        </SheetContent>
      </Sheet>

      <RespostasRapidasDialog
        open={respostasAbertas}
        onOpenChange={setRespostasAbertas}
        podeEditar={a.podeResponder}
      />
    </div>
  );
}
