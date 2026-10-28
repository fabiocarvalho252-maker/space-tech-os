import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useEmpresaId, useProfile } from "@/hooks/useCurrentUser";
import { SITE_ADMIN_EMAIL } from "@/lib/site-admin";
import { precosConviteFn } from "@/lib/convites-assinatura.functions";
import { brl } from "@/lib/format";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { EditorTextosRobo } from "./EditorTextosRobo";
import { HorarioSemanaEditor } from "@/components/HorarioSemanaEditor";
import { horarioInvalido } from "@/lib/horario-loja";
import {
  HORARIO_COMERCIAL,
  estaAberto,
  lerHorario,
  lerTextos,
  proximaAbertura,
  type Horario,
  type TextosRobo,
} from "@/lib/whatsapp/robo";

// Configurações > WhatsApp > Robô de atendimento: liga/desliga para a
// empresa e horário de atendimento (Brasília). O robô em si roda no
// servidor (robo.server.ts), a cada mensagem recebida.
export function RoboWhatsappCard() {
  const empresaId = useEmpresaId();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const chave = ["whatsapp-robo-config", empresaId];

  const { data, isLoading } = useQuery({
    queryKey: chave,
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("robo_ativo, robo_horario, robo_textos")
        .eq("user_id", empresaId!)
        .maybeSingle();
      if (error) throw error;
      return {
        ativo: !!data?.robo_ativo,
        horario: lerHorario(data?.robo_horario),
        textos: lerTextos(data?.robo_textos),
      };
    },
  });

  const [horario, setHorario] = useState<Horario>(HORARIO_COMERCIAL);
  useEffect(() => {
    if (data) setHorario(data.horario);
  }, [data]);

  const salvar = useMutation({
    mutationFn: async (patch: {
      robo_ativo?: boolean;
      robo_horario?: Horario;
      robo_textos?: TextosRobo;
    }) => {
      const { error } = await supabase
        .from("whatsapp_config")
        .upsert({ user_id: empresaId!, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: (_r, patch) => {
      void qc.invalidateQueries({ queryKey: chave });
      if (patch.robo_ativo !== undefined) {
        toast.success(patch.robo_ativo ? "Robô de atendimento ligado." : "Robô desligado.");
      } else {
        toast.success(patch.robo_textos ? "Textos do robô salvos." : "Horário salvo.");
      }
    },
    onError: (e: Error) => toast.error("Não foi possível salvar: " + e.message),
  });

  const invalido = horarioInvalido(horario);
  const horarioLoja = profile?.horario_funcionamento
    ? lerHorario(profile.horario_funcionamento)
    : null;
  const alterado = JSON.stringify(horario) !== JSON.stringify(data?.horario ?? HORARIO_COMERCIAL);
  // Na conta da SPACE TECH o menu tem a opção 5 (planos do site).
  const { data: user } = useCurrentUser();
  const souSpaceTech = user?.email === SITE_ADMIN_EMAIL;
  const { data: precos } = useQuery({
    queryKey: ["convite-precos"],
    queryFn: () => precosConviteFn(),
    enabled: souSpaceTech,
  });
  const agora = new Date();
  const ctxPrevia = {
    loja: (profile?.loja || profile?.nome || "sua loja").trim(),
    nome: "Maria",
    aberto: estaAberto(horario, agora),
    abre: proximaAbertura(horario, agora),
    planos: souSpaceTech
      ? {
          mensal: precos?.mensal ? brl(precos.mensal) : null,
          anual: precos?.anual ? brl(precos.anual) : null,
          link: `${window.location.origin}/cadastro`,
        }
      : null,
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Robô de atendimento
      </h3>
      <div className="space-y-5 rounded-xl border border-border bg-muted/30 p-4">
        <label className="flex items-start justify-between gap-4">
          <span className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold">
                Responder clientes automaticamente
              </span>
              <span className="block text-xs text-muted-foreground">
                Quando um cliente escreve, o robô responde com um menu: status da OS, pedido de
                orçamento, garantia ou falar com um atendente. Ele não inventa preço nem prazo, só
                responde a quem manda mensagem e fica quieto quando alguém da equipe responde ou
                assume a conversa. Dá para pausar em cada conversa, na central do WhatsApp.
              </span>
            </span>
          </span>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={!!data?.ativo}
              disabled={salvar.isPending || !empresaId}
              onCheckedChange={(v) => salvar.mutate({ robo_ativo: v })}
              aria-label="Ligar ou desligar o robô de atendimento"
            />
          )}
        </label>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Horário de atendimento (Brasília)
          </p>
          <p className="text-xs text-muted-foreground">
            Fora do horário o robô avisa que a loja está fechada e quando volta, e continua ajudando
            com status, orçamento e garantia.
          </p>
          <HorarioSemanaEditor value={horario} onChange={setHorario} />
          {invalido && (
            <p className="text-xs text-destructive">
              Confira os horários: o fechamento precisa ser depois da abertura.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!alterado || invalido || salvar.isPending}
              onClick={() => salvar.mutate({ robo_horario: horario })}
            >
              Salvar horário
            </Button>
            {alterado && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHorario(data?.horario ?? HORARIO_COMERCIAL)}
              >
                Desfazer
              </Button>
            )}
            {horarioLoja && JSON.stringify(horarioLoja) !== JSON.stringify(horario) && (
              <Button size="sm" variant="outline" onClick={() => setHorario(horarioLoja)}>
                Usar o horário de funcionamento da loja
              </Button>
            )}
          </div>
        </div>

        {data && (
          <EditorTextosRobo
            salvos={data.textos}
            ctxPrevia={ctxPrevia}
            comPlanos={souSpaceTech}
            salvando={salvar.isPending}
            onSalvar={(textos) => salvar.mutate({ robo_textos: textos })}
          />
        )}
      </div>
    </div>
  );
}
