// Auditoria: quem criou, alterou ou apagou o quê, e quando. Os registros são
// gravados por gatilho no banco (migration 20261028220000_auditoria) e só o
// dono da empresa e administradores conseguem ler (RLS de audit_log).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronRight, History, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser, useEmpresaId, useMinhaEmpresa } from "@/hooks/useCurrentUser";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — SpaceTech" },
      { name: "description", content: "Quem criou, alterou ou apagou cada registro." },
    ],
  }),
  component: Auditoria,
});

const POR_PAGINA = 50;

const TABELAS: Record<string, string> = {
  clientes: "Clientes",
  fornecedores: "Fornecedores",
  produtos: "Produtos e serviços",
  ordens_servico: "Ordens de serviço",
  vendas: "Vendas",
  compras: "Compras",
  lancamentos: "Financeiro",
  cobrancas: "Cobranças",
  seminovos: "Seminovos",
  crediario_contratos: "Crediário",
  termos_garantia: "Termos de garantia",
  agendamentos: "Agenda",
  user_empresas: "Equipe",
  role_permissions: "Permissões",
  empresa_convites: "Convites",
  os_config: "Configurações da OS",
  sale_config: "Configurações de venda",
  estoque_config: "Configurações de estoque",
  pagamento_config: "Mercado Pago",
  profiles: "Dados da empresa",
};

const ACOES: Record<string, { label: string; cor: string }> = {
  criou: { label: "Criou", cor: "bg-emerald-500/10 text-emerald-600" },
  alterou: { label: "Alterou", cor: "bg-amber-500/10 text-amber-600" },
  apagou: { label: "Apagou", cor: "bg-destructive/10 text-destructive" },
};

// Campos técnicos que não ajudam quem lê a auditoria.
const CAMPOS_OCULTOS = new Set(["id", "user_id", "empresa_id", "created_at", "updated_at"]);

type Registro = {
  id: number;
  created_at: string;
  ator_nome: string | null;
  ator_id: string | null;
  tabela: string;
  acao: string;
  rotulo: string | null;
  alteracoes: Json | null;
};

