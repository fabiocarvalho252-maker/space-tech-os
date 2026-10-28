// Contas Bancárias: saldo de cada conta (saldo inicial + lançamentos pagos),
// entradas e saídas do período, conta padrão e em qual conta cai cada forma
// de pagamento. Lançamento novo sem conta recebe a conta sozinho no banco
// (gatilho lancamentos_definir_conta, migration 20261028230000).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Banknote, Landmark, Pencil, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useEmpresaId, usePermissoes, podeGerenciar } from "@/hooks/useCurrentUser";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MoneyInput } from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/contas-bancarias")({
  head: () => ({
    meta: [
      { title: "Contas Bancárias — SpaceTech" },
      { name: "description", content: "Saldo de cada conta e para onde vai cada pagamento." },
    ],
  }),
  component: ContasBancarias,
});

const TIPOS = ["Conta corrente", "Poupança", "Caixa da loja", "Carteira digital", "Maquininha"];
const SEM_CONTA = "__sem_conta__";

type Conta = {
  id: string;
  banco: string;
  agencia: string | null;
  conta: string | null;
  tipo: string | null;
  saldo_inicial: number | null;
  padrao: boolean;
};

const formVazio = { banco: "", tipo: "Conta corrente", agencia: "", conta: "", saldo_inicial: "0" };

