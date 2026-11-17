// Aba "Agenda" do /admin/marketing: mostra as publicações agendadas (e o que
// já saiu) por dia, no horário de Brasília, e deixa agendar um conteúdo
// aprovado para Instagram e/ou Facebook. Agendar não publica na hora: o worker
// publica no horário marcado. Cancelar só vale antes de publicar.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Facebook,
  Instagram,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  agendarConteudoMarketing,
  cancelarAgendamentoMarketing,
  obterAgendaMarketing,
  type ItemAgenda,
  type StatusAgenda,
} from "@/lib/marketing/agenda.functions";
import {
  plataformasPublicaveis,
  type ConteudoMarketing,
  type PlataformaMeta,
} from "@/lib/marketing/conteudo";
import { cn } from "@/lib/utils";

const FUSO = "America/Sao_Paulo";
const NOME: Record<PlataformaMeta, string> = { instagram: "Instagram", facebook: "Facebook" };

const STATUS: Record<StatusAgenda, { rotulo: string; classe: string }> = {
  agendado: { rotulo: "Agendado", classe: "border-sky-500/40 bg-sky-500/10 text-sky-700" },
  executando: {
    rotulo: "Publicando…",
    classe: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  },
  publicado: {
    rotulo: "Publicado",
    classe: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  },
  falhou: { rotulo: "Falhou", classe: "border-destructive/40 bg-destructive/10 text-destructive" },
  cancelado: { rotulo: "Cancelado", classe: "border-border bg-muted text-muted-foreground" },
};

// Dia (AAAA-MM-DD) e hora em Brasília, a partir do ISO guardado.
function partesBR(iso: string) {
  const d = new Date(iso);
  return {
    dia: d.toLocaleDateString("en-CA", { timeZone: FUSO }),
    hora: d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }),
  };
}

const hojeBR = () => new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
const mesDe = (dia: string) => dia.slice(0, 7);

function deslocarMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function rotuloMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(a, m - 1, 15, 12)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

