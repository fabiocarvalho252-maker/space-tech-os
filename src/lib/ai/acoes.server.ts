// Ações da SPACE TECH IA (cadastrar cliente, abrir OS, mudar status de OS).
// As ferramentas "propor_*" só montam e conferem a ação — não gravam nada;
// a proposta volta para o chat como cartão de confirmação. Quem grava é
// executarAcao, chamado por executarAcaoIA quando o usuário confirma.
// Tudo roda com o client Supabase do próprio usuário (RLS + has_permission),
// então a IA nunca consegue fazer algo que a pessoa não faria pela tela.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { STATUS_OS, statusLabel } from "@/lib/format";
import type { AcaoIA } from "./types";
import type { ToolDef } from "./tools.server";

type Supa = SupabaseClient<Database>;

const STATUS_VALIDOS = STATUS_OS.map((s) => s.value as string);

function texto(valor: unknown, max: number): string | null {
  const t = String(valor ?? "")
    .trim()
    .slice(0, max);
  return t || null;
}

function busca(valor: unknown): string {
  return String(valor ?? "")
    .replace(/[,()%]/g, " ")
    .trim()
    .slice(0, 100);
}

/** Resultado de uma ferramenta propor_*: a ação pronta para o cartão. */
export type PropostaAcao = { proposta: AcaoIA };

export function ehProposta(valor: unknown): valor is PropostaAcao {
  return typeof valor === "object" && valor !== null && "proposta" in valor;
}

async function buscarClientes(supabase: Supa, nome: string) {
  const termo = busca(nome);
  if (!termo) return [];
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome, telefone")
    .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%`)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return data ?? [];
}

export const ACOES_TOOLS: ToolDef[] = [
  {
    name: "propor_criar_cliente",
    description:
      "Prepara o cadastro de um cliente novo. NÃO grava: mostra um cartão para o usuário confirmar. Antes, use get_clientes para não duplicar um cliente que já existe.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome completo do cliente" },
        telefone: { type: "string", description: "Telefone/WhatsApp, se informado" },
        documento: { type: "string", description: "CPF ou CNPJ, se informado" },
      },
      required: ["nome"],
    },
    execute: async (_supabase, args) => {
      const nome = texto(args["nome"], 120);
      if (!nome) return { erro: "Informe o nome do cliente." };
      return {
        proposta: {
          tipo: "criar_cliente",
          nome,
          telefone: texto(args["telefone"], 30),
          documento: texto(args["documento"], 30),
        },
      } satisfies PropostaAcao;
    },
  },
  {
    name: "propor_abrir_os",
    description:
      "Prepara a abertura de uma Ordem de Serviço. NÃO grava: mostra um cartão para o usuário confirmar. Informe o nome do cliente como foi dito; a ferramenta procura no cadastro. Se houver mais de um cliente parecido, ela devolve a lista para você perguntar qual é. Se não existir, cadastra o cliente junto (passe o telefone se souber).",
    input_schema: {
      type: "object",
      properties: {
        cliente_nome: { type: "string", description: "Nome (ou telefone) do cliente" },
        cliente_telefone: { type: "string", description: "Telefone do cliente, se informado" },
        aparelho: { type: "string", description: "Aparelho (ex: iPhone 11, Galaxy A32)" },
        marca: { type: "string" },
        modelo: { type: "string" },
        defeito: { type: "string", description: "Defeito relatado pelo cliente" },
        valor: { type: "number", description: "Valor do orçamento em reais, se informado" },
      },
      required: ["aparelho"],
    },
    execute: async (supabase, args) => {
      const aparelho = texto(args["aparelho"], 120);
      if (!aparelho) return { erro: "Informe o aparelho." };
      const nomeCliente = texto(args["cliente_nome"], 120);
      let cliente: { id: string; nome: string } | null = null;
      let novoCliente: { nome: string; telefone: string | null } | null = null;
      if (nomeCliente) {
        const achados = await buscarClientes(supabase, nomeCliente);
        const exato = achados.filter((c) => c.nome.toLowerCase() === nomeCliente.toLowerCase());
        if (exato.length === 1) cliente = exato[0]!;
        else if (achados.length === 1) cliente = achados[0]!;
        else if (achados.length > 1) {
          return {
            precisa_escolher_cliente: true,
            clientes: achados.map((c) => ({ nome: c.nome, telefone: c.telefone })),
            instrucao:
              "Pergunte ao usuário qual destes clientes é e chame propor_abrir_os de novo com o nome completo.",
          };
        } else {
          novoCliente = { nome: nomeCliente, telefone: texto(args["cliente_telefone"], 30) };
        }
      }
      const valor = Number(args["valor"]);
      return {
        proposta: {
          tipo: "abrir_os",
          cliente_id: cliente?.id ?? null,
          cliente_nome: cliente?.nome ?? null,
          novo_cliente: novoCliente,
          aparelho,
          marca: texto(args["marca"], 60),
          modelo: texto(args["modelo"], 60),
          defeito: texto(args["defeito"], 1000),
          valor: Number.isFinite(valor) && valor > 0 ? valor : null,
        },
      } satisfies PropostaAcao;
    },
  },
  {
    name: "propor_mudar_status_os",
    description: `Prepara a mudança de status de uma OS pelo número. NÃO grava: mostra um cartão para o usuário confirmar. Status válidos: ${STATUS_OS.map((s) => `${s.value} (${s.label})`).join(", ")}. Mudar para "pronto" avisa o cliente no WhatsApp automaticamente.`,
    input_schema: {
      type: "object",
      properties: {
        numero: { type: "integer", description: "Número da OS" },
        status: { type: "string", description: "Novo status (um dos valores válidos)" },
      },
      required: ["numero", "status"],
    },
    execute: async (supabase, args) => {
      const status = String(args["status"] ?? "");
      if (!STATUS_VALIDOS.includes(status)) return { erro: `Status inválido: ${status}.` };
      const { data: os, error } = await supabase
        .from("ordens_servico")
        .select("id, numero, aparelho, status")
        .eq("numero", Number(args["numero"]))
        .maybeSingle();
      if (error) throw error;
      if (!os) return { erro: `OS #${args["numero"]} não encontrada.` };
      if (os.status === status)
        return { erro: `A OS #${os.numero} já está como ${statusLabel(status)}.` };
      return {
        proposta: {
          tipo: "mudar_status_os",
          os_id: os.id,
          numero: os.numero,
          aparelho: os.aparelho,
          status_atual: os.status,
          status_novo: status,
        },
      } satisfies PropostaAcao;
    },
  },
];

