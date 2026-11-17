// Servidor HTTP + WebSocket do runner. Todas as rotas exigem administrador.
// As dependências (verificador de token, consulta do SDK, catálogo) entram por
// parâmetro, para que os testes rodem sem rede e sem gastar com a API.
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import websocket from "@fastify/websocket";
import { z } from "zod";
import { AcessoNegado, exigirAdmin, type VerificarToken } from "./autenticacao/admin.ts";
import { criarGerenciadorTickets } from "./autenticacao/tickets.ts";
import type { Config } from "./config.ts";
import { carregarCatalogo, type ItemCatalogo } from "./catalogo.ts";
import { executarMissao, type Consulta } from "./missoes/executar.ts";
import { criarFila } from "./missoes/fila.ts";
import { criarRepositorio, type Repositorio } from "./missoes/repositorio.ts";
import { readdir } from "node:fs/promises";
import type { EventoEscritorio } from "./tipos.ts";
import type { Gravador } from "./persistencia/gravador.ts";
import { registrarRotasEquipe } from "./equipe/rotas.ts";
import type { RepositorioEquipe } from "./equipe/repositorio.ts";

export type DependenciasApp = {
  config: Config;
  verificar: VerificarToken;
  consulta: Consulta;
  claudeHome: string;
  catalogo?: () => Promise<ItemCatalogo[]>;
  // Opcional: sem gravador a missão fica só em memória.
  gravador?: Gravador;
  // Opcional: sem repositório a Equipe lista o catálogo e não salva edições.
  equipe?: RepositorioEquipe | undefined;
};

const ESQUEMA_MISSAO = z.object({
  prompt: z.string().trim().min(3).max(4000),
  projectId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,59}$/),
  mode: z.enum(["seguro", "automatico"]).default("seguro"),
});

const ESQUEMA_DECISAO = z.object({ decision: z.enum(["permitir", "negar"]) });
const DIA_MS = 24 * 60 * 60 * 1000;

