import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useMinhaEmpresa, usePermissoes } from "@/hooks/useCurrentUser";
import { brl, dataBR, paraCentavos, paraReais } from "@/lib/format";
import { randomId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const OUTRO = "__outro__";
const hojeISO = () => format(new Date(), "yyyy-MM-dd");
const PARCELAS_RAPIDAS = [2, 3, 4, 5, 6];
const PARCELAS_MAIS = [7, 8, 9, 10, 12, 18, 24];

type Parcela = {
  id: string;
  numero_parcela: number;
  valor: number;
  vencimento: string;
  forma_pagamento_id: string;
  recebido: boolean;
  data_recebimento: string;
};

type TecnicoLinha = {
  id: string;
  membro_user_id: string;
  nome_livre: string;
  valor: number;
};

// Splits are done in integer centavos so 100/3 lands as 33.33/33.33/33.34
// instead of drifting a cent off the total from float rounding — the last
// installment absorbs the remainder, matching how the app already rounds
// money everywhere else (two decimal places, never more).
function dividirValor(totalReais: number, n: number): number[] {
  if (n <= 0) return [];
  const totalCent = paraCentavos(totalReais);
  const base = Math.floor(totalCent / n);
  const resto = totalCent - base * n;
  return Array.from({ length: n }, (_, i) => paraReais(i === n - 1 ? base + resto : base));
}

function novaParcelaVazia(numero: number, vencimento: string): Parcela {
  return {
    id: randomId(),
    numero_parcela: numero,
    valor: 0,
    vencimento,
    forma_pagamento_id: "",
    recebido: false,
    data_recebimento: "",
  };
}

// Used both by the quick "2x/3x/…" shortcuts and by "+ Parcela": recomputes
// how many installments there are, but keeps each existing installment's own
// due date / payment method / received state intact — only the amounts are
// redistributed evenly. Only genuinely new rows get generated defaults.
function ajustarQuantidadeParcelas(
  atual: Parcela[],
  novaQtd: number,
  totalReais: number,
  dataInicial: string,
): Parcela[] {
  const base = Array.from({ length: novaQtd }, (_, i) => {
    const existente = atual[i];
    return existente
      ? { ...existente, numero_parcela: i + 1 }
      : novaParcelaVazia(i + 1, format(addMonths(new Date(dataInicial), i), "yyyy-MM-dd"));
  });
  const valores = dividirValor(totalReais, novaQtd);
  return base.map((p, i) => ({ ...p, valor: valores[i] ?? 0 }));
}

type FaturarOsModalProps = {
  osId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FaturarOsModal({ osId, open, onOpenChange }: FaturarOsModalProps) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: minhaEmpresa } = useMinhaEmpresa();
  const { data: permissoes } = usePermissoes();
  const empresaId = minhaEmpresa?.empresa_id;
  const souDono = !!user && !!minhaEmpresa && minhaEmpresa.empresa_id === user.id;
  const podeFaturar =
    souDono || (!!permissoes?.["ordens"]?.gerenciar && !!permissoes?.["financeiro"]?.gerenciar);

  const { data: os, isLoading: carregandoOs } = useQuery({
    queryKey: ["os-faturar", osId],
    enabled: !!osId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*, clientes(nome, telefone, email)")
        .eq("id", osId as string)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: itens = [], isLoading: carregandoItens } = useQuery({
    queryKey: ["os-itens-faturar", osId],
    enabled: !!osId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_itens")
        .select("*")
        .eq("os_id", osId as string);
      if (error) throw error;
      return data as any[];
    },
  });

  const totalItens = useMemo(
    () => itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario), 0),
    [itens],
  );

  const { data: faturamento, isLoading: carregandoFaturamento } = useQuery({
    queryKey: ["os-faturamento-ativo", osId],
    enabled: !!osId && open,
    queryFn: async () => {
      const { data: fat, error } = await supabase
        .from("os_faturamentos" as any)
        .select("*")
        .eq("os_id", osId as string)
        .neq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!fat) return null;
      const [{ data: parcelas }, { data: tecnicos }, { data: categoria }] = await Promise.all([
        supabase
          .from("os_faturamento_parcelas" as any)
          .select("*, payment_methods(nome)")
          .eq("faturamento_id", (fat as any).id)
          .order("numero_parcela"),
        supabase
          .from("os_faturamento_tecnicos" as any)
          .select("*")
          .eq("faturamento_id", (fat as any).id),
        (fat as any).categoria_id
          ? supabase
              .from("finance_categories")
              .select("nome")
              .eq("id", (fat as any).categoria_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return {
        ...(fat as any),
        parcelas: parcelas ?? [],
        tecnicos: tecnicos ?? [],
        categoriaNome: (categoria as any)?.nome,
      };
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["finance-categorias-entrada", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_categories")
        .select("id, nome")
        .eq("user_id", empresaId as string)
        .eq("tipo", "entrada")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["payment-methods", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("id, nome")
        .eq("user_id", empresaId as string)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: membros = [] } = useQuery({
    queryKey: ["empresa-membros-tecnicos", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_empresa_membros", {
        p_empresa_id: empresaId as string,
      });
      if (error) throw error;
      return ((data as any[]) ?? []).filter((m) =>
        ["tecnico", "gerente", "admin"].includes(m.role),
      );
    },
  });

  const { data: clientesLista = [] } = useQuery({
    queryKey: ["clientes-faturar-os"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // ---- Formulário (só relevante quando não há faturamento ativo) ----
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [desconto, setDesconto] = useState(0);
  const [categoriaId, setCategoriaId] = useState("");
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoLinha[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [inicializado, setInicializado] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmSaidaAberto, setConfirmSaidaAberto] = useState(false);
  const [clientePopoverAberto, setClientePopoverAberto] = useState(false);

  useEffect(() => {
    if (open) setInicializado(false);
  }, [open, osId]);

  const totalOs = Math.max(totalItens - desconto, 0);

  useEffect(() => {
    if (inicializado || !open || carregandoOs || carregandoItens || faturamento === undefined) {
      return;
    }
    if (!os || faturamento || totalItens <= 0) {
      setInicializado(true);
      return;
    }
    const descontoInicial = Number(os.desconto ?? 0);
    const totalInicial = Math.max(totalItens - descontoInicial, 0);
    setDescricao(`Fatura de OS Nº ${os.numero}`);
    setClienteId(os.cliente_id ?? "");
    setDesconto(descontoInicial);
    setCategoriaId("");
    setParcelas(ajustarQuantidadeParcelas([], 1, totalInicial, hojeISO()));
    setTecnicos(
      os.responsavel
        ? [
            {
              id: randomId(),
              membro_user_id: "",
              nome_livre: os.responsavel,
              valor: totalInicial,
            },
          ]
        : [],
    );
    setObservacoes("");
    setErro(null);
    setSujo(false);
    setInicializado(true);
  }, [inicializado, open, carregandoOs, carregandoItens, faturamento, os, totalItens]);

  useEffect(() => {
    if (!inicializado) return;
    const categoriaDefault = categorias.find((c) => c.nome === "Faturamento de OS");
    if (!categoriaId && categoriaDefault) setCategoriaId(categoriaDefault.id);
  }, [inicializado, categorias, categoriaId]);

  function aplicarParcelamento(n: number) {
    setParcelas((ps) => ajustarQuantidadeParcelas(ps, n, totalOs, ps[0]?.vencimento || hojeISO()));
    setSujo(true);
  }

  function atualizarParcela(id: string, patch: Partial<Parcela>) {
    setParcelas((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSujo(true);
  }

  function removerParcela(id: string) {
    setParcelas((ps) => {
      if (ps.length <= 1) return ps;
      return ps.filter((p) => p.id !== id).map((p, i) => ({ ...p, numero_parcela: i + 1 }));
    });
    setSujo(true);
  }

  function adicionarTecnico() {
    setTecnicos((ts) => [
      ...ts,
      { id: randomId(), membro_user_id: "", nome_livre: "", valor: 0 },
    ]);
    setSujo(true);
  }
  function removerTecnico(id: string) {
    setTecnicos((ts) => ts.filter((t) => t.id !== id));
    setSujo(true);
  }
  function atualizarTecnico(id: string, patch: Partial<TecnicoLinha>) {
    setTecnicos((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setSujo(true);
  }

  const somaParcelas = useMemo(
    () => parcelas.reduce((s, p) => s + Number(p.valor || 0), 0),
    [parcelas],
  );
  const diferencaParcelas = paraReais(paraCentavos(totalOs) - paraCentavos(somaParcelas));
  const somaTecnicos = useMemo(
    () => tecnicos.reduce((s, t) => s + Number(t.valor || 0), 0),
    [tecnicos],
  );
  const diferencaTecnicos = paraReais(paraCentavos(totalOs) - paraCentavos(somaTecnicos));

  const parcelasValidas =
    parcelas.length > 0 &&
    Math.abs(diferencaParcelas) <= 0.01 &&
    parcelas.every(
      (p) =>
        p.valor > 0 && p.vencimento && p.forma_pagamento_id && (!p.recebido || p.data_recebimento),
    );
  const tecnicosValidos =
    tecnicos.length === 0 ||
    (Math.abs(diferencaTecnicos) <= 0.01 &&
      tecnicos.every((t) => t.membro_user_id || t.nome_livre.trim()));
  const identificacaoValida = !!descricao.trim() && !!clienteId && !!categoriaId;
  const podeSubmeter = identificacaoValida && totalOs > 0 && parcelasValidas && tecnicosValidos;

  const clienteSelecionado = clientesLista.find((c) => c.id === clienteId);

  const faturar = useMutation({
    mutationFn: async () => {
      if (!os) throw new Error("OS não carregada");
      const patchOs: { cliente_id?: string; desconto?: number } = {};
      if (clienteId !== (os.cliente_id ?? "")) patchOs.cliente_id = clienteId;
      if (desconto !== Number(os.desconto ?? 0)) patchOs.desconto = desconto;
      if (Object.keys(patchOs).length) {
        const { error: erroPatch } = await supabase
          .from("ordens_servico")
          .update(patchOs)
          .eq("id", osId as string);
        if (erroPatch) throw erroPatch;
      }

      const { data, error } = await supabase.rpc("faturar_os" as any, {
        p_os_id: osId,
        p_categoria_id: categoriaId || null,
        p_valor_total: totalOs,
        p_parcelas: parcelas.map((p) => ({
          numero_parcela: p.numero_parcela,
          valor: p.valor,
          vencimento: p.vencimento,
          forma_pagamento_id: p.forma_pagamento_id || null,
          recebido: p.recebido,
          data_recebimento: p.recebido ? p.data_recebimento || hojeISO() : null,
        })),
        p_tecnicos: tecnicos.map((t) => ({
          membro_user_id: t.membro_user_id || null,
          nome_livre: t.membro_user_id ? null : t.nome_livre.trim(),
          valor: t.valor,
        })),
        p_observacoes: observacoes || null,
        p_descricao: descricao || null,
      });
      if (error) throw error;
      return data;
    },
    onMutate: () => setErro(null),
    onSuccess: () => {
      toast.success(`OS Nº ${os?.numero} faturada com sucesso.`);
      qc.invalidateQueries({ queryKey: ["os-faturamento-ativo", osId] });
      qc.invalidateQueries({ queryKey: ["os-faturar", osId] });
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      setSujo(false);
      onOpenChange(false);
    },
    onError: (e: Error) => {
      setErro(e.message || "Não foi possível faturar a OS. Tente novamente.");
      toast.error(e.message || "Não foi possível faturar a OS. Tente novamente.");
    },
  });

  const receberParcela = useMutation({
    mutationFn: async (parcelaId: string) => {
      const { error } = await supabase.rpc("receber_parcela_faturamento" as any, {
        p_parcela_id: parcelaId,
        p_data_recebimento: hojeISO(),
        p_forma_pagamento_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcela marcada como recebida.");
      qc.invalidateQueries({ queryKey: ["os-faturamento-ativo", osId] });
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelarFaturamento = useMutation({
    mutationFn: async () => {
      const motivo = window.prompt("Motivo do cancelamento (opcional):") ?? undefined;
      const { error } = await supabase.rpc("cancelar_faturamento_os" as any, {
        p_faturamento_id: faturamento!.id,
        p_motivo: motivo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Faturamento cancelado. Um estorno foi registrado quando aplicável.");
      qc.invalidateQueries({ queryKey: ["os-faturamento-ativo", osId] });
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function imprimirRecibo() {
    if (!faturamento || !os) return;
    const janela = window.open("", "_blank", "width=800,height=900");
    if (!janela) return;
    const linhasParcelas = faturamento.parcelas
      .map(
        (p: any) => `<tr>
          <td>${p.numero_parcela}/${p.total_parcelas}</td>
          <td>${brl(p.valor)}</td>
          <td>${dataBR(p.vencimento)}</td>
          <td>${p.payment_methods?.nome ?? "—"}</td>
          <td>${p.status === "recebido" ? "Recebido em " + dataBR(p.data_recebimento) : p.status === "cancelado" ? "Cancelada" : "Pendente"}</td>
        </tr>`,
      )
      .join("");
    const linhasTecnicos = faturamento.tecnicos
      .map(
        (t: any) => `<tr><td>${t.nome_livre ?? t.membro_user_id}</td><td>${brl(t.valor)}</td></tr>`,
      )
      .join("");
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Faturamento OS ${os.numero}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:40px;color:#1b1b2b;line-height:1.4}
        h1{margin:0;font-size:20px}
        header{display:flex;justify-content:space-between;border-bottom:2px solid #4f46e5;padding-bottom:12px}
        table{width:100%;margin-top:20px;border-collapse:collapse}
        td,th{padding:6px 8px;text-align:left;border-bottom:1px solid #f3f4f6;font-size:12px}
        .total{margin-top:20px;font-size:18px;font-weight:800;color:#4f46e5}
      </style></head><body>
      <header>
        <div><h1>${faturamento.descricao ?? `Faturamento — OS nº ${os.numero}`}</h1><small>Cliente: ${os.clientes?.nome ?? "—"}</small></div>
        <div style="text-align:right"><strong>${dataBR(faturamento.created_at)}</strong></div>
      </header>
      <p class="total">Total faturado: ${brl(faturamento.valor_total)}</p>
      <p>Categoria: ${faturamento.categoriaNome ?? "—"}</p>
      <table><thead><tr><th>Parcela</th><th>Valor</th><th>Vencimento</th><th>Forma</th><th>Status</th></tr></thead>
      <tbody>${linhasParcelas}</tbody></table>
      ${
        faturamento.tecnicos.length
          ? `<h3>Divisão entre técnicos</h3><table><thead><tr><th>Técnico</th><th>Valor</th></tr></thead><tbody>${linhasTecnicos}</tbody></table>`
          : ""
      }
      <script>window.onload=()=>window.print()<\/script>
      </body></html>`);
    janela.document.close();
  }

  function pedirFechar() {
    if (sujo) {
      setConfirmSaidaAberto(true);
      return;
    }
    onOpenChange(false);
  }

  function fecharSemSalvar() {
    setConfirmSaidaAberto(false);
    setSujo(false);
    onOpenChange(false);
  }

  const recebidoTotal = parcelas.filter((p) => p.recebido).reduce((s, p) => s + p.valor, 0);
  const aReceberTotal = parcelas.filter((p) => !p.recebido).reduce((s, p) => s + p.valor, 0);

  const carregando = carregandoOs || carregandoFaturamento || carregandoItens;
  const mostrarFormulario =
    !carregando && inicializado && os && podeFaturar && !faturamento && totalItens > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && pedirFechar()}>
        <DialogContent className="flex max-h-[95vh] w-[calc(100%-1rem)] max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100%-2rem)] sm:rounded-2xl">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold sm:text-lg">Faturar OS</DialogTitle>
              <DialogDescription className="text-xs">
                {os ? `OS Nº ${os.numero} · Gera receita no financeiro` : "Carregando…"}
              </DialogDescription>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {carregando && <p className="text-sm text-muted-foreground">Carregando...</p>}

            {!carregando && !os && <p className="text-sm text-destructive">OS não encontrada.</p>}

            {!carregando && os && !podeFaturar && (
              <p className="text-sm text-destructive">
                Você não tem permissão para faturar ordens de serviço (é preciso poder gerenciar
                Ordens e Financeiro).
              </p>
            )}

            {!carregando && os && podeFaturar && totalItens <= 0 && !faturamento && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Esta OS não tem itens com valor — adicione produtos/serviços antes de faturar.
              </p>
            )}

            {!carregando && os && podeFaturar && faturamento && (
              <FaturamentoDetalhe
                os={os}
                faturamento={faturamento}
                receberParcela={receberParcela}
                cancelarFaturamento={cancelarFaturamento}
                imprimirRecibo={imprimirRecibo}
              />
            )}

            {mostrarFormulario && (
              <fieldset disabled={faturar.isPending} className="space-y-6">
                <section>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Identificação
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Descrição</Label>
                      <Input
                        value={descricao}
                        onChange={(e) => {
                          setDescricao(e.target.value);
                          setSujo(true);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        Cliente <span className="text-destructive">*</span>
                      </Label>
                      <Popover open={clientePopoverAberto} onOpenChange={setClientePopoverAberto}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal"
                          >
                            <span className="truncate">
                              {clienteSelecionado?.nome ?? "Buscar cliente..."}
                            </span>
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar cliente..." />
                            <CommandList>
                              <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                              <CommandGroup>
                                {clientesLista.map((c) => (
                                  <CommandItem
                                    key={c.id}
                                    value={c.nome}
                                    onSelect={() => {
                                      setClienteId(c.id);
                                      setSujo(true);
                                      setClientePopoverAberto(false);
                                    }}
                                  >
                                    {c.nome}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Valores
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label>
                        Valor bruto <span className="text-destructive">*</span>
                      </Label>
                      <Input value={brl(totalItens)} disabled />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Desconto</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={desconto}
                        onChange={(e) => {
                          setDesconto(Math.max(0, Number(e.target.value) || 0));
                          setSujo(true);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        Valor com desconto <span className="text-destructive">*</span>
                      </Label>
                      <Input value={brl(totalOs)} disabled className="font-semibold" />
                      <p className="text-xs text-muted-foreground">
                        Desconto aplicado na OS: {brl(os.desconto ?? 0)}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        Categoria (receita) <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={categoriaId}
                        onValueChange={(v) => {
                          setCategoriaId(v);
                          setSujo(true);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Valor bruto</p>
                      <p className="font-semibold">{brl(totalItens)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Desconto</p>
                      <p className="font-semibold">{brl(desconto)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total a faturar</p>
                      <p className="text-lg font-extrabold text-primary">{brl(totalOs)}</p>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                        Pagamento
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Defina como o valor será recebido.
                      </p>
                    </div>
                    <span className="text-sm font-semibold">Total: {brl(totalOs)}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {PARCELAS_RAPIDAS.map((n) => (
                      <Button
                        key={n}
                        type="button"
                        variant={parcelas.length === n ? "default" : "outline"}
                        size="sm"
                        onClick={() => aplicarParcelamento(n)}
                      >
                        {n}x
                      </Button>
                    ))}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant={PARCELAS_MAIS.includes(parcelas.length) ? "default" : "outline"}
                          size="sm"
                        >
                          Mais <ChevronDown className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {PARCELAS_MAIS.map((n) => (
                          <DropdownMenuItem key={n} onClick={() => aplicarParcelamento(n)}>
                            {n}x
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => aplicarParcelamento(parcelas.length + 1)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Parcela
                    </Button>
                  </div>

                  {/* Desktop */}
                  <div className="mt-4 hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parcela</TableHead>
                          <TableHead>
                            Valor <span className="text-destructive">*</span>
                          </TableHead>
                          <TableHead>
                            Vencimento <span className="text-destructive">*</span>
                          </TableHead>
                          <TableHead>
                            Forma <span className="text-destructive">*</span>
                          </TableHead>
                          <TableHead>Recebido</TableHead>
                          <TableHead>Data recebimento</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parcelas.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              {p.numero_parcela}/{parcelas.length}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={p.valor}
                                onChange={(e) =>
                                  atualizarParcela(p.id, { valor: Number(e.target.value) })
                                }
                                className="w-28"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={p.vencimento}
                                onChange={(e) =>
                                  atualizarParcela(p.id, { vencimento: e.target.value })
                                }
                                className="w-40"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={p.forma_pagamento_id}
                                onValueChange={(v) =>
                                  atualizarParcela(p.id, { forma_pagamento_id: v })
                                }
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue placeholder="Forma" />
                                </SelectTrigger>
                                <SelectContent>
                                  {formasPagamento.map((f) => (
                                    <SelectItem key={f.id} value={f.id}>
                                      {f.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={p.recebido}
                                  onCheckedChange={(v) =>
                                    atualizarParcela(p.id, {
                                      recebido: v,
                                      data_recebimento: v ? p.data_recebimento || hojeISO() : "",
                                    })
                                  }
                                />
                                <span className="text-xs text-muted-foreground">
                                  {p.recebido ? "Recebido" : "Não recebido"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {p.recebido && (
                                <Input
                                  type="date"
                                  value={p.data_recebimento}
                                  onChange={(e) =>
                                    atualizarParcela(p.id, { data_recebimento: e.target.value })
                                  }
                                  className="w-40"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                disabled={parcelas.length <= 1}
                                className="text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                                onClick={() => removerParcela(p.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile: card por parcela */}
                  <div className="mt-4 grid gap-3 md:hidden">
                    {parcelas.map((p) => (
                      <div key={p.id} className="space-y-2 rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold">
                            Parcela {p.numero_parcela}/{parcelas.length}
                          </p>
                          <button
                            type="button"
                            disabled={parcelas.length <= 1}
                            className="text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                            onClick={() => removerParcela(p.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Valor</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={p.valor}
                            onChange={(e) =>
                              atualizarParcela(p.id, { valor: Number(e.target.value) })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Vencimento</Label>
                          <Input
                            type="date"
                            value={p.vencimento}
                            onChange={(e) => atualizarParcela(p.id, { vencimento: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Forma de recebimento</Label>
                          <Select
                            value={p.forma_pagamento_id}
                            onValueChange={(v) => atualizarParcela(p.id, { forma_pagamento_id: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Forma" />
                            </SelectTrigger>
                            <SelectContent>
                              {formasPagamento.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Recebido</Label>
                          <Switch
                            checked={p.recebido}
                            onCheckedChange={(v) =>
                              atualizarParcela(p.id, {
                                recebido: v,
                                data_recebimento: v ? p.data_recebimento || hojeISO() : "",
                              })
                            }
                          />
                        </div>
                        {p.recebido && (
                          <div className="space-y-1">
                            <Label className="text-xs">Data de recebimento</Label>
                            <Input
                              type="date"
                              value={p.data_recebimento}
                              onChange={(e) =>
                                atualizarParcela(p.id, { data_recebimento: e.target.value })
                              }
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-3">
                    <p>
                      Total da OS: <strong>{brl(totalOs)}</strong>
                    </p>
                    <p>
                      Soma das parcelas: <strong>{brl(somaParcelas)}</strong>
                    </p>
                    <p>
                      Diferença: <strong>{brl(diferencaParcelas)}</strong>
                    </p>
                  </div>
                  {Math.abs(diferencaParcelas) <= 0.01 ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Parcelamento conferido
                    </p>
                  ) : (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" /> Ajuste o valor das parcelas
                    </p>
                  )}
                </section>

                <section>
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    <Users className="h-4 w-4 text-primary" /> Divisão do serviço entre técnicos
                  </h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    O valor da OS é dividido entre os técnicos responsáveis. Informe quanto da OS
                    corresponde a cada técnico.
                  </p>

                  <div className="space-y-2">
                    {tecnicos.map((t) => (
                      <div
                        key={t.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
                      >
                        <Select
                          value={t.membro_user_id || (t.nome_livre ? OUTRO : "")}
                          onValueChange={(v) =>
                            atualizarTecnico(
                              t.id,
                              v === OUTRO
                                ? { membro_user_id: "" }
                                : { membro_user_id: v, nome_livre: "" },
                            )
                          }
                        >
                          <SelectTrigger className="w-56">
                            <SelectValue placeholder="Selecione o técnico" />
                          </SelectTrigger>
                          <SelectContent>
                            {membros.map((m: any) => (
                              <SelectItem key={m.user_id} value={m.user_id}>
                                {m.email}
                              </SelectItem>
                            ))}
                            <SelectItem value={OUTRO}>Outro (digitar nome)</SelectItem>
                          </SelectContent>
                        </Select>
                        {!t.membro_user_id && (
                          <Input
                            placeholder="Nome do técnico"
                            value={t.nome_livre}
                            onChange={(e) => atualizarTecnico(t.id, { nome_livre: e.target.value })}
                            className="w-48"
                          />
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={t.valor}
                            onChange={(e) =>
                              atualizarTecnico(t.id, { valor: Number(e.target.value) })
                            }
                            className="w-28"
                          />
                        </div>
                        <button
                          type="button"
                          className="ml-auto text-muted-foreground hover:text-destructive"
                          onClick={() => removerTecnico(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {!tecnicos.length && (
                      <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                        Nenhum técnico adicionado. O faturamento pode prosseguir sem divisão.
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={adicionarTecnico}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar técnico
                  </Button>

                  {tecnicos.length > 0 && (
                    <>
                      <div className="mt-3 grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-3">
                        <p>
                          Total da OS: <strong>{brl(totalOs)}</strong>
                        </p>
                        <p>
                          Total distribuído: <strong>{brl(somaTecnicos)}</strong>
                        </p>
                        <p>
                          Diferença: <strong>{brl(diferencaTecnicos)}</strong>
                        </p>
                      </div>
                      {Math.abs(diferencaTecnicos) <= 0.01 ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Divisão conferida
                        </p>
                      ) : diferencaTecnicos > 0 ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> Faltam {brl(diferencaTecnicos)}{" "}
                          para distribuir
                        </p>
                      ) : (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> Você distribuiu{" "}
                          {brl(Math.abs(diferencaTecnicos))} a mais que o valor da OS
                        </p>
                      )}
                    </>
                  )}
                </section>

                <section className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => {
                      setObservacoes(e.target.value);
                      setSujo(true);
                    }}
                  />
                </section>
              </fieldset>
            )}
          </div>

          {mostrarFormulario && (
            <div className="border-t border-border px-5 py-4 sm:px-6">
              {erro && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {erro}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Total a faturar: <strong className="text-foreground">{brl(totalOs)}</strong>
                  </span>
                  <span>
                    Parcelas: <strong className="text-foreground">{parcelas.length}</strong>
                  </span>
                  <span>
                    Recebido: <strong className="text-foreground">{brl(recebidoTotal)}</strong>
                  </span>
                  <span>
                    A receber: <strong className="text-foreground">{brl(aReceberTotal)}</strong>
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={pedirFechar}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={faturar.isPending || !podeSubmeter}
                    onClick={() => faturar.mutate()}
                  >
                    {faturar.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Faturando...
                      </>
                    ) : (
                      <>
                        <Receipt className="mr-2 h-4 w-4" /> Faturar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSaidaAberto} onOpenChange={setConfirmSaidaAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Existem alterações não salvas. Deseja realmente sair?
            </AlertDialogTitle>
            <AlertDialogDescription>
              As alterações feitas neste faturamento serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={fecharSemSalvar}>Sair sem salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FaturamentoDetalhe({
  os,
  faturamento,
  receberParcela,
  cancelarFaturamento,
  imprimirRecibo,
}: {
  os: any;
  faturamento: any;
  receberParcela: ReturnType<typeof useMutation<void, Error, string>>;
  cancelarFaturamento: ReturnType<typeof useMutation<void, Error, void>>;
  imprimirRecibo: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm">
          <strong>Esta OS já possui faturamento financeiro.</strong> Faturada em{" "}
          <strong>{dataBR(faturamento.created_at)}</strong>, total{" "}
          <strong>{brl(faturamento.valor_total)}</strong>
          {faturamento.categoriaNome ? ` — categoria ${faturamento.categoriaNome}` : ""}.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-bold">Parcelas</h3>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcela</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {faturamento.parcelas.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.numero_parcela}/{p.total_parcelas}
                  </TableCell>
                  <TableCell>{brl(p.valor)}</TableCell>
                  <TableCell>{dataBR(p.vencimento)}</TableCell>
                  <TableCell>{p.payment_methods?.nome ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        p.status === "recebido"
                          ? "default"
                          : p.status === "cancelado"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {p.status === "recebido"
                        ? `Recebido em ${dataBR(p.data_recebimento)}`
                        : p.status === "cancelado"
                          ? "Cancelada"
                          : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.status === "pendente" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => receberParcela.mutate(p.id)}
                      >
                        Marcar recebida
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-3 md:hidden">
          {faturamento.parcelas.map((p: any) => (
            <div key={p.id} className="space-y-1 rounded-lg border border-border p-3">
              <p className="text-sm font-bold">
                Parcela {p.numero_parcela}/{p.total_parcelas} — {brl(p.valor)}
              </p>
              <p className="text-xs text-muted-foreground">Vencimento: {dataBR(p.vencimento)}</p>
              <p className="text-xs text-muted-foreground">
                Forma: {p.payment_methods?.nome ?? "—"}
              </p>
              <Badge
                variant={
                  p.status === "recebido"
                    ? "default"
                    : p.status === "cancelado"
                      ? "outline"
                      : "secondary"
                }
              >
                {p.status === "recebido"
                  ? `Recebido em ${dataBR(p.data_recebimento)}`
                  : p.status === "cancelado"
                    ? "Cancelada"
                    : "Pendente"}
              </Badge>
              {p.status === "pendente" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => receberParcela.mutate(p.id)}
                >
                  Marcar recebida
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {faturamento.tecnicos.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold">Divisão entre técnicos</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {faturamento.tecnicos.map((t: any) => (
              <div
                key={t.id}
                className="flex justify-between rounded-lg border border-border p-2 text-sm"
              >
                <span>{t.nome_livre ?? t.membro_user_id}</span>
                <span className="font-semibold">{brl(t.valor)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={imprimirRecibo}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir recibo
        </Button>
        <Button
          variant="destructive"
          disabled={cancelarFaturamento.isPending}
          onClick={() => {
            if (
              window.confirm(
                "Cancelar este faturamento? Um estorno será registrado quando houver parcelas já recebidas.",
              )
            ) {
              cancelarFaturamento.mutate();
            }
          }}
        >
          <Ban className="mr-2 h-4 w-4" />
          {cancelarFaturamento.isPending ? "Cancelando..." : "Cancelar faturamento"}
        </Button>
      </div>
    </div>
  );
}
