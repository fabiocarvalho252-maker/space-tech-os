// Página pública (sem login) de agendamento online: o cliente escolhe o dia
// e um horário livre — gerados pelo horário de funcionamento da loja, sem
// conflito com a Agenda (agenda_horarios_livres) — e informa nome, WhatsApp,
// aparelho e problema. O horário cai na Agenda da loja (agendar_publica).
// Só existe com Configurações → Empresa → Agendamento online ligado.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CalendarCheck, CalendarDays, Clock, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, LogoWord } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lerHorario } from "@/lib/whatsapp/robo";
import { maskPhoneBR } from "@/lib/whatsapp";

export const Route = createFileRoute("/agendar/$slug")({
  head: () => ({ meta: [{ title: "Agendar atendimento" }] }),
  component: AgendarOnline,
});

type AgendaPublica = {
  loja: string;
  logo: string | null;
  whatsapp: string | null;
  endereco: string | null;
  duracao: number;
  dias: number;
  horario: unknown;
};

const FUSO = "America/Sao_Paulo";
const DIA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "AAAA-MM-DD" de hoje + n dias no horário de Brasília. */
function diaBrasilia(n: number) {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const horaBR = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

const MENSAGEM_ERRO: Record<string, string> = {
  indisponivel: "Esse horário acabou de ser ocupado. Escolha outro, por favor.",
  dados: "Confira seu nome e o WhatsApp com DDD.",
  limite: "Você já tem horários marcados. Para mudar, fale com a loja pelo WhatsApp.",
};

function AgendarOnline() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const [dia, setDia] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", aparelho: "", problema: "" });
  const [feito, setFeito] = useState<string | null>(null);

  const { data: agenda, isLoading } = useQuery({
    queryKey: ["agenda-publica", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("agenda_publica", { p_slug: slug });
      if (error) throw error;
      return (data ?? null) as AgendaPublica | null;
    },
  });

  // Próximos dias, marcando os fechados pelo horário de funcionamento.
  const dias = useMemo(() => {
    if (!agenda) return [];
    const horario = lerHorario(agenda.horario);
    return Array.from({ length: agenda.dias + 1 }, (_, n) => {
      const iso = diaBrasilia(n);
      const semana = new Date(`${iso}T12:00:00Z`).getUTCDay();
      return { iso, semana, aberto: !!horario[semana] };
    });
  }, [agenda]);

  const { data: horarios = [], isFetching: carregandoHorarios } = useQuery({
    queryKey: ["agenda-horarios", slug, dia],
    enabled: !!dia,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("agenda_horarios_livres", {
        p_slug: slug,
        p_data: dia!,
      });
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });

  const agendar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("agendar_publica", {
        p_slug: slug,
        p_inicio: slot!,
        p_nome: form.nome,
        p_telefone: form.telefone,
        p_aparelho: form.aparelho,
        p_problema: form.problema,
      });
      if (error) throw error;
      if (data !== "ok") throw new Error(MENSAGEM_ERRO[data] ?? "Não foi possível agendar.");
    },
    onSuccess: () => setFeito(slot),
    // Horário ocupado no meio do caminho: recarrega os livres.
    onError: () => {
      void qc.invalidateQueries({ queryKey: ["agenda-horarios", slug, dia] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agenda) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
        <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">Agendamento indisponível</h1>
        <p className="mt-2 max-w-xs text-center text-muted-foreground">
          Confira o link ou fale com a loja.
        </p>
      </div>
    );
  }

  const telefoneOk = form.telefone.replace(/\D/g, "").length >= 10;
  const podeEnviar = !!slot && form.nome.trim().length >= 2 && telefoneOk;

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <header className="mb-6 border-b border-border bg-background px-4 py-6">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8 text-primary" />
            <LogoWord className="text-lg" />
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            Agendamento
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-4">
        <div className="flex items-center gap-3 rounded-2xl bg-card p-5 shadow-soft">
          {agenda.logo ? (
            <img
              src={agenda.logo}
              alt=""
              className="h-12 w-12 rounded-xl border border-border object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CalendarDays className="h-6 w-6 text-primary" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight">{agenda.loja}</p>
            <p className="text-sm text-muted-foreground">Agende o atendimento do seu aparelho</p>
            {agenda.endereco && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" /> {agenda.endereco}
              </p>
            )}
          </div>
        </div>

        {feito ? (
          <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <CalendarCheck className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="text-lg font-bold">Horário agendado!</p>
            <p className="text-sm">
              {new Intl.DateTimeFormat("pt-BR", {
                timeZone: FUSO,
                weekday: "long",
                day: "2-digit",
                month: "long",
              }).format(new Date(feito))}{" "}
              às <strong>{horaBR(feito)}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              A {agenda.loja} já recebeu seu agendamento.
              {agenda.whatsapp ? ` Dúvidas: WhatsApp ${agenda.whatsapp}.` : ""}
            </p>
          </div>
        ) : (
          <div className="space-y-5 rounded-2xl bg-card p-5 shadow-soft">
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <CalendarDays className="h-4 w-4 text-primary" /> Escolha o dia
              </h3>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {dias.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    disabled={!d.aberto}
                    onClick={() => {
                      setDia(d.iso);
                      setSlot(null);
                    }}
                    className={`flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 text-xs transition ${
                      dia === d.iso
                        ? "border-primary bg-primary text-primary-foreground"
                        : d.aberto
                          ? "border-border hover:bg-muted"
                          : "border-border/40 text-muted-foreground/40"
                    }`}
                  >
                    <span>{DIA_SEMANA[d.semana]}</span>
                    <span className="text-base font-bold">{d.iso.slice(8)}</span>
                    <span>{d.iso.slice(5, 7)}</span>
                  </button>
                ))}
              </div>
            </section>

            {dia && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <Clock className="h-4 w-4 text-primary" /> Escolha o horário
                </h3>
                {carregandoHorarios ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : horarios.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem horários livres nesse dia. Escolha outro.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {horarios.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setSlot(h)}
                        className={`rounded-lg border py-2 text-sm font-medium transition ${
                          slot === h
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {horaBR(h)}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {slot && (
              <section className="space-y-3 border-t border-border pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Seu nome *</Label>
                    <Input
                      value={form.nome}
                      maxLength={80}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>WhatsApp com DDD *</Label>
                    <Input
                      inputMode="tel"
                      value={form.telefone}
                      onChange={(e) => setForm({ ...form, telefone: maskPhoneBR(e.target.value) })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Aparelho</Label>
                  <Input
                    value={form.aparelho}
                    maxLength={80}
                    onChange={(e) => setForm({ ...form, aparelho: e.target.value })}
                    placeholder="Ex.: iPhone 11, Galaxy A12"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>O que está acontecendo?</Label>
                  <Textarea
                    rows={3}
                    value={form.problema}
                    maxLength={500}
                    onChange={(e) => setForm({ ...form, problema: e.target.value })}
                    placeholder="Ex.: tela trincada, não carrega..."
                  />
                </div>
                <Button
                  className="h-12 w-full"
                  disabled={!podeEnviar || agendar.isPending}
                  onClick={() => agendar.mutate()}
                >
                  {agendar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Agendar às {horaBR(slot)}
                </Button>
                {agendar.error && (
                  <p className="text-center text-xs text-destructive">{agendar.error.message}</p>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
