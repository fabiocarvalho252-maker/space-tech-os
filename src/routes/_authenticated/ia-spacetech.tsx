import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Sparkles,
  Stethoscope,
  FileText,
  MessageCircle,
  History,
  Wrench,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { gerarComIA } from "@/lib/ia.functions";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/ia-spacetech")({
  head: () => ({
    meta: [
      { title: "IA SPACE TECH — SpaceTech" },
      {
        name: "description",
        content: "Assistentes de IA para diagnóstico, orçamento e atendimento.",
      },
    ],
  }),
  component: IaSpaceTech,
});

type Tipo = "diagnostico" | "orcamento" | "mensagem_cliente" | "resumo_os" | "pecas";

const FERRAMENTAS: {
  tipo: Tipo;
  titulo: string;
  descricao: string;
  icon: typeof Stethoscope;
  placeholder: string;
}[] = [
  {
    tipo: "diagnostico",
    titulo: "Auxiliar de diagnóstico",
    descricao:
      "Descreva o aparelho e o defeito relatado para receber um diagnóstico e serviço sugeridos.",
    icon: Stethoscope,
    placeholder: "Aparelho: iPhone 12\nDefeito relatado: não liga após contato com água",
  },
  {
    tipo: "orcamento",
    titulo: "Gerar texto de orçamento",
    descricao:
      "Informe aparelho, defeito e os itens/valores para gerar um texto de proposta pronto para o cliente.",
    icon: FileText,
    placeholder: "Aparelho: Samsung A54\nDefeito: tela trincada\nItens: Troca de tela - R$ 350,00",
  },
  {
    tipo: "mensagem_cliente",
    titulo: "Gerar mensagem para cliente",
    descricao:
      "Descreva o contexto (status da OS, o que aconteceu) para gerar uma mensagem pronta de WhatsApp.",
    icon: MessageCircle,
    placeholder:
      "OS #42 aprovada pelo cliente, peça chegou e o reparo deve ficar pronto amanhã à tarde.",
  },
  {
    tipo: "resumo_os",
    titulo: "Resumir histórico da OS",
    descricao:
      "Cole a linha do tempo de eventos de uma OS para receber um resumo curto do que já foi feito.",
    icon: History,
    placeholder:
      "08/08 09:20 OS criada\n08/08 10:10 Diagnóstico iniciado\n08/08 11:30 Orçamento enviado\n08/08 13:00 Cliente aprovou",
  },
  {
    tipo: "pecas",
    titulo: "Sugerir peças",
    descricao:
      "Informe aparelho e defeito para receber uma lista das peças mais prováveis necessárias.",
    icon: Wrench,
    placeholder: "Aparelho: Motorola Moto G54\nDefeito: não carrega, conector solto",
  },
];

function IaSpaceTech() {
  return (
    <div>
      <PageHeader
        title="IA SPACE TECH"
        subtitle="Assistentes de inteligência artificial para agilizar o dia a dia da bancada"
      />
      <div className="grid gap-4 md:grid-cols-2">
        {FERRAMENTAS.map((f) => (
          <FerramentaIA key={f.tipo} {...f} />
        ))}
      </div>
    </div>
  );
}

function FerramentaIA({
  tipo,
  titulo,
  descricao,
  icon: Icon,
  placeholder,
}: {
  tipo: Tipo;
  titulo: string;
  descricao: string;
  icon: typeof Stethoscope;
  placeholder: string;
}) {
  const [entrada, setEntrada] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);

  const gerar = useMutation({
    mutationFn: async () => {
      if (!entrada.trim()) throw new Error("Preencha as informações antes de gerar");
      const res = await gerarComIA({ data: { tipo, entrada } });
      return res.texto;
    },
    onSuccess: (texto) => setResultado(texto),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold">{titulo}</h2>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{descricao}</p>
      <Textarea
        value={entrada}
        onChange={(e) => setEntrada(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="text-sm"
      />
      <Button onClick={() => gerar.mutate()} disabled={gerar.isPending} className="self-start">
        <Sparkles className="h-4 w-4" />
        {gerar.isPending ? "Gerando..." : "Gerar com IA"}
      </Button>
      {resultado && (
        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{resultado}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(resultado);
              toast.success("Texto copiado");
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Copy className="h-3 w-3" /> Copiar
          </button>
        </div>
      )}
    </div>
  );
}
