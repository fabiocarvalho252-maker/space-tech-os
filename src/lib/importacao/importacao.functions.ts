// Server functions da importação de dados (tela /importar). A tela lê a
// planilha no navegador e manda as linhas em lotes, já ligadas aos campos;
// aqui cada linha é limpa de novo (campos.ts), os duplicados são pulados e
// a gravação usa o cliente do próprio usuário — o RLS (has_permission no
// módulo) decide se ele pode cadastrar. Cada registro leva o importacao_id
// para poder ser desfeito (função desfazer_importacao no banco).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  TIPOS_IMPORTACAO,
  chaveDuplicado,
  limparLinha,
  normalizarCabecalho,
  type TipoImportacao,
} from "./campos";

const LOTE_MAXIMO = 500;
const PAGINA = 1000;

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

// Mesma regra de empresaDoUsuario (whatsapp.functions.ts): um convite para
// outra empresa vence a empresa própria do funcionário.
async function empresaComPermissao(context: Ctx, tipo: TipoImportacao): Promise<string> {
  const { data } = await context.supabase
    .from("user_empresas")
    .select("empresa_id")
    .eq("user_id", context.userId);
  const empresaId = (data ?? []).find((m) => m.empresa_id !== context.userId)?.empresa_id;
  const empresa = empresaId ?? context.userId;
  const { data: pode } = await context.supabase.rpc("has_permission", {
    p_empresa_id: empresa,
    p_modulo: TIPOS_IMPORTACAO[tipo].modulo,
    p_acao: "gerenciar",
  });
  if (!pode) {
    throw new Error(
      `Seu usuário não tem permissão para cadastrar ${TIPOS_IMPORTACAO[tipo].rotulo.toLowerCase()}.`,
    );
  }
  return empresa;
}

type Existente = Record<string, string | number | null>;

async function chavesExistentes(
  context: Ctx,
  tipo: TipoImportacao,
  empresaId: string,
): Promise<Set<string>> {
  const chaves = new Set<string>();
  for (let inicio = 0; ; inicio += PAGINA) {
    let linhas: Existente[] | null = null;
    let erro: { message: string } | null = null;
    if (tipo === "clientes") {
      const r = await context.supabase
        .from("clientes")
        .select("nome, telefone, documento")
        .eq("user_id", empresaId)
        .range(inicio, inicio + PAGINA - 1);
      linhas = r.data;
      erro = r.error;
    } else if (tipo === "fornecedores") {
      const r = await context.supabase
        .from("fornecedores")
        .select("razao_social, cnpj_cpf")
        .eq("user_id", empresaId)
        .range(inicio, inicio + PAGINA - 1);
      linhas = r.data;
      erro = r.error;
    } else {
      let q = context.supabase
        .from("produtos")
        .select("nome, sku, codigo_barras")
        .eq("user_id", empresaId);
      q = tipo === "servicos" ? q.eq("categoria", "Serviço") : q.neq("categoria", "Serviço");
      const r = await q.range(inicio, inicio + PAGINA - 1);
      linhas = r.data;
      erro = r.error;
    }
    if (erro) throw new Error(erro.message);
    for (const l of linhas ?? []) chaves.add(chaveDuplicado(tipo, l));
    if (!linhas || linhas.length < PAGINA) return chaves;
  }
}

/** Fornecedor pelo nome (razão social ou fantasia) → id, para ligar produtos. */
async function mapaFornecedores(context: Ctx, empresaId: string): Promise<Map<string, string>> {
  const { data } = await context.supabase
    .from("fornecedores")
    .select("id, razao_social, nome_fantasia")
    .eq("user_id", empresaId)
    .limit(5000);
  const mapa = new Map<string, string>();
  for (const f of data ?? []) {
    for (const nome of [f.razao_social, f.nome_fantasia]) {
      if (nome) mapa.set(normalizarCabecalho(nome), f.id);
    }
  }
  return mapa;
}

async function garantirCategorias(context: Ctx, empresaId: string, nomes: string[]) {
  if (!nomes.length) return;
  const { data } = await context.supabase
    .from("produto_categorias")
    .select("nome")
    .eq("user_id", empresaId);
  const existentes = new Set((data ?? []).map((c) => normalizarCabecalho(c.nome)));
  const novas = [...new Map(nomes.map((n) => [normalizarCabecalho(n), n])).entries()]
    .filter(([k]) => k && !existentes.has(k))
    .map(([, nome]) => ({ user_id: empresaId, nome }));
  if (novas.length) await context.supabase.from("produto_categorias").insert(novas);
}

const valorSchema = z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]);

const loteSchema = z.object({
  tipo: z.enum(["clientes", "fornecedores", "produtos", "servicos"]),
  importacaoId: z.guid().nullable(),
  arquivo: z.string().max(200),
  linhas: z.array(z.record(z.string().max(40), valorSchema)).max(LOTE_MAXIMO),
});

export type ResultadoLote = {
  importacaoId: string;
  inseridos: number;
  duplicados: number;
  invalidos: number;
};

