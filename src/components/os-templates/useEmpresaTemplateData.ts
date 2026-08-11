import { useMemo } from "react";
import { useProfile } from "@/hooks/useCurrentUser";
import type { RenderOsData } from "@/lib/os-template-render";

// Maps the empresa's real profile (logo, razão social, etc.) into the shape
// the render engine expects — shared by every template thumbnail/preview so
// they reflect the user's actual branding instead of a generic placeholder.
export function useEmpresaTemplateData(): RenderOsData["empresa"] {
  const { data: profile } = useProfile();
  return useMemo(
    () => ({
      nome: (profile as any)?.loja || (profile as any)?.nome || "Sua Empresa",
      logoUrl: (profile as any)?.logo_url ?? null,
      cnpj: (profile as any)?.cnpj_cpf ?? null,
      endereco: (profile as any)?.endereco ?? null,
      telefone: (profile as any)?.whatsapp ?? null,
      responsavel: null,
    }),
    [profile],
  );
}
