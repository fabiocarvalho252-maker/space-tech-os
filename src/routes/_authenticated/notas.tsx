import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  FileCheck,
  Filter,
  Plus,
  Search,
  Printer,
  Trash2,
  XCircle,
  CheckCircle2,
  Wrench,
  ShoppingCart,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import {
  useCurrentUser,
  useEmpresaId,
  useProfile,
  usePermissoes,
  usePlanoFeatures,
  podeGerenciar,
  temFeature,
} from "@/hooks/useCurrentUser";
import { brl, dataBR } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { StatusBadge } from "@/components/StatusBadge";
import { UpgradeModal } from "@/components/UpgradeModal";
import { SectionCard } from "@/components/SectionCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({
    meta: [
      { title: "Notas Fiscais — SpaceTech" },
      { name: "description", content: "Controle interno de notas de vendas e ordens de serviço." },
    ],
  }),
  // ?osId=<id> lets the OS screen's "Emitir Nota Fiscal" action deep-link
  // straight into a pre-filled "Nova Nota" dialog instead of needing its own
  // separate creation flow.
  validateSearch: (search: Record<string, unknown>): { osId?: string } => {
    const osId = search["osId"];
    return typeof osId === "string" ? { osId } : {};
  },
  component: NotasFiscais,
});

type ItemForm = { descricao: string; quantidade: string; valor_unitario: string };

const vazio = {
  origem: "avulsa" as "avulsa" | "venda" | "os",
  cliente_id: "",
  venda_id: "",
  os_id: "",
  observacoes: "",
};

const itemVazio: ItemForm = { descricao: "", quantidade: "1", valor_unitario: "" };

const statusMap = {
  rascunho: { label: "Pendente", tone: "warning" as const },
  emitida: { label: "Autorizada", tone: "success" as const },
  cancelada: { label: "Cancelada", tone: "danger" as const },
};

