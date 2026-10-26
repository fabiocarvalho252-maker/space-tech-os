import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ListOrdered,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Plus,
  Settings,
  Wifi,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";
import { IconeWhatsapp } from "@/components/SuporteWhatsapp";
import { ThemeToggle } from "@/components/ThemeToggle";
import { podeVer, usePermissoes } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { acessoCentralFn } from "@/lib/whatsapp/central.functions";
import { formatarTelefone } from "@/lib/whatsapp/telefone";
import { statusWhatsapp } from "@/lib/whatsapp/whatsapp.functions";
import { AcoesOsProvider } from "@/components/whatsapp-central/AcoesOs";
import { ListaConversas } from "@/components/whatsapp-central/ListaConversas";
import { JanelaConversa } from "@/components/whatsapp-central/JanelaConversa";
import { NovoAtendimentoDialog } from "@/components/whatsapp-central/NovoAtendimentoDialog";
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

const STATUS_CONEXAO = {
  conectado: { label: "Conectado", cor: "bg-emerald-500", texto: "text-emerald-500" },
  conectando: { label: "Conectando…", cor: "bg-amber-500", texto: "text-amber-500" },
  desconectado: { label: "Desconectado", cor: "bg-red-500", texto: "text-red-500" },
  erro: { label: "Com erro", cor: "bg-red-500", texto: "text-red-500" },
} as const;

function CentralWhatsapp() {
  const navigate = useNavigate({ from: "/whatsapp" });
  const { c: selecionada } = Route.useSearch();
  const { data: permissoes } = usePermissoes();
  const [respostasAbertas, setRespostasAbertas] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);

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
  const podeConfigurar = podeVer(permissoes, "configuracoes");
  const estado = STATUS_CONEXAO[status.data?.status ?? "desconectado"];

  return (
    <AcoesOsProvider>
      <div className="flex h-[calc(100dvh-6.5rem)] min-h-[480px] flex-col sm:h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-8rem)]">
        {/* Cabeçalho */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <IconeWhatsapp className="h-7 w-7" />
          </div>
          <div className="mr-auto">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Central de atendimento e automações</p>
          </div>

          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2"
            title="Estado da conexão com o WhatsApp da loja"
          >
            {status.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <span className={cn("h-2.5 w-2.5 rounded-full", estado.cor)} aria-hidden />
            )}
            <div className="leading-tight">
              <p
                className={cn(
                  "text-sm font-semibold",
                  status.isLoading ? "text-muted-foreground" : estado.texto,
                )}
              >
                {status.isLoading ? "Verificando…" : estado.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {status.data?.phone_number
                  ? formatarTelefone(status.data.phone_number)
                  : "WhatsApp da loja (QR Code)"}
              </p>
            </div>
            {!status.isLoading && status.data?.status !== "conectado" && podeConfigurar && (
              <Button asChild size="sm" variant="outline" className="ml-1 h-7">
                <Link to="/whatsapp-conexao">
                  <Wifi className="mr-1 h-3.5 w-3.5" /> Conectar
                </Link>
              </Button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-1.5 h-4 w-4" /> Configurações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRespostasAbertas(true)}>
                <Zap className="mr-2 h-4 w-4" /> Respostas rápidas
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/whatsapp-fila">
                  <ListOrdered className="mr-2 h-4 w-4" /> Fila e automações
                </Link>
              </DropdownMenuItem>
              {podeConfigurar && (
                <DropdownMenuItem asChild>
                  <Link to="/whatsapp-conexao">
                    <Wifi className="mr-2 h-4 w-4" /> Conexão e QR Code
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {a.podeResponder && (
            <Button onClick={() => setNovoAberto(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo atendimento
            </Button>
          )}
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
        </div>

        {/* Três colunas */}
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[330px_1fr] xl:grid-cols-[330px_1fr_310px]">
          <aside
            className={cn(
              "min-h-0 overflow-hidden rounded-2xl border border-border bg-card lg:block",
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
            className={cn(
              "min-h-0 min-w-0 overflow-hidden rounded-2xl border border-border bg-card",
              selecionada ? "block" : "hidden lg:block",
            )}
            aria-label="Conversa"
          >
            {selecionada ? (
              <JanelaConversa
                key={selecionada}
                conversaId={selecionada}
                acesso={a}
                onVoltar={() => selecionar(null)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                <MessagesSquare className="h-10 w-10 text-primary/50" />
                Escolha uma conversa à esquerda.
              </div>
            )}
          </section>

          <aside
            className="hidden min-h-0 overflow-y-auto rounded-2xl border border-border bg-card xl:block"
            aria-label="Cliente e OS"
          >
            {selecionada ? (
              <PainelContexto key={selecionada} conversaId={selecionada} acesso={a} />
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Os dados do cliente e das OS aparecem aqui.
              </p>
            )}
          </aside>
        </div>

        <RespostasRapidasDialog
          open={respostasAbertas}
          onOpenChange={setRespostasAbertas}
          podeEditar={a.podeResponder}
        />
        <NovoAtendimentoDialog
          open={novoAberto}
          onOpenChange={setNovoAberto}
          onCriada={(id) => selecionar(id)}
        />
      </div>
    </AcoesOsProvider>
  );
}
