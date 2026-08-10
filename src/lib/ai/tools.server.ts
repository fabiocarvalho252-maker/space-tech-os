import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { STATUS_OS, statusLabel } from "@/lib/format";

type ToolSupabase = SupabaseClient<Database>;

type LinhaOS = {
  numero: number;
  aparelho: string;
  marca: string | null;
  modelo: string | null;
  defeito: string | null;
  valor: number;
  status: string;
  responsavel: string | null;
  created_at: string;
  clientes: { nome: string | null } | null;
};

type LinhaProduto = {
  nome: string;
  categoria: string | null;
  preco_venda: number;
  quantidade: number;
  estoque_minimo: number;
};

type LinhaVenda = {
  numero: number;
  total: number;
  forma_pagamento: string;
  status: string;
  created_at: string;
  clientes: { nome: string | null } | null;
};

type LinhaLancamento = {
  tipo: string;
  categoria: string | null;
  descricao: string;
  valor: number;
  data: string;
  status: string | null;
};

type LinhaAgendamento = {
  titulo: string;
  tipo: string;
  tecnico: string | null;
  inicio: string;
  fim: string;
  status: string;
  clientes: { nome: string | null } | null;
};

// Read-only tools the SPACE TECH IA can call. Every query runs through the
// caller's own RLS-bound Supabase client (see auth-middleware.ts's
// context.supabase, built from the user's own JWT) — never the service-role
// client — so empresa isolation comes from the exact same row-level security
// policies every screen in the app already relies on, not from a parallel
// filtering system built here.

const LIMITE_PADRAO = 10;
const LIMITE_MAXIMO = 20;

function limitar(valor: unknown): number {
  const n = Number(valor) || LIMITE_PADRAO;
  return Math.min(Math.max(1, Math.trunc(n)), LIMITE_MAXIMO);
}

// PostgREST's .or() filter syntax breaks on raw commas/parens in the value —
// strip them rather than trust the model's argument verbatim.
function textoBusca(valor: unknown): string {
  return String(valor ?? "")
    .replace(/[,()]/g, " ")
    .trim()
    .slice(0, 100);
}

export type ToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  execute: (supabase: ToolSupabase, args: Record<string, unknown>) => Promise<unknown>;
};

