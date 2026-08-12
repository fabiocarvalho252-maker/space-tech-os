import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import type { RenderOsData } from "@/lib/os-template-render";

// Same idea as useEmpresaTemplateData (real branding instead of a generic
// placeholder), for the two company-level text fields buildSampleOsRenderData
// otherwise hardcodes to short unrelated sample copy: "Termos e condições"
// (os_config.termos_condicoes) and the default "Termo de garantia". Both are
// per-empresa settings, not per-OS, so — unlike cliente/aparelho/itens, which
// have no single "real" value to preview with — there's always a genuine
// value to show once the empresa has saved one in Configurações → OS /
// Termos de Garantia. Falls back to `undefined` (spread away, sample copy
// wins) only when the empresa hasn't saved either yet.
export function useEmpresaTermosData(): Partial<
  Pick<RenderOsData, "condicoesTexto" | "termoGarantiaTexto">
> {
  const { data: user } = useCurrentUser();

  const { data: osConfig } = useQuery({
    queryKey: ["os-config", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("os_config" as any)
        .select("termos_condicoes")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as { termos_condicoes: string | null } | null;
    },
  });

  const { data: termoGarantia } = useQuery({
    queryKey: ["termo-garantia-padrao", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("termos_garantia")
        .select("conteudo")
        .eq("user_id", user!.id)
        .eq("is_default", true)
        .maybeSingle();
      return data as { conteudo: string } | null;
    },
  });

  return {
    ...(osConfig?.termos_condicoes ? { condicoesTexto: osConfig.termos_condicoes } : {}),
    ...(termoGarantia?.conteudo ? { termoGarantiaTexto: termoGarantia.conteudo } : {}),
  };
}
