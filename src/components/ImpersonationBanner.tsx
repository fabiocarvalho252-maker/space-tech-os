import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { obterImpersonacao, limparImpersonacao } from "@/lib/impersonation";

export function ImpersonationBanner() {
  const [sessao] = useState(() => obterImpersonacao());
  const [voltando, setVoltando] = useState(false);

  if (!sessao) return null;

  async function voltar() {
    setVoltando(true);
    const { error } = await supabase.auth.setSession({
      access_token: sessao!.adminAccessToken,
      refresh_token: sessao!.adminRefreshToken,
    });
    limparImpersonacao();
    // Full reload either way: a fresh app boot re-reads whichever session
    // ended up in localStorage instead of trusting stale in-memory/query state.
    if (error) {
      await supabase.auth.signOut();
      window.location.href = "/";
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-600">
      <div className="flex items-center gap-2 font-medium">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>Modo administrador — você está vendo o painel de {sessao.empresaNome}.</span>
      </div>
      <button
        onClick={voltar}
        disabled={voltando}
        className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
      >
        {voltando ? "Voltando..." : "Voltar para administração"}
      </button>
    </div>
  );
}
