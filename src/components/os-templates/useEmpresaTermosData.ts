import { useQuery } from "@tanstack/react-query";
import { useEmpresaId } from "@/hooks/useCurrentUser";
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
  Pick<RenderOsData, "condicoesTexto" | "termoGarantiaTexto" | "fotos" | "qrCodeUrl" | "duasVias">
> {
  const empresaId = useEmpresaId();

  const { data: osConfig } = useQuery({
    queryKey: ["os-config", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("os_config")
        .select(
          "termos_condicoes, exibir_fotos_impressao, imprimir_qrcode_cliente, imprimir_duas_vias",
        )
        .eq("user_id", empresaId!)
        .maybeSingle();
      return data as {
        termos_condicoes: string | null;
        exibir_fotos_impressao: boolean | null;
        imprimir_qrcode_cliente: boolean | null;
        imprimir_duas_vias: boolean | null;
      } | null;
    },
  });

  const { data: termoGarantia } = useQuery({
    queryKey: ["termo-garantia-padrao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("termos_garantia")
        .select("conteudo")
        .eq("user_id", empresaId!)
        .eq("is_default", true)
        .eq("ativo", true)
        .maybeSingle();
      return data as { conteudo: string } | null;
    },
  });

  return {
    // Fotos, QR Code e 2 vias seguem as chaves de Configurações → OS, como a
    // impressão e o PDF de verdade — a amostra antes mostrava fotos e QR
    // mesmo com eles desligados.
    ...(osConfig !== undefined
      ? {
          ...(osConfig?.exibir_fotos_impressao ? {} : { fotos: [] }),
          ...(osConfig?.imprimir_qrcode_cliente ? {} : { qrCodeUrl: null }),
          duasVias: !!osConfig?.imprimir_duas_vias,
        }
      : {}),
    ...(osConfig?.termos_condicoes ? { condicoesTexto: osConfig.termos_condicoes } : {}),
    ...(termoGarantia?.conteudo ? { termoGarantiaTexto: termoGarantia.conteudo } : {}),
  };
}
