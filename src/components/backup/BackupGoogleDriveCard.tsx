import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CloudUpload, HardDrive, Loader2, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  desconectarDrive,
  fazerBackupAgora,
  iniciarConexaoDrive,
  salvarOpcoesBackup,
  statusBackupDrive,
} from "@/lib/backup/backup.functions";

function tamanhoLegivel(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// Conexão do Google Drive para backup (src/lib/backup/). escopo "empresa" em
// Configurações → Backup; "plataforma" no /admin, para o dump do servidor.
export function BackupGoogleDriveCard({ escopo }: { escopo: "empresa" | "plataforma" }) {
  const qc = useQueryClient();
  const chave = ["backup-drive", escopo];
  const [confirmDesconectar, setConfirmDesconectar] = useState(false);

  const statusQuery = useQuery({
    queryKey: chave,
    queryFn: () => statusBackupDrive({ data: { escopo } }),
    retry: false,
  });
  const s = statusQuery.data;

  // Volta do Google: /configuracoes?aba=backup&drive=conectado|erro&motivo=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const drive = params.get("drive");
    if (!drive) return;
    if (drive === "conectado") toast.success("Google Drive conectado!");
    else toast.error(params.get("motivo") ?? "Não foi possível conectar o Google Drive.");
    params.delete("drive");
    params.delete("motivo");
    const resto = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (resto ? `?${resto}` : ""));
  }, []);

  const conectar = useMutation({
    mutationFn: () => iniciarConexaoDrive({ data: { escopo } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desconectar = useMutation({
    mutationFn: () => desconectarDrive({ data: { escopo } }),
    onSuccess: () => {
      setConfirmDesconectar(false);
      toast.success("Google Drive desconectado.");
      qc.invalidateQueries({ queryKey: chave });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const backup = useMutation({
    mutationFn: () => fazerBackupAgora({ data: { escopo } }),
    onSuccess: (r) => {
      toast.success(`Backup enviado: ${r.arquivo} (${tamanhoLegivel(r.tamanho)})`);
      qc.invalidateQueries({ queryKey: chave });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: chave });
    },
  });

  const opcoes = useMutation({
    mutationFn: (o: { automatico: boolean; incluirFotos: boolean }) =>
      salvarOpcoesBackup({ data: o }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chave }),
    onError: (e: Error) => toast.error(e.message),
  });

  const plataforma = escopo === "plataforma";

  return (
    <SectionCard
      title={plataforma ? "Backup do servidor no Google Drive" : "Backup no Google Drive"}
      subtitle={
        plataforma
          ? "Envia todo dia às 3h o backup completo do banco e dos arquivos (guarda os 7 últimos)."
          : "Guarde uma cópia de todos os dados da sua empresa no seu próprio Google Drive."
      }
      icon={HardDrive}
      className={plataforma ? "mb-6" : ""}
      action={
        s?.configurado &&
        s.podeGerenciar && (
          <div className="flex items-center gap-2">
            {statusQuery.isFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <StatusBadge
              label={s.conectado ? "Conectado" : "Não conectado"}
              tone={s.conectado ? "success" : "neutral"}
            />
          </div>
        )
      }
    >
      {statusQuery.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : statusQuery.error ? (
        <p className="text-sm text-destructive">{(statusQuery.error as Error).message}</p>
      ) : !s?.configurado ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          {plataforma ? (
            <>
              Google Drive não configurado no servidor. Preencha <code>GOOGLE_OAUTH_CLIENT_ID</code>{" "}
              e <code>GOOGLE_OAUTH_CLIENT_SECRET</code> no <code>.env</code> (passo a passo em{" "}
              <code>docs/backup-google-drive.md</code>).
            </>
          ) : (
            "O backup no Google Drive ainda não está disponível. Em breve!"
          )}
        </div>
      ) : !s.podeGerenciar ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> Somente o dono da conta pode configurar o backup.
        </div>
      ) : !s.conectado ? (
        <div className="space-y-4">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {(plataforma
              ? [
                  "Banco de dados completo (todas as empresas) e arquivos do Storage.",
                  "Feito logo depois do backup local da madrugada.",
                ]
              : [
                  "Clientes, OS, vendas, estoque, financeiro e demais cadastros.",
                  "Planilhas que abrem no Excel, mais fotos das OS e aparelhos.",
                  "Backup automático todo dia, guardando os 14 mais recentes.",
                  "O SPACE TECH só acessa a pasta que ele mesmo cria no seu Drive.",
                ]
            ).map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t}
              </li>
            ))}
          </ul>
          <Button className="gap-2" disabled={conectar.isPending} onClick={() => conectar.mutate()}>
            {conectar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HardDrive className="h-4 w-4" />
            )}
            Conectar Google Drive
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Conta Google</p>
              <p className="font-medium break-all">{s.email ?? "—"}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Último backup</p>
              {s.ultimoBackupEm ? (
                <p className="flex items-center gap-1.5 font-medium">
                  {s.ultimoStatus === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  {dataHora(s.ultimoBackupEm)}
                  {s.ultimoStatus === "ok" && s.ultimoTamanho
                    ? ` · ${tamanhoLegivel(s.ultimoTamanho)}`
                    : ""}
                </p>
              ) : (
                <p className="font-medium">Nenhum ainda</p>
              )}
            </div>
          </div>

          {s.ultimoStatus === "erro" && s.ultimoErro && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {s.ultimoErro}
            </p>
          )}

          {!plataforma && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="backup-automatico" className="text-sm">
                  Backup automático todo dia (madrugada)
                </Label>
                <Switch
                  id="backup-automatico"
                  checked={s.automatico}
                  disabled={opcoes.isPending}
                  onCheckedChange={(v) =>
                    opcoes.mutate({ automatico: v, incluirFotos: s.incluirFotos })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="backup-fotos" className="text-sm">
                  Incluir fotos e documentos
                </Label>
                <Switch
                  id="backup-fotos"
                  checked={s.incluirFotos}
                  disabled={opcoes.isPending}
                  onCheckedChange={(v) =>
                    opcoes.mutate({ automatico: s.automatico, incluirFotos: v })
                  }
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" disabled={backup.isPending} onClick={() => backup.mutate()}>
              {backup.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              {backup.isPending ? "Fazendo backup..." : "Fazer backup agora"}
            </Button>
            <Button variant="outline" onClick={() => setConfirmDesconectar(true)}>
              Desconectar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Os arquivos ficam na pasta{" "}
            <strong>
              {plataforma ? "SPACE TECH - Backup do servidor" : "SPACE TECH - Backup"}
            </strong>{" "}
            do seu Google Drive.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmDesconectar}
        onOpenChange={setConfirmDesconectar}
        title="Desconectar o Google Drive?"
        description="Os backups automáticos param. Os arquivos que já estão no seu Drive continuam lá."
        confirmLabel="Desconectar"
        destructive
        loading={desconectar.isPending}
        onConfirm={() => desconectar.mutate()}
      />
    </SectionCard>
  );
}