function NotasFiscais() {
  const { formatFinancialValue: fmt } = useFinancialVisibility();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const { data: profile } = useProfile();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "notas");
  const { data: features } = usePlanoFeatures();
  const temNotaFiscal = temFeature(features, "NOTA_FISCAL");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [busca, setBusca] = useState("");
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "rascunho" | "emitida" | "cancelada">(
    "todos",
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(vazio);
  const [itens, setItens] = useState<ItemForm[]>([{ ...itemVazio }]);
  const [confirmAcao, setConfirmAcao] = useState<{
    id: string;
    numero: number;
    acao: "cancelar" | "excluir";
  } | null>(null);

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ["notas_fiscais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*, cliente:clientes(nome, documento), os:ordens_servico(numero), venda:vendas(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: fiscalConfig } = useQuery({
    queryKey: ["fiscal-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fiscal_config" as any).select("*").maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, documento")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  const { data: vendasDisponiveis = [] } = useQuery({
    queryKey: ["vendas-para-nota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("id, total, cliente_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user && open && form.origem === "venda",
  });

  const { data: osDisponiveis = [] } = useQuery({
    queryKey: ["os-para-nota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero, valor, cliente_id, aparelho")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user && open && form.origem === "os",
  });

  useEffect(() => {
    if (!searchParams.osId) return;
    if (temNotaFiscal) {
      setForm({ ...vazio, origem: "os", os_id: searchParams.osId });
      setOpen(true);
    } else {
      setUpgradeOpen(true);
    }
    navigate({ to: "/notas", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.osId, temNotaFiscal]);

  // Once the deep-linked OS loads, carry over its cliente automatically —
  // the dialog still asks for "Cliente" as a separate field for the manual
  // flow, but there's no reason to make a one-click action from the OS
  // screen re-ask for a client the OS already has.
  useEffect(() => {
    if (form.origem !== "os" || !form.os_id || form.cliente_id) return;
    const os = osDisponiveis.find((o) => o.id === form.os_id);
    if (os?.cliente_id) setForm((f) => ({ ...f, cliente_id: os.cliente_id as string }));
  }, [osDisponiveis, form.origem, form.os_id, form.cliente_id]);

  function atualizarItem(i: number, campo: keyof ItemForm, valor: string) {
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }

  function fecharDialog() {
    setOpen(false);
    setForm(vazio);
    setItens([{ ...itemVazio }]);
  }

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.cliente_id) throw new Error("Selecione o cliente.");

      let itensFinal: { descricao: string; quantidade: number; valor_unitario: number }[] = [];
      let vendaId: string | null = null;
      let osId: string | null = null;

      if (form.origem === "venda") {
        if (!form.venda_id) throw new Error("Selecione a venda.");
        vendaId = form.venda_id;
        const { data: vendaItens, error } = await supabase
          .from("venda_itens")
          .select("descricao, quantidade, preco_unitario")
          .eq("venda_id", form.venda_id);
        if (error) throw error;
        itensFinal = (vendaItens ?? []).map((i) => ({
          descricao: i.descricao,
          quantidade: i.quantidade,
          valor_unitario: i.preco_unitario,
        }));
      } else if (form.origem === "os") {
        if (!form.os_id) throw new Error("Selecione a ordem de serviço.");
        osId = form.os_id;
        const os = osDisponiveis.find((o) => o.id === form.os_id);
        itensFinal = [
          {
            descricao: `Serviço OS #${os?.numero ?? ""} — ${os?.aparelho ?? "Aparelho"}`,
            quantidade: 1,
            valor_unitario: os?.valor ?? 0,
          },
        ];
      } else {
        itensFinal = itens
          .filter((i) => i.descricao.trim())
          .map((i) => ({
            descricao: i.descricao.trim(),
            quantidade: parseFloat(i.quantidade) || 1,
            valor_unitario: parseFloat(i.valor_unitario) || 0,
          }));
      }

      if (!itensFinal.length) throw new Error("Adicione ao menos um item.");

      const valorTotal = itensFinal.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);

      const { data: nota, error: notaErro } = await supabase
        .from("notas_fiscais")
        .insert({
          user_id: empresaId!,
          cliente_id: form.cliente_id,
          venda_id: vendaId,
          os_id: osId,
          serie: fiscalConfig?.serie_padrao || "1",
          observacoes: form.observacoes || null,
          valor_total: valorTotal,
        })
        .select()
        .single();
      if (notaErro) throw notaErro;

      const { error: itensErro } = await supabase
        .from("nota_fiscal_itens")
        .insert(itensFinal.map((i) => ({ ...i, nota_id: nota.id, user_id: empresaId! })));
      if (itensErro) throw itensErro;
    },
    onSuccess: () => {
      toast.success("Nota criada como rascunho.");
      fecharDialog();
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emitir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notas_fiscais")
        .update({ status: "emitida", emitida_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota emitida (controle interno).");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notas_fiscais")
        .update({ status: "cancelada" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota cancelada.");
      setConfirmAcao(null);
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota removida.");
      setConfirmAcao(null);
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
    },
  });

  async function imprimir(notaId: string) {
    const nota = notas.find((n) => n.id === notaId);
    if (!nota) return;

    // Open synchronously — inside the click's user-gesture — before the
    // await below, or most browsers silently block it as an unrequested
    // popup once a network request has happened first.
    const janela = window.open("", "_blank", "width=800,height=900");
    if (!janela) {
      toast.error("Não foi possível abrir a janela de impressão.", {
        description: "Verifique se o navegador está bloqueando pop-ups para este site.",
      });
      return;
    }
    janela.document.write(
      "<!doctype html><html><body style='font-family:system-ui,sans-serif;padding:40px;color:#666'>Preparando impressão...</body></html>",
    );

    const { data: itensNota } = await supabase
      .from("nota_fiscal_itens")
      .select("descricao, quantidade, valor_unitario")
      .eq("nota_id", notaId);

    janela.document.open();
    janela.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>Nota ${nota.serie}/${nota.numero} — ${profile?.loja || "SpaceTech"}</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #333; }
          header { border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          h1 { margin: 0; color: #1e1b4b; font-size: 20px; }
          .aviso { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; font-size: 12px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { text-align: left; background: #f3f4f6; padding: 8px; border-bottom: 2px solid #ddd; font-size: 12px; }
          td { padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; }
          .total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 16px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>${profile?.loja || "SpaceTech"}</h1>
            <p>Nota interna nº ${nota.numero} — série ${nota.serie}</p>
          </div>
          <button class="no-print" onclick="window.print()">Imprimir</button>
        </header>
        <div class="aviso">
          Comprovante de controle interno — <strong>não é uma NF-e/NFS-e válida perante o Fisco</strong>.
          A emissão fiscal eletrônica ainda não está integrada a este sistema.
        </div>
        <p><strong>Cliente:</strong> ${nota.cliente?.nome ?? "—"}</p>
        <p><strong>Data:</strong> ${dataBR(nota.created_at)} &nbsp; <strong>Status:</strong> ${statusMap[nota.status as keyof typeof statusMap]?.label ?? nota.status}</p>
        <table>
          <thead><tr><th>Descrição</th><th>Qtd.</th><th>Valor unit.</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${(itensNota ?? [])
              .map(
                (i) => `<tr>
                  <td>${i.descricao}</td>
                  <td>${i.quantidade}</td>
                  <td>${brl(i.valor_unitario)}</td>
                  <td>${brl(i.quantidade * i.valor_unitario)}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
        <p class="total">Total: ${brl(nota.valor_total)}</p>
      </body>
      </html>
    `);
    janela.document.close();
  }

  const filtradas = notas
    .filter((n) => filtroStatus === "todos" || n.status === filtroStatus)
    .filter((n) =>
      `${n.cliente?.nome ?? ""} ${n.numero} ${n.cliente?.documento ?? ""}`
        .toLowerCase()
        .includes(busca.toLowerCase()),
    );

  // "Notas de produtos" (NF-e/NFC-e) vs "Notas de serviços" (NFS-e) — não há
  // coluna de tipo fiscal na tabela, então a origem já registrada (venda vs
  // OS) é usada como aproximação real: venda = produto, OS = serviço.
  const hoje = new Date();
  const notasDoMes = notas.filter((n) => {
    const d = new Date(n.created_at);
    return (
      n.status === "emitida" &&
      d.getMonth() === hoje.getMonth() &&
      d.getFullYear() === hoje.getFullYear()
    );
  });
  const totalEmitidas = notasDoMes.reduce((s, n) => s + Number(n.valor_total), 0);
  const totalProdutos = notasDoMes
    .filter((n) => !!n.venda_id)
    .reduce((s, n) => s + Number(n.valor_total), 0);
  const totalServicos = notasDoMes
    .filter((n) => !!n.os_id)
    .reduce((s, n) => s + Number(n.valor_total), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notas Fiscais"
        subtitle="Controle interno de notas vinculadas a vendas e ordens de serviço."
        action={
          gerenciar &&
          (temNotaFiscal ? (
            <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : fecharDialog())}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Nova Nota
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nova Nota</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
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
                    <Label>Origem</Label>
                    <Select
                      value={form.origem}
                      onValueChange={(v: "avulsa" | "venda" | "os") =>
                        setForm({ ...form, origem: v, venda_id: "", os_id: "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="avulsa">Avulsa</SelectItem>
                        <SelectItem value="venda">Venda (PDV)</SelectItem>
                        <SelectItem value="os">Ordem de Serviço</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.origem === "venda" && (
                    <div className="space-y-1.5">
                      <Label>Venda</Label>
                      <Select
                        value={form.venda_id}
                        onValueChange={(v) => setForm({ ...form, venda_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a venda" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendasDisponiveis.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              #{v.id.slice(0, 8)} — {fmt(v.total)} — {dataBR(v.created_at)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Os itens da venda serão copiados automaticamente.
                      </p>
                    </div>
                  )}

                  {form.origem === "os" && (
                    <div className="space-y-1.5">
                      <Label>Ordem de Serviço</Label>
                      <Select
                        value={form.os_id}
                        onValueChange={(v) => setForm({ ...form, os_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a OS" />
                        </SelectTrigger>
                        <SelectContent>
                          {osDisponiveis.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              #{o.numero} — {o.aparelho} — {fmt(o.valor)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {form.origem === "avulsa" && (
                    <div className="space-y-2">
                      <Label>Itens</Label>
                      {itens.map((it, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            placeholder="Descrição"
                            value={it.descricao}
                            onChange={(e) => atualizarItem(i, "descricao", e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="Qtd"
                            value={it.quantidade}
                            onChange={(e) => atualizarItem(i, "quantidade", e.target.value)}
                            className="w-16"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Valor"
                            value={it.valor_unitario}
                            onChange={(e) => atualizarItem(i, "valor_unitario", e.target.value)}
                            className="w-24"
                          />
                          {itens.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setItens((prev) => prev.filter((_, idx) => idx !== i))}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setItens((prev) => [...prev, { ...itemVazio }])}
                      >
                        <Plus className="h-3 w-3" /> Item
                      </Button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea
                      value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={fecharDialog}>
                    Cancelar
                  </Button>
                  <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                    {criar.isPending ? "Salvando..." : "Salvar rascunho"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button className="gap-2" onClick={() => setUpgradeOpen(true)}>
              <Plus className="h-4 w-4" /> Nova Nota
            </Button>
          ))
        }
      />

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} titulo="Nota Fiscal" />

      <div className="grid gap-4 sm:grid-cols-3">
        <SectionCard className="p-4">
          <p className="text-xs text-muted-foreground">Total emitidas</p>
          <p className="mt-1 text-xl font-extrabold">{fmt(totalEmitidas)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Notas autorizadas no mês</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-xs text-muted-foreground">Notas de produtos</p>
          <p className="mt-1 text-xl font-extrabold">{fmt(totalProdutos)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">NF-e e NFC-e</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-xs text-muted-foreground">Notas de serviços</p>
          <p className="mt-1 text-xl font-extrabold">{fmt(totalServicos)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">NFS-e</p>
        </SectionCard>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por número, cliente ou CPF/CNPJ..."
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => setMostrarFiltro((v) => !v)}>
          <Filter className="h-4 w-4" /> Filtrar
        </Button>
      </div>

      {mostrarFiltro && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={filtroStatus}
            onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="rascunho">Pendente</SelectItem>
              <SelectItem value="emitida">Autorizada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-muted-foreground">Carregando...</p>
        ) : filtradas.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Número</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Origem</th>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((n) => {
                  const status =
                    statusMap[n.status as keyof typeof statusMap] ?? statusMap.rascunho;
                  return (
                    <tr key={n.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">
                        {n.serie}/{n.numero}
                      </td>
                      <td className="px-4 py-3">{n.cliente?.nome ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {n.os_id ? (
                            <Wrench className="h-3 w-3" />
                          ) : n.venda_id ? (
                            <ShoppingCart className="h-3 w-3" />
                          ) : null}
                          {n.os?.numero ? `OS #${n.os.numero}` : n.venda_id ? "Venda" : "Avulsa"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{dataBR(n.created_at)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge label={status.label} tone={status.tone} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(n.valor_total)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => imprimir(n.id)}
                            className="text-muted-foreground hover:text-primary"
                            title="Imprimir"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {gerenciar && n.status === "rascunho" && (
                            <button
                              onClick={() => emitir.mutate(n.id)}
                              className="text-muted-foreground hover:text-green-500"
                              title="Emitir"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          {gerenciar && n.status !== "cancelada" && (
                            <button
                              onClick={() =>
                                setConfirmAcao({ id: n.id, numero: n.numero, acao: "cancelar" })
                              }
                              className="text-muted-foreground hover:text-destructive"
                              title="Cancelar"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                          {gerenciar && n.status === "rascunho" && (
                            <button
                              onClick={() =>
                                setConfirmAcao({ id: n.id, numero: n.numero, acao: "excluir" })
                              }
                              className="text-muted-foreground hover:text-destructive"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <FileCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold">Nenhuma nota encontrada</h3>
            <p className="max-w-xs text-sm text-muted-foreground mt-1">
              Crie uma nota a partir de uma venda, de uma ordem de serviço ou avulsa.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-primary/5 p-6 border border-primary/10">
        <h4 className="font-bold text-primary flex items-center gap-2">
          <Info className="h-4 w-4" /> Importante
        </h4>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Estas notas são um controle interno (número, série, cliente, itens e valores) — ainda{" "}
          <strong>não são NF-e/NFS-e emitidas junto ao Fisco</strong>. A integração com um provedor
          de emissão fiscal eletrônica (certificado digital, SEFAZ) é uma etapa futura.
        </p>
      </div>

      <ConfirmDialog
        open={!!confirmAcao}
        onOpenChange={(v) => !v && setConfirmAcao(null)}
        title={
          confirmAcao?.acao === "cancelar"
            ? `Cancelar a nota nº ${confirmAcao.numero}?`
            : `Excluir o rascunho nº ${confirmAcao?.numero}?`
        }
        description={
          confirmAcao?.acao === "cancelar"
            ? "A nota ficará marcada como cancelada e sai do total emitido."
            : "Este rascunho será removido permanentemente."
        }
        confirmLabel={confirmAcao?.acao === "cancelar" ? "Cancelar nota" : "Excluir"}
        destructive
        loading={cancelar.isPending || remover.isPending}
        onConfirm={() => {
          if (!confirmAcao) return;
          if (confirmAcao.acao === "cancelar") cancelar.mutate(confirmAcao.id);
          else remover.mutate(confirmAcao.id);
        }}
      />
    </div>
  );
}
