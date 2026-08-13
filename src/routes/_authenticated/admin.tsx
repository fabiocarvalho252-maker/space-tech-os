import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addMonths, format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Ban,
  Building2,
  Check,
  Copy,
  KeyRound,
  Loader2,
  LogIn,
  MessageSquare,
  MoreVertical,
  QrCode,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TimerReset,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DIAS_TESTE, useCurrentUser } from "@/hooks/useCurrentUser";
import { dataBR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { salvarImpersonacao } from "@/lib/impersonation";
import {
  ajustarCreditosIA,
  atualizarPlanoEmpresa,
  conectarWhatsappSistema,
  desconectarWhatsappSistema,
  entrarComoEmpresa,
  listarEmpresasDoSite,
  resetarSenhaEmpresa,
  statusWhatsappSistema,
  type EmpresaDoSite,
} from "@/lib/site-admin.functions";
import type { WhatsappSistemaConexao } from "@/lib/whatsapp/system-instance";

const SITE_ADMIN_EMAIL = "admin@spacetech.app";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Administração do site — SpaceTech" }],
  }),
  component: AdminDoSite,
});

const PLANOS = [
  { value: "trial", label: "Teste grátis (7 dias)", meses: null },
  { value: "mensal", label: "Mensal (1 mês)", meses: 1 },
  { value: "trimestral", label: "Trimestral (3 meses)", meses: 3 },
  { value: "semestral", label: "Semestral (6 meses)", meses: 6 },
  { value: "anual", label: "Anual (12 meses)", meses: 12 },
  { value: "vitalicio", label: "Vitalício", meses: null },
  { value: "suspenso", label: "Suspenso", meses: null },
] as const;

const PLANOS_COM_VALIDADE = ["mensal", "trimestral", "semestral", "anual"];

const TONE_POR_PLANO: Record<string, StatusTone> = {
  trial: "neutral",
  mensal: "success",
  trimestral: "success",
  semestral: "success",
  anual: "success",
  vitalicio: "purple",
  suspenso: "danger",
};

function haQuanto(iso: string | null) {
  if (!iso) return "Nunca";
  return formatDistanceToNow(new Date(iso), { locale: ptBR, addSuffix: true });
}

function planoLabel(plano: string) {
  return PLANOS.find((p) => p.value === plano)?.label ?? plano;
}

type StatusAcesso = "ativa" | "teste" | "expirada" | "suspensa";

const STATUS_LABEL: Record<StatusAcesso, string> = {
  ativa: "Ativa",
  teste: "Em teste",
  expirada: "Expirada",
  suspensa: "Suspensa",
};

const STATUS_TONE: Record<StatusAcesso, StatusTone> = {
  ativa: "success",
  teste: "warning",
  expirada: "danger",
  suspensa: "neutral",
};

// Mirrors the trial/plano gate in src/routes/_authenticated/route.tsx exactly,
// so the badge shown here always matches whether the empresa can actually log in.
function statusAcesso(e: EmpresaDoSite): StatusAcesso {
  if (e.plano === "suspenso") return "suspensa";
  if (e.plano === "vitalicio") return "ativa";
  if (PLANOS_COM_VALIDADE.includes(e.plano)) {
    if (e.acessoAte && new Date(e.acessoAte) < new Date(new Date().toDateString())) {
      return "expirada";
    }
    return "ativa";
  }
  const diasDecorridos = Math.floor((Date.now() - new Date(e.criadoEm).getTime()) / 86_400_000);
  return diasDecorridos > DIAS_TESTE ? "expirada" : "teste";
}

