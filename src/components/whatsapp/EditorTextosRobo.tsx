import { useEffect, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  TEXTOS_PADRAO,
  textoMenu,
  textoPlanos,
  type Contexto,
  type TextosRobo,
} from "@/lib/whatsapp/robo";

type NumeroOpcao = 1 | 2 | 3 | 4 | 5;

// Editor das mensagens e opções do robô (Configurações > WhatsApp > Robô de
// atendimento). A loja muda quando quiser; campo vazio volta ao texto padrão
// (lerTextos). A prévia ao lado mostra exatamente o que o cliente recebe.
export function EditorTextosRobo({
  salvos,
  ctxPrevia,
  comPlanos,
  salvando,
  onSalvar,
}: {
  salvos: TextosRobo;
  /** Loja, horário e planos para a prévia (sem os textos). */
  ctxPrevia: Omit<Contexto, "textos">;
  /** Mostra a opção 5 (planos do SPACE TECH): só na conta da SPACE TECH. */
  comPlanos: boolean;
  salvando: boolean;
  onSalvar: (textos: TextosRobo) => void;
}) {
  const [textos, setTextos] = useState<TextosRobo>(salvos);
  useEffect(() => setTextos(salvos), [salvos]);

  const alterado = JSON.stringify(textos) !== JSON.stringify(salvos);
  const ehPadrao = JSON.stringify(textos) === JSON.stringify(TEXTOS_PADRAO);
  const ctx: Contexto = { ...ctxPrevia, textos };

  function campo<K extends keyof TextosRobo>(chave: K, valor: TextosRobo[K]) {
    setTextos((t) => ({ ...t, [chave]: valor }));
  }
  function opcao(n: NumeroOpcao, texto: string) {
    setTextos((t) => ({ ...t, opcoes: { ...t.opcoes, [n]: texto } }));
  }
  function ligar(n: NumeroOpcao, ligada: boolean) {
    setTextos((t) => ({
      ...t,
      desligadas: ligada ? t.desligadas.filter((x) => x !== n) : [...t.desligadas, n],
    }));
  }

  const numeros: NumeroOpcao[] = comPlanos ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];

  return (
    <details className="group rounded-lg border border-border bg-background/50">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium">
        <Pencil className="h-4 w-4 text-primary" /> Editar mensagens e opções do robô
      </summary>
      <div className="space-y-5 border-t border-border p-3">
        <p className="text-xs text-muted-foreground">
          Mude o que quiser e clique em <strong>Salvar textos</strong>. Campo vazio volta ao texto
          padrão. As palavras entre chaves, como <code>{"{nome}"}</code>, são trocadas sozinhas pelo
          dado do cliente.
        </p>

        <Bloco titulo="Começo da conversa">
          <Campo rotulo="Saudação" dica="{nome} = primeiro nome do cliente · {loja} = nome da loja">
            <Textarea
              rows={2}
              value={textos.saudacao}
              onChange={(e) => campo("saudacao", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Pergunta (loja aberta)">
            <Input value={textos.pergunta} onChange={(e) => campo("pergunta", e.target.value)} />
          </Campo>
          <Campo rotulo="Aviso de loja fechada" dica="{abre} = quando abre (ex.: amanhã às 8h)">
            <Textarea
              rows={2}
              value={textos.fechado}
              onChange={(e) => campo("fechado", e.target.value)}
            />
          </Campo>
        </Bloco>

        <Bloco titulo="Opções do menu">
          <div className="divide-y divide-border rounded-lg border border-border">
            {numeros.map((n) => {
              const fixa = n === 4;
              const ligada = fixa || !textos.desligadas.includes(n);
              return (
                <div key={n} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-5 text-center text-sm font-bold">{n}</span>
                  <Input
                    value={textos.opcoes[n]}
                    onChange={(e) => opcao(n, e.target.value)}
                    disabled={!ligada}
                    className="h-8 flex-1"
                    aria-label={`Texto da opção ${n}`}
                  />
                  <Switch
                    checked={ligada}
                    disabled={fixa}
                    onCheckedChange={(v) => ligar(n, v)}
                    aria-label={`Opção ${n} ligada`}
                    title={
                      fixa ? "Sempre ligada: o cliente precisa conseguir falar com alguém" : ""
                    }
                  />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            A opção 4 (atendente) fica sempre ligada, para o cliente sempre conseguir falar com uma
            pessoa. Opção desligada some do menu.
          </p>
        </Bloco>

        <Bloco titulo="Respostas">
          <Campo rotulo="Pergunta do aparelho (opção 2)">
            <Textarea
              rows={2}
              value={textos.perguntaAparelho}
              onChange={(e) => campo("perguntaAparelho", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Pergunta do defeito (opção 2)" dica="{aparelho} = o que o cliente digitou">
            <Textarea
              rows={2}
              value={textos.perguntaDefeito}
              onChange={(e) => campo("perguntaDefeito", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Orçamento anotado">
            <Input
              value={textos.orcamentoAnotado}
              onChange={(e) => campo("orcamentoAnotado", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Quando pede atendente (opção 4)">
            <Input value={textos.atendente} onChange={(e) => campo("atendente", e.target.value)} />
          </Campo>
          {comPlanos && (
            <Campo
              rotulo="Resposta dos planos (opção 5)"
              dica="{mensal} e {anual} = preços do plano · {link} = link de cadastro"
            >
              <Textarea
                rows={9}
                value={textos.planos}
                onChange={(e) => campo("planos", e.target.value)}
              />
            </Campo>
          )}
        </Bloco>

        <Bloco titulo="Prévia (como o cliente recebe)">
          <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
            {textoMenu(ctx, true)}
          </p>
          {comPlanos && !textos.desligadas.includes(5) && (
            <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
              {textoPlanos(ctx, false)}
            </p>
          )}
        </Bloco>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!alterado || salvando} onClick={() => onSalvar(textos)}>
            Salvar textos
          </Button>
          {alterado && (
            <Button size="sm" variant="ghost" onClick={() => setTextos(salvos)}>
              Desfazer
            </Button>
          )}
          {!ehPadrao && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => setTextos(TEXTOS_PADRAO)}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Voltar ao padrão
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      {children}
    </section>
  );
}

function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium">{rotulo}</span>
      {children}
      {dica && <span className="block text-xs text-muted-foreground">{dica}</span>}
    </label>
  );
}
