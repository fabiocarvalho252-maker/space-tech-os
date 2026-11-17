import { useState, type KeyboardEvent } from "react";
import { Play, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

const ATALHOS = [
  "Revisar o código do SPACE TECH",
  "Criar legenda para o Instagram",
  "Analisar erros do build",
];

type Props = {
  rodando: boolean;
  online: boolean | null;
  projetos: string[];
  onSimular: () => void;
  onEnviar: (pedido: string, projeto: string) => void;
  onCancelar: () => void;
};

export function CommandChat({ rodando, online, projetos, onSimular, onEnviar, onCancelar }: Props) {
  const [pedido, setPedido] = useState("");
  const [projeto, setProjeto] = useState("");
  const projetoAtual = projeto || projetos[0] || "";
  const podeEnviarReal = online === true && projetoAtual !== "";

  const enviarReal = () => {
    if (rodando || !pedido.trim() || !podeEnviarReal) return;
    onEnviar(pedido.trim(), projetoAtual);
  };

  const aoTeclar = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault();
      if (podeEnviarReal) enviarReal();
      else if (!rodando && pedido.trim()) onSimular();
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
          {online === true
            ? "Runner online: o pedido vai para os agentes do ECC na VPS, com o seu plano Pro."
            : "Runner offline: só a simulação está disponível."}
        </p>
      </div>

      {online === true && projetos.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Projeto</span>
          <select
            value={projetoAtual}
            onChange={(e) => setProjeto(e.target.value)}
            className="rounded-xl border border-border bg-background p-2 text-sm"
          >
            {projetos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}

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

      <div className="flex flex-wrap gap-2">
        {podeEnviarReal && (
          <Button
            className="flex-1 gap-2"
            onClick={enviarReal}
            disabled={rodando || !pedido.trim()}
          >
            <Send className="h-4 w-4" /> Enviar ao Diretor
          </Button>
        )}
        <Button
          variant={podeEnviarReal ? "outline" : "default"}
          className="flex-1 gap-2"
          onClick={onSimular}
          disabled={rodando || !pedido.trim()}
        >
          <Play className="h-4 w-4" /> Simular missão
        </Button>
        <Button variant="destructive" className="gap-2" onClick={onCancelar} disabled={!rodando}>
          <Square className="h-4 w-4" /> Parar tudo
        </Button>
      </div>
    </div>
  );
}
