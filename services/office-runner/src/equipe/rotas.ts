// Rotas da Equipe: listar perfis (GET) e editar um agente (PATCH). Todas exigem
// administrador, via o verificador já usado pelo runner (exigirAdmin).
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ItemCatalogo } from "../catalogo.ts";
import { aplicarEdicao, mesclarEquipe, perfilPadrao } from "./perfis.ts";
import { validarNomeUnico } from "./nomes.ts";
import { validarEdicao } from "./validacao.ts";
import type { RepositorioEquipe } from "./repositorio.ts";

export type DependenciasEquipe = {
  exigir: (request: FastifyRequest) => Promise<unknown>;
  catalogo: () => Promise<ItemCatalogo[]>;
  repositorio: RepositorioEquipe | undefined;
};

export const MSG_SEM_BANCO =
  "A Equipe precisa do banco para salvar alterações. Configure SUPABASE_SERVICE_ROLE_KEY no runner e tente de novo.";

export function registrarRotasEquipe(app: FastifyInstance, deps: DependenciasEquipe): void {
  app.get("/office-api/equipe", async (request) => {
    await deps.exigir(request);
    const itens = await deps.catalogo();
    const salvos = deps.repositorio ? await deps.repositorio.listar() : [];
    return { perfis: mesclarEquipe(itens, salvos), bancoDisponivel: deps.repositorio !== undefined };
  });

  app.patch<{ Params: { agentId: string } }>("/office-api/equipe/:agentId", async (request, reply) => {
    await deps.exigir(request);
    const validacao = validarEdicao(request.body);
    if (!validacao.ok) return reply.code(400).send({ erro: "Dados inválidos.", campos: validacao.erros });

    const repositorio = deps.repositorio;
    if (!repositorio) return reply.code(503).send({ erro: MSG_SEM_BANCO });

    const { agentId } = request.params;
    const itens = await deps.catalogo();
    const item = itens.find((candidato) => candidato.id === agentId);
    if (!item) return reply.code(404).send({ erro: "Agente não encontrado no catálogo." });

    const salvos = await repositorio.listar();
    const nomesDosOutros = mesclarEquipe(itens, salvos)
      .filter((perfil) => perfil.agentId !== agentId)
      .map((perfil) => perfil.displayName);
    const erroNome = validarNomeUnico(validacao.valor.displayName, nomesDosOutros);
    if (erroNome) return reply.code(409).send({ erro: erroNome });

    const base = salvos.find((perfil) => perfil.agentId === agentId) ?? perfilPadrao(item);
    const perfil = aplicarEdicao(base, validacao.valor);
    await repositorio.salvar(perfil);
    return { perfil: { ...perfil, salvo: true } };
  });
}
