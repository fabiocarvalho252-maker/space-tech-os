import { useState, type KeyboardEvent } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

const ATALHOS = [
  "Revisar o código do SPACE TECH",
  "Criar legenda para o Instagram",
  "Analisar erros do build",
];

type Props = {
  rodando: boolean;
  onIniciar: (pedido: string) => void;
  onCancelar: () => void;
};

export function CommandChat({ rodando, onIniciar, onCancelar }: Props) {
  const [pedido, setPedido] = useState("");

  const enviar = () => {
    if (rodando || !pedido.trim()) return;
    onIniciar(pedido.trim());
  };

  const aoTeclar = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault();
      enviar();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="pedido-escritorio" className="text-sm font-semibold">
          Pedido ao Diretor
        </label>
        <textarea
          id="pedido-escritorio"
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          onKeyDown={aoTeclar}
          rows={4}
          placeholder="Descreva o que você quer que os agentes façam. Ctrl+Enter envia."
          className="mt-1 w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Nesta fase é uma simulação: o texto ainda não é enviado a agente nenhum.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ATALHOS.map((atalho) => (
          <button
            key={atalho}
            type="button"
            onClick={() => setPedido(atalho)}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
          >
            {atalho}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button className="flex-1 gap-2" onClick={enviar} disabled={rodando || !pedido.trim()}>
          <Play className="h-4 w-4" /> Simular missão
        </Button>
        <Button variant="destructive" className="gap-2" onClick={onCancelar} disabled={!rodando}>
          <Square className="h-4 w-4" /> Parar tudo
        </Button>
      </div>
    </div>
  );
}
