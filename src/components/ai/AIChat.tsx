import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { AIMessage } from "./AIMessage";
import { AISuggestions } from "./AISuggestions";
import type { ChatMessage } from "@/lib/ai/types";
import { enviarMensagemIA } from "@/lib/ai/chat.functions";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const MAX_HISTORICO_ENVIADO = 12;
const CHAVE_HISTORICO = "spacetech_ia_historico";

function hojeISO() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${hoje.getMonth() + 1}-${hoje.getDate()}`;
}

function chaveArmazenamento(userId: string) {
  return `${CHAVE_HISTORICO}_${userId}`;
}

// O histórico só vale para o dia em que foi salvo — assim que a data muda,
// a conversa começa do zero (o usuário pediu explicitamente esse comportamento).
function carregarHistoricoDeHoje(userId: string): ChatMessage[] {
  try {
    const bruto = localStorage.getItem(chaveArmazenamento(userId));
    if (!bruto) return [];
    const salvo = JSON.parse(bruto) as { data: string; mensagens: ChatMessage[] };
    return salvo.data === hojeISO() ? salvo.mensagens : [];
  } catch {
    return [];
  }
}

function salvarHistoricoDeHoje(userId: string, mensagens: ChatMessage[]) {
  localStorage.setItem(chaveArmazenamento(userId), JSON.stringify({ data: hojeISO(), mensagens }));
}

export function AIChat() {
  const { data: usuario } = useCurrentUser();
  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  const [texto, setTexto] = useState("");
  const listaRef = useRef<HTMLDivElement>(null);
  const diaCarregadoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!usuario?.id) return;
    setMensagens(carregarHistoricoDeHoje(usuario.id));
    diaCarregadoRef.current = hojeISO();
  }, [usuario?.id]);

  useEffect(() => {
    if (!usuario?.id) return;
    salvarHistoricoDeHoje(usuario.id, mensagens);
  }, [usuario?.id, mensagens]);

  // Se o painel ficar aberto virando o dia, limpa a conversa sozinho em vez
  // de esperar a próxima mensagem.
  useEffect(() => {
    const intervalo = setInterval(() => {
      const hoje = hojeISO();
      if (diaCarregadoRef.current && diaCarregadoRef.current !== hoje) {
        diaCarregadoRef.current = hoje;
        setMensagens([]);
      }
    }, 60_000);
    return () => clearInterval(intervalo);
  }, []);

  const enviar = useMutation({
    mutationFn: async (mensagem: string) => {
      const historico = mensagens.slice(-MAX_HISTORICO_ENVIADO);
      return enviarMensagemIA({ data: { mensagem, historico } });
    },
    onSuccess: (res) => {
      if (res.erro) {
        setMensagens((prev) => [...prev, { role: "assistant", content: `⚠️ ${res.erro}` }]);
      } else if (res.resposta) {
        setMensagens((prev) => [...prev, { role: "assistant", content: res.resposta! }]);
      }
    },
    onError: (e: Error) => {
      setMensagens((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Não consegui falar com a IA agora: ${e.message}` },
      ]);
    },
  });

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, enviar.isPending]);

  function enviarTexto(valor: string) {
    const conteudo = valor.trim();
    if (!conteudo || enviar.isPending) return;
    const hoje = hojeISO();
    const virouODia = diaCarregadoRef.current !== null && diaCarregadoRef.current !== hoje;
    diaCarregadoRef.current = hoje;
    setMensagens((prev) => [...(virouODia ? [] : prev), { role: "user", content: conteudo }]);
    setTexto("");
    enviar.mutate(conteudo);
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={listaRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {mensagens.length === 0 ? (
          <AISuggestions onEscolher={enviarTexto} />
        ) : (
          mensagens.map((m, i) => <AIMessage key={i} mensagem={m} />)
        )}
        {enviar.isPending && (
          <div className="flex items-center gap-2 pl-9 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            SPACE TECH IA está pensando...
          </div>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          enviarTexto(texto);
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite uma pergunta..."
          maxLength={1000}
          className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={enviar.isPending || !texto.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
