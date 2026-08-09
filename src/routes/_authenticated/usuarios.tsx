import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, Copy, UserPlus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser, useMinhaEmpresa, type Role } from "@/hooks/useCurrentUser";
import { dataBR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e Permissões — SpaceTech" },
      { name: "description", content: "Equipe, papéis e permissões por módulo." },
    ],
  }),
  component: Usuarios,
});

const ROLES_EDITAVEIS: { value: Role; label: string }[] = [
  { value: "gerente", label: "Gerente" },
  { value: "tecnico", label: "Técnico" },
  { value: "atendente", label: "Atendente" },
  { value: "financeiro", label: "Financeiro" },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  tecnico: "Técnico",
  atendente: "Atendente",
  financeiro: "Financeiro",
};

const MODULOS = [
  { value: "clientes", label: "Clientes" },
  { value: "fornecedores", label: "Fornecedores" },
  { value: "produtos", label: "Produtos e Serviços" },
  { value: "ordens", label: "Ordens de Serviço" },
  { value: "agenda", label: "Agenda" },
  { value: "vendas", label: "Vendas e PDV" },
  { value: "compras", label: "Compras" },
  { value: "seminovos", label: "Compra de Seminovos" },
  { value: "financeiro", label: "Financeiro" },
  { value: "cobrancas", label: "Cobranças" },
  { value: "garantia", label: "Garantias" },
  { value: "notas", label: "Notas Fiscais" },
  { value: "relatorios", label: "Relatórios" },
  { value: "configuracoes", label: "Configurações" },
];

