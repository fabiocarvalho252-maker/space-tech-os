// Cartão de um agente na grade da Equipe: avatar com iniciais, nome, cargo,
// setor e resumo. Clicar nele abre o perfil completo.
import type { AgentProfile } from "../equipe/tipos.ts";
import { corDoAvatar, iniciaisDoNome } from "../equipe/avatar.ts";
import { getAgentLabel } from "../rotulos.ts";

type Props = { perfil: AgentProfile; onAbrir: (agentId: string) => void };

export function AvatarAgente({ agentId, nome }: { agentId: string; nome: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${corDoAvatar(agentId)}`}
    >
      {iniciaisDoNome(nome)}
    </span>
  );
}

export function CartaoAgente({ perfil, onAbrir }: Props) {
  const nome = perfil.displayName.trim() || getAgentLabel(perfil.agentId);
  return (
    <button
      type="button"
      onClick={() => onAbrir(perfil.agentId)}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/60 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AvatarAgente agentId={perfil.agentId} nome={nome} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{nome}</span>
          {perfil.edited && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              editado por você
            </span>
          )}
        </span>
        <span className="truncate text-sm text-muted-foreground">{perfil.roleTitle}</span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {perfil.sector} · {perfil.kind === "skill" ? "Skill" : "Agente"}
        </span>
        <span className="line-clamp-1 text-sm">{perfil.summaryPtBr}</span>
      </span>
    </button>
  );
}
