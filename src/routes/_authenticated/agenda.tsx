import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Ban,
  CalendarClock,
  User,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser, usePermissoes, podeGerenciar } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — SpaceTech" },
      { name: "description", content: "Compromissos, bloqueios de horário e visitas técnicas." },
    ],
  }),
  component: Agenda,
});

type Visao = "dia" | "semana" | "mes";

const STATUS_AGENDA = [
  { value: "agendado", label: "Agendado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

const vazio = {
  titulo: "",
  tipo: "compromisso" as "compromisso" | "bloqueio",
  cliente_id: "",
  os_id: "",
  tecnico: "",
  data: format(new Date(), "yyyy-MM-dd"),
  horaInicio: "09:00",
  horaFim: "10:00",
  status: "agendado",
  observacoes: "",
};

function Agenda() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "agenda");

  const [visao, setVisao] = useState<Visao>("semana");
  const [dataRef, setDataRef] = useState(new Date());
  const [filtroTecnico, setFiltroTecnico] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vazio);

  const {
    inicio: rangeInicio,
    fim: rangeFim,
    label: rangeLabel,
  } = useMemo(() => {
    if (visao === "dia") {
      return {
        inicio: startOfDay(dataRef),
        fim: endOfDay(dataRef),
        label: format(dataRef, "EEEE, dd 'de' MMMM", { locale: ptBR }),
      };
    }
    if (visao === "mes") {
      const inicio = startOfMonth(dataRef);
      const fim = endOfMonth(dataRef);
      return { inicio, fim, label: format(dataRef, "MMMM 'de' yyyy", { locale: ptBR }) };
    }
    const inicio = startOfWeek(dataRef, { weekStartsOn: 0 });
    const fim = endOfWeek(dataRef, { weekStartsOn: 0 });
    return {
      inicio,
      fim,
      label: `${format(inicio, "dd/MM")} — ${format(fim, "dd/MM")}`,
    };
  }, [visao, dataRef]);

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["agendamentos", rangeInicio.toISOString(), rangeFim.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*, cliente:clientes(nome), os:ordens_servico(numero, aparelho)")
        .gte("inicio", rangeInicio.toISOString())
        .lte("inicio", rangeFim.toISOString())
        .order("inicio");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ["ordens-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero, aparelho, cliente_id")
        .order("numero", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetForm = () => {
    setForm(vazio);
    setEditId(null);
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      if (!form.titulo.trim()) throw new Error("Informe um título");
      const inicio = new Date(`${form.data}T${form.horaInicio}`);
      const fim = new Date(`${form.data}T${form.horaFim}`);
      if (fim <= inicio) throw new Error("O horário final deve ser depois do início");

      const payload = {
        user_id: user.id,
        titulo: form.titulo,
        tipo: form.tipo,
        cliente_id: form.cliente_id || null,
        os_id: form.os_id || null,
        tecnico: form.tecnico || null,
        inicio: inicio.toISOString(),
        fim: fim.toISOString(),
        status: form.status,
        observacoes: form.observacoes || null,
      };

      if (editId) {
        const { error } = await supabase.from("agendamentos").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agendamentos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Compromisso atualizado" : "Compromisso criado");
      resetForm();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agendamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido da agenda");
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
    },
  });

  function abrirEdicao(a: any) {
    setEditId(a.id);
    setForm({
      titulo: a.titulo,
      tipo: a.tipo,
      cliente_id: a.cliente_id ?? "",
      os_id: a.os_id ?? "",
      tecnico: a.tecnico ?? "",
      data: format(new Date(a.inicio), "yyyy-MM-dd"),
      horaInicio: format(new Date(a.inicio), "HH:mm"),
      horaFim: format(new Date(a.fim), "HH:mm"),
      status: a.status,
      observacoes: a.observacoes ?? "",
    });
    setOpen(true);
  }

  const tecnicos = Array.from(
    new Set(agendamentos.map((a) => a.tecnico).filter(Boolean)),
  ) as string[];

  const filtrados = agendamentos.filter(
    (a) =>
      (filtroTecnico === "todos" || a.tecnico === filtroTecnico) &&
      (filtroStatus === "todos" || a.status === filtroStatus),
  );

  const dias = eachDayOfInterval({ start: rangeInicio, end: rangeFim });
  const osDoCliente = form.cliente_id
    ? ordens.filter((o) => o.cliente_id === form.cliente_id)
    : ordens;

  function navegar(direcao: 1 | -1) {
    if (visao === "dia") setDataRef((d) => addDays(d, direcao));
    else if (visao === "semana") setDataRef((d) => addWeeks(d, direcao));
    else setDataRef((d) => addMonths(d, direcao));
  }

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Compromissos, visitas técnicas e bloqueios de horário"
        action={
          gerenciar && (
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (!v) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" /> Novo compromisso
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editId ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Título</Label>
                    <Input
                      value={form.titulo}
                      onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select
                      value={form.tipo}
                      onValueChange={(v) =>
                        setForm({ ...form, tipo: v as "compromisso" | "bloqueio" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compromisso">Compromisso</SelectItem>
                        <SelectItem value="bloqueio">Bloqueio de horário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Técnico</Label>
                    <Input
                      placeholder="Nome do técnico"
                      value={form.tecnico}
                      onChange={(e) => setForm({ ...form, tecnico: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cliente</Label>
                    <Select
                      value={form.cliente_id || "none"}
                      onValueChange={(v) =>
                        setForm({ ...form, cliente_id: v === "none" ? "" : v, os_id: "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ordem de serviço</Label>
                    <Select
                      value={form.os_id || "none"}
                      onValueChange={(v) => setForm({ ...form, os_id: v === "none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {osDoCliente.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            #{o.numero} · {o.aparelho}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={form.data}
                      onChange={(e) => setForm({ ...form, data: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Início</Label>
                      <Input
                        type="time"
                        value={form.horaInicio}
                        onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Fim</Label>
                      <Input
                        type="time"
                        value={form.horaFim}
                        onChange={(e) => setForm({ ...form, horaFim: e.target.value })}
                      />
                    </div>
                  </div>
                  {editId && (
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select
                        value={form.status}
                        onValueChange={(v) => setForm({ ...form, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_AGENDA.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea
                      value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                  {editId ? "Salvar alterações" : "Criar compromisso"}
                </Button>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navegar(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setDataRef(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => navegar(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-semibold capitalize">{rangeLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-secondary p-1">
            {(["dia", "semana", "mes"] as Visao[]).map((v) => (
              <button
                key={v}
                onClick={() => setVisao(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  visao === v ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <Select value={filtroTecnico} onValueChange={setFiltroTecnico}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue placeholder="Técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os técnicos</SelectItem>
              {tecnicos.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_AGENDA.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {dias.map((dia) => {
          const doDia = filtrados
            .filter((a) => isSameDay(new Date(a.inicio), dia))
            .sort((a, b) => a.inicio.localeCompare(b.inicio));
          if (!doDia.length && visao !== "dia") return null;
          return (
            <div
              key={dia.toISOString()}
              className="rounded-2xl border border-border bg-card shadow-soft"
            >
              <div className="border-b border-border px-4 py-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {format(dia, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </h3>
              </div>
              <div className="divide-y divide-border">
                {doDia.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-14 shrink-0 pt-0.5 text-xs font-bold text-primary">
                      {format(new Date(a.inicio), "HH:mm")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {a.tipo === "bloqueio" ? (
                          <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <CalendarClock className="h-3.5 w-3.5 text-primary" />
                        )}
                        <p
                          className={`truncate text-sm font-semibold ${gerenciar ? "cursor-pointer hover:underline" : ""}`}
                          onClick={() => gerenciar && abrirEdicao(a)}
                        >
                          {a.titulo}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            a.status === "cancelado"
                              ? "bg-destructive/10 text-destructive"
                              : a.status === "concluido"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-primary/10 text-primary"
                          }`}
                        >
                          {STATUS_AGENDA.find((s) => s.value === a.status)?.label ?? a.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {a.cliente?.nome && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {a.cliente.nome}
                          </span>
                        )}
                        {a.tecnico && (
                          <span className="flex items-center gap-1">
                            <Wrench className="h-3 w-3" /> {a.tecnico}
                          </span>
                        )}
                        {a.os && (
                          <span>
                            OS #{a.os.numero} · {a.os.aparelho}
                          </span>
                        )}
                      </div>
                    </div>
                    {gerenciar && (
                      <div className="flex shrink-0 items-center gap-2">
                        {a.status !== "cancelado" && (
                          <button
                            onClick={() => mudarStatus.mutate({ id: a.id, status: "cancelado" })}
                            className="text-xs font-semibold text-muted-foreground hover:text-destructive"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          onClick={() => remover.mutate(a.id)}
                          className="text-muted-foreground transition hover:text-destructive"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!doDia.length && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhum compromisso.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