async function inserirCliente(
  supabase: Supa,
  empresaId: string,
  dados: { nome: string; telefone: string | null; documento?: string | null },
) {
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      user_id: empresaId,
      nome: dados.nome,
      telefone: dados.telefone,
      documento: dados.documento ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export type ResultadoAcao = { mensagem: string; osId?: string; avisarPronta?: boolean };

export async function executarAcao(
  supabase: Supa,
  empresaId: string,
  acao: AcaoIA,
): Promise<ResultadoAcao> {
  switch (acao.tipo) {
    case "criar_cliente": {
      await inserirCliente(supabase, empresaId, acao);
      return { mensagem: `Cliente ${acao.nome} cadastrado.` };
    }
    case "abrir_os": {
      const clienteId =
        acao.cliente_id ??
        (acao.novo_cliente ? await inserirCliente(supabase, empresaId, acao.novo_cliente) : null);
      const { data: os, error } = await supabase
        .from("ordens_servico")
        .insert({
          user_id: empresaId,
          cliente_id: clienteId,
          aparelho: acao.aparelho,
          marca: acao.marca,
          modelo: acao.modelo,
          defeito: acao.defeito,
          valor: acao.valor ?? 0,
          status: "recebido",
        })
        .select("id, numero")
        .single();
      if (error) throw error;
      return { mensagem: `OS #${os.numero} aberta.`, osId: os.id };
    }
    case "mudar_status_os": {
      const { data: os, error: erroOs } = await supabase
        .from("ordens_servico")
        .select("status")
        .eq("id", acao.os_id)
        .maybeSingle();
      if (erroOs) throw erroOs;
      if (!os) throw new Error("OS não encontrada.");
      const { data: alterada, error } = await supabase
        .from("ordens_servico")
        .update({ status: acao.status_novo })
        .eq("id", acao.os_id)
        .select("id");
      if (error) throw error;
      if (!alterada?.length) throw new Error("Sem permissão para alterar esta OS.");
      return {
        mensagem: `OS #${acao.numero} agora está como ${statusLabel(acao.status_novo)}.`,
        osId: acao.os_id,
        avisarPronta: acao.status_novo === "pronto",
      };
    }
  }
}
