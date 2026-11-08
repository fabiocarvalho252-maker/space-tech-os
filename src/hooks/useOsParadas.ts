// OS paradas (sem mudar de status há X dias — Configurações → OS). Usado no
// sininho e no selo "Parada" da lista de OS. RLS limita à empresa.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export type OsParada = { os_id: string; numero: number; status: string; dias: number };

export async function buscarOsParadas(): Promise<OsParada[]> {
  const { data: cfg } = await supabase
    .from("os_config")
    .select("dias_alerta_os_parada")
    .maybeSingle();
  const dias = cfg?.dias_alerta_os_parada ?? 5;
  if (dias <= 0) return [];
  const { data, error } = await supabase.rpc("os_paradas", { p_dias: dias });
  if (error) throw error;
  return data ?? [];
}

export function useOsParadas() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["os-paradas"],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: buscarOsParadas,
  });
}
