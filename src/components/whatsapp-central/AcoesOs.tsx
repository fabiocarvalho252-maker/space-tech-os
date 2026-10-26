// Ações rápidas de OS da Central (confirmar recebimento, orçamento, pronto,
// PDF, garantia...). Todas abrem o mesmo WhatsAppSendModal da tela de OS, já
// com o modelo e o anexo certos — o atendente revisa antes de enviar, e o
// envio grava na conversa pelo caminho de sempre.
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import {
  CheckCircle2,
  FileText,
  PackageCheck,
  Receipt,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { WhatsAppSendModal, type WhatsAppOsAlvo } from "@/components/WhatsAppSendModal";
import type { OsResumo } from "@/lib/whatsapp/central.server";

export type AcaoOs = "recebimento" | "atualizar" | "orcamento" | "pronto" | "pdf" | "garantia";

export const ACOES_OS: {
  id: AcaoOs;
  label: string;
  icon: LucideIcon;
  template: string;
  anexos?: { os: boolean; orcamento: boolean };
}[] = [
  { id: "recebimento", label: "Confirmar recebimento", icon: CheckCircle2, template: "nova_os" },
  { id: "atualizar", label: "Atualizar reparo", icon: RefreshCw, template: "os_atualizada" },
  {
    id: "orcamento",
    label: "Enviar orçamento",
    icon: Receipt,
    template: "orcamento",
    anexos: { os: false, orcamento: true },
  },
  { id: "pronto", label: "Aparelho pronto", icon: PackageCheck, template: "pronto_retirar" },
  {
    id: "pdf",
    label: "Enviar PDF da OS",
    icon: FileText,
    template: "padrao",
    anexos: { os: true, orcamento: false },
  },
  { id: "garantia", label: "Enviar garantia", icon: ShieldCheck, template: "garantia" },
];

type Abrir = (
  os: OsResumo,
  acao: AcaoOs,
  cliente: { nome: string | null; telefone: string },
) => void;

const Ctx = createContext<Abrir | null>(null);

export function useAcoesOs(): Abrir {
  const abrir = useContext(Ctx);
  if (!abrir) throw new Error("useAcoesOs fora de AcoesOsProvider");
  return abrir;
}

export function AcoesOsProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [envio, setEnvio] = useState<{
    os: WhatsAppOsAlvo;
    template: string;
    anexos: { os: boolean; orcamento: boolean } | undefined;
  } | null>(null);

  const abrir: Abrir = (os, acao, cliente) => {
    const def = ACOES_OS.find((a) => a.id === acao)!;
    setEnvio({
      os: {
        id: os.id,
        numero: os.numero,
        aparelho: os.aparelho,
        marca: os.marca,
        modelo: os.modelo,
        status: os.status,
        valor: Number(os.valor ?? 0),
        responsavel: os.responsavel,
        created_at: os.created_at,
        garantia_dias: os.garantia_dias,
        clientes: { nome: cliente.nome, telefone: cliente.telefone },
      },
      template: def.template,
      anexos: def.anexos,
    });
  };

  return (
    <Ctx.Provider value={abrir}>
      {children}
      <WhatsAppSendModal
        os={envio?.os ?? null}
        open={!!envio}
        templateInicial={envio?.template}
        anexosIniciais={envio?.anexos}
        onOpenChange={(o) => {
          if (!o) {
            setEnvio(null);
            void qc.invalidateQueries({ queryKey: ["whatsapp-central"] });
          }
        }}
      />
    </Ctx.Provider>
  );
}