export async function criarApp(deps: DependenciasApp): Promise<FastifyInstance> {
  const { config } = deps;
  const app = Fastify({ logger: { level: "info", redact: ["req.headers.authorization"] }, bodyLimit: 32 * 1024 });
  await app.register(websocket);

  const repo: Repositorio = criarRepositorio();
  const gravador = deps.gravador;
  if (gravador) {
    repo.assinar((evento) => {
      gravador.evento(evento);
      // Sem resposta do administrador (prazo ou missão parada): fecha a aprovação no banco.
      if (evento.tipo === "aprovacao.respondida" && evento.aprovacao?.decisao === "expirada") {
        void gravador.aprovacaoDecidida(evento.aprovacao.id, "expirada", null);
      }
      if (evento.tipo === "aprovacao.pedida" && evento.aprovacao) {
        void gravador.aprovacaoPedida(evento.missaoId, {
          id: evento.aprovacao.id,
          agenteId: evento.agenteId,
          ferramenta: evento.aprovacao.ferramenta,
          resumo: evento.aprovacao.resumo,
        });
      }
    });
  }
  const fila = criarFila(config.OFFICE_MAX_CONCURRENCY);
  const tickets = criarGerenciadorTickets();
  const criadasNoDia: number[] = [];
  const limites = {
    projetoRaiz: config.OFFICE_PROJECTS_ROOT,
    maxTurns: config.OFFICE_MAX_TURNS,
    maxCustoUsd: config.OFFICE_MAX_COST_USD,
    maxMinutos: config.OFFICE_MAX_MINUTES,
    timeoutAprovacaoMs: config.OFFICE_APPROVAL_TIMEOUT_MIN * 60_000,
  };

  const exigir = (request: FastifyRequest) => exigirAdmin(request.headers.authorization, config.ADMIN_EMAIL, deps.verificar);
  const lerCatalogo = () => (deps.catalogo ? deps.catalogo() : carregarCatalogo(deps.claudeHome));
  registrarRotasEquipe(app, { exigir, catalogo: lerCatalogo, repositorio: deps.equipe });

  app.setErrorHandler((erro, _request, reply: FastifyReply) => {
    if (erro instanceof AcessoNegado) return reply.code(erro.status).send({ erro: erro.message });
    if (erro instanceof z.ZodError) return reply.code(400).send({ erro: "Dados inválidos." });
    app.log.error({ erro: erro instanceof Error ? erro.message : String(erro) }, "falha na rota");
    return reply.code(500).send({ erro: "Erro interno." });
  });

  app.get("/office-api/health", async () => ({ ok: true, fila: fila.tamanho() }));

  app.get("/office-api/agents", async (request) => {
    await exigir(request);
    const itens = await lerCatalogo();
    return { itens };
  });

  app.get("/office-api/projects", async (request) => {
    await exigir(request);
    const pastas = await readdir(config.OFFICE_PROJECTS_ROOT, { withFileTypes: true }).catch(() => []);
    return { projetos: pastas.filter((p) => p.isDirectory()).map((p) => p.name).sort() };
  });

  app.post("/office-api/missions", async (request, reply) => {
    const usuario = await exigir(request);
    const corpo = ESQUEMA_MISSAO.parse(request.body);
    const agora = Date.now();
    while (criadasNoDia.length && (criadasNoDia[0] ?? 0) < agora - DIA_MS) criadasNoDia.shift();
    if (criadasNoDia.length >= config.OFFICE_MAX_MISSOES_DIA) {
      return reply.code(429).send({ erro: "Limite diário de missões atingido. Tente amanhã." });
    }
    criadasNoDia.push(agora);
    const missao = repo.criar(corpo.prompt, corpo.projectId, corpo.mode);
    if (gravador) {
      await gravador.missaoCriada({
        id: missao.id,
        criadoPor: usuario.id,
        prompt: missao.prompt,
        projeto: missao.projeto,
        modo: missao.modo,
        criadaEm: missao.criadaEm,
      });
    }
    const posicao = fila.enfileirar(() => executarMissao(missao, repo, deps.consulta, limites));
    return reply.code(202).send({ id: missao.id, status: missao.status, posicaoNaFila: posicao });
  });

  app.get("/office-api/missions", async (request) => {
    await exigir(request);
    return { missoes: repo.listar().map(resumirMissao) };
  });

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/office-api/missions/:id/events", async (request, reply) => {
    await exigir(request);
    const missao = repo.obter(request.params.id);
    if (!missao) return reply.code(404).send({ erro: "Missão não encontrada." });
    return { eventos: repo.replay(request.query.after, missao.id) };
  });

  app.post<{ Params: { id: string } }>("/office-api/missions/:id/cancel", async (request, reply) => {
    await exigir(request);
    const missao = repo.obter(request.params.id);
    if (!missao) return reply.code(404).send({ erro: "Missão não encontrada." });
    missao.controlador.abort(new Error("cancelada pelo administrador"));
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/office-api/approvals/:id", async (request, reply) => {
    const usuario = await exigir(request);
    const { decision } = ESQUEMA_DECISAO.parse(request.body);
    const ok = repo.decidirAprovacao(request.params.id, decision);
    if (ok && gravador) {
      void gravador.aprovacaoDecidida(request.params.id, decision === "permitir" ? "permitida" : "negada", usuario.id);
    }
    return ok ? { ok: true } : reply.code(404).send({ erro: "Aprovação não encontrada ou já respondida." });
  });

  app.post("/office-api/ws-ticket", async (request) => {
    const usuario = await exigir(request);
    const ticket = tickets.emitir(usuario.id);
    return { ticket: ticket.valor, expiraEm: ticket.expiraEm };
  });

  app.get<{ Querystring: { ticket?: string; after?: string } }>("/office-ws", { websocket: true }, (socket, request) => {
    const usuarioId = tickets.consumir(request.query.ticket ?? "");
    if (!usuarioId) {
      socket.close(4401, "ticket inválido");
      return;
    }
    const enviar = (evento: EventoEscritorio) => {
      if (socket.readyState === 1) socket.send(JSON.stringify(evento));
    };
    for (const evento of repo.replay(request.query.after)) enviar(evento);
    const parar = repo.assinar(enviar);
    socket.on("close", parar);
  });

  return app;
}

function resumirMissao(missao: ReturnType<Repositorio["listar"]>[number]) {
  return { id: missao.id, prompt: missao.prompt, projeto: missao.projeto, status: missao.status, criadaEm: missao.criadaEm };
}
