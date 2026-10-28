import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  QrCode,
  Copy,
  CheckCircle2,
  Clock,
  AlertCircle,
  Smartphone,
  Wrench,
  ShoppingCart,
  Trash2,
  RefreshCw,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { dataBR } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { criarCobrancaPixFn, verificarPagamentoPixFn } from "@/lib/pix/pix.functions";

export const Route = createFileRoute("/_authenticated/cobrancas")({
  head: () => ({
    meta: [
      { title: "Cobranças — SpaceTech" },
      { name: "description", content: "Gerencie suas cobranças e receba via Pix." },
    ],
  }),
  component: Cobrancas,
});

const FUSO = "America/Sao_Paulo";

/** Hoje em Brasília, AAAA-MM-DD (mesmo formato da coluna vencimento). */
function hojeBR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

/** Dias entre duas datas AAAA-MM-DD (b - a). */
function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

type Situacao = "pendente" | "atrasada" | "paga" | "cancelada" | "expirada";

/** "Atrasada" não é gravada no banco: é uma cobrança não paga (pendente ou com
 * o QR Pix expirado) cujo vencimento já passou. */
function situacaoDe(c: { status: string; vencimento: string }, hoje: string): Situacao {
  if (c.status === "paga" || c.status === "cancelada") return c.status;
  if (c.vencimento < hoje) return "atrasada";
  return c.status === "expirada" ? "expirada" : "pendente";
}

const vazio = () => ({
  cliente_id: "",
  valor: "",
  vencimento: hojeBR(),
  tipo_origem: "avulsa" as "avulsa" | "os" | "venda",
  origem_id: "",
});