function ContasBancarias() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "financeiro");

  const hoje = new Date();
  const [inicio, setInicio] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [fim, setFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [editando, setEditando] = useState<Conta | "nova" | null>(null);
  const [form, setForm] = useState(formVazio);
  const [destinoLote, setDestinoLote] = useState("");
  const [confirmarLote, setConfirmarLote] = useState(false);

  const { data: contas = [], isLoading: carregandoContas } = useQuery({
    queryKey: ["contas-bancarias", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, banco, agencia, conta, tipo, saldo_inicial, padrao")
        .eq("user_id", empresaId!)
        .order("padrao", { ascending: false })
        .order("banco");
      if (error) throw error;
      return data as Conta[];
    },
  });

  const { data: saldos = [], isLoading: carregandoSaldos } = useQuery({
    queryKey: ["contas-bancarias-saldos", empresaId, inicio, fim],
    enabled: !!empresaId && !!inicio && !!fim,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("saldos_contas_bancarias", {
        p_empresa: empresaId!,
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: formas = [] } = useQuery({
    queryKey: ["formas-pagamento-contas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("id, nome, bank_account_id")
        .eq("user_id", empresaId!)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const saldoPorConta = useMemo(
    () => new Map(saldos.map((s) => [s.bank_account_id ?? SEM_CONTA, s])),
    [saldos],
  );
  const semConta = saldoPorConta.get(SEM_CONTA);
  const saldoTotal = contas.reduce(
    (t, c) =>
      t + Number(c.saldo_inicial ?? 0) + Number(saldoPorConta.get(c.id)?.movimento_total ?? 0),
    0,
  );

  function invalidar() {
    void qc.invalidateQueries({ queryKey: ["contas-bancarias"] });
    void qc.invalidateQueries({ queryKey: ["contas-bancarias-saldos"] });
    void qc.invalidateQueries({ queryKey: ["formas-pagamento-contas"] });
    void qc.invalidateQueries({ queryKey: ["bank_accounts"] });
  }

  function abrir(c: Conta | "nova") {
    setForm(
      c === "nova"
        ? formVazio
        : {
            banco: c.banco,
            tipo: c.tipo || "Conta corrente",
            agencia: c.agencia ?? "",
            conta: c.conta ?? "",
            saldo_inicial: String(c.saldo_inicial ?? 0),
          },
    );
    setEditando(c);
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.banco.trim()) throw new Error("Informe o nome da conta ou do banco.");
      const payload = {
        banco: form.banco.trim(),
        tipo: form.tipo,
        agencia: form.agencia.trim() || null,
        conta: form.conta.trim() || null,
        saldo_inicial: Number(form.saldo_inicial) || 0,
      };
      const { error } =
        editando === "nova"
          ? await supabase
              .from("bank_accounts")
              // A primeira conta já vira a padrão.
              .insert({ ...payload, user_id: empresaId!, padrao: contas.length === 0 })
          : await supabase
              .from("bank_accounts")
              .update(payload)
              .eq("id", (editando as Conta).id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editando === "nova" ? "Conta criada" : "Conta atualizada");
      setEditando(null);
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tornarPadrao = useMutation({
    mutationFn: async (id: string) => {
      // Índice único: tira a padrão atual antes de marcar a nova.
      const { error: e1 } = await supabase
        .from("bank_accounts")
        .update({ padrao: false })
        .eq("user_id", empresaId!)
        .eq("padrao", true);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("bank_accounts")
        .update({ padrao: true })
        .eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Conta padrão definida");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contaDaForma = useMutation({
    mutationFn: async ({ formaId, contaId }: { formaId: string; contaId: string | null }) => {
      const { error } = await supabase
        .from("payment_methods")
        .update({ bank_account_id: contaId })
        .eq("id", formaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Forma de pagamento atualizada");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atribuirLote = useMutation({
    mutationFn: async () => {
      const { error, count } = await supabase
        .from("lancamentos")
        .update({ bank_account_id: destinoLote }, { count: "exact" })
        .eq("user_id", empresaId!)
        .is("bank_account_id", null)
        .eq("status", "pago")
        .gte("data", inicio)
        .lte("data", fim);
      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: (n) => {
      toast.success(`${n} ${n === 1 ? "lançamento atribuído" : "lançamentos atribuídos"} à conta`);
      setConfirmarLote(false);
      setDestinoLote("");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const carregando = carregandoContas || carregandoSaldos;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas Bancárias"
        subtitle="Saldo de cada conta e para onde vai o dinheiro de cada forma de pagamento"
        action={
          gerenciar && (
            <Button onClick={() => abrir("nova")}>
              <Plus className="h-4 w-4" /> Nova conta
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="space-y-1.5">
          <Label className="text-xs">Entradas e saídas de</Label>
          <Input
            type="date"
            className="h-9"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">até</Label>
          <Input type="date" className="h-9" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Saldo somado das contas</p>
          <p className="text-2xl font-bold text-primary">{brl(saldoTotal)}</p>
        </div>
      </div>

      {carregando ? (
        <TableSkeleton />
      ) : !contas.length ? (
        <EmptyState
          icon={Landmark}
          title="Nenhuma conta cadastrada"
          description="Cadastre o banco, a conta digital e o caixa da loja para ver o saldo de cada um."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {contas.map((c) => {
            const s = saldoPorConta.get(c.id);
            const saldo = Number(c.saldo_inicial ?? 0) + Number(s?.movimento_total ?? 0);
            return (
              <section
                key={c.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-soft"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold">
                      <Banknote className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{c.banco}</span>
                      {c.padrao && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          Padrão
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[c.tipo, c.agencia && `Ag. ${c.agencia}`, c.conta && `Conta ${c.conta}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {gerenciar && (
                    <div className="flex shrink-0 gap-1">
                      {!c.padrao && (
                        <button
                          onClick={() => tornarPadrao.mutate(c.id)}
                          title="Tornar conta padrão"
                          aria-label="Tornar conta padrão"
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => abrir(c)}
                        title="Editar"
                        aria-label="Editar"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className={`mt-4 text-2xl font-bold ${saldo < 0 ? "text-destructive" : ""}`}>
                  {brl(saldo)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Saldo atual (inicial {brl(Number(c.saldo_inicial ?? 0))})
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Entradas no período</p>
                    <p className="font-semibold text-emerald-600">
                      {brl(Number(s?.entradas_periodo ?? 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Saídas no período</p>
                    <p className="font-semibold text-destructive">
                      {brl(Number(s?.saidas_periodo ?? 0))}
                    </p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!!semConta && Number(semConta.qtd_periodo) > 0 && (
        <section className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 p-5">
          <p className="font-semibold">Lançamentos sem conta no período</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {semConta.qtd_periodo} lançamentos pagos: entradas{" "}
            {brl(Number(semConta.entradas_periodo))} e saídas {brl(Number(semConta.saidas_periodo))}
            . Eles não entram no saldo de nenhuma conta.
          </p>
          {gerenciar && contas.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Select value={destinoLote} onValueChange={setDestinoLote}>
                <SelectTrigger className="h-9 w-56">
                  <SelectValue placeholder="Escolha a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.banco}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!destinoLote}
                onClick={() => setConfirmarLote(true)}
              >
                Atribuir todos à conta
              </Button>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-base font-bold">Em qual conta cai cada forma de pagamento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vendas, OS faturadas e lançamentos novos vão para a conta da forma de pagamento usada. Sem
          conta definida, vão para a conta padrão.{" "}
          <Link to="/configuracoes" className="font-medium text-primary hover:underline">
            Formas de pagamento
          </Link>{" "}
          ficam em Configurações → Financeiro.
        </p>
        <div className="mt-4 divide-y divide-border rounded-xl border border-border">
          {formas.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
            >
              <span className="text-sm font-medium">{f.nome}</span>
              <Select
                value={f.bank_account_id ?? SEM_CONTA}
                disabled={!gerenciar || !contas.length}
                onValueChange={(v) =>
                  contaDaForma.mutate({ formaId: f.id, contaId: v === SEM_CONTA ? null : v })
                }
              >
                <SelectTrigger className="h-9 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_CONTA}>Conta padrão</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.banco}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {!formas.length && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Nenhuma forma de pagamento.</p>
          )}
        </div>
      </section>

      <Dialog open={editando !== null} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando === "nova" ? "Nova conta" : "Editar conta"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome / banco</Label>
              <Input
                value={form.banco}
                onChange={(e) => setForm({ ...form, banco: e.target.value })}
                placeholder="Ex.: Nubank, Caixa da loja, Mercado Pago"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Saldo inicial</Label>
              <MoneyInput
                value={form.saldo_inicial}
                onChange={(v) => setForm({ ...form, saldo_inicial: String(v) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Agência</Label>
              <Input
                value={form.agencia}
                onChange={(e) => setForm({ ...form, agencia: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Input
                value={form.conta}
                onChange={(e) => setForm({ ...form, conta: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Saldo inicial = quanto havia na conta antes dos lançamentos registrados no sistema.
          </p>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar conta"}
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmarLote}
        onOpenChange={setConfirmarLote}
        title="Atribuir lançamentos sem conta?"
        description={`Os ${semConta?.qtd_periodo ?? 0} lançamentos pagos sem conta entre ${inicio.split("-").reverse().join("/")} e ${fim.split("-").reverse().join("/")} passam para "${contas.find((c) => c.id === destinoLote)?.banco ?? ""}".`}
        confirmLabel="Atribuir"
        loading={atribuirLote.isPending}
        onConfirm={() => atribuirLote.mutate()}
      />
    </div>
  );
}
