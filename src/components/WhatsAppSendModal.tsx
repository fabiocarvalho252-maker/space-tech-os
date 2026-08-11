import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, dataBR, statusLabel } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProfile } from "@/hooks/useCurrentUser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppPhoneInput } from "@/components/whatsapp/WhatsAppPhoneInput";
import { WhatsAppMessageTemplates } from "@/components/whatsapp/WhatsAppMessageTemplates";
import { WhatsAppMessageEditor } from "@/components/whatsapp/WhatsAppMessageEditor";
import { WhatsAppScheduleOptions } from "@/components/whatsapp/WhatsAppScheduleOptions";
import { WhatsAppAttachmentOptions } from "@/components/whatsapp/WhatsAppAttachmentOptions";
import { WhatsAppModalFooter } from "@/components/whatsapp/WhatsAppModalFooter";
import { enviarNotificacaoOsWhatsAppFn } from "@/lib/whatsapp/whatsapp.functions";
import {
  buildMensagensRapidas,
  buildWaMeLink,
  digitsOnlyBR,
  isValidPhoneBR,
  maskPhoneBR,
  preencherVariaveisWhatsApp,
  type VariaveisWhatsApp,
  type WhatsAppSchedule,
} from "@/lib/whatsapp";

// Any OS row shape from the ordens.tsx list/edit form is enough here — this
// modal only ever reads the fields below (select("*") already brings all of
// them, since ordens.tsx's list query has no column projection).
export type WhatsAppOsAlvo = {
  id: string;
  numero: number;
  aparelho?: string | null;
  marca?: string | null;
  modelo?: string | null;
  status: string;
  valor: number;
  responsavel?: string | null;
  created_at?: string | null;
  garantia_dias?: number | null;
  clientes?: { nome?: string | null; telefone?: string | null } | null;
};

