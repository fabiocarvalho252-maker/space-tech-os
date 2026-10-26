import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissoes, podeGerenciar } from "@/hooks/useCurrentUser";
import {
  cancelarFilaFn,
  editarTextoFilaFn,
  enviarAgoraFilaFn,
  listarFilaFn,
  reagendarFilaFn,
  reenviarFalhasFilaFn,
  reenviarFilaFn,
  resumoFilaFn,
  salvarRegrasFilaFn,
} from "@/lib/whatsapp/whatsapp.functions";
import type { AbaFila, ItemFila, RegrasFila } from "@/lib/whatsapp/fila.server";

export const Route = createFileRoute("/_authenticated/whatsapp-fila")({
  head: () => ({
    meta: [{ title: "Fila WhatsApp — SpaceTech" }],
  }),
  component: FilaWhatsapp,
});

const ABAS: { id: AbaFila; rotulo: string }[] = [
  { id: "agendadas", rotulo: "Agendadas" },
  { id: "falhas", rotulo: "Com falha" },
  { id: "enviadas", rotulo: "Enviadas" },
  { id: "canceladas", rotulo: "Canceladas" },
];

const MOTIVO_ESPERA: Record<string, string> = {
  desconectado: "O WhatsApp da empresa está desconectado — as mensagens esperam a reconexão.",
  fora_do_horario: "Fora do horário de envio — as mensagens saem quando o horário abrir.",
  limite_hora: "Limite de mensagens por hora atingido — o envio continua na próxima hora.",
};

function tipoMensagem(templateId: string | null, osNumero: number | null): string {
  const t = templateId ?? "";
  if (t === "pesquisa_auto" || t === "pos_atendimento") return "Pesquisa pós-OS";
  if (t.startsWith("aniversario_")) return "Aniversário";
  if (t.startsWith("pos_venda_")) return "Pesquisa pós-venda";
  if (t.startsWith("boas_vindas_")) return "Boas-vindas";
  if (t.startsWith("relatorio_semanal_")) return "Resumo semanal";
  if (t.startsWith("agradecimento_")) return "Agradecimento";
  if (t === "os_pronta") return "OS pronta";
  if (osNumero) return "Aviso de OS";
  return "Mensagem";
}

function telefone(numero: string): string {
  const d = numero.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return numero;
}

function dataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** ISO → valor de <input type="datetime-local"> no fuso do navegador. */
function paraInputLocal(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3600_000);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const STATUS_ITEM: Record<ItemFila["status"], { rotulo: string; tom: StatusTone }> = {
  agendado: { rotulo: "Agendada", tom: "info" },
  pendente: { rotulo: "Enviando", tom: "warning" },
  falhou: { rotulo: "Falhou", tom: "danger" },
  enviado: { rotulo: "Enviada", tom: "success" },
  cancelado: { rotulo: "Cancelada", tom: "neutral" },
};

