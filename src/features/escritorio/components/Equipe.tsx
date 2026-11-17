// Aba Equipe do escritório: grade de agentes e skills em português, com busca e
// filtros por setor e tipo. Clicar num cartão abre o perfil em um diálogo.
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, SearchX, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CHAVE_CONSULTA_EQUIPE, listarEquipe } from "../api/runner.ts";
import {
  FILTROS_PADRAO,
  FILTRO_TODOS,
  filtrarPerfis,
  listarSetores,
  type FiltrosEquipe,
} from "../equipe/filtros.ts";
import type { TipoEquipe } from "../equipe/tipos.ts";
import { CartaoAgente } from "./CartaoAgente.tsx";
import { PerfilEquipe } from "./PerfilEquipe.tsx";

const CLASSE_CAMPO = "h-9 rounded-md border border-input bg-background px-3 text-sm";

function extrairMensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Erro desconhecido.";
}

export function Equipe() {
  const consulta = useQuery({
    queryKey: CHAVE_CONSULTA_EQUIPE,
    queryFn: async () => (await listarEquipe()).perfis,
  });
  const [filtros, setFiltros] = useState<FiltrosEquipe>(FILTROS_PADRAO);
  const [agenteAberto, setAgenteAberto] = useState<string | null>(null);

  const perfis = useMemo(() => consulta.data ?? [], [consulta.data]);
  const setores = useMemo(() => listarSetores(perfis), [perfis]);
  const visiveis = useMemo(() => filtrarPerfis(perfis, filtros), [perfis, filtros]);
  const perfilAberto = perfis.find((p) => p.agentId === agenteAberto) ?? null;

  if (consulta.isLoading) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Carregando equipe…
      </p>
    );
  }
  if (consulta.isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center"
      >
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
        <p className="font-medium">Não foi possível carregar a equipe</p>
        <p className="text-sm text-muted-foreground">{extrairMensagem(consulta.error)}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void consulta.refetch()}
          disabled={consulta.isFetching}
        >
          {consulta.isFetching ? "Tentando…" : "Tentar de novo"}
        </Button>
      </div>
    );
  }
  if (perfis.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center">
        <Users className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">Nenhum agente na equipe ainda</p>
        <p className="text-sm text-muted-foreground">
          Os agentes do ECC aparecem aqui assim que forem carregados.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          type="search"
          aria-label="Buscar na equipe"
          placeholder="Buscar por nome, cargo ou resumo"
          value={filtros.busca}
          onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
          className="sm:col-span-3"
        />
        <select
          aria-label="Filtrar por setor"
          className={CLASSE_CAMPO}
          value={filtros.setor}
          onChange={(e) => setFiltros((f) => ({ ...f, setor: e.target.value }))}
        >
          <option value={FILTRO_TODOS}>Todos os setores</option>
          {setores.map((setor) => (
            <option key={setor} value={setor}>
              {setor}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por tipo"
          className={CLASSE_CAMPO}
          value={filtros.tipo}
          onChange={(e) =>
            setFiltros((f) => ({ ...f, tipo: e.target.value as TipoEquipe | typeof FILTRO_TODOS }))
          }
        >
          <option value={FILTRO_TODOS}>Agentes e skills</option>
          <option value="agent">Só agentes</option>
          <option value="skill">Só skills</option>
        </select>
      </div>

      {visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center">
          <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Nenhum resultado</p>
          <p className="text-sm text-muted-foreground">Ajuste a busca ou os filtros.</p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {visiveis.map((perfil) => (
            <li key={perfil.agentId}>
              <CartaoAgente perfil={perfil} onAbrir={setAgenteAberto} />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={perfilAberto !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setAgenteAberto(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{perfilAberto?.displayName ?? "Perfil"}</DialogTitle>
            <DialogDescription>Perfil do agente na equipe</DialogDescription>
          </DialogHeader>
          {perfilAberto && <PerfilEquipe perfil={perfilAberto} perfis={perfis} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