function nomeCampo(campo: string): string {
  const t = campo.replace(/_id$/, "").replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function valorLegivel(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("pt-BR");
    return v.length > 120 ? `${v.slice(0, 120)}…` : v;
  }
  const json = JSON.stringify(v);
  return json.length > 120 ? `${json.slice(0, 120)}…` : json;
}

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Auditoria() {
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const { data: minhaEmpresa, isLoading: carregandoPapel } = useMinhaEmpresa();
  const podeVer =
    !!user &&
    !!minhaEmpresa &&
    (minhaEmpresa.empresa_id === user.id || minhaEmpresa.role === "admin");

  const [tabela, setTabela] = useState("todas");
  const [acao, setAcao] = useState("todas");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [aberto, setAberto] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["auditoria", empresaId, tabela, acao, de, ate, busca, pagina],
    enabled: !!empresaId && podeVer,
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("id, created_at, ator_nome, ator_id, tabela, acao, rotulo, alteracoes", {
          count: "exact",
        })
        .eq("user_id", empresaId!)
        .order("created_at", { ascending: false })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
      if (tabela !== "todas") q = q.eq("tabela", tabela);
      if (acao !== "todas") q = q.eq("acao", acao);
      if (de) q = q.gte("created_at", new Date(`${de}T00:00:00-03:00`).toISOString());
      if (ate) q = q.lte("created_at", new Date(`${ate}T23:59:59-03:00`).toISOString());
      const termo = busca.trim().replace(/[%,()]/g, " ");
      if (termo) q = q.or(`rotulo.ilike.%${termo}%,ator_nome.ilike.%${termo}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { linhas: (data ?? []) as Registro[], total: count ?? 0 };
    },
  });

  const linhas = data?.linhas ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  function mudarFiltro(fn: () => void) {
    fn();
    setPagina(0);
    setAberto(null);
  }

  if (!carregandoPapel && !podeVer) {
    return (
      <div>
        <PageHeader title="Auditoria" subtitle="Histórico de alterações do sistema" />
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Só o dono da empresa e administradores veem a auditoria."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Auditoria"
        subtitle="Quem criou, alterou ou apagou cada registro — guardado por 1 ano"
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <SearchInput
          value={busca}
          onChange={(v) => mudarFiltro(() => setBusca(v))}
          placeholder="Buscar por registro ou pessoa..."
          className="w-full max-w-xs"
        />
        <Select value={tabela} onValueChange={(v) => mudarFiltro(() => setTabela(v))}>
          <SelectTrigger className="h-9 w-auto min-w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os módulos</SelectItem>
            {Object.entries(TABELAS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={acao} onValueChange={(v) => mudarFiltro(() => setAcao(v))}>
          <SelectTrigger className="h-9 w-auto min-w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ações</SelectItem>
            {Object.entries(ACOES).map(([v, a]) => (
              <SelectItem key={v} value={v}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          De
          <Input
            type="date"
            value={de}
            onChange={(e) => mudarFiltro(() => setDe(e.target.value))}
            className="h-9 w-[150px]"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Até
          <Input
            type="date"
            value={ate}
            onChange={(e) => mudarFiltro(() => setAte(e.target.value))}
            className="h-9 w-[150px]"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {isLoading || carregandoPapel ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : isError ? (
          <div className="px-4 py-10 text-center">
            <p className="mb-2 text-sm text-destructive">Não foi possível carregar a auditoria.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : !linhas.length ? (
          <div className="p-4">
            <EmptyState
              icon={History}
              title="Nada registrado"
              description="As alterações feitas a partir de agora aparecem aqui."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {linhas.map((r) => {
              const a = ACOES[r.acao] ?? { label: r.acao, cor: "bg-muted text-muted-foreground" };
              const expandido = aberto === r.id;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => setAberto(expandido ? null : r.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-secondary/30"
                  >
                    {expandido ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.cor}`}
                        >
                          {a.label}
                        </span>
                        <span className="font-medium">{TABELAS[r.tabela] ?? r.tabela}</span>
                        {r.rotulo && <span className="truncate">· {r.rotulo}</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {dataHora(r.created_at)} ·{" "}
                        {r.ator_nome || (r.ator_id ? "Usuário" : "Sistema")}
                        {r.acao === "alterou" && r.alteracoes && typeof r.alteracoes === "object"
                          ? ` · ${Object.keys(r.alteracoes).map(nomeCampo).join(", ")}`
                          : ""}
                      </span>
                    </span>
                  </button>
                  {expandido && <Detalhe registro={r} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {total > POR_PAGINA && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {pagina + 1} de {totalPaginas} · {total} registros
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pagina === 0}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagina + 1 >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detalhe({ registro }: { registro: Registro }) {
  const dados =
    registro.alteracoes &&
    typeof registro.alteracoes === "object" &&
    !Array.isArray(registro.alteracoes)
      ? (registro.alteracoes as Record<string, unknown>)
      : {};

  if (registro.acao === "alterou") {
    return (
      <div className="overflow-x-auto px-4 pb-4 pl-11">
        <table className="w-full min-w-[420px] text-xs">
          <thead className="text-left uppercase text-muted-foreground">
            <tr>
              <th className="pb-1.5 pr-3">Campo</th>
              <th className="pb-1.5 pr-3">Antes</th>
              <th className="pb-1.5">Depois</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Object.entries(dados).map(([campo, par]) => {
              const [antes, depois] = Array.isArray(par) ? par : [undefined, par];
              return (
                <tr key={campo}>
                  <td className="py-1.5 pr-3 font-medium">{nomeCampo(campo)}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground line-through decoration-destructive/40">
                    {valorLegivel(antes)}
                  </td>
                  <td className="py-1.5">{valorLegivel(depois)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const campos = Object.entries(dados).filter(
    ([k, v]) =>
      !CAMPOS_OCULTOS.has(k) && v !== null && v !== "" && !(Array.isArray(v) && !v.length),
  );
  return (
    <dl className="grid gap-x-6 gap-y-1.5 px-4 pb-4 pl-11 text-xs sm:grid-cols-2">
      {campos.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="shrink-0 text-muted-foreground">{nomeCampo(k)}:</dt>
          <dd className="min-w-0 break-words">{valorLegivel(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
