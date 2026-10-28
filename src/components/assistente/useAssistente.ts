import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useEmpresaId, usePermissoes, podeVer } from "@/hooks/useCurrentUser";
import { listarReclamacoesPesquisaFn } from "@/lib/whatsapp/whatsapp.functions";
import { naoLidasCentralFn } from "@/lib/whatsapp/central.functions";
import {
  PREFERENCIAS_PADRAO,
  dispensar,
  STATUS_OS_ENCERRADA,
  filtrarSugestoes,
  hojeLocal,
  montarSugestoes,
  silenciado,
  type AcaoSugestao,
  type DadosAssistente,
  type PreferenciasAssistente,
  type Sugestao,
} from "@/lib/assistente/sugestoes";

// Preferência pessoal do login (não da empresa). Sem linha salva = padrão
// (ligado, tudo visível).
export function usePreferenciasAssistente() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const chave = ["assistente-preferencias", user?.id];

  const { data: prefs = PREFERENCIAS_PADRAO, isLoading } = useQuery({
    queryKey: chave,
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PreferenciasAssistente> => {
      const { data, error } = await supabase
        .from("assistente_preferencias")
        .select("ativo, categorias_desligadas, silenciado_ate, dispensados")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return PREFERENCIAS_PADRAO;
      return { ...data, dispensados: (data.dispensados ?? {}) as Record<string, string> };
    },
  });

  const salvar = useMutation({
    mutationFn: async (novo: Partial<PreferenciasAssistente>) => {
      const completo = { ...prefs, ...novo };
      const { error } = await supabase.from("assistente_preferencias").upsert(
        {
          user_id: user!.id,
          ...completo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      return completo;
    },
    // Otimista: o balão some na hora; se falhar, volta ao que estava.
    onMutate: async (novo) => {
      await qc.cancelQueries({ queryKey: chave });
      const anterior = qc.getQueryData<PreferenciasAssistente>(chave);
      qc.setQueryData<PreferenciasAssistente>(chave, { ...prefs, ...novo });
      return { anterior };
    },
    onError: (_e, _novo, ctx) => {
      if (ctx?.anterior) qc.setQueryData(chave, ctx.anterior);
    },
  });

  return { prefs, carregando: isLoading, salvar: salvar.mutate };
}

async function contar(tabela: "clientes" | "ordens_servico" | "produtos", empresaId: string) {
  const { count, error } = await supabase
    .from(tabela)
    .select("id", { count: "exact", head: true })
    .eq("user_id", empresaId);
  return error ? null : (count ?? 0);
}

/** Sugestões visíveis agora (já filtradas pelas preferências). */
export function useAssistente() {
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const { data: permissoes } = usePermissoes();
  const { prefs } = usePreferenciasAssistente();
  const ligado = prefs.ativo;

  const ver = (modulo: string) => podeVer(permissoes, modulo);
  const modulos = ["ordens", "cobrancas", "financeiro", "produtos", "agenda", "clientes"]
    .filter(ver)
    .join(",");

  // Mesma chave do contador do menu lateral: compartilham o cache.
  const { data: whatsappNaoLidas } = useQuery({
    queryKey: ["whatsapp-central", "nao-lidas"],
    queryFn: () => naoLidasCentralFn(),
    enabled: !!user && ligado && ver("whatsapp"),
    refetchInterval: 20_000,
    retry: false,
  });

  const { data: dados } = useQuery({
    queryKey: ["assistente-dados", empresaId, modulos],
    enabled: !!user && !!empresaId && ligado && permissoes !== undefined,
    staleTime: 60_000,
    refetchInterval: 3 * 60_000,
    retry: false,
    queryFn: async (): Promise<Omit<DadosAssistente, "whatsappNaoLidas">> => {
      const id = empresaId!;
      const agora = new Date();
      const hoje = hojeLocal(agora);
      const fimHoje = new Date(agora);
      fimHoje.setHours(23, 59, 59, 999);

      const [os, cobrancas, pagar, receber, produtos, agenda, reclamacoes, totais] =
        await Promise.all([
          ver("ordens")
            ? supabase
                .from("ordens_servico")
                .select("id, numero, status, updated_at, previsao, aparelho, clientes(nome)")
                .eq("user_id", id)
                .not("status", "in", `(${STATUS_OS_ENCERRADA.join(",")})`)
                .order("updated_at", { ascending: true })
                .limit(200)
            : null,
          ver("cobrancas")
            ? supabase
                .from("cobrancas")
                .select("valor")
                .eq("user_id", id)
                // Mesma regra da tela Cobranças: não paga e vencimento passado.
                .in("status", ["pendente", "expirada"])
                .lt("vencimento", hoje)
                .limit(500)
            : null,
          ver("financeiro")
            ? supabase
                .from("lancamentos")
                .select("valor")
                .eq("user_id", id)
                .eq("tipo", "saida")
                .eq("status", "pendente")
                .lte("vencimento", hoje)
                .limit(500)
            : null,
          ver("financeiro")
            ? supabase
                .from("lancamentos")
                .select("valor")
                .eq("user_id", id)
                .eq("tipo", "entrada")
                .eq("status", "pendente")
                .lt("vencimento", hoje)
                .limit(500)
            : null,
          ver("produtos")
            ? supabase
                .from("produtos")
                .select("nome, quantidade, estoque_minimo")
                .eq("user_id", id)
                .gt("estoque_minimo", 0)
                .limit(1000)
            : null,
          ver("agenda")
            ? supabase
                .from("agendamentos")
                .select("titulo, inicio")
                .eq("user_id", id)
                .eq("status", "agendado")
                .gte("inicio", agora.toISOString())
                .lte("inicio", fimHoje.toISOString())
                .limit(50)
            : null,
          // Mesmo módulo que o servidor confere (empresaDoUsuario "clientes").
          ver("clientes") ? listarReclamacoesPesquisaFn().catch(() => null) : null,
          Promise.all([
            ver("clientes") ? contar("clientes", id) : null,
            ver("ordens") ? contar("ordens_servico", id) : null,
            ver("produtos") ? contar("produtos", id) : null,
          ]),
        ]);

      // Consulta que falhou vira "sem dado" (null): a sugestão só não aparece.
      const linhas = <T>(r: { data: T[] | null; error: unknown } | null) =>
        r && !r.error ? (r.data ?? []) : null;

      return {
        os:
          linhas(os)?.map((o) => ({
            id: o.id,
            numero: o.numero,
            status: o.status,
            updated_at: o.updated_at,
            previsao: o.previsao,
            aparelho: o.aparelho,
            cliente: o.clientes?.nome ?? null,
          })) ?? null,
        cobrancasVencidas: linhas(cobrancas),
        contasPagarVencidas: linhas(pagar),
        receberAtrasados: linhas(receber),
        estoqueBaixo: linhas(produtos)?.filter((p) => p.quantidade <= p.estoque_minimo) ?? null,
        agendaHoje: linhas(agenda),
        reclamacoes: reclamacoes ? reclamacoes.length : null,
        totais: { clientes: totais[0], os: totais[1], produtos: totais[2] },
      };
    },
  });

  const sugestoes = useMemo(() => {
    if (!dados) return [];
    const agora = new Date();
    return filtrarSugestoes(
      montarSugestoes({ ...dados, whatsappNaoLidas: whatsappNaoLidas ?? null }, agora),
      prefs,
      agora,
    );
  }, [dados, whatsappNaoLidas, prefs]);

  return { sugestoes, ligado, silenciado: silenciado(prefs), carregando: ligado && !dados };
}

/** "Depois" esconde por 3 horas; "Não mostrar mais" esconde de vez. */
const HORAS_DEPOIS = 3;
const PARA_SEMPRE = new Date("9999-12-31T00:00:00Z");

export function useAcoesSugestao() {
  const navigate = useNavigate();
  const { prefs, salvar } = usePreferenciasAssistente();
  return {
    abrir(acao: AcaoSugestao) {
      void navigate({ to: acao.to, search: acao.search ?? {} } as never);
    },
    depois(s: Sugestao) {
      const ate = new Date(Date.now() + HORAS_DEPOIS * 3_600_000);
      salvar({ dispensados: dispensar(prefs.dispensados, s.chave, ate) });
    },
    nuncaMais(s: Sugestao) {
      salvar({ dispensados: dispensar(prefs.dispensados, s.chave, PARA_SEMPRE) });
    },
  };
}
