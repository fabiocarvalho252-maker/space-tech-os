import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Download,
  FileText,
  Filter,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser, useEmpresaId, useProfile } from "@/hooks/useCurrentUser";
import { dataBR } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
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

const CATEGORIA_FATURAMENTO_OS = "Faturamento de OS";

// O faturamento de OS (RPC faturar_os) grava o lançamento na categoria que o
// usuário escolher — muitas empresas usam "Serviços" —, mas a descrição
// sempre termina em "— parcela N/M". Assim o filtro "Faturamento de OS"
// encontra as faturas de OS em qualquer categoria.
function ehFaturamentoOs(l: { tipo?: string; descricao?: string | null }) {
  return l.tipo === "entrada" && /— parcela \d+\/\d+$/.test(l.descricao ?? "");
}

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
  const { formatFinancialValue: brl } = useFinancialVisibility();
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

  // Custo dos serviços: o "Custo adicional" de cada serviço do cadastro
  // usado em OS ou venda vira uma saída automática, agrupada por OS/venda e
  // dia. Não é gravado em `lancamentos` — é calculado dos itens, então some
  // sozinho quando a OS/venda é cancelada e não conta em dobro no Dashboard
  // (CMV) nem nos Relatórios, que já somam esse custo à parte.
  const { data: custosServicos = [] } = useQuery({
    queryKey: ["financeiro-custos-servicos"],
    queryFn: async () => {
      const [osItens, vendaItens] = await Promise.all([
        supabase
          .from("os_itens")
          .select(
            "os_id, quantidade, created_at, produtos!inner(categoria, preco_custo), ordens_servico(numero, status)",
          )
          .eq("produtos.categoria", "Serviço"),
        supabase
          .from("venda_itens")
          .select(
            "venda_id, quantidade, created_at, produtos!inner(categoria, preco_custo), vendas(numero, status)",
          )
          .eq("produtos.categoria", "Serviço"),
      ]);
      if (osItens.error) throw osItens.error;
      if (vendaItens.error) throw vendaItens.error;

      type Item = {
        quantidade: number;
        created_at: string;
        produtos: { preco_custo: number } | null;
      };
      const grupos = new Map<string, any>();
      function somar(chave: string, descricao: string, item: Item, referencia: string) {
        const custo = Number(item.quantidade) * Number(item.produtos?.preco_custo ?? 0);
        if (custo <= 0) return;
        const data = format(new Date(item.created_at), "yyyy-MM-dd");
        const id = `custo-${chave}-${data}`;
        const atual = grupos.get(id) ?? {
          id,
          automatico: true,
          os_id: null as string | null,
          referencia,
          tipo: "saida",
          categoria: "Custo dos serviços",
          descricao,
          valor: 0,
          data,
          vencimento: data,
          created_at: item.created_at,
          status: "pago",
          bank_account_id: null,
        };
        atual.valor += custo;
        if (item.created_at > atual.created_at) atual.created_at = item.created_at;
        grupos.set(id, atual);
      }
      for (const i of (osItens.data ?? []) as any[]) {
        const os = i.ordens_servico;
        if (os && ["cancelado", "reprovado"].includes(os.status)) continue;
        somar(`os-${i.os_id}`, `Custo dos serviços — OS Nº ${os?.numero ?? "?"}`, i, "OS");
        const grupo = grupos.get(
          `custo-os-${i.os_id}-${format(new Date(i.created_at), "yyyy-MM-dd")}`,
        );
        if (grupo) grupo.os_id = i.os_id;
      }
      for (const i of (vendaItens.data ?? []) as any[]) {
        const venda = i.vendas;
        if (venda?.status === "cancelado") continue;
        somar(
          `venda-${i.venda_id}`,
          `Custo dos serviços — Venda #${venda?.numero ?? "?"}`,
          i,
          "Venda",
        );
      }
      return Array.from(grupos.values());
    },
  });

  // Liga cada lançamento gerado pelo faturamento de OS (parcelas e estornos)
  // à sua OS, para a lista mostrar uma linha só por OS com receita, custo e
  // lucro em vez de uma linha por parcela/custo.
  const { data: vinculosOs = new Map<string, { osId: string; numero: number | null }>() } =
    useQuery({
      queryKey: ["financeiro-vinculos-os"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("os_faturamento_parcelas" as any)
          .select(
            "lancamento_id, lancamento_estorno_id, os_faturamentos(os_id, ordens_servico(numero))",
          );
        if (error) throw error;
        const mapa = new Map<string, { osId: string; numero: number | null }>();
        for (const p of (data ?? []) as any[]) {
          const fat = p.os_faturamentos;
          if (!fat?.os_id) continue;
          const vinculo = { osId: fat.os_id, numero: fat.ordens_servico?.numero ?? null };
          if (p.lancamento_id) mapa.set(p.lancamento_id, vinculo);
          if (p.lancamento_estorno_id) mapa.set(p.lancamento_estorno_id, vinculo);
        }
        return mapa;
      },
    });

  const todosLancamentos = useMemo(
    () =>
      [...lancamentos, ...custosServicos].sort((a: any, b: any) =>
        b.created_at.localeCompare(a.created_at),
      ),
    [lancamentos, custosServicos],
  );

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
    return todosLancamentos.filter((l: any) => {
      const matchTipo = filtros.tipo === "todos" || l.tipo === filtros.tipo;
      const matchStatus = filtros.status === "todos" || l.status === filtros.status;
      const matchCategoria =
        filtros.categoria === "todas" ||
        l.categoria === filtros.categoria ||
        (filtros.categoria === CATEGORIA_FATURAMENTO_OS && ehFaturamentoOs(l));
      const matchConta = filtros.conta === "todas" || l.bank_account_id === filtros.conta;

      // Usa a coluna `data` (a data de negócio do lançamento, que pode ter
      // sido retroagida na Nova Venda/Nova OS) em vez de `created_at` (o
      // instante em que a linha foi gravada) — do contrário um lançamento
      // lançado hoje com data de ontem aparecia em "Hoje" em vez de "ontem".
      let matchPeriodo = true;
      if (filtros.periodo !== "todos" && l.data) {
        const hoje = new Date();
        if (filtros.periodo === "hoje") {
          matchPeriodo = l.data === format(hoje, "yyyy-MM-dd");
        } else if (filtros.periodo === "mes") {
          matchPeriodo = l.data.slice(0, 7) === format(hoje, "yyyy-MM");
        }
      }

      return matchTipo && matchStatus && matchCategoria && matchConta && matchPeriodo;
    });
  }, [todosLancamentos, filtros]);

  // Linhas da tabela: tudo que pertence a uma mesma OS (parcelas recebidas,
  // estornos e custo dos serviços) vira uma linha só, com receita, despesa e
  // lucro da OS. Os filtros acima continuam valendo por lançamento — a linha
  // da OS soma só os lançamentos que passaram no filtro.
  const [osAbertas, setOsAbertas] = useState<Set<string>>(new Set());
  const linhas = useMemo(() => {
    const porOs = new Map<string, any>();
    const resultado: any[] = [];
    for (const l of listaFiltrada as any[]) {
      const vinculo = vinculosOs.get(l.id);
      const osId = l.os_id ?? vinculo?.osId;
      if (!osId) {
        resultado.push(l);
        continue;
      }
      let grupo = porOs.get(osId);
      if (!grupo) {
        grupo = {
          id: `os-${osId}`,
          grupoOs: true,
          numero: vinculo?.numero ?? null,
          receita: 0,
          despesa: 0,
          itens: [] as any[],
          created_at: l.created_at,
          data: l.data,
          vencimento: l.vencimento ?? l.data,
        };
        porOs.set(osId, grupo);
        resultado.push(grupo);
      }
      if (grupo.numero == null) {
        grupo.numero = vinculo?.numero ?? l.descricao?.match(/OS Nº (\d+)/)?.[1] ?? null;
      }
      grupo.itens.push(l);
      if (l.status !== "cancelado") {
        if (l.tipo === "entrada") grupo.receita += Number(l.valor);
        else grupo.despesa += Number(l.valor);
      }
      if (l.created_at > grupo.created_at) grupo.created_at = l.created_at;
      const venc = l.vencimento ?? l.data;
      if (venc && (!grupo.vencimento || venc > grupo.vencimento)) grupo.vencimento = venc;
    }
    return resultado.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [listaFiltrada, vinculosOs]);

  // Opções do filtro: as categorias cadastradas em Configurações mais as que
  // aparecem nos lançamentos — antes só as usadas apareciam, e cada empresa
  // via "Faturamento de OS" ou "Serviços" dependendo de onde faturou.
  const opcoesCategoria = useMemo(
    () =>
      [
        ...new Set([
          CATEGORIA_FATURAMENTO_OS,
          ...categories.map((c) => c.nome),
          ...todosLancamentos.map((l: any) => l.categoria),
        ]),
      ]
        .filter(Boolean)
        .sort((a, b) => String(a).localeCompare(String(b), "pt-BR")),
    [categories, todosLancamentos],
  );

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
  const lucro = entradas - saidas;
  const margem = entradas > 0 ? (lucro / entradas) * 100 : 0;

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
                    Data: dataBR(l.data),
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
              {opcoesCategoria.map((c) => (
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
        <Resumo label="Receita (entradas)" valor={brl(entradas)} tone="success" />
        <Resumo label="Despesas (saídas)" valor={brl(saidas)} tone="destructive" />
        <Resumo
          label={lucro >= 0 ? "Lucro" : "Prejuízo"}
          valor={brl(lucro)}
          tone={lucro >= 0 ? "primary" : "destructive"}
          detalhe={entradas > 0 ? `Margem de ${margem.toFixed(1).replace(".", ",")}%` : undefined}
        />
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
              {linhas.map((l) =>
                l.grupoOs ? (
                  <LinhaOs
                    key={l.id}
                    grupo={l}
                    aberta={osAbertas.has(l.id)}
                    alternar={() =>
                      setOsAbertas((prev) => {
                        const nova = new Set(prev);
                        if (nova.has(l.id)) nova.delete(l.id);
                        else nova.add(l.id);
                        return nova;
                      })
                    }
                    brl={brl}
                    remover={(id) => remover.mutate(id)}
                  />
                ) : (
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
                      {(l as any).automatico ? (
                        <span
                          className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
                          title={`Calculado do custo dos serviços usados na ${(l as any).referencia}`}
                        >
                          Automático
                        </span>
                      ) : (
                        <button
                          onClick={() => remover.mutate(l.id)}
                          className="text-muted-foreground transition hover:text-destructive"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ),
              )}
              {!linhas.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
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

function LinhaOs({
  grupo,
  aberta,
  alternar,
  brl,
  remover,
}: {
  grupo: any;
  aberta: boolean;
  alternar: () => void;
  brl: (v: number) => string;
  remover: (id: string) => void;
}) {
  const lucro = grupo.receita - grupo.despesa;
  const pendente = grupo.itens.some((i: any) => i.status === "pendente");
  const cancelado = grupo.itens.every((i: any) => i.status === "cancelado");
  // OS com custo de serviço lançado mas sem faturamento ativo ainda não teve
  // receita — mostrar "Não faturada" em vez de um prejuízo que não existe.
  const naoFaturada = !grupo.itens.some(
    (i: any) => i.tipo === "entrada" && i.status !== "cancelado",
  );
  const rotulo = naoFaturada ? "Não faturada" : lucro >= 0 ? "Lucro" : "Prejuízo";
  const corValor = naoFaturada
    ? "text-amber-600 dark:text-amber-400"
    : lucro >= 0
      ? "text-primary"
      : "text-destructive";
  return (
    <>
      <tr className="cursor-pointer hover:bg-secondary/40" onClick={alternar}>
        <td className="px-4 py-3">
          <span className="flex items-center gap-2 font-medium">
            {aberta ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            OS Nº {grupo.numero ?? "?"}
          </span>
          <span className="mt-0.5 block pl-6 text-xs text-muted-foreground">
            Receita <span className="font-semibold text-success">{brl(grupo.receita)}</span>
            {" · "}
            Despesa <span className="font-semibold text-destructive">{brl(grupo.despesa)}</span>
          </span>
        </td>
        <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">Ordem de serviço</td>
        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">—</td>
        <td className="px-4 py-3 text-muted-foreground">
          {dataBR(grupo.vencimento || grupo.created_at)}
          {cancelado ? (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Cancelado
            </span>
          ) : (
            pendente && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Pendente
              </span>
            )
          )}
        </td>
        <td className={`px-4 py-3 text-right font-bold ${corValor}`}>
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {rotulo}
          </span>
          {naoFaturada ? `Custo ${brl(grupo.despesa)}` : brl(lucro)}
        </td>
        <td className="px-4 py-3 text-right">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {grupo.itens.length} {grupo.itens.length === 1 ? "item" : "itens"}
          </span>
        </td>
      </tr>
      {aberta &&
        grupo.itens.map((i: any) => (
          <tr key={i.id} className="bg-secondary/30 text-xs">
            <td className="py-2 pl-12 pr-4">
              <span className="flex items-center gap-2">
                {i.tipo === "entrada" ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                )}
                {i.descricao || "Lançamento"}
              </span>
            </td>
            <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">
              {i.categoria || "—"}
            </td>
            <td className="hidden px-4 py-2 text-muted-foreground md:table-cell">
              {i.bank_accounts?.banco || "—"}
            </td>
            <td className="px-4 py-2 text-muted-foreground">
              {dataBR(i.vencimento || i.created_at)}
              {i.status === "pendente" && " · Pendente"}
              {i.status === "cancelado" && " · Cancelado"}
            </td>
            <td
              className={`px-4 py-2 text-right font-semibold ${
                i.tipo === "entrada" ? "text-success" : "text-destructive"
              }`}
            >
              {i.tipo === "entrada" ? "+" : "−"} {brl(i.valor)}
            </td>
            <td className="px-4 py-2 text-right">
              {i.automatico ? (
                <span className="text-[10px] font-bold text-muted-foreground">Automático</span>
              ) : (
                <button
                  onClick={() => remover(i.id)}
                  className="text-muted-foreground transition hover:text-destructive"
                  aria-label="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </td>
          </tr>
        ))}
    </>
  );
}

function Resumo({
  label,
  valor,
  tone,
  detalhe,
}: {
  label: string;
  valor: string;
  tone: "success" | "destructive" | "primary";
  detalhe?: string | undefined;
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
      {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}