function rotuloDia(dia: string): string {
  return new Date(`${dia}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    timeZone: FUSO,
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function IconePlataforma({ p }: { p: PlataformaMeta }) {
  const Icone = p === "instagram" ? Instagram : Facebook;
  return <Icone className="h-3.5 w-3.5" aria-label={NOME[p]} />;
}

export function AgendaMarketing({ conteudos }: { conteudos: ConteudoMarketing[] }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["marketing-agenda"],
    queryFn: () => obterAgendaMarketing(),
    refetchInterval: 60_000,
  });
  const [mes, setMes] = useState(() => mesDe(hojeBR()));

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        {isError ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Erro ao carregar a agenda."}
          </p>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin" />
        )}
      </div>
    );
  }

  const candidatos = conteudos.filter((c) => plataformasPublicaveis(c).length > 0);
  const itensDoMes = data.itens
    .filter((i) => mesDe(partesBR(i.quando).dia) === mes)
    .sort((a, b) => a.quando.localeCompare(b.quando));
  const porDia = new Map<string, ItemAgenda[]>();
  for (const i of itensDoMes) {
    const dia = partesBR(i.quando).dia;
    porDia.set(dia, [...(porDia.get(dia) ?? []), i]);
  }
  const pendentes = data.itens.filter((i) => i.status === "agendado").length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold capitalize">{rotuloMes(mes)}</h2>
            <p className="text-xs text-muted-foreground">
              {pendentes} agendamento(s) aguardando · horários de Brasília
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Mês anterior"
              onClick={() => setMes(deslocarMes(mes, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMes(mesDe(hojeBR()))}>
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próximo mês"
              onClick={() => setMes(deslocarMes(mes, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {porDia.size === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nada agendado neste mês.
          </p>
        ) : (
          <div className="space-y-4">
            {[...porDia.entries()].map(([dia, itens]) => (
              <div key={dia}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {rotuloDia(dia)}
                </h3>
                <ul className="space-y-2">
                  {itens.map((i) => (
                    <LinhaItem key={i.id} item={i} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <FormAgendar candidatos={candidatos} />
    </div>
  );
}

function LinhaItem({ item }: { item: ItemAgenda }) {
  const qc = useQueryClient();
  const [cancelar, setCancelar] = useState(false);
  const { hora } = partesBR(item.quando);
  const st = STATUS[item.status];
  const cancelamento = useMutation({
    mutationFn: () => cancelarAgendamentoMarketing({ data: { id: item.id } }),
    onSuccess: () => {
      setCancelar(false);
      toast.success(`${item.conteudo} cancelado.`);
      qc.invalidateQueries({ queryKey: ["marketing-agenda"] });
    },
    onError: (e) => {
      setCancelar(false);
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar.");
    },
  });

  return (
    <li className="rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            <span className="tabular-nums">{hora}</span> · {item.conteudo}{" "}
            <span className="font-normal text-muted-foreground">{item.titulo}</span>
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {item.plataformas.map((p) => (
              <span key={p} className="inline-flex items-center gap-1">
                <IconePlataforma p={p} />
                {NOME[p]}
              </span>
            ))}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            st.classe,
          )}
        >
          {st.rotulo}
        </span>
      </div>

      {Object.entries(item.resultados).length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {Object.entries(item.resultados).map(([p, r]) => (
            <li key={p} className="flex flex-wrap items-center gap-1">
              <span className="font-medium">{NOME[p as PlataformaMeta]}:</span>
              {r?.link ? (
                <a
                  href={r.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  ver post <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-destructive">{r?.erro ?? "sem resultado"}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {item.status === "agendado" && (
        <div className="mt-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setCancelar(true)}
          >
            <XCircle className="mr-1 h-4 w-4" /> Cancelar agendamento
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={cancelar}
        onOpenChange={setCancelar}
        title={`Cancelar ${item.conteudo}?`}
        description="A publicação agendada não será feita. Você pode agendar de novo depois."
        confirmLabel="Cancelar agendamento"
        destructive
        loading={cancelamento.isPending}
        onConfirm={() => cancelamento.mutate()}
      />
    </li>
  );
}

function FormAgendar({ candidatos }: { candidatos: ConteudoMarketing[] }) {
  const qc = useQueryClient();
  const [conteudo, setConteudo] = useState("");
  const [marcadas, setMarcadas] = useState<PlataformaMeta[]>([]);
  const [dia, setDia] = useState(() => hojeBR());
  const [hora, setHora] = useState("12:00");
  const [confirmar, setConfirmar] = useState(false);

  const escolhido = candidatos.find((c) => c.id === conteudo);
  const autorizadas = escolhido ? plataformasPublicaveis(escolhido) : [];

  const agendar = useMutation({
    mutationFn: () =>
      agendarConteudoMarketing({
        data: { conteudo, plataformas: marcadas, quando: `${dia}T${hora}` },
      }),
    onSuccess: (r) => {
      setConfirmar(false);
      toast.success(
        `${conteudo} agendado para ${r.quando.slice(8, 10)}/${r.quando.slice(5, 7)} às ${hora}.`,
      );
      setMarcadas([]);
      qc.invalidateQueries({ queryKey: ["marketing-agenda"] });
    },
    onError: (e) => {
      setConfirmar(false);
      toast.error(e instanceof Error ? e.message : "Não foi possível agendar.");
    },
  });

  const pronto = Boolean(conteudo && marcadas.length && dia && hora);
  const [a, m, d] = dia.split("-");

  return (
    <section className="h-fit rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <CalendarClock className="h-4 w-4" /> Agendar publicação
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Só conteúdos aprovados, nas plataformas autorizadas na aprovação. O agendamento publica no
        horário marcado, sem ninguém precisar clicar.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold" htmlFor="ag-conteudo">
            Conteúdo
          </label>
          <select
            id="ag-conteudo"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={conteudo}
            onChange={(e) => {
              setConteudo(e.target.value);
              setMarcadas([]);
            }}
          >
            <option value="">Escolha um conteúdo aprovado…</option>
            {candidatos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.titulo}
              </option>
            ))}
          </select>
          {candidatos.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhum conteúdo aprovado para Instagram ou Facebook.
            </p>
          )}
        </div>

        {escolhido && (
          <div>
            <p className="mb-1 text-xs font-semibold">Plataformas</p>
            <div className="space-y-2">
              {autorizadas.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={marcadas.includes(p)}
                    onCheckedChange={(v) =>
                      setMarcadas((atual) => (v ? [...atual, p] : atual.filter((x) => x !== p)))
                    }
                  />
                  <IconePlataforma p={p} /> {NOME[p]}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold" htmlFor="ag-dia">
              Dia
            </label>
            <input
              id="ag-dia"
              type="date"
              min={hojeBR()}
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" htmlFor="ag-hora">
              Hora (Brasília)
            </label>
            <input
              id="ag-hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
        </div>
        {a && (
          <p className="text-xs text-muted-foreground">
            Será publicado em {d}/{m}/{a} às {hora}.
          </p>
        )}

        <Button
          className="w-full"
          disabled={!pronto || agendar.isPending}
          onClick={() => setConfirmar(true)}
        >
          {agendar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Agendar
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title={`Agendar ${conteudo}?`}
        description={`Vai ser publicado em ${marcadas.map((p) => NOME[p]).join(" e ")} no dia ${d}/${m}/${a} às ${hora}. Nada é publicado antes desse horário.`}
        confirmLabel="Agendar"
        loading={agendar.isPending}
        onConfirm={() => agendar.mutate()}
      />
    </section>
  );
}
