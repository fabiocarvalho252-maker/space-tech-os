import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Trash2,
  Download,
  FileText,
  Filter,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser, useEmpresaId, useProfile } from "@/hooks/useCurrentUser";
import { brl, dataBR } from "@/lib/format";
import { useMemo } from "react";
import { exportToCSV, generateFinancePDF } from "@/lib/exports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — SpaceTech" },
      { name: "description", content: "Entradas, saídas e saldo do caixa da sua assistência." },
      { property: "og:title", content: "Financeiro — SpaceTech" },
      { property: "og:description", content: "Fluxo de caixa simples e sempre atualizado." },
    ],
  }),
  component: Financeiro,
});

const vazio = {
  tipo: "entrada",
  categoria: "",
  descricao: "",
  valor: "0",
  bank_account_id: "",
  payment_method_id: "",
  status: "pago",
  vencimento: new Date().toISOString().split("T")[0],
};

function Financeiro() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(vazio);
  const [showFilters, setShowFilters] = useState(false);
  const [filtros, setFiltros] = useState({
    periodo: "todos",
    tipo: "todos",
    status: "todos",
    categoria: "todas",
    conta: "todas",
  });

  const { data: lancamentos = [] } = useQuery({
    queryKey: ["lancamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select(
          `
          *,
          bank_accounts (banco),
          payment_methods (nome)
        `,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["finance-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_categories" as any).select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts" as any).select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: methods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods" as any).select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const valor = Number(form.valor);
      if (!valor || valor <= 0) throw new Error("Informe um valor válido");
      const { error } = await supabase.from("lancamentos").insert({
        user_id: empresaId!,
        tipo: form.tipo,
        categoria: form.categoria || null,
        descricao: form.descricao || form.categoria || "Lançamento",
        valor,
        bank_account_id: form.bank_account_id || null,
        payment_method_id: form.payment_method_id || null,
        status: form.status,
        vencimento: form.vencimento || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento registrado");
      setForm(vazio);
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lancamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  const listaFiltrada = useMemo(() => {
    return lancamentos.filter((l: any) => {
      const matchTipo = filtros.tipo === "todos" || l.tipo === filtros.tipo;
      const matchStatus = filtros.status === "todos" || l.status === filtros.status;
      const matchCategoria = filtros.categoria === "todas" || l.categoria === filtros.categoria;
      const matchConta = filtros.conta === "todas" || l.bank_account_id === filtros.conta;

      let matchPeriodo = true;
      if (filtros.periodo !== "todos") {
        const data = new Date(l.created_at);
        const hoje = new Date();
        if (filtros.periodo === "hoje") {
          matchPeriodo = data.toDateString() === hoje.toDateString();
        } else if (filtros.periodo === "mes") {
          matchPeriodo =
            data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
        }
      }

      return matchTipo && matchStatus && matchCategoria && matchConta && matchPeriodo;
    });
  }, [lancamentos, filtros]);

  // Um lançamento cancelado (ex: venda cancelada em Vendas) continua na
  // lista para consulta/auditoria, mas nunca é dinheiro que entrou ou saiu
  // de verdade — não pode contar nos totais independente do filtro de
  // status escolhido acima.
  const entradas = listaFiltrada
    .filter((l) => l.tipo === "entrada" && l.status !== "cancelado")
    .reduce((s, l) => s + Number(l.valor), 0);
  const saidas = listaFiltrada
    .filter((l) => l.tipo === "saida" && l.status !== "cancelado")
    .reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Fluxo de caixa com entradas automáticas do PDV"
        action={
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 rounded-full ${showFilters ? "bg-primary/10 border-primary text-primary" : ""}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
              Filtros
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCSV(
                  listaFiltrada.map((l) => ({
                    Data: dataBR(l.created_at),
                    Descricao: l.descricao,
                    Categoria: l.categoria,
                    Tipo: l.tipo,
                    Valor: l.valor,
                  })),
                  "financeiro-spacetech",
                )
              }
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                generateFinancePDF(listaFiltrada, profile, {
                  entradas,
                  saidas,
                  saldo: entradas - saidas,
                })
              }
            >
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" /> Novo lançamento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo lançamento</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {["entrada", "saida"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setForm({ ...form, tipo: t })}
                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                          form.tipo === t
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input text-muted-foreground"
                        }`}
                      >
                        {t === "entrada" ? "Entrada" : "Saída"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Categoria</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={form.categoria || ""}
                        onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {categories
                          .filter((c) => c.tipo === form.tipo)
                          .map((c) => (
                            <option key={c.id} value={c.nome}>
                              {c.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Conta</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={form.bank_account_id || ""}
                        onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.banco}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Forma de Pagto</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={form.payment_method_id || ""}
                        onChange={(e) => setForm({ ...form, payment_method_id: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {methods.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Vencimento</Label>
                      <Input
                        type="date"
                        value={form.vencimento}
                        onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição</Label>
                    <Input
                      value={form.descricao || ""}
                      onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        <option value="pago">Pago / Recebido</option>
                        <option value="pendente">Pendente</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.valor}
                        onChange={(e) => setForm({ ...form, valor: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                  Registrar
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {showFilters && (
        <div className="mb-6 grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-5 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={filtros.periodo}
              onChange={(e) => setFiltros((prev) => ({ ...prev, periodo: e.target.value }))}
            >
              <option value="todos">Todos</option>
              <option value="hoje">Hoje</option>
              <option value="mes">Este Mês</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={filtros.tipo}
              onChange={(e) => setFiltros((prev) => ({ ...prev, tipo: e.target.value }))}
            >
              <option value="todos">Todos</option>
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={filtros.status}
              onChange={(e) => setFiltros((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="todos">Todos</option>
              <option value="pago">Pago / Recebido</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={filtros.categoria}
              onChange={(e) => setFiltros((prev) => ({ ...prev, categoria: e.target.value }))}
            >
              <option value="todas">Todas</option>
              {[...new Set(lancamentos.map((l) => l.categoria))].filter(Boolean).map((c) => (
                <option key={String(c)} value={String(c)}>
                  {String(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conta</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={filtros.conta}
              onChange={(e) => setFiltros((prev) => ({ ...prev, conta: e.target.value }))}
            >
              <option value="todas">Todas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.banco}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Resumo label="Entradas" valor={brl(entradas)} tone="success" />
        <Resumo label="Saídas" valor={brl(saidas)} tone="destructive" />
        <Resumo label="Saldo" valor={brl(entradas - saidas)} tone="primary" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Descrição</th>
                <th className="hidden px-4 py-3 sm:table-cell">Categoria</th>
                <th className="hidden px-4 py-3 md:table-cell">Conta</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listaFiltrada.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-medium">
                      {l.tipo === "entrada" ? (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      )}
                      {l.descricao || "Lançamento"}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {l.categoria || "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {(l as any).bank_accounts?.banco || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {dataBR((l as any).vencimento || l.created_at)}
                    {(l as any).status === "pendente" && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Pendente
                      </span>
                    )}
                    {(l as any).status === "cancelado" && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Cancelado
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold ${
                      l.tipo === "entrada" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {l.tipo === "entrada" ? "+" : "−"} {brl(l.valor)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remover.mutate(l.id)}
                      className="text-muted-foreground transition hover:text-destructive"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!listaFiltrada.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum lançamento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Resumo({
  label,
  valor,
  tone,
}: {
  label: string;
  valor: string;
  tone: "success" | "destructive" | "primary";
}) {
  const tones = {
    success: "text-success",
    destructive: "text-destructive",
    primary: "text-primary",
  } as const;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${tones[tone]}`}>{valor}</p>
    </div>
  );
}