function AdminDoSite() {
  const { data: user, isLoading: carregandoUser } = useCurrentUser();
  const souAdmin = user?.email === SITE_ADMIN_EMAIL;
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaDoSite | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroPlano, setFiltroPlano] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["site-admin-empresas"],
    queryFn: () => listarEmpresasDoSite(),
    enabled: souAdmin,
  });

  if (!carregandoUser && !souAdmin) {
    return (
      <div>
        <PageHeader title="Administração do site" subtitle="Acesso restrito" />
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Esta área é exclusiva do administrador do site."
        />
      </div>
    );
  }

  const empresas = data?.empresas ?? [];
  // Keep the dialog showing fresh data after a plano update invalidates the list.
  const empresaAtual = empresaSelecionada
    ? (empresas.find((e) => e.id === empresaSelecionada.id) ?? empresaSelecionada)
    : null;
  const pedidosPendentes = empresas.filter((e) => e.planoSolicitado);

  const contagem = { total: 0, ativa: 0, teste: 0, bloqueada: 0 };
  for (const e of empresas) {
    contagem.total++;
    const s = statusAcesso(e);
    if (s === "ativa") contagem.ativa++;
    else if (s === "teste") contagem.teste++;
    else contagem.bloqueada++;
  }

  const termo = busca.trim().toLowerCase();
  const empresasFiltradas = empresas.filter((e) => {
    if (filtroPlano !== "todos" && e.plano !== filtroPlano) return false;
    if (filtroStatus !== "todos" && statusAcesso(e) !== filtroStatus) return false;
    if (termo) {
      const alvo = `${e.loja ?? ""} ${e.nome ?? ""} ${e.email ?? ""}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Administração do site"
        subtitle="Controle geral das empresas cadastradas no SpaceTech e da ativação da plataforma."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={Building2}
          label="Empresas"
          valor={contagem.total}
          cor="text-primary bg-primary/10"
        />
        <StatTile
          icon={ShieldCheck}
          label="Ativas"
          valor={contagem.ativa}
          cor="text-emerald-600 bg-emerald-500/10"
        />
        <StatTile
          icon={TimerReset}
          label="Em teste"
          valor={contagem.teste}
          cor="text-amber-600 bg-amber-500/10"
        />
        <StatTile
          icon={Ban}
          label="Bloqueadas"
          valor={contagem.bloqueada}
          cor="text-red-600 bg-red-500/10"
        />
      </div>

      {pedidosPendentes.length > 0 && (
        <SectionCard
          title="Pedidos de reativação"
          subtitle={`${pedidosPendentes.length} empresa${pedidosPendentes.length > 1 ? "s" : ""} esperando ativação`}
          icon={Send}
          className="mb-6 border-violet-500/30 bg-violet-500/5"
        >
          <div className="space-y-2">
            {pedidosPendentes.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div>
                  <p className="font-medium">{e.loja || e.nome || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">
                    Quer o plano <strong>{planoLabel(e.planoSolicitado!)}</strong>
                    {e.planoSolicitadoEm ? ` · ${haQuanto(e.planoSolicitadoEm)}` : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => setEmpresaSelecionada(e)}>
                  Atender
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <WhatsappSistemaCard souAdmin={souAdmin} />

      <SectionCard
        title="Empresas cadastradas"
        subtitle={`${empresasFiltradas.length} de ${empresas.length}`}
        icon={Building2}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa por nome ou e-mail..."
              className="pl-9"
            />
          </div>
          <Select value={filtroPlano} onValueChange={setFiltroPlano}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os planos</SelectItem>
              {PLANOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(Object.keys(STATUS_LABEL) as StatusAcesso[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Erro ao carregar empresas."}
          </p>
        ) : !empresas.length ? (
          <EmptyState icon={Users} title="Nenhuma empresa cadastrada ainda" />
        ) : !empresasFiltradas.length ? (
          <EmptyState icon={Search} title="Nenhuma empresa encontrada com esses filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Empresa</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Plano</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Cadastro</th>
                  <th className="px-3 py-2">Último acesso</th>
                  <th className="px-3 py-2 text-center">Equipe</th>
                  <th className="px-3 py-2 text-center">OS criadas</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {empresasFiltradas.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/30">
                    <td className="px-3 py-3 font-medium">{e.loja || e.nome || "Sem nome"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{e.email || "—"}</td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        label={planoLabel(e.plano)}
                        tone={TONE_POR_PLANO[e.plano] ?? "neutral"}
                      />
                      {e.planoSolicitado && (
                        <div className="mt-1 text-xs text-violet-600">
                          Quer: {planoLabel(e.planoSolicitado)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        label={STATUS_LABEL[statusAcesso(e)]}
                        tone={STATUS_TONE[statusAcesso(e)]}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div>{dataBR(e.criadoEm)}</div>
                      <div className="text-xs text-muted-foreground">{haQuanto(e.criadoEm)}</div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{haQuanto(e.ultimoLogin)}</td>
                    <td className="px-3 py-3 text-center">{e.totalMembros}</td>
                    <td className="px-3 py-3 text-center">{e.totalOrdens}</td>
                    <td className="px-3 py-3 text-right">
                      <EmpresaAcoesMenu
                        empresa={e}
                        onVerDetalhes={() => setEmpresaSelecionada(e)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <EmpresaDetalheDialog
        empresa={empresaAtual}
        open={!!empresaSelecionada}
        onOpenChange={(v) => !v && setEmpresaSelecionada(null)}
      />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  valor,
  cor,
}: {
  icon: typeof Building2;
  label: string;
  valor: number;
  cor: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${cor}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{valor}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// Quick actions that don't need the full plano/senha dialog open — suspending
// or reactivating is a one-click decision an operator makes straight from the
// row. Deleting an empresa or impersonating its login are deliberately not
// here: neither has server-side support yet (no cascading delete, no
// impersonation session), so faking them in the menu would be misleading.
function EmpresaAcoesMenu({
  empresa,
  onVerDetalhes,
}: {
  empresa: EmpresaDoSite;
  onVerDetalhes: () => void;
}) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEntrarOpen, setConfirmEntrarOpen] = useState(false);
  const suspensa = empresa.plano === "suspenso";

  const alternarSuspensao = useMutation({
    mutationFn: () =>
      atualizarPlanoEmpresa({
        data: {
          empresaId: empresa.id,
          plano: suspensa ? "trial" : "suspenso",
          acessoAte: null,
        },
      }),
    onSuccess: () => {
      toast.success(suspensa ? "Empresa reativada." : "Empresa suspensa.");
      qc.invalidateQueries({ queryKey: ["site-admin-empresas"] });
      setConfirmOpen(false);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmOpen(false);
    },
  });

  const entrar = useMutation({
    mutationFn: async () => {
      const { data: sessaoAtual } = await supabase.auth.getSession();
      const adminSessao = sessaoAtual.session;
      if (!adminSessao) throw new Error("Sessão de administrador expirou. Faça login novamente.");
      const { link } = await entrarComoEmpresa({ data: { empresaId: empresa.id } });
      salvarImpersonacao({
        adminAccessToken: adminSessao.access_token,
        adminRefreshToken: adminSessao.refresh_token,
        empresaNome: empresa.loja || empresa.nome || "Empresa",
      });
      window.location.href = link;
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmEntrarOpen(false);
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Ações">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onVerDetalhes}>Ver detalhes / gerenciar</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirmEntrarOpen(true)}>
            <LogIn className="mr-2 h-4 w-4" /> Entrar no painel
          </DropdownMenuItem>
          <DropdownMenuItem
            className={suspensa ? "" : "text-destructive focus:text-destructive"}
            onClick={() => setConfirmOpen(true)}
          >
            {suspensa ? (
              <>
                <RotateCcw className="mr-2 h-4 w-4" /> Reativar empresa
              </>
            ) : (
              <>
                <Ban className="mr-2 h-4 w-4" /> Suspender empresa
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={suspensa ? "Reativar esta empresa?" : "Suspender esta empresa?"}
        description={
          suspensa
            ? "O acesso volta a ser liberado com um novo período de teste — ajuste o plano depois se necessário."
            : "A empresa perde acesso ao sistema imediatamente, até ser reativada ou ter um plano definido."
        }
        confirmLabel={suspensa ? "Reativar" : "Suspender"}
        destructive={!suspensa}
        loading={alternarSuspensao.isPending}
        onConfirm={() => alternarSuspensao.mutate()}
      />

      <ConfirmDialog
        open={confirmEntrarOpen}
        onOpenChange={setConfirmEntrarOpen}
        title={`Entrar como ${empresa.loja || empresa.nome || "esta empresa"}?`}
        description="Você passa a ver o sistema exatamente como essa empresa vê, sem alterar a senha dela. Sua sessão de administrador fica guardada nesta aba para você voltar depois pelo botão que aparece no topo da tela."
        confirmLabel="Entrar no painel"
        loading={entrar.isPending}
        onConfirm={() => entrar.mutate()}
      />
    </>
  );
}

function ehNaoConfigurado(erro: unknown): boolean {
  return erro instanceof Error && /não foi configurada/i.test(erro.message);
}

function qrCodeSrc(qr: string): string {
  return qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
}

// Pairs the "spacetech_system" Evolution API instance that sends WhatsApp
// activation codes for every empresa signup — separate from each empresa's
// own /whatsapp connection, paired once here by the SPACE TECH operator.
function WhatsappSistemaCard({ souAdmin }: { souAdmin: boolean }) {
  const qc = useQueryClient();
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [confirmDesconectar, setConfirmDesconectar] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["whatsapp-sistema-status"],
    queryFn: () => statusWhatsappSistema(),
    enabled: souAdmin,
    retry: false,
    refetchInterval: (query) => {
      const conexao = query.state.data as WhatsappSistemaConexao | null | undefined;
      return conexao?.status === "conectando" ? 4000 : false;
    },
  });

  const naoConfigurado = ehNaoConfigurado(statusQuery.error);
  const conexao = statusQuery.data ?? null;
  const status = conexao?.status ?? "desconectado";
  const conectado = status === "conectado";

  const conectar = useMutation({
    mutationFn: () => conectarWhatsappSistema(),
    onSuccess: (res) => {
      qc.setQueryData(["whatsapp-sistema-status"], res);
      setQrDialogOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desconectar = useMutation({
    mutationFn: () => desconectarWhatsappSistema(),
    onSuccess: (res) => {
      qc.setQueryData(["whatsapp-sistema-status"], res);
      setConfirmDesconectar(false);
      toast.success("WhatsApp do sistema desconectado.");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmDesconectar(false);
    },
  });

  const STATUS_TEXTO: Record<string, string> = {
    conectado: "Conectado",
    desconectado: "Desconectado",
    conectando: "Conectando...",
    erro: "Erro na conexão",
  };
  const STATUS_BADGE_TONE: Record<string, StatusTone> = {
    conectado: "success",
    desconectado: "danger",
    conectando: "warning",
    erro: "danger",
  };

  return (
    <SectionCard
      title="WhatsApp do sistema"
      subtitle="Envia os códigos de ativação para novos cadastros de empresa."
      icon={MessageSquare}
      className="mb-6"
      action={
        !naoConfigurado && (
          <div className="flex items-center gap-2">
            {statusQuery.isFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <StatusBadge
              label={STATUS_TEXTO[status] ?? status}
              tone={STATUS_BADGE_TONE[status] ?? "neutral"}
            />
          </div>
        )
      }
    >
      {naoConfigurado ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Evolution API não configurada no servidor. Preencha <code>EVOLUTION_API_URL</code> e{" "}
          <code>EVOLUTION_API_KEY</code> no <code>.env</code> para habilitar a conexão.
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {conectado && conexao?.phone_number ? (
              <span className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" /> Número conectado:{" "}
                <strong className="text-foreground">{conexao.phone_number}</strong>
              </span>
            ) : status === "erro" && conexao?.last_error ? (
              <span className="text-destructive">{conexao.last_error}</span>
            ) : (
              "Nenhum número conectado no momento."
            )}
          </div>

          <div className="flex gap-2">
            {!conectado ? (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 gap-2"
                disabled={conectar.isPending}
                onClick={() => conectar.mutate()}
              >
                {conectar.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                Conectar
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmDesconectar(true)}>
                Desconectar
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-green-600" /> Conectar WhatsApp do sistema
            </DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular dedicado do SPACE TECH → Aparelhos conectados → Conectar um
              aparelho, e escaneie o código abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
            {conexao?.qr_code ? (
              <img
                src={qrCodeSrc(conexao.qr_code)}
                alt="QR Code do WhatsApp"
                className="h-56 w-56"
              />
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </>
            )}
            <p className="text-xs text-muted-foreground">Aguardando leitura...</p>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDesconectar}
        onOpenChange={setConfirmDesconectar}
        title="Desconectar o WhatsApp do sistema?"
        description="Novos cadastros de empresa deixarão de receber o código de ativação até reconectar."
        confirmLabel="Desconectar"
        destructive
        loading={desconectar.isPending}
        onConfirm={() => desconectar.mutate()}
      />
    </SectionCard>
  );
}

// Renewing the same kind of plan while it's still valid stacks on top of the
// current expiry instead of shortening it.
function calcularAcessoAte(planoValue: string, acessoAteAtual: string): string {
  const definicao = PLANOS.find((p) => p.value === planoValue);
  if (!definicao?.meses) return acessoAteAtual;
  const baseAtual =
    acessoAteAtual && new Date(acessoAteAtual) > new Date() ? new Date(acessoAteAtual) : new Date();
  return format(addMonths(baseAtual, definicao.meses), "yyyy-MM-dd");
}

function EmpresaDetalheDialog({
  empresa,
  open,
  onOpenChange,
}: {
  empresa: EmpresaDoSite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [plano, setPlano] = useState<string>(empresa?.plano ?? "trial");
  const [acessoAte, setAcessoAte] = useState<string>(empresa?.acessoAte ?? "");
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [quantidadeCreditos, setQuantidadeCreditos] = useState("10");

  // Re-seed local form state whenever a different empresa is opened.
  const [empresaIdAberta, setEmpresaIdAberta] = useState<string | null>(null);
  if (empresa && empresa.id !== empresaIdAberta) {
    setEmpresaIdAberta(empresa.id);
    // Pre-select whatever plano the empresa asked for on /assinatura, if any
    // — saves the admin a click, since that's almost always what they came here to grant.
    const planoInicial = empresa.planoSolicitado ?? empresa.plano;
    setPlano(planoInicial);
    setAcessoAte(calcularAcessoAte(planoInicial, empresa.acessoAte ?? ""));
    setSenhaGerada(null);
    setCopiado(false);
  }

  const salvarPlano = useMutation({
    mutationFn: () =>
      atualizarPlanoEmpresa({
        data: { empresaId: empresa!.id, plano: plano as any, acessoAte: acessoAte || null },
      }),
    onSuccess: () => {
      toast.success("Plano atualizado.");
      qc.invalidateQueries({ queryKey: ["site-admin-empresas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ajustarCreditos = useMutation({
    mutationFn: (delta: number) => ajustarCreditosIA({ data: { empresaId: empresa!.id, delta } }),
    onSuccess: (res) => {
      toast.success(`Créditos de IA atualizados: ${res.iaCreditos}.`);
      qc.invalidateQueries({ queryKey: ["site-admin-empresas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetarSenha = useMutation({
    mutationFn: () => resetarSenhaEmpresa({ data: { empresaId: empresa!.id } }),
    onSuccess: (res) => {
      setSenhaGerada(res.senha);
      setConfirmResetOpen(false);
      toast.success("Senha redefinida. Copie e repasse para o cliente.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!empresa) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{empresa.loja || empresa.nome || "Empresa"}</DialogTitle>
          <DialogDescription>{empresa.email || "Sem e-mail"}</DialogDescription>
        </DialogHeader>

        {empresa.planoSolicitado && (
          <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-600">
            <Send className="h-3.5 w-3.5 shrink-0" />
            Pediu o plano <strong>{planoLabel(empresa.planoSolicitado)}</strong>
            {empresa.planoSolicitadoEm ? ` · ${haQuanto(empresa.planoSolicitadoEm)}` : ""} — já
            pré-selecionado abaixo.
          </div>
        )}

        <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Responsável</p>
            <p className="font-medium">{empresa.nome || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">WhatsApp</p>
            <p className="font-medium">{empresa.whatsapp || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CNPJ/CPF</p>
            <p className="font-medium">{empresa.cnpjCpf || "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Endereço</p>
            <p className="font-medium">
              {[empresa.endereco, empresa.cidade].filter(Boolean).join(" — ") || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Equipe / OS criadas</p>
            <p className="font-medium">
              {empresa.totalMembros} membro{empresa.totalMembros === 1 ? "" : "s"} ·{" "}
              {empresa.totalOrdens} OS
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cadastro</p>
            <p className="font-medium">
              {dataBR(empresa.criadoEm)} ({haQuanto(empresa.criadoEm)})
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Último acesso</p>
            <p className="font-medium">{haQuanto(empresa.ultimoLogin)}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border p-3">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Plano de acesso
          </Label>
          <Select
            value={plano}
            onValueChange={(v) => {
              setPlano(v);
              setAcessoAte(calcularAcessoAte(v, acessoAte));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {PLANOS_COM_VALIDADE.includes(plano) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Acesso válido até</Label>
              <Input type="date" value={acessoAte} onChange={(e) => setAcessoAte(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Preenchido automaticamente pela duração do plano — ajuste se precisar.
              </p>
            </div>
          )}
          {plano === "trial" && (
            <p className="text-xs text-muted-foreground">
              Segue a regra padrão: 7 dias a partir do cadastro ({dataBR(empresa.criadoEm)}).
            </p>
          )}

          <Button
            size="sm"
            onClick={() => salvarPlano.mutate()}
            disabled={salvarPlano.isPending}
            className="w-full"
          >
            {salvarPlano.isPending ? "Salvando..." : "Salvar plano"}
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-border p-3">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Créditos de IA
          </Label>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
            <span>
              Saldo atual: <strong>{empresa.iaCreditos}</strong> crédito
              {empresa.iaCreditos === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[10, 50, 100].map((qtd) => (
              <Button
                key={qtd}
                size="sm"
                variant="outline"
                disabled={ajustarCreditos.isPending}
                onClick={() => ajustarCreditos.mutate(qtd)}
              >
                +{qtd}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={quantidadeCreditos}
              onChange={(e) => setQuantidadeCreditos(e.target.value)}
              className="w-24"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={ajustarCreditos.isPending || !Number(quantidadeCreditos)}
              onClick={() => ajustarCreditos.mutate(Number(quantidadeCreditos))}
            >
              Adicionar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={ajustarCreditos.isPending || !Number(quantidadeCreditos)}
              onClick={() => ajustarCreditos.mutate(-Number(quantidadeCreditos))}
            >
              Remover
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border p-3">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Acesso da conta
          </Label>
          {senhaGerada ? (
            <div className="space-y-2">
              <p className="text-xs text-amber-600">
                Copie agora — esta senha não fica salva em lugar nenhum e não será mostrada de novo.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={senhaGerada} className="font-mono" />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(senhaGerada);
                    setCopiado(true);
                    toast.success("Senha copiada!");
                  }}
                >
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2"
              onClick={() => setConfirmResetOpen(true)}
            >
              <KeyRound className="h-4 w-4" /> Redefinir senha de login
            </Button>
          )}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Redefinir a senha desta conta?"
        description="Uma nova senha aleatória será gerada e a senha atual deixa de funcionar imediatamente. Você vai precisar repassá-la ao cliente."
        confirmLabel="Redefinir senha"
        destructive
        loading={resetarSenha.isPending}
        onConfirm={() => resetarSenha.mutate()}
      />
    </Dialog>
  );
}
