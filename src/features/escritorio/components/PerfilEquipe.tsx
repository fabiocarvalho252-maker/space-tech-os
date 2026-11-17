// Painel do perfil de um agente: descrição em português, quando usar e o texto
// original do ECC. Editar abre o formulário; salvar atualiza a lista da equipe.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CHAVE_CONSULTA_EQUIPE, salvarPerfil, type DadosPerfilEquipe } from "../api/runner.ts";
import type { AgentProfile } from "../equipe/tipos.ts";
import type { ValoresEdicaoPerfil } from "../equipe/validacaoEdicao.ts";
import { getAgentLabel } from "../rotulos.ts";
import { AvatarAgente } from "./CartaoAgente.tsx";
import { FormularioPerfil } from "./FormularioPerfil.tsx";

type Props = { perfil: AgentProfile; perfis: readonly AgentProfile[] };

function extrairMensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Não foi possível salvar o perfil.";
}

function paraDadosEdicao(valores: ValoresEdicaoPerfil): DadosPerfilEquipe {
  return {
    displayName: valores.displayName.trim(),
    roleTitle: valores.roleTitle.trim(),
    summaryPtBr: valores.summaryPtBr.trim(),
    descriptionPtBr: valores.descriptionPtBr.trim(),
    sector: valores.sector.trim(),
    whenToUse: valores.whenToUse.map((item) => item.trim()),
  };
}

export function PerfilEquipe({ perfil, perfis }: Props) {
  const [editando, setEditando] = useState(false);
  const queryClient = useQueryClient();
  const nome = perfil.displayName.trim() || getAgentLabel(perfil.agentId);
  const nomesOutros = perfis.filter((p) => p.agentId !== perfil.agentId).map((p) => p.displayName);
  const setores = [...new Set(perfis.map((p) => p.sector))];

  const mutacao = useMutation({
    mutationFn: (valores: ValoresEdicaoPerfil) =>
      salvarPerfil(perfil.agentId, paraDadosEdicao(valores)),
    onSuccess: () => {
      setEditando(false);
      void queryClient.invalidateQueries({ queryKey: CHAVE_CONSULTA_EQUIPE });
    },
  });

  if (editando) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Editar {nome}</h2>
        <FormularioPerfil
          perfil={perfil}
          nomesOutros={nomesOutros}
          setores={setores}
          salvando={mutacao.isPending}
          erroSalvar={mutacao.isError ? extrairMensagem(mutacao.error) : null}
          onSalvar={(valores) => mutacao.mutate(valores)}
          onCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <AvatarAgente agentId={perfil.agentId} nome={nome} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-semibold">{nome}</h2>
          <p className="text-sm text-muted-foreground">{perfil.roleTitle}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{perfil.sector}</Badge>
            <Badge variant="outline">{perfil.kind === "skill" ? "Skill" : "Agente"}</Badge>
            {perfil.edited && <Badge>editado por você</Badge>}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
          <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Editar
        </Button>
      </header>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold">Resumo</h3>
        <p className="text-sm">{perfil.summaryPtBr}</p>
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold">Descrição</h3>
        <p className="whitespace-pre-line text-sm">{perfil.descriptionPtBr}</p>
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold">Quando usar</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {perfil.whenToUse.map((exemplo) => (
            <li key={exemplo}>{exemplo}</li>
          ))}
        </ul>
      </section>

      <details className="rounded-lg border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Ver original</summary>
        <p className="mt-2 whitespace-pre-line text-muted-foreground">
          {perfil.originalDescription}
        </p>
      </details>
    </div>
  );
}
