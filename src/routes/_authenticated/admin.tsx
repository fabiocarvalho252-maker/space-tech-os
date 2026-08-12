import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addMonths, format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Check,
  Copy,
  KeyRound,
  Loader2,
  MessageSquare,
  QrCode,
  ShieldAlert,
  Smartphone,
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
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { dataBR } from "@/lib/format";
import {
  atualizarPlanoEmpresa,
  conectarWhatsappSistema,
  desconectarWhatsappSistema,
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

function AdminDoSite() {
  const { data: user, isLoading: carregandoUser } = useCurrentUser();
  const souAdmin = user?.email === SITE_ADMIN_EMAIL;
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaDoSite | null>(null);

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

  return (
    <div>
      <PageHeader
        title="Administração do site"
        subtitle="Todas as empresas cadastradas no SpaceTech, há quanto tempo estão ativas e o plano de cada uma."
      />

      <WhatsappSistemaCard souAdmin={souAdmin} />

      <SectionCard
        title="Empresas cadastradas"
        subtitle={`${empresas.length} no total`}
        icon={Building2}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Erro ao carregar empresas."}
          </p>
        ) : !empresas.length ? (
          <EmptyState icon={Users} title="Nenhuma empresa cadastrada ainda" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Empresa</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Plano</th>
                  <th className="px-3 py-2">Cadastro</th>
                  <th className="px-3 py-2">Último acesso</th>
                  <th className="px-3 py-2 text-center">Equipe</th>
                  <th className="px-3 py-2 text-center">OS criadas</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {empresas.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/30">
                    <td className="px-3 py-3 font-medium">{e.loja || e.nome || "Sem nome"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{e.email || "—"}</td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        label={planoLabel(e.plano)}
                        tone={TONE_POR_PLANO[e.plano] ?? "neutral"}
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
                      <Button size="sm" variant="outline" onClick={() => setEmpresaSelecionada(e)}>
                        Gerenciar
                      </Button>
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

  return (
    <SectionCard
      title="WhatsApp do sistema (ativação de contas)"
      subtitle="Envia os códigos de verificação do cadastro de novas empresas."
      icon={MessageSquare}
    >
      {naoConfigurado ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Evolution API não configurada no servidor. Preencha <code>EVOLUTION_API_URL</code> e{" "}
          <code>EVOLUTION_API_KEY</code> no <code>.env</code> para habilitar a conexão.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${conectado ? "bg-success animate-pulse" : "bg-destructive"}`}
              />
              <span className="font-bold">
                {status === "conectado" && "🟢 Conectado"}
                {status === "desconectado" && "🔴 Desconectado"}
                {status === "conectando" && "🟡 Conectando..."}
                {status === "erro" && "🔴 Erro na conexão"}
              </span>
            </div>
            {statusQuery.isFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {conectado && conexao?.phone_number && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" /> Número conectado:{" "}
              <strong>{conexao.phone_number}</strong>
            </div>
          )}
          {status === "erro" && conexao?.last_error && (
            <p className="mt-3 text-xs text-destructive">{conexao.last_error}</p>
          )}

          <div className="mt-4 flex gap-2">
            {!conectado ? (
              <Button
                className="bg-green-600 hover:bg-green-700 gap-2"
                disabled={conectar.isPending}
                onClick={() => conectar.mutate()}
              >
                {conectar.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                Conectar WhatsApp do sistema
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setConfirmDesconectar(true)}>
                Desconectar
              </Button>
            )}
          </div>
        </>
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

  // Re-seed local form state whenever a different empresa is opened.
  const [empresaIdAberta, setEmpresaIdAberta] = useState<string | null>(null);
  if (empresa && empresa.id !== empresaIdAberta) {
    setEmpresaIdAberta(empresa.id);
    setPlano(empresa.plano);
    setAcessoAte(empresa.acessoAte ?? "");
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
              const definicao = PLANOS.find((p) => p.value === v);
              if (definicao?.meses) {
                // Renewing the same kind of plan while it's still valid stacks
                // on top of the current expiry instead of shortening it.
                const baseAtual =
                  acessoAte && new Date(acessoAte) > new Date() ? new Date(acessoAte) : new Date();
                setAcessoAte(format(addMonths(baseAtual, definicao.meses), "yyyy-MM-dd"));
              }
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
