// Configurações → Empresa → Agendamento online: liga a página pública
// /agendar/<endereço>, define o endereço, a duração de cada horário, a
// antecedência mínima e até quantos dias à frente o cliente pode marcar.
// Os horários saem do horário de funcionamento da loja (logo acima).
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useProfile } from "@/hooks/useCurrentUser";
import { origemPublica } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const slugDe = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function AgendaOnlineConfig() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: profile } = useProfile();
  const [cfg, setCfg] = useState({
    ligado: false,
    slug: "",
    duracao: 60,
    antecedencia: 2,
    dias: 14,
  });

  useEffect(() => {
    if (!profile) return;
    setCfg({
      ligado: profile.agenda_online,
      slug: profile.agenda_slug || slugDe(profile.loja || profile.nome || ""),
      duracao: profile.agenda_duracao_min,
      antecedencia: profile.agenda_antecedencia_h,
      dias: profile.agenda_dias,
    });
  }, [profile]);

  const salvar = useMutation({
    mutationFn: async () => {
      const slug = slugDe(cfg.slug);
      if (cfg.ligado && slug.length < 3) throw new Error("o endereço precisa de 3 letras ou mais");
      const { error } = await supabase
        .from("profiles")
        .update({
          agenda_online: cfg.ligado,
          agenda_slug: slug || null,
          agenda_duracao_min: cfg.duracao,
          agenda_antecedencia_h: cfg.antecedencia,
          agenda_dias: cfg.dias,
        })
        .eq("id", user!.id);
      if (error) {
        if (error.code === "23505") throw new Error("esse endereço já é usado por outra loja");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Agendamento online salvo");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  const link = `${origemPublica()}/agendar/${slugDe(cfg.slug)}`;
  const semHorario = !profile?.horario_funcionamento;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarClock className="h-5 w-5 text-primary" /> Agendamento online
          </h2>
          <p className="text-sm text-muted-foreground">
            Uma página onde o cliente escolhe dia e horário livre para trazer o aparelho. O horário
            cai direto na Agenda (marcado como “Online”) e avisa no sininho.
          </p>
        </div>
        <Switch
          checked={cfg.ligado}
          onCheckedChange={(v) => setCfg({ ...cfg, ligado: v })}
          aria-label="Ligar agendamento online"
        />
      </div>

      {semHorario && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          Ligue e preencha o <strong>Horário de funcionamento</strong> acima: os horários livres
          saem dele. Sem ele, a página não mostra horários.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Endereço da página</Label>
          <div className="flex items-center gap-2">
            <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
              {origemPublica()}/agendar/
            </span>
            <Input
              value={cfg.slug}
              onChange={(e) => setCfg({ ...cfg, slug: e.target.value.toLowerCase() })}
              onBlur={() => setCfg({ ...cfg, slug: slugDe(cfg.slug) })}
              placeholder="minha-loja"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Duração de cada horário</Label>
          <select
            value={cfg.duracao}
            onChange={(e) => setCfg({ ...cfg, duracao: Number(e.target.value) })}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            {[15, 20, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} h`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Antecedência mínima (horas)</Label>
          <Input
            type="number"
            min={0}
            max={168}
            value={cfg.antecedencia}
            onChange={(e) =>
              setCfg({
                ...cfg,
                antecedencia: Math.min(168, Math.max(0, Number(e.target.value) || 0)),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Até quantos dias à frente</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={cfg.dias}
            onChange={(e) =>
              setCfg({ ...cfg, dias: Math.min(60, Math.max(1, Number(e.target.value) || 1)) })
            }
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Um horário por vez (compromissos e bloqueios da Agenda ocupam o horário). Cada WhatsApp
        marca no máximo 2 horários futuros.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          Salvar agendamento online
        </Button>
        {profile?.agenda_online && profile.agenda_slug && (
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                toast.success("Link copiado");
              }}
            >
              <Copy className="h-4 w-4" /> Copiar link
            </Button>
            <Button variant="outline" className="gap-2" asChild>
              <a href={link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> Abrir página
              </a>
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