export function WhatsAppSendModal({
  os,
  open,
  onOpenChange,
}: {
  os: WhatsAppOsAlvo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: whatsappConfig } = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see src/lib/whatsapp/types.ts header
        .from("whatsapp_config" as any)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
    enabled: open,
  });

  const templates = useMemo(() => buildMensagensRapidas(whatsappConfig), [whatsappConfig]);
  const [templateId, setTemplateId] = useState<string | null>(templates[0]?.id ?? null);
  const [texto, setTexto] = useState("");
  const [telefone, setTelefone] = useState("");
  const [editadoManualmente, setEditadoManualmente] = useState(false);
  const [anexos, setAnexos] = useState({ os: false, orcamento: false });
  const [agendamento, setAgendamento] = useState<WhatsAppSchedule>({ tipo: "agora" });

  const variaveis: VariaveisWhatsApp = useMemo(
    () => ({
      cliente: os?.clientes?.nome ?? "",
      os: os ? String(os.numero) : "",
      numero: os ? String(os.numero) : "",
      numero_os: os ? String(os.numero) : "",
      valor: os ? brl(os.valor) : "",
      status: os ? statusLabel(os.status) : "",
      tecnico: os?.responsavel ?? "",
      aparelho: [os?.aparelho, os?.marca].filter(Boolean).join(" "),
      modelo: os?.modelo ?? "",
      data: os?.created_at ? dataBR(os.created_at) : "",
      garantia: os?.garantia_dias ? `${os.garantia_dias} dias` : "",
      nome_loja: (profile as any)?.loja ?? "",
      empresa: (profile as any)?.loja ?? "",
      telefone: (profile as any)?.whatsapp ?? "",
    }),
    [os, profile],
  );

  // Reset to the first template + the client's own phone every time the
  // modal is opened for a (possibly different) OS — but never wipe state
  // while it's already open, so a backdrop-click-to-close-then-reopen (or a
  // stray re-render) doesn't discard anything the user typed.
  useEffect(() => {
    if (!open || !os) return;
    const primeira = templates[0];
    setTemplateId(primeira?.id ?? null);
    setTexto(primeira ? preencherVariaveisWhatsApp(primeira.message, variaveis) : "");
    setTelefone(maskPhoneBR(os.clientes?.telefone ?? ""));
    setEditadoManualmente(false);
    setAnexos({ os: false, orcamento: false });
    setAgendamento({ tipo: "agora" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, os?.id]);

  function selecionarTemplate(id: string) {
    setTemplateId(id);
    const modelo = templates.find((t) => t.id === id);
    setTexto(modelo ? preencherVariaveisWhatsApp(modelo.message, variaveis) : "");
    setEditadoManualmente(false);
  }

  function novaMensagem() {
    setTemplateId(null);
    setTexto("");
    setEditadoManualmente(true);
    textareaRef.current?.focus();
  }

  const telefoneValido = isValidPhoneBR(telefone);
  const orcamentoDisponivel = Number(os?.valor ?? 0) > 0;
  const isMobile = useIsMobile();

  const agendamentoValido =
    agendamento.tipo === "agora" || (!!agendamento.data && !!agendamento.hora);
  const podeEnviar = telefoneValido && texto.trim().length > 0 && agendamentoValido;

  const enviar = useMutation({
    mutationFn: async () => {
      if (!os) throw new Error("OS não carregada.");

      // No celular, sem anexos e sem agendamento, deixa a pessoa mandar pelo
      // próprio app do WhatsApp — mais natural do que depender da conexão da
      // empresa. Anexos e agendamento sempre passam pelo servidor, já que o
      // wa.me não suporta nem um nem outro.
      if (isMobile && !anexos.os && !anexos.orcamento && agendamento.tipo === "agora") {
        window.open(buildWaMeLink(telefone, texto), "_blank");
        return "wa_me" as const;
      }

      const agendamentoPayload =
        agendamento.tipo === "fila"
          ? {
              tipo: "fila" as const,
              scheduledAt: new Date(`${agendamento.data}T${agendamento.hora}:00`).toISOString(),
            }
          : { tipo: "agora" as const };

      return enviarNotificacaoOsWhatsAppFn({
        data: {
          osId: os.id,
          numero: digitsOnlyBR(telefone),
          mensagem: texto,
          templateId,
          anexos,
          agendamento: agendamentoPayload,
        },
      });
    },
    onSuccess: (resultado) => {
      if (resultado === "wa_me") {
        onOpenChange(false);
        return;
      }
      if (resultado.status === "falhou") {
        toast.error("Não foi possível enviar a mensagem. Verifique o WhatsApp e tente novamente.");
        return; // mantém o modal aberto para o usuário tentar de novo
      }
      toast.success(
        resultado.status === "agendado"
          ? "Notificação agendada com sucesso."
          : "Mensagem enviada com sucesso pelo WhatsApp.",
      );
      qc.invalidateQueries({ queryKey: ["os-historico"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !enviar.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-xl rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-center">
            <MessageCircle className="h-5 w-5 text-green-600" /> Enviar notificação por WhatsApp
          </DialogTitle>
          <DialogDescription className="text-center">
            {os ? `OS ${os.numero} — ${os.clientes?.nome ?? "cliente sem nome"}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <WhatsAppPhoneInput value={telefone} onChange={setTelefone} valido={telefoneValido} />

          <WhatsAppMessageTemplates
            templates={templates}
            selecionadoId={templateId ?? ""}
            destacado={!editadoManualmente}
            onSelecionar={selecionarTemplate}
            onNovaMensagem={novaMensagem}
          />

          <WhatsAppMessageEditor
            value={texto}
            onChange={(v) => {
              setTexto(v);
              setEditadoManualmente(true);
            }}
            inputRef={textareaRef}
          />

          <WhatsAppScheduleOptions value={agendamento} onChange={setAgendamento} />

          <WhatsAppAttachmentOptions
            osSelecionado={anexos.os}
            orcamentoSelecionado={anexos.orcamento}
            orcamentoDisponivel={orcamentoDisponivel}
            onToggleOs={() => setAnexos((a) => ({ ...a, os: !a.os }))}
            onToggleOrcamento={() => setAnexos((a) => ({ ...a, orcamento: !a.orcamento }))}
          />
        </div>

        <WhatsAppModalFooter
          enviando={enviar.isPending}
          podeEnviar={podeEnviar}
          agendando={agendamento.tipo === "fila"}
          onCancelar={() => onOpenChange(false)}
          onEnviar={() => enviar.mutate()}
        />
      </DialogContent>
    </Dialog>
  );
}
