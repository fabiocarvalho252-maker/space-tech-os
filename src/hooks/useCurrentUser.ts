import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export const DIAS_TESTE = 7;

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
    staleTime: 60_000,
  });
}

export function useProfile() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
}

export type Role = "admin" | "gerente" | "tecnico" | "atendente" | "financeiro";

/** Which company the current login acts under, and their role in it. Every
 * signup automatically owns its own (usually empty) company, but someone who
 * accepted an invite elsewhere almost certainly means to work in *that*
 * company, not their own placeholder one — so an outside membership wins
 * over self-ownership. Null means no membership exists at all (shouldn't
 * normally happen once signed up, since every profile gets a self-row). */
export function useMinhaEmpresa() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["minha-empresa", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_empresas")
        .select("empresa_id, role")
        .eq("user_id", user!.id);
      if (error) throw error;
      if (!data?.length) return null;
      const convidada = data.find((m) => m.empresa_id !== user!.id);
      const propria = data.find((m) => m.empresa_id === user!.id);
      return (convidada ?? propria ?? data[0]) as { empresa_id: string; role: Role };
    },
  });
}

export function useUserRole() {
  const { data: empresa } = useMinhaEmpresa();
  return useQuery({
    queryKey: ["user-role", empresa?.empresa_id, empresa?.role],
    enabled: !!empresa,
    queryFn: async () => empresa!.role,
  });
}

/** The full ver/gerenciar matrix for the current login's role, keyed by
 * module. Company owners get an implicit all-true matrix without a query,
 * matching the has_permission() shortcut enforced server-side. */
export function usePermissoes() {
  const { data: user } = useCurrentUser();
  const { data: empresa } = useMinhaEmpresa();
  const souDono = !!user && !!empresa && empresa.empresa_id === user.id;

  return useQuery({
    queryKey: ["permissoes", empresa?.empresa_id, empresa?.role],
    enabled: !!empresa,
    queryFn: async () => {
      if (souDono) return null; // null = full access, checked by callers
      const { data, error } = await supabase
        .from("role_permissions")
        .select("modulo, pode_ver, pode_gerenciar")
        .eq("empresa_id", empresa!.empresa_id)
        .eq("role", empresa!.role);
      if (error) throw error;
      const mapa: Record<string, { ver: boolean; gerenciar: boolean }> = {};
      for (const p of data ?? []) {
        mapa[p.modulo] = { ver: p.pode_ver, gerenciar: p.pode_gerenciar };
      }
      return mapa;
    },
  });
}

/** Trial status for the company the current login acts under (the owner's
 * profile.created_at is the trial's start, regardless of whether the caller
 * is the owner or an invited team member — the whole company loses access
 * together, since that's who the trial actually belongs to). */
export function useTrialStatus() {
  const { data: minhaEmpresa } = useMinhaEmpresa();
  return useQuery({
    queryKey: ["trial-status", minhaEmpresa?.empresa_id],
    enabled: !!minhaEmpresa?.empresa_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("created_at, plano, acesso_ate")
        .eq("id", minhaEmpresa!.empresa_id)
        .maybeSingle();
      if (error) throw error;
      const plano = data?.plano ?? "trial";
      const acessoAte = data?.acesso_ate;

      if (plano === "vitalicio") return { diasRestantes: Infinity, expirado: false };
      if (plano === "suspenso") return { diasRestantes: -1, expirado: true };
      if (["mensal", "trimestral", "semestral", "anual"].includes(plano)) {
        if (!acessoAte) return { diasRestantes: Infinity, expirado: false };
        const diasRestantes = differenceInCalendarDays(new Date(acessoAte), new Date());
        return { diasRestantes, expirado: diasRestantes < 0 };
      }

      if (!data?.created_at) return { diasRestantes: DIAS_TESTE, expirado: false };
      const diasDecorridos = differenceInCalendarDays(new Date(), new Date(data.created_at));
      const diasRestantes = DIAS_TESTE - diasDecorridos;
      return { diasRestantes, expirado: diasRestantes < 0 };
    },
  });
}

export function podeVer(
  permissoes: Record<string, { ver: boolean; gerenciar: boolean }> | null | undefined,
  modulo: string,
) {
  if (permissoes === null) return true; // dono da empresa: acesso total
  if (!permissoes) return true; // ainda carregando: não esconder de forma otimista
  return !!permissoes[modulo]?.ver;
}

export function podeGerenciar(
  permissoes: Record<string, { ver: boolean; gerenciar: boolean }> | null | undefined,
  modulo: string,
) {
  if (permissoes === null) return true; // dono da empresa: acesso total
  if (!permissoes) return false; // ainda carregando: não oferecer ações de escrita otimisticamente
  return !!permissoes[modulo]?.gerenciar;
}
