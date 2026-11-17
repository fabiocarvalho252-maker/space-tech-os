// Converte mensagens do stream do Agent SDK em EventoEscritorio. Função pura:
// quem chama guarda o mapeamento tool_use_id → agente e a sequência de ids.
import type { EventoEscritorio, EstadoAgente, TipoEvento } from "../tipos.ts";
import { mascararSegredos, truncar } from "./sanitizar.ts";

export const LIMITE_TEXTO = 120;
export const LIMITE_RESULTADO = 8000;

export type ContextoMissao = {
  missaoId: string;
  proximoId: () => string;
  agora: () => string;
  // tool_use_id de subagente → subagent_type (nome do agente do ECC).
  subagentes: Map<string, string>;
};

type Bloco = { type: string; [chave: string]: unknown };

function evento(
  ctx: ContextoMissao,
  agenteId: string,
  tipo: TipoEvento,
  extra: Partial<EventoEscritorio> = {},
): EventoEscritorio {
  return { id: ctx.proximoId(), missaoId: ctx.missaoId, ts: ctx.agora(), agenteId, tipo, ...extra };
}

function textoDoBloco(bloco: Bloco): string {
  return typeof bloco["text"] === "string" ? bloco["text"] : "";
}

function pareceSubagente(nome: string): boolean {
  return nome === "Task" || nome === "Agent";
}

function nomeDoSubagente(entrada: Record<string, unknown>): string {
  const tipo = entrada["subagent_type"];
  return typeof tipo === "string" && tipo.length > 0 ? tipo : "geral";
}

function eventosDoAssistente(ctx: ContextoMissao, conteudo: Bloco[], paiId: string | null): EventoEscritorio[] {
  const saida: EventoEscritorio[] = [];
  const agenteAtual = paiId ? ctx.subagentes.get(paiId) ?? "orchestrator" : "orchestrator";

  for (const bloco of conteudo) {
    if (bloco.type === "text") {
      const texto = textoDoBloco(bloco).trim();
      if (texto) {
        saida.push(
          evento(ctx, agenteAtual, "agente.mensagem", {
            estado: "pensando",
            texto: truncar(mascararSegredos(texto), LIMITE_TEXTO),
          }),
        );
      }
    } else if (bloco.type === "tool_use") {
      const nome = typeof bloco["name"] === "string" ? bloco["name"] : "ferramenta";
      const entrada = (bloco["input"] ?? {}) as Record<string, unknown>;
      const idUso = typeof bloco["id"] === "string" ? bloco["id"] : "";
      if (pareceSubagente(nome)) {
        const agente = nomeDoSubagente(entrada);
        ctx.subagentes.set(idUso, agente);
        saida.push(
          evento(ctx, agente, "agente.surgiu", {
            agentePaiId: agenteAtual,
            estado: "trabalhando",
            texto: truncar(mascararSegredos(String(entrada["description"] ?? "Recebeu uma tarefa.")), LIMITE_TEXTO),
          }),
        );
      } else {
        saida.push(
          evento(ctx, agenteAtual, "ferramenta.iniciada", {
            estado: "usando_ferramenta",
            ferramenta: { nome, ok: undefined },
          }),
        );
      }
    }
  }
  return saida;
}

function eventosDoUsuario(ctx: ContextoMissao, conteudo: unknown, paiId: string | null): EventoEscritorio[] {
  if (!Array.isArray(conteudo)) return [];
  const agenteAtual = paiId ? ctx.subagentes.get(paiId) ?? "orchestrator" : "orchestrator";
  const saida: EventoEscritorio[] = [];
  for (const bloco of conteudo as Bloco[]) {
    if (bloco.type !== "tool_result") continue;
    const ok = bloco["is_error"] !== true;
    const idUso = typeof bloco["tool_use_id"] === "string" ? bloco["tool_use_id"] : "";
    if (ctx.subagentes.has(idUso)) {
      const agente = ctx.subagentes.get(idUso) ?? "geral";
      saida.push(evento(ctx, agente, "agente.finalizou", { estado: ok ? "concluido" : "erro" }));
    } else {
      saida.push(evento(ctx, agenteAtual, "ferramenta.finalizada", { ferramenta: { nome: "", ok } }));
    }
  }
  return saida;
}

type MensagemSdk = { type: string; [chave: string]: unknown };

export function normalizarMensagem(ctx: ContextoMissao, mensagem: MensagemSdk): EventoEscritorio[] {
  const paiId = typeof mensagem["parent_tool_use_id"] === "string" ? mensagem["parent_tool_use_id"] : null;

  if (mensagem.type === "system" && mensagem["subtype"] === "init") {
    return [evento(ctx, "orchestrator", "missao.iniciada", { estado: "pensando", texto: "Vou dividir o pedido." })];
  }
  if (mensagem.type === "assistant") {
    const corpo = mensagem["message"] as { content?: Bloco[] } | undefined;
    return eventosDoAssistente(ctx, corpo?.content ?? [], paiId);
  }
  if (mensagem.type === "user") {
    const corpo = mensagem["message"] as { content?: unknown } | undefined;
    return eventosDoUsuario(ctx, corpo?.content, paiId);
  }
  if (mensagem.type === "result") {
    return [resultadoFinal(ctx, mensagem)];
  }
  return [];
}

function resultadoFinal(ctx: ContextoMissao, mensagem: MensagemSdk): EventoEscritorio {
  const sucesso = mensagem["subtype"] === "success" && mensagem["is_error"] !== true;
  const custo = typeof mensagem["total_cost_usd"] === "number" ? mensagem["total_cost_usd"] : 0;
  const uso = (mensagem["usage"] ?? {}) as Record<string, unknown>;
  const entrada = Number(uso["input_tokens"] ?? 0);
  const saida = Number(uso["output_tokens"] ?? 0);
  const resultado = typeof mensagem["result"] === "string" ? mensagem["result"] : null;
  const usoEvento = { entradaTokens: entrada, saidaTokens: saida, custoUsd: custo };

  if (!sucesso) {
    const erro = Array.isArray(mensagem["errors"]) ? String(mensagem["errors"][0] ?? "") : "";
    return evento(ctx, "orchestrator", "missao.falhou", {
      estado: "erro" satisfies EstadoAgente,
      texto: truncar(mascararSegredos(erro || "A missão terminou com erro."), LIMITE_TEXTO),
      uso: usoEvento,
    });
  }
  return evento(ctx, "orchestrator", "missao.concluida", {
    estado: "concluido",
    texto: "Pronto.",
    resultado: resultado ? truncar(mascararSegredos(resultado), LIMITE_RESULTADO) : "",
    uso: usoEvento,
  });
}