export const importarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => loteSchema.parse(data))
  .handler(async ({ data, context }): Promise<ResultadoLote> => {
    const { tipo } = data;
    const empresaId = await empresaComPermissao(context, tipo);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let importacaoId = data.importacaoId;
    if (importacaoId) {
      const { data: imp } = await supabaseAdmin
        .from("importacoes")
        .select("user_id, tipo, desfeita_em")
        .eq("id", importacaoId)
        .maybeSingle();
      if (!imp || imp.user_id !== empresaId || imp.tipo !== tipo || imp.desfeita_em) {
        throw new Error("Importação inválida.");
      }
    } else {
      const { data: nova, error } = await supabaseAdmin
        .from("importacoes")
        .insert({ user_id: empresaId, tipo, arquivo: data.arquivo, criado_por: context.userId })
        .select("id")
        .single();
      if (error) throw error;
      importacaoId = nova.id;
    }

    const existentes = await chavesExistentes(context, tipo, empresaId);
    const fornecedores = tipo === "produtos" ? await mapaFornecedores(context, empresaId) : null;

    let duplicados = 0;
    let invalidos = 0;
    const registros: Record<string, string | number | null>[] = [];
    for (const bruta of data.linhas) {
      const { dados, erro } = limparLinha(tipo, bruta);
      if (erro) {
        invalidos++;
        continue;
      }
      const chave = chaveDuplicado(tipo, dados);
      if (existentes.has(chave)) {
        duplicados++;
        continue;
      }
      existentes.add(chave);
      registros.push(dados);
    }

    let inseridos = 0;
    if (registros.length) {
      const base = { user_id: empresaId, importacao_id: importacaoId };
      let erro: { message: string } | null = null;
      if (tipo === "clientes") {
        const r = await context.supabase.from("clientes").insert(
          registros.map((d) => ({
            ...base,
            nome: String(d["nome"]),
            telefone: (d["telefone"] as string | null) ?? null,
            documento: (d["documento"] as string | null) ?? null,
            email: (d["email"] as string | null) ?? null,
            endereco: (d["endereco"] as string | null) ?? null,
            data_nascimento: (d["data_nascimento"] as string | null) ?? null,
            observacoes: (d["observacoes"] as string | null) ?? null,
          })),
        );
        erro = r.error;
      } else if (tipo === "fornecedores") {
        const r = await context.supabase.from("fornecedores").insert(
          registros.map((d) => ({
            ...base,
            razao_social: String(d["razao_social"]),
            nome_fantasia: (d["nome_fantasia"] as string | null) ?? null,
            cnpj_cpf: (d["cnpj_cpf"] as string | null) ?? null,
            telefone: (d["telefone"] as string | null) ?? null,
            whatsapp: (d["whatsapp"] as string | null) ?? null,
            email: (d["email"] as string | null) ?? null,
            endereco: (d["endereco"] as string | null) ?? null,
            observacoes: (d["observacoes"] as string | null) ?? null,
          })),
        );
        erro = r.error;
      } else if (tipo === "produtos") {
        const categorias = registros
          .map((d) => d["categoria"])
          .filter((c): c is string => typeof c === "string" && c !== "Serviço");
        await garantirCategorias(context, empresaId, categorias);
        const r = await context.supabase.from("produtos").insert(
          registros.map((d) => {
            const fornecedor =
              typeof d["fornecedor"] === "string"
                ? fornecedores?.get(normalizarCabecalho(d["fornecedor"]))
                : undefined;
            return {
              ...base,
              nome: String(d["nome"]),
              sku: (d["sku"] as string | null) ?? null,
              codigo_barras: (d["codigo_barras"] as string | null) ?? null,
              categoria:
                d["categoria"] === "Serviço" ? null : ((d["categoria"] as string | null) ?? null),
              preco_custo: Math.max(0, Number(d["preco_custo"] ?? 0)),
              preco_venda: Math.max(0, Number(d["preco_venda"] ?? 0)),
              quantidade: Math.max(0, Number(d["quantidade"] ?? 0)),
              estoque_minimo: Math.max(0, Number(d["estoque_minimo"] ?? 0)),
              marca: (d["marca"] as string | null) ?? null,
              localizacao: (d["localizacao"] as string | null) ?? null,
              descricao: (d["descricao"] as string | null) ?? null,
              fornecedor_id: fornecedor ?? null,
            };
          }),
        );
        erro = r.error;
      } else {
        // Mesmo formato do cadastro em /servicos/adicionar.
        const r = await context.supabase.from("produtos").insert(
          registros.map((d) => ({
            ...base,
            nome: String(d["nome"]),
            categoria: "Serviço",
            preco_venda: Math.max(0, Number(d["preco_venda"] ?? 0)),
            preco_custo: Math.max(0, Number(d["preco_custo"] ?? 0)),
            descricao: (d["descricao"] as string | null) ?? null,
            quantidade: 999,
            estoque_minimo: 0,
          })),
        );
        erro = r.error;
      }
      if (erro) throw new Error(`Falha ao gravar: ${erro.message}`);
      inseridos = registros.length;
    }

    const { data: atual } = await supabaseAdmin
      .from("importacoes")
      .select("inseridos, pulados")
      .eq("id", importacaoId)
      .single();
    await supabaseAdmin
      .from("importacoes")
      .update({
        inseridos: (atual?.inseridos ?? 0) + inseridos,
        pulados: (atual?.pulados ?? 0) + duplicados + invalidos,
      })
      .eq("id", importacaoId);

    return { importacaoId, inseridos, duplicados, invalidos };
  });

export type Importacao = {
  id: string;
  tipo: TipoImportacao;
  arquivo: string | null;
  inseridos: number;
  pulados: number;
  created_at: string;
  desfeita_em: string | null;
  desfeita_mantidos: number | null;
};

export const listarImportacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Importacao[]> => {
    // RLS da tabela: só quem vê as configurações da empresa.
    const { data, error } = await context.supabase
      .from("importacoes")
      .select("id, tipo, arquivo, inseridos, pulados, created_at, desfeita_em, desfeita_mantidos")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data ?? []) as Importacao[];
  });

export const desfazerImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ importacaoId: z.guid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ apagados: number; mantidos: number }> => {
    const { data: r, error } = await context.supabase.rpc("desfazer_importacao", {
      p_importacao: data.importacaoId,
    });
    if (error) throw new Error(error.message);
    const linha = r?.[0];
    return { apagados: linha?.apagados ?? 0, mantidos: linha?.mantidos ?? 0 };
  });
