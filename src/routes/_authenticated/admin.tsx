import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, ShieldAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { dataBR } from "@/lib/format";
import { listarEmpresasDoSite } from "@/lib/site-admin.functions";

const SITE_ADMIN_EMAIL = "admin@spacetech.app";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Administração do site — SpaceTech" }],
  }),
  component: AdminDoSite,
});

function haQuanto(iso: string | null) {
  if (!iso) return "Nunca";
  return formatDistanceToNow(new Date(iso), { locale: ptBR, addSuffix: true });
}

function AdminDoSite() {
  const { data: user, isLoading: carregandoUser } = useCurrentUser();
  const souAdmin = user?.email === SITE_ADMIN_EMAIL;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["site-admin-empresas"],
    queryFn: () => listarEmpresasDoSite(),
    enabled: souAdmin,
  });

  if (!carregandoUser && !souAdmin) {
    return (
      <div>
        <PageHeader title="Administração do site" subtitle="Acesso restrito" />
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Esta área é exclusiva do administrador do site."
        />
      </div>
    );
  }

  const empresas = data?.empresas ?? [];

  return (
    <div>
      <PageHeader
        title="Administração do site"
        subtitle="Todas as empresas cadastradas no SpaceTech e há quanto tempo estão ativas."
      />

      <SectionCard
        title="Empresas cadastradas"
        subtitle={`${empresas.length} no total`}
        icon={Building2}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Erro ao carregar empresas."}
          </p>
        ) : !empresas.length ? (
          <EmptyState icon={Users} title="Nenhuma empresa cadastrada ainda" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Empresa</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Cadastro</th>
                  <th className="px-3 py-2">Último acesso</th>
                  <th className="px-3 py-2 text-center">Equipe</th>
                  <th className="px-3 py-2 text-center">OS criadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {empresas.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/30">
                    <td className="px-3 py-3 font-medium">{e.loja || e.nome || "Sem nome"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{e.email || "—"}</td>
                    <td className="px-3 py-3">
                      <div>{dataBR(e.criadoEm)}</div>
                      <div className="text-xs text-muted-foreground">{haQuanto(e.criadoEm)}</div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{haQuanto(e.ultimoLogin)}</td>
                    <td className="px-3 py-3 text-center">{e.totalMembros}</td>
                    <td className="px-3 py-3 text-center">{e.totalOrdens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