function Cobrancas() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(vazio);
  const [filtroStatus, setFiltroStatus] = useState<Situacao | "todas">("todas");
  const [confirmExcluir, setConfirmExcluir] = useState<{ id: string; cliente: string } | null>(
    null,
  );

  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey: ["cobrancas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas")
        .select(
          `
          *,
          cliente:clientes(nome),
          os:ordens_servico(numero),
          venda:vendas(numero)
        `,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    // Pix confirmation arrives via webhook independently of this tab — poll
    // gently while something's still waiting to be paid so the status
    // updates without a manual refresh.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((c) => c.status === "pendente") ? 8000 : false,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Só busca OS/vendas quando o usuário escolhe vincular; filtra pelo cliente
  // escolhido e traz as 50 mais recentes.
  const { data: origens = [] } = useQuery({
    queryKey: ["cobrancas-origens", form.tipo_origem, form.cliente_id],
    queryFn: async () => {
      if (form.tipo_origem === "os") {
        let q = supabase
          .from("ordens_servico")
          .select("id, numero, cliente:clientes(nome)")
          .neq("status", "cancelado")
          .order("created_at", { ascending: false })
          .limit(50);
        if (form.cliente_id) q = q.eq("cliente_id", form.cliente_id);
        const { data, error } = await q;
        if (error) throw error;
        return data.map((o) => ({
          id: o.id,
          rotulo: `OS #${o.numero}${o.cliente?.nome ? ` — ${o.cliente.nome}` : ""}`,
        }));
      }
      let q = supabase
        .from("vendas")
        .select("id, numero, total, cliente:clientes(nome)")
        .neq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(50);
      if (form.cliente_id) q = q.eq("cliente_id", form.cliente_id);
      const { data, error } = await q;
      if (error) throw error;
      return data.map((v) => ({
        id: v.id,
        rotulo: `Venda #${v.numero}${v.cliente?.nome ? ` — ${v.cliente.nome}` : ""}`,
      }));
    },
    enabled: !!user && open && form.tipo_origem !== "avulsa",
  });

  const criar = useMutation({
    mutationFn: async () => {
      const valor = parseFloat(form.valor);
      if (!valor || valor <= 0) throw new Error("Informe um valor válido");
      if (form.tipo_origem !== "avulsa" && !form.origem_id)
        throw new Error(
          form.tipo_origem === "os" ? "Escolha a ordem de serviço" : "Escolha a venda",
        );

      return criarCobrancaPixFn({
        data: {
          valor,
          clienteId: form.cliente_id || null,
          osId: form.tipo_origem === "os" ? form.origem_id || null : null,
          vendaId: form.tipo_origem === "venda" ? form.origem_id || null : null,
          vencimento: form.vencimento || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Cobrança Pix gerada com sucesso!");
      setForm(vazio());
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cobrancas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cobrança removida");
      setConfirmExcluir(null);
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
    },
  });

  // Fallback manual para quando o webhook do Mercado Pago não chega (URL de
  // notificação inalcançável, entrega perdida, ...) — reconsulta o
  // pagamento direto na API do Mercado Pago em vez de esperar.
  const verificar = useMutation({
    mutationFn: (cobrancaId: string) => verificarPagamentoPixFn({ data: { cobrancaId } }),
    onSuccess: () => {
      toast.success("Pagamento verificado junto ao Mercado Pago.");
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMap: Record<Situacao, { label: string; icon: typeof Clock; class: string }> = {
    atrasada: {
      label: "Atrasada",
      icon: AlertCircle,
      class: "bg-destructive/10 text-destructive border-destructive/20",
    },
    pendente: {
      label: "Pendente",
      icon: Clock,
      class: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    },
    paga: {
      label: "Paga",
      icon: CheckCircle2,
      class: "bg-green-500/10 text-green-500 border-green-500/20",
    },
    cancelada: {
      label: "Cancelada",
      icon: AlertCircle,
      class: "bg-muted text-muted-foreground border-border",
    },
    expirada: {
      label: "Pix expirado",
      icon: AlertCircle,
      class: "bg-muted text-muted-foreground border-border",
    },
  };

  const hoje = hojeBR();
  const comSituacao = useMemo(
    () => cobrancas.map((c) => ({ ...c, situacao: situacaoDe(c, hoje) })),
    [cobrancas, hoje],
  );
  const resumo = useMemo(() => {
    const r = { pendente: 0, atrasada: 0, paga: 0, qtdAtrasada: 0 };
    for (const c of comSituacao) {
      const v = Number(c.valor);
      if (c.situacao === "paga") r.paga += v;
      else if (c.situacao === "atrasada") {
        r.atrasada += v;
        r.qtdAtrasada++;
      } else if (c.situacao !== "cancelada") r.pendente += v;
    }
    return r;
  }, [comSituacao]);

  const termo = busca.toLowerCase();
  const filtrados = comSituacao.filter(
    (c) =>
      (filtroStatus === "todas" || c.situacao === filtroStatus) &&
      `${c.cliente?.nome || ""} ${c.os?.numero || ""} ${c.venda?.numero || ""}`
        .toLowerCase()
        .includes(termo),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobranças Pix"
        subtitle="Gere e acompanhe pagamentos via Pix integrados ao Mercado Pago."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nova Cobrança
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gerar Nova Cobrança</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label>Cliente</Label>
                  <Select
                    value={form.cliente_id}
                    onValueChange={(v) => setForm({ ...form, cliente_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Vencimento</Label>
                  <Input
                    type="date"
                    value={form.vencimento}
                    onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Vincular a:</Label>
                  <Select
                    value={form.tipo_origem}
                    onValueChange={(v: "avulsa" | "os" | "venda") =>
                      setForm({ ...form, tipo_origem: v, origem_id: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avulsa">Cobrança Avulsa</SelectItem>
                      <SelectItem value="os">Ordem de Serviço</SelectItem>
                      <SelectItem value="venda">Venda (PDV)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.tipo_origem !== "avulsa" && (
                  <div className="space-y-1.5">
                    <Label>{form.tipo_origem === "os" ? "Ordem de serviço" : "Venda"}</Label>
                    <Select
                      value={form.origem_id}
                      onValueChange={(v) => setForm({ ...form, origem_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            origens.length
                              ? "Selecione"
                              : form.cliente_id
                                ? "Nada encontrado para este cliente"
                                : "Nada encontrado"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {origens.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.rotulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                  {criar.isPending ? "Gerando..." : "Gerar Pix"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          { rotulo: "A receber", valor: resumo.pendente, cor: "text-amber-500" },
          {
            rotulo: resumo.qtdAtrasada ? `Atrasado (${resumo.qtdAtrasada})` : "Atrasado",
            valor: resumo.atrasada,
            cor: "text-destructive",
          },
          { rotulo: "Recebido", valor: resumo.paga, cor: "text-green-500" },
        ].map((r) => (
          <div key={r.rotulo} className="rounded-2xl border border-border bg-card p-3 sm:p-4">
            <p className="text-[11px] text-muted-foreground sm:text-xs">{r.rotulo}</p>
            <p className={cn("mt-0.5 text-sm font-bold sm:text-lg", r.cor)}>{brl(r.valor)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["todas", "pendente", "atrasada", "paga", "expirada", "cancelada"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              filtroStatus === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "todas" ? "Todas" : statusMap[s].label}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente ou OS..."
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p>Carregando...</p>
        ) : (
          filtrados.map((c) => {
            const status = statusMap[c.situacao];
            const diasAtraso = c.situacao === "atrasada" ? diasEntre(c.vencimento, hoje) : 0;
            return (
              <div
                key={c.id}
                className="relative rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/50 group"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      status.class,
                    )}
                  >
                    <status.icon className="h-3 w-3" />
                    {status.label}
                    {diasAtraso > 0 && ` · ${diasAtraso} ${diasAtraso === 1 ? "dia" : "dias"}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(c.qr_code_copy_paste || "");
                        toast.success("Pix Copia e Cola copiado!");
                      }}
                      className="text-muted-foreground hover:text-primary transition"
                      title="Copiar Pix"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() =>
                        setConfirmExcluir({ id: c.id, cliente: c.cliente?.nome || "esta cobrança" })
                      }
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-2xl font-extrabold tracking-tight text-primary">
                    {brl(c.valor)}
                  </p>
                  <h3 className="font-bold text-sm mt-1">
                    {c.cliente?.nome || "Cliente não informado"}
                  </h3>
                </div>

                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Origem:</span>
                    <span className="flex items-center gap-1 font-medium">
                      {c.os_id ? (
                        <Wrench className="h-3 w-3" />
                      ) : c.venda_id ? (
                        <ShoppingCart className="h-3 w-3" />
                      ) : (
                        <Smartphone className="h-3 w-3" />
                      )}
                      {c.os?.numero
                        ? `OS #${c.os.numero}`
                        : c.venda?.numero
                          ? `Venda #${c.venda.numero}`
                          : "Avulsa"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Criada em:</span>
                    <span className="font-medium">{dataBR(c.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CalendarClock className="h-3 w-3" /> Vencimento:
                    </span>
                    <span
                      className={cn("font-medium", c.situacao === "atrasada" && "text-destructive")}
                    >
                      {dataBR(c.vencimento)}
                    </span>
                  </div>
                </div>

                {c.status === "pendente" && (
                  <div className="mt-6 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      disabled={verificar.isPending}
                      onClick={() => verificar.mutate(c.id)}
                    >
                      <RefreshCw className={cn("h-4 w-4", verificar.isPending && "animate-spin")} />
                      Verificar pagamento
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full gap-2">
                          <QrCode className="h-4 w-4" /> Ver QR Code
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-xs">
                        <DialogHeader>
                          <DialogTitle className="text-center">Pagamento via Pix</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-4 py-6">
                          {c.qr_code ? (
                            <img
                              src={`data:image/png;base64,${c.qr_code}`}
                              alt="QR Code Pix"
                              className="aspect-square w-48 rounded-xl border border-border object-contain"
                            />
                          ) : (
                            <div className="relative aspect-square w-48 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-border">
                              <QrCode className="h-16 w-16 text-muted-foreground opacity-20" />
                              <p className="absolute text-[10px] text-muted-foreground text-center px-4">
                                QR Code indisponível
                                <br />
                                Configure as credenciais nas Configurações
                              </p>
                            </div>
                          )}
                          <div className="text-center">
                            <p className="text-lg font-bold">{brl(c.valor)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              QR válido até:{" "}
                              {c.expires_at
                                ? new Date(c.expires_at).toLocaleString("pt-BR", {
                                    timeZone: FUSO,
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })
                                : "—"}
                            </p>
                          </div>
                          <Button
                            className="w-full gap-2"
                            onClick={() => {
                              navigator.clipboard.writeText(c.qr_code_copy_paste || "");
                              toast.success("Pix Copia e Cola copiado!");
                            }}
                          >
                            <Copy className="h-4 w-4" /> Copiar Código
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            );
          })
        )}

        {!filtrados.length && !isLoading && (
          <div className="col-span-full py-20 text-center text-muted-foreground">
            <AlertCircle className="mx-auto h-10 w-10 mb-2 opacity-20" />
            <p>Nenhuma cobrança encontrada.</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-primary/5 p-6 border border-primary/10">
        <h4 className="font-bold text-primary flex items-center gap-2">
          <Smartphone className="h-4 w-4" /> Importante
        </h4>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Para que o QR Code Pix real seja gerado, você deve cadastrar suas credenciais do{" "}
          <strong>Mercado Pago</strong> (Public Key e Access Token) na página de{" "}
          <Link to="/configuracoes" className="underline font-medium hover:text-primary">
            Configurações
          </Link>
          . As cobranças pagas serão liquidadas automaticamente e registradas no seu financeiro
          assim que o Mercado Pago confirmar o pagamento.
        </p>
      </div>

      <ConfirmDialog
        open={!!confirmExcluir}
        onOpenChange={(v) => !v && setConfirmExcluir(null)}
        title="Deseja realmente excluir esta cobrança?"
        description={
          confirmExcluir
            ? `A cobrança de "${confirmExcluir.cliente}" será removida permanentemente.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        loading={remover.isPending}
        onConfirm={() => confirmExcluir && remover.mutate(confirmExcluir.id)}
      />
    </div>
  );
}