function FilaWhatsapp() {
  const qc = useQueryClient();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "configuracoes");
  const [aba, setAba] = useState<AbaFila>("agendadas");
  const [editando, setEditando] = useState<ItemFila | null>(null);
  const [texto, setTexto] = useState("");
  const [reagendando, setReagendando] = useState<ItemFila | null>(null);
  const [quando, setQuando] = useState("");
  const [cancelando, setCancelando] = useState<ItemFila | null>(null);
  const [confirmarFalhas, setConfirmarFalhas] = useState(false);

  const resumo = useQuery({
    queryKey: ["fila-whatsapp", "resumo"],
    queryFn: () => resumoFilaFn(),
    refetchInterval: 15_000,
  });
  const lista = useQuery({
    queryKey: ["fila-whatsapp", "lista", aba],
    queryFn: () => listarFilaFn({ data: { aba } }),
    refetchInterval: 15_000,
  });

  const atualizar = () => qc.invalidateQueries({ queryKey: ["fila-whatsapp"] });
  const aoErrar = (e: Error) => toast.error(e.message);

  const enviarAgora = useMutation({
    mutationFn: (id: string) => enviarAgoraFilaFn({ data: { id } }),
    onSuccess: (r) =>
      r.status === "enviado"
        ? toast.success("Mensagem enviada.")
        : toast.error("O WhatsApp recusou o envio — veja o motivo na aba Com falha."),
    onError: aoErrar,
    onSettled: atualizar,
  });
  const reenviar = useMutation({
    mutationFn: (id: string) => reenviarFilaFn({ data: { id } }),
    onSuccess: () => toast.success("Mensagem de volta na fila."),
    onError: aoErrar,
    onSettled: atualizar,
  });
  const reenviarFalhas = useMutation({
    mutationFn: () => reenviarFalhasFilaFn(),
    onSuccess: (r) => {
      setConfirmarFalhas(false);
      toast.success(
        r.quantidade
          ? `${r.quantidade} mensagem(ns) de volta na fila.`
          : "Nenhuma falha dos últimos 7 dias para reenviar.",
      );
    },
    onError: aoErrar,
    onSettled: atualizar,
  });
  const cancelar = useMutation({
    mutationFn: (id: string) => cancelarFilaFn({ data: { id } }),
    onSuccess: () => {
      setCancelando(null);
      toast.success("Mensagem cancelada.");
    },
    onError: aoErrar,
    onSettled: atualizar,
  });
  const salvarTexto = useMutation({
    mutationFn: () => editarTextoFilaFn({ data: { id: editando!.id, texto } }),
    onSuccess: () => {
      setEditando(null);
      toast.success("Texto atualizado.");
    },
    onError: aoErrar,
    onSettled: atualizar,
  });
  const salvarQuando = useMutation({
    mutationFn: () =>
      reagendarFilaFn({
        data: { id: reagendando!.id, quando: new Date(quando).toISOString() },
      }),
    onSuccess: () => {
      setReagendando(null);
      toast.success("Mensagem reagendada.");
    },
    onError: aoErrar,
    onSettled: atualizar,
  });

  const r = resumo.data;
  const espera = r?.espera ? MOTIVO_ESPERA[r.espera] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fila WhatsApp"
        subtitle="Mensagens agendadas e automáticas: o que vai sair, o que falhou e o que já foi enviado"
      />

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          icone={CalendarClock}
          rotulo="Agendadas"
          valor={r?.contagem.agendadas}
          detalhe={r?.proximoEnvio ? `Próxima: ${dataHora(r.proximoEnvio)}` : "Nenhuma na fila"}
        />
        <Indicador
          icone={Clock}
          rotulo="Enviando agora"
          valor={r?.contagem.enviando}
          detalhe={r ? `${r.enviosUltimaHora} de ${r.regras.limiteHora} na última hora` : ""}
        />
        <Indicador
          icone={XCircle}
          rotulo="Com falha"
          valor={r?.contagem.falhas}
          detalhe="Podem ser reenviadas"
          alerta={!!r?.contagem.falhas}
        />
        <Indicador
          icone={CheckCircle2}
          rotulo="Enviadas hoje"
          valor={r?.contagem.enviadasHoje}
          detalhe={r?.conectado ? "WhatsApp conectado" : "WhatsApp desconectado"}
          alerta={r ? !r.conectado : false}
        />
      </div>

      {espera && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">{espera}</p>
            {r?.espera === "desconectado" && (
              <Link to="/whatsapp-conexao" className="text-primary underline">
                Conectar o WhatsApp
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* Lista */}
        <SectionCard
          action={
            aba === "falhas" &&
            gerenciar &&
            !!lista.data?.length && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => setConfirmarFalhas(true)}
              >
                <RefreshCw className="h-4 w-4" /> Reenviar falhas recentes
              </Button>
            )
          }
          title="Mensagens"
        >
          <Tabs value={aba} onValueChange={(v) => setAba(v as AbaFila)} className="mb-4">
            <TabsList className="flex h-auto flex-wrap justify-start">
              {ABAS.map((a) => (
                <TabsTrigger key={a.id} value={a.id}>
                  {a.rotulo}
                  {a.id === "agendadas" && !!r?.contagem.agendadas && ` (${r.contagem.agendadas})`}
                  {a.id === "falhas" && !!r?.contagem.falhas && ` (${r.contagem.falhas})`}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {lista.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : lista.error ? (
            <p className="text-sm text-destructive">{(lista.error as Error).message}</p>
          ) : !lista.data?.length ? (
            <EmptyState
              icon={aba === "falhas" ? CheckCircle2 : CalendarClock}
              title={
                aba === "agendadas"
                  ? "Nenhuma mensagem na fila"
                  : aba === "falhas"
                    ? "Nenhuma falha"
                    : aba === "enviadas"
                      ? "Nenhuma mensagem enviada ainda"
                      : "Nenhuma mensagem cancelada"
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {lista.data.map((m) => (
                <div key={m.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={STATUS_ITEM[m.status].rotulo}
                      tone={STATUS_ITEM[m.status].tom}
                    />
                    <span className="text-sm font-semibold">
                      {m.contact_name || telefone(m.phone_number)}
                    </span>
                    {m.contact_name && (
                      <span className="text-xs text-muted-foreground">
                        {telefone(m.phone_number)}
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {tipoMensagem(m.template_id, m.os_numero)}
                      {m.os_numero ? ` · OS #${m.os_numero}` : ""}
                      {m.anexos ? ` · ${m.anexos} PDF` : ""}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {m.status === "enviado"
                        ? `Enviada ${dataHora(m.enviado_em ?? m.created_at)}`
                        : m.status === "agendado" || m.status === "pendente"
                          ? `Para ${dataHora(m.scheduled_at)}`
                          : dataHora(m.created_at)}
                    </span>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
                    {m.content || "(sem texto)"}
                  </p>
                  {m.error && m.status !== "enviado" && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {m.error}
                    </p>
                  )}
                  {gerenciar && ["agendado", "falhou", "cancelado"].includes(m.status) && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={enviarAgora.isPending}
                        onClick={() => enviarAgora.mutate(m.id)}
                      >
                        {enviarAgora.isPending && enviarAgora.variables === m.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Enviar agora
                      </Button>
                      {m.status !== "agendado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={reenviar.isPending}
                          onClick={() => reenviar.mutate(m.id)}
                        >
                          <RefreshCw className="h-4 w-4" /> Pôr na fila
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setReagendando(m);
                          setQuando(paraInputLocal(m.scheduled_at));
                        }}
                      >
                        <CalendarClock className="h-4 w-4" /> Reagendar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setEditando(m);
                          setTexto(m.content ?? "");
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Editar texto
                      </Button>
                      {m.status !== "cancelado" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-destructive"
                          onClick={() => setCancelando(m)}
                        >
                          <XCircle className="h-4 w-4" /> Cancelar
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Proteção contra bloqueio */}
        {r && <RegrasCard regras={r.regras} gerenciar={gerenciar} aoSalvar={atualizar} />}
      </div>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar texto da mensagem</DialogTitle>
            <DialogDescription>
              Para {editando?.contact_name || telefone(editando?.phone_number ?? "")}
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!texto.trim() || salvarTexto.isPending}
              onClick={() => salvarTexto.mutate()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reagendando} onOpenChange={(o) => !o && setReagendando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar mensagem</DialogTitle>
            <DialogDescription>
              Ela sai a partir desse horário, respeitando o horário de envio e o intervalo entre
              mensagens.
            </DialogDescription>
          </DialogHeader>
          <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReagendando(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!quando || salvarQuando.isPending}
              onClick={() => salvarQuando.mutate()}
            >
              Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!cancelando}
        onOpenChange={(o) => !o && setCancelando(null)}
        title="Cancelar esta mensagem?"
        description="Ela não será enviada. Dá para recolocar na fila depois, pela aba Canceladas."
        confirmLabel="Cancelar mensagem"
        destructive
        loading={cancelar.isPending}
        onConfirm={() => cancelando && cancelar.mutate(cancelando.id)}
      />

      <ConfirmDialog
        open={confirmarFalhas}
        onOpenChange={setConfirmarFalhas}
        title="Reenviar as falhas recentes?"
        description="As mensagens que falharam nos últimos 7 dias voltam para a fila (uma vez cada — cópias repetidas são canceladas) e saem respeitando o intervalo e o horário de envio. Falhas mais antigas ficam como estão (dá para reenviar uma a uma)."
        confirmLabel="Reenviar"
        loading={reenviarFalhas.isPending}
        onConfirm={() => reenviarFalhas.mutate()}
      />
    </div>
  );
}

function Indicador({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  icone: typeof Clock;
  rotulo: string;
  valor: number | undefined;
  detalhe: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icone className={alerta ? "h-4 w-4 text-destructive" : "h-4 w-4 text-primary"} />
        {rotulo}
      </div>
      <p className="mt-1 text-2xl font-bold">{valor ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{detalhe}</p>
    </div>
  );
}

function RegrasCard({
  regras,
  gerenciar,
  aoSalvar,
}: {
  regras: RegrasFila;
  gerenciar: boolean;
  aoSalvar: () => void;
}) {
  const [form, setForm] = useState(regras);
  useEffect(() => setForm(regras), [regras]);
  const mudou = JSON.stringify(form) !== JSON.stringify(regras);

  const salvar = useMutation({
    mutationFn: () => salvarRegrasFilaFn({ data: form }),
    onSuccess: () => {
      toast.success("Proteções salvas.");
      aoSalvar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campo = (
    chave: keyof RegrasFila,
    rotulo: string,
    ajuda: string,
    min: number,
    max: number,
  ) => (
    <div className="space-y-1">
      <Label htmlFor={`regra-${chave}`} className="text-sm">
        {rotulo}
      </Label>
      <Input
        id={`regra-${chave}`}
        type="number"
        min={min}
        max={max}
        disabled={!gerenciar}
        value={form[chave]}
        onChange={(e) => setForm({ ...form, [chave]: Number(e.target.value) })}
      />
      <p className="text-xs text-muted-foreground">{ajuda}</p>
    </div>
  );

  return (
    <SectionCard
      title="Proteção contra bloqueio"
      subtitle="Evita que o número da loja seja banido por mandar muitas mensagens seguidas."
      icon={ShieldCheck}
      className="h-fit"
    >
      <div className="space-y-4">
        {campo(
          "intervaloSeg",
          "Intervalo entre mensagens (segundos)",
          "Tempo mínimo entre uma mensagem e outra. Recomendado: 15 a 30.",
          5,
          600,
        )}
        <div className="grid grid-cols-2 gap-3">
          {campo("horaInicio", "Enviar a partir de (h)", "Ex.: 8", 0, 23)}
          {campo("horaFim", "Parar às (h)", "Ex.: 20", 1, 24)}
        </div>
        {campo(
          "limiteHora",
          "Limite por hora",
          "Máximo de mensagens da fila em 1 hora. Recomendado: até 30.",
          1,
          500,
        )}
        <p className="text-xs text-muted-foreground">
          Valem para as mensagens da fila (agendadas e automáticas). Envios feitos na hora pela tela
          de OS ou do WhatsApp contam no limite, mas não esperam.
        </p>
        {gerenciar && (
          <Button
            className="w-full"
            disabled={!mudou || salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar proteções
          </Button>
        )}
      </div>
    </SectionCard>
  );
}