function gerarCodigo() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function Usuarios() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: minhaEmpresa } = useMinhaEmpresa();
  const souDono = !!user && !!minhaEmpresa && minhaEmpresa.empresa_id === user.id;
  const empresaId = minhaEmpresa?.empresa_id;

  const [codigoInput, setCodigoInput] = useState("");
  const [conviteOpen, setConviteOpen] = useState(false);
  const [conviteRole, setConviteRole] = useState<Role>("atendente");
  const [conviteGerado, setConviteGerado] = useState<string | null>(null);

  const { data: membros = [] } = useQuery({
    queryKey: ["empresa-membros", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_empresa_membros", {
        p_empresa_id: empresaId as string,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: convites = [] } = useQuery({
    queryKey: ["empresa-convites", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa_convites")
        .select("*")
        .eq("empresa_id", empresaId as string)
        .is("usado_em", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId && souDono,
  });

  const { data: permissoesMatriz = [] } = useQuery({
    queryKey: ["role-permissions", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("empresa_id", empresaId as string);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const entrar = useMutation({
    mutationFn: async () => {
      if (!codigoInput.trim()) throw new Error("Informe o código do convite");
      const { error } = await supabase.rpc("aceitar_convite", { p_codigo: codigoInput.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite aceito! Recarregando sua empresa...");
      setCodigoInput("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convidar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      const codigo = gerarCodigo();
      const expira_em = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("empresa_convites").insert({
        codigo,
        empresa_id: user.id,
        criado_por: user.id,
        permissao: conviteRole,
        expira_em,
      });
      if (error) throw error;
      return codigo;
    },
    onSuccess: (codigo) => {
      setConviteGerado(codigo);
      qc.invalidateQueries({ queryKey: ["empresa-convites", empresaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alterarRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("user_empresas")
        .update({ role })
        .eq("user_id", userId)
        .eq("empresa_id", empresaId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["empresa-membros", empresaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerMembro = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_empresas")
        .delete()
        .eq("user_id", userId)
        .eq("empresa_id", empresaId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro removido");
      qc.invalidateQueries({ queryKey: ["empresa-membros", empresaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelarConvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("empresa_convites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresa-convites", empresaId] });
    },
  });

  const atualizarPermissao = useMutation({
    mutationFn: async ({
      role,
      modulo,
      pode_ver,
      pode_gerenciar,
    }: {
      role: string;
      modulo: string;
      pode_ver: boolean;
      pode_gerenciar: boolean;
    }) => {
      if (!empresaId) return;
      const { error } = await supabase
        .from("role_permissions")
        .upsert(
          { empresa_id: empresaId, role, modulo, pode_ver, pode_gerenciar },
          { onConflict: "empresa_id,role,modulo" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-permissions", empresaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function permissao(role: string, modulo: string) {
    return (
      permissoesMatriz.find((p) => p.role === role && p.modulo === modulo) ?? {
        pode_ver: false,
        pode_gerenciar: false,
      }
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários e Permissões"
        subtitle={
          minhaEmpresa
            ? `Sua função: ${ROLE_LABEL[minhaEmpresa.role] ?? minhaEmpresa.role}`
            : "Equipe, papéis e permissões por módulo"
        }
        action={
          souDono && (
            <Dialog
              open={conviteOpen}
              onOpenChange={(v) => {
                setConviteOpen(v);
                if (!v) setConviteGerado(null);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4" /> Convidar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar para a equipe</DialogTitle>
                </DialogHeader>
                {!conviteGerado ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>Papel</Label>
                      <Select value={conviteRole} onValueChange={(v) => setConviteRole(v as Role)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES_EDITAVEIS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => convidar.mutate()} disabled={convidar.isPending}>
                      Gerar código de convite
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Compartilhe este código com a pessoa convidada. Ele expira em 7 dias.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={conviteGerado}
                        className="font-mono text-lg tracking-widest"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(conviteGerado);
                          toast.success("Código copiado");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" /> Entrar com código de convite
        </h2>
        <div className="flex max-w-md items-center gap-2">
          <Input
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
            placeholder="Código do convite"
            className="font-mono tracking-widest"
          />
          <Button onClick={() => entrar.mutate()} disabled={entrar.isPending}>
            Entrar
          </Button>
        </div>
      </div>

      {empresaId && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-bold">Equipe</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Papel</th>
                <th className="hidden px-4 py-3 sm:table-cell">Desde</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {membros.map((m) => (
                <tr key={m.user_id}>
                  <td className="px-4 py-3 font-medium">{m.email}</td>
                  <td className="px-4 py-3">
                    {souDono && m.user_id !== user?.id ? (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          alterarRole.mutate({ userId: m.user_id, role: e.target.value })
                        }
                        className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium"
                      >
                        {ROLES_EDITAVEIS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {dataBR(m.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {souDono && m.user_id !== user?.id && (
                      <button
                        onClick={() => removerMembro.mutate(m.user_id)}
                        className="text-muted-foreground transition hover:text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!membros.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando equipe...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {souDono && convites.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-bold">Convites pendentes</h2>
          </div>
          <div className="divide-y divide-border">
            {convites.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold tracking-widest">{c.codigo}</span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABEL[c.permissao] ?? c.permissao} · expira em {dataBR(c.expira_em)}
                  </span>
                </div>
                <button
                  onClick={() => cancelarConvite.mutate(c.id)}
                  className="text-muted-foreground transition hover:text-destructive"
                  aria-label="Cancelar convite"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {souDono && empresaId && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-bold">Permissões por módulo</h2>
            <p className="text-xs text-muted-foreground">
              "Ver" permite consultar o módulo; "Gerenciar" permite criar, editar e excluir.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Módulo</th>
                  {ROLES_EDITAVEIS.map((r) => (
                    <th key={r.value} className="px-4 py-3 text-center">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MODULOS.map((m) => (
                  <tr key={m.value}>
                    <td className="px-4 py-3 font-medium">{m.label}</td>
                    {ROLES_EDITAVEIS.map((r) => {
                      const p = permissao(r.value, m.value);
                      return (
                        <td key={r.value} className="px-4 py-3">
                          <div className="flex items-center justify-center gap-4">
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Checkbox
                                checked={p.pode_ver}
                                onCheckedChange={(checked) =>
                                  atualizarPermissao.mutate({
                                    role: r.value,
                                    modulo: m.value,
                                    pode_ver: !!checked,
                                    pode_gerenciar: checked ? p.pode_gerenciar : false,
                                  })
                                }
                              />
                              Ver
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Checkbox
                                checked={p.pode_gerenciar}
                                onCheckedChange={(checked) =>
                                  atualizarPermissao.mutate({
                                    role: r.value,
                                    modulo: m.value,
                                    pode_ver: checked ? true : p.pode_ver,
                                    pode_gerenciar: !!checked,
                                  })
                                }
                              />
                              Gerenciar
                            </label>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!souDono && minhaEmpresa && (
        <p className="text-sm text-muted-foreground">
          Somente o administrador da empresa gerencia a equipe e as permissões.
        </p>
      )}
    </div>
  );
}