export const TOOLS: ToolDef[] = [
  {
    name: "get_clientes",
    description:
      "Busca clientes cadastrados por nome ou telefone (busca parcial). Sem filtro, lista os mais recentes. Retorna nome, telefone, e-mail e quantas OS cada cliente tem.",
    input_schema: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Nome ou telefone (parcial) do cliente" },
        limite: { type: "integer", description: "Máximo de resultados (padrão 10, máximo 20)" },
      },
    },
    execute: async (supabase, args) => {
      let query = supabase
        .from("clientes")
        .select("id, nome, telefone, email")
        .order("created_at", { ascending: false })
        .limit(limitar(args["limite"]));
      const busca = textoBusca(args["busca"]);
      if (busca) query = query.or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%`);
      const { data, error } = await query;
      if (error) throw error;
      const comOs = await Promise.all(
        (data ?? []).map(async (c) => {
          const { count } = await supabase
            .from("ordens_servico")
            .select("id", { count: "exact", head: true })
            .eq("cliente_id", c.id);
          return { nome: c.nome, telefone: c.telefone, email: c.email, total_os: count ?? 0 };
        }),
      );
      return comOs;
    },
  },
  {
    name: "get_cliente",
    description: "Detalhes de um cliente específico pelo nome (usa o resultado mais próximo).",
    input_schema: {
      type: "object",
      properties: { nome: { type: "string", description: "Nome do cliente" } },
      required: ["nome"],
    },
    execute: async (supabase, args) => {
      const nome = textoBusca(args["nome"]);
      const { data: cliente, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone, email, endereco")
        .ilike("nome", `%${nome}%`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!cliente) return { encontrado: false };
      const { count } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", cliente.id);
      return {
        encontrado: true,
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        endereco: cliente.endereco,
        total_os: count ?? 0,
      };
    },
  },
  {
    name: "get_ordens_servico",
    description: `Lista ordens de serviço com filtros opcionais por status, aparelho ou nome do cliente. Status válidos: ${STATUS_OS.map((s) => `${s.value} (${s.label})`).join(", ")}.`,
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Um dos valores de status válidos (ex: aguardando_peca)",
        },
        aparelho: { type: "string", description: "Filtro parcial pelo aparelho/modelo" },
        cliente_nome: { type: "string", description: "Filtro parcial pelo nome do cliente" },
        limite: { type: "integer" },
      },
    },
    execute: async (supabase, args) => {
      let query = supabase
        .from("ordens_servico")
        .select(
          "numero, aparelho, marca, modelo, defeito, valor, status, responsavel, created_at, clientes(nome)",
        )
        .order("created_at", { ascending: false })
        .limit(limitar(args["limite"]));
      if (args["status"]) query = query.eq("status", String(args["status"]));
      const aparelho = textoBusca(args["aparelho"]);
      if (aparelho) query = query.ilike("aparelho", `%${aparelho}%`);
      const { data, error } = await query;
      if (error) throw error;
      let linhas = (data ?? []) as unknown as LinhaOS[];
      const clienteNome = textoBusca(args["cliente_nome"]).toLowerCase();
      if (clienteNome) {
        linhas = linhas.filter((o) => (o.clientes?.nome ?? "").toLowerCase().includes(clienteNome));
      }
      return linhas.map((o) => ({
        numero: o.numero,
        aparelho: o.aparelho,
        marca: o.marca,
        modelo: o.modelo,
        defeito: o.defeito,
        valor: o.valor,
        status: o.status,
        status_label: statusLabel(o.status),
        responsavel: o.responsavel || "Técnico não atribuído",
        cliente: o.clientes?.nome ?? null,
        criado_em: o.created_at,
      }));
    },
  },
  {
    name: "get_ordem_servico",
    description:
      "Detalhes completos de uma OS específica pelo número (inclui itens/peças/serviços lançados nela).",
    input_schema: {
      type: "object",
      properties: { numero: { type: "integer", description: "Número da OS" } },
      required: ["numero"],
    },
    execute: async (supabase, args) => {
      const { data: osData, error } = await supabase
        .from("ordens_servico")
        .select("*, clientes(nome, telefone)")
        .eq("numero", Number(args["numero"]))
        .maybeSingle();
      if (error) throw error;
      if (!osData) return { encontrado: false };
      const os = osData as unknown as {
        id: string;
        numero: number;
        aparelho: string;
        marca: string | null;
        modelo: string | null;
        defeito: string | null;
        diagnostico: string | null;
        laudo_tecnico: string | null;
        valor: number;
        status: string;
        responsavel: string | null;
        created_at: string;
        clientes: { nome: string | null; telefone: string | null } | null;
      };
      const { data: itens } = await supabase
        .from("os_itens")
        .select("descricao, tipo, quantidade, preco_unitario")
        .eq("os_id", os.id);
      return {
        encontrado: true,
        numero: os.numero,
        aparelho: os.aparelho,
        marca: os.marca,
        modelo: os.modelo,
        defeito: os.defeito,
        diagnostico: os.diagnostico,
        laudo_tecnico: os.laudo_tecnico,
        valor: os.valor,
        status: os.status,
        status_label: statusLabel(os.status),
        responsavel: os.responsavel || "Técnico não atribuído",
        cliente: os.clientes?.nome ?? null,
        telefone_cliente: os.clientes?.telefone ?? null,
        itens: itens ?? [],
        criado_em: os.created_at,
      };
    },
  },
  {
    name: "get_estoque",
    description:
      "Busca produtos, peças e serviços cadastrados (o cadastro de peças/serviços de uma assistência técnica pode estar em Produtos ou em Serviços — esta ferramenta busca nos dois). Pode filtrar só os com estoque baixo ou zerado.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Filtro parcial pelo nome do item" },
        apenas_baixo_estoque: {
          type: "boolean",
          description: "Se true, retorna só itens com quantidade <= estoque mínimo",
        },
        apenas_zerado: {
          type: "boolean",
          description: "Se true, retorna só itens com quantidade 0",
        },
        limite: { type: "integer" },
      },
    },
    execute: async (supabase, args) => {
      let query = supabase
        .from("produtos")
        .select("nome, categoria, preco_venda, quantidade, estoque_minimo")
        .order("nome")
        .limit(limitar(args["limite"]));
      const nome = textoBusca(args["nome"]);
      if (nome) query = query.ilike("nome", `%${nome}%`);
      const { data, error } = await query;
      if (error) throw error;
      let linhas = (data ?? []) as unknown as LinhaProduto[];
      if (args["apenas_zerado"]) linhas = linhas.filter((p) => Number(p.quantidade) <= 0);
      else if (args["apenas_baixo_estoque"])
        linhas = linhas.filter((p) => Number(p.quantidade) <= Number(p.estoque_minimo));
      return linhas;
    },
  },
  {
    name: "get_vendas",
    description: "Lista vendas (PDV/Vendas) em um período opcional, com o total vendido somado.",
    input_schema: {
      type: "object",
      properties: {
        data_inicio: { type: "string", description: "Data inicial YYYY-MM-DD" },
        data_fim: { type: "string", description: "Data final YYYY-MM-DD" },
        limite: { type: "integer" },
      },
    },
    execute: async (supabase, args) => {
      let query = supabase
        .from("vendas")
        .select("numero, total, forma_pagamento, status, created_at, clientes(nome)")
        .order("created_at", { ascending: false })
        .limit(limitar(args["limite"]));
      if (args["data_inicio"]) query = query.gte("created_at", `${args["data_inicio"]}T00:00:00`);
      if (args["data_fim"]) query = query.lte("created_at", `${args["data_fim"]}T23:59:59`);
      const { data, error } = await query;
      if (error) throw error;
      const linhas = (data ?? []) as unknown as LinhaVenda[];
      const totalVendido = linhas.reduce((s, v) => s + Number(v.total), 0);
      return {
        total_vendido: totalVendido,
        quantidade_vendas: linhas.length,
        vendas: linhas.map((v) => ({
          numero: v.numero,
          total: v.total,
          forma_pagamento: v.forma_pagamento,
          status: v.status,
          cliente: v.clientes?.nome ?? null,
          data: v.created_at,
        })),
      };
    },
  },
  {
    name: "get_financeiro",
    description:
      "Consulta lançamentos financeiros (receitas e despesas) em um período, com os totais já somados. Lançamentos com status 'pendente' e tipo 'entrada' são o que ainda falta receber.",
    input_schema: {
      type: "object",
      properties: {
        data_inicio: { type: "string", description: "Data inicial YYYY-MM-DD" },
        data_fim: { type: "string", description: "Data final YYYY-MM-DD" },
        tipo: {
          type: "string",
          enum: ["entrada", "saida"],
          description: "Filtra só receitas ou só despesas",
        },
        limite: { type: "integer" },
      },
    },
    execute: async (supabase, args) => {
      let query = supabase
        .from("lancamentos")
        .select("tipo, categoria, descricao, valor, data, status")
        .order("data", { ascending: false })
        .limit(limitar(args["limite"]));
      if (args["data_inicio"]) query = query.gte("data", String(args["data_inicio"]));
      if (args["data_fim"]) query = query.lte("data", String(args["data_fim"]));
      if (args["tipo"]) query = query.eq("tipo", String(args["tipo"]));
      const { data, error } = await query;
      if (error) throw error;
      const linhas = (data ?? []) as unknown as LinhaLancamento[];
      const receitas = linhas
        .filter((l) => l.tipo === "entrada")
        .reduce((s, l) => s + Number(l.valor), 0);
      const despesas = linhas
        .filter((l) => l.tipo === "saida")
        .reduce((s, l) => s + Number(l.valor), 0);
      return { receitas, despesas, resultado: receitas - despesas, lancamentos: linhas };
    },
  },
  {
    name: "get_agenda",
    description: "Consulta compromissos da agenda em um período (ex: hoje, esta semana).",
    input_schema: {
      type: "object",
      properties: {
        data_inicio: { type: "string", description: "Data inicial YYYY-MM-DD (obrigatório)" },
        data_fim: { type: "string", description: "Data final YYYY-MM-DD (obrigatório)" },
        limite: { type: "integer" },
      },
      required: ["data_inicio", "data_fim"],
    },
    execute: async (supabase, args) => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("titulo, tipo, tecnico, inicio, fim, status, clientes(nome)")
        .gte("inicio", `${args["data_inicio"]}T00:00:00`)
        .lte("inicio", `${args["data_fim"]}T23:59:59`)
        .order("inicio")
        .limit(limitar(args["limite"]));
      if (error) throw error;
      return ((data ?? []) as unknown as LinhaAgendamento[]).map((a) => ({
        titulo: a.titulo,
        tipo: a.tipo,
        tecnico: a.tecnico,
        inicio: a.inicio,
        fim: a.fim,
        status: a.status,
        cliente: a.clientes?.nome ?? null,
      }));
    },
  },
];
