// Escritório IA (Fase 1): escritório pixel com agentes do ECC, alimentado por
// um roteiro simulado. Só o administrador do site acessa. A proteção de verdade
// fica no servidor (Fase 2); esta guarda é só para não mostrar a tela a outros.
import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SITE_ADMIN_EMAIL } from "@/lib/site-admin";
import { ApprovalCard } from "@/features/escritorio/components/ApprovalCard";
import { CommandChat } from "@/features/escritorio/components/CommandChat";
import { EventFeed } from "@/features/escritorio/components/EventFeed";
import { MissionResult } from "@/features/escritorio/components/MissionResult";
import { OfficeCanvas } from "@/features/escritorio/components/OfficeCanvas";
import { AgentInspector } from "@/features/escritorio/components/AgentInspector";
import { ReplayControles } from "@/features/escritorio/components/ReplayControles";
import { OfficeToolbar } from "@/features/escritorio/components/OfficeToolbar";
import { MissionHistory } from "@/features/escritorio/components/MissionHistory";
import { useEscritorio } from "@/features/escritorio/hooks/useEscritorio";
import { listarProjetos } from "@/features/escritorio/api/runner";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin_/escritorio")({
  head: () => ({ meta: [{ title: "Escritório IA — Administração do site" }] }),
  component: PaginaEscritorio,
});

function PaginaEscritorio() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) return null;

  if (user?.email !== SITE_ADMIN_EMAIL) {
    return (
      <div>
        <PageHeader title="Escritório IA" subtitle="Acesso restrito" />
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Esta área é exclusiva do administrador do site."
        />
      </div>
    );
  }

  return <Escritorio />;
}

function Escritorio() {
  const {
    estado,
    online,
    erro,
    iniciarSimulacao,
    iniciarReal,
    cancelar,
    decidir,
    mostrarEventos,
    replay,
    reiniciarReplay,
    temReplay,
  } = useEscritorio();
  const rodando = estado.status === "rodando";
  const [agenteSelecionado, setAgenteSelecionado] = useState<string | null>(null);
  const { data: projetos } = useQuery({
    queryKey: ["office-projects"],
    queryFn: () => listarProjetos(),
    enabled: online === true,
    select: (r) => r.projetos,
  });

  return (
    <div>
      <PageHeader
        title="Escritório IA"
        subtitle="Os agentes do ECC trabalhando em tempo real. Só você vê esta área."
        action={<OfficeToolbar estado={estado} />}
      />

      <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
        <div className="flex flex-col gap-3">
          <OfficeCanvas estado={estado} onSelecionarAgente={setAgenteSelecionado} />
          {temReplay && (
            <ReplayControles
              tocando={replay.tocando}
              velocidade={replay.velocidade}
              onReiniciar={reiniciarReplay}
              onPausarContinuar={() => (replay.tocando ? replay.pausar() : replay.continuar())}
              onVelocidade={replay.setVelocidade}
            />
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {erro && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {erro}
            </p>
          )}
          {estado.aprovacao && <ApprovalCard pedido={estado.aprovacao} onDecidir={decidir} />}

          <Card className="p-4">
            <CommandChat
              rodando={rodando}
              online={online}
              projetos={projetos ?? []}
              onSimular={iniciarSimulacao}
              onEnviar={(pedido, projeto) => void iniciarReal(pedido, projeto, "seguro")}
              onCancelar={cancelar}
            />
          </Card>

          <Tabs defaultValue="eventos">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="eventos">Eventos</TabsTrigger>
              <TabsTrigger value="resultado">Resultado</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="eventos">
              <EventFeed eventos={estado.eventos} />
            </TabsContent>
            <TabsContent value="resultado">
              <MissionResult texto={estado.resultado} />
            </TabsContent>
            <TabsContent value="historico">
              <MissionHistory onMostrar={mostrarEventos} />
            </TabsContent>
          </Tabs>
          {agenteSelecionado && (
            <AgentInspector
              agenteId={agenteSelecionado}
              estado={estado}
              onFechar={() => setAgenteSelecionado(null)}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
