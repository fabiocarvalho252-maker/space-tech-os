// Cadastro/edição de compra de seminovo (reformulação do módulo "Compra de
// Seminovos", pedido do usuário) — mesma receita de CadastroAparelhoModal
// (Dialog + Label/Input/Select direto na tabela via RLS, sem função de
// servidor), com seções maiores e touch-friendly para uso em tablet. Custo
// total e lucros são colunas GENERATED no Postgres (ver migration
// 20260831130000_seminovos_reformulacao.sql) — os valores mostrados aqui
// são só uma prévia otimista, o valor real vem sempre do banco.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { formatarCpf, limparCpf, validarCpf } from "@/lib/cpf";
import { randomId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/MoneyInput";
import { PatternLock } from "@/components/PatternLock";
import { Eye, EyeOff } from "lucide-react";
import { ConsertoCustosSection } from "./ConsertoCustosSection";
import { AssinaturaCanvas, type AssinaturaCanvasHandle } from "./AssinaturaCanvas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type SeminovoRow = Database["public"]["Tables"]["seminovos"]["Row"];
type ClienteRow = { id: string; nome: string; telefone: string | null; documento: string | null };

const BUCKET_FOTOS = "seminovos-fotos";

const ESTADOS = ["Excelente", "Bom", "Regular", "Ruim"];

// "vendido" e "devolvido" nunca aparecem aqui de propósito — só são
// alcançados pelas ações dedicadas "Vender"/"Devolver", que também criam a
// venda/lançamento financeiro correspondente. Deixar o formulário setar
// esses status manualmente destruiria essa integração.
const STATUS_CADASTRO = [
  { value: "pendente", label: "Pendente" },
  { value: "disponivel", label: "Disponível para venda" },
  { value: "sucata", label: "Sucata" },
  { value: "sem_solucao", label: "Sem solução" },
];

type FormState = {
  cliente_id: string;
  vendedor_nome: string;
  vendedor_telefone: string;
  vendedor_documento: string;
  marca: string;
  modelo: string;
  imei: string;
  armazenamento: string;
  ram: string;
  cor: string;
  estado: string;
  bateria_percentual: string;
  acessorios: string;
  senha_dispositivo: string;
  padrao_desbloqueio: string;
  observacoes: string;
  data_avaliacao: string;
  valor_pago: string;
  outros_custos: string;
  preco_venda: string;
  preco_lojista: string;
  status: string;
};

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

const formVazio: FormState = {
  cliente_id: "",
  vendedor_nome: "",
  vendedor_telefone: "",
  vendedor_documento: "",
  marca: "",
  modelo: "",
  imei: "",
  armazenamento: "",
  ram: "",
  cor: "",
  estado: "Bom",
  bateria_percentual: "",
  acessorios: "",
  senha_dispositivo: "",
  padrao_desbloqueio: "",
  observacoes: "",
  data_avaliacao: hoje(),
  valor_pago: "0",
  outros_custos: "0",
  preco_venda: "",
  preco_lojista: "",
  status: "pendente",
};

export function CadastroSeminovoModal({
  open,
  onOpenChange,
  seminovo,
  empresaId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seminovo: SeminovoRow | null;
  empresaId: string;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(formVazio);
  // Só existe uma vez que o aparelho já foi salvo (o detalhamento precisa de
  // um seminovo_id para anexar os itens) — nula ao criar, atualizada pela
  // própria ConsertoCustosSection quando editando um aparelho existente.
  const [totalConserto, setTotalConserto] = useState(0);
  const [verSenha, setVerSenha] = useState(false);

  // CPF + assinatura só fazem parte do momento da compra (pedido, seção 1:
  // "somente no processo de compra do aparelho do cliente") — só existem
  // quando `seminovo` é null. `fase` intercala o formulário com a tela de
  // conferência (pedido, seção 5) antes do registro efetivo; o canvas fica
  // sempre montado (escondido via CSS, não desmontado) para não perder o
  // traço ao voltar da conferência para editar.
  const [fase, setFase] = useState<"formulario" | "confirmacao">("formulario");
  const [cpfSugestao, setCpfSugestao] = useState<ClienteRow | null>(null);
  const canvasRef = useRef<AssinaturaCanvasHandle>(null);
  const [assinaturaBlob, setAssinaturaBlob] = useState<Blob | null>(null);
  const [assinaturaPreviewUrl, setAssinaturaPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!seminovo) setTotalConserto(0);
  }, [seminovo]);

  useEffect(() => {
    if (!open) {
      setFase("formulario");
      setVerSenha(false);
      setCpfSugestao(null);
      setAssinaturaBlob(null);
      setAssinaturaPreviewUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (seminovo) {
      setForm({
        cliente_id: seminovo.cliente_id ?? "",
        vendedor_nome: seminovo.vendedor_nome ?? "",
        vendedor_telefone: seminovo.vendedor_telefone ?? "",
        vendedor_documento: seminovo.vendedor_documento
          ? formatarCpf(seminovo.vendedor_documento)
          : "",
        marca: seminovo.marca,
        modelo: seminovo.modelo,
        imei: seminovo.imei ?? "",
        armazenamento: seminovo.armazenamento ?? "",
        ram: seminovo.ram ?? "",
        cor: seminovo.cor ?? "",
        estado: seminovo.estado ?? "Bom",
        bateria_percentual:
          seminovo.bateria_percentual != null ? String(seminovo.bateria_percentual) : "",
        acessorios: seminovo.acessorios ?? "",
        senha_dispositivo: seminovo.senha_dispositivo ?? "",
        padrao_desbloqueio: seminovo.padrao_desbloqueio ?? "",
        observacoes: seminovo.observacoes ?? "",
        data_avaliacao: seminovo.data_avaliacao ? seminovo.data_avaliacao.slice(0, 10) : hoje(),
        valor_pago: String(seminovo.valor_pago ?? 0),
        outros_custos: String(seminovo.outros_custos ?? 0),
        preco_venda: seminovo.preco_venda != null ? String(seminovo.preco_venda) : "",
        preco_lojista: seminovo.preco_lojista != null ? String(seminovo.preco_lojista) : "",
        status: seminovo.status,
      });
    } else {
      setForm(formVazio);
    }
  }, [open, seminovo]);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-seminovos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone, documento")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ClienteRow[];
    },
  });

  // Localizar/reutilizar cadastro existente pelo CPF (pedido, seção 2) —
  // só sugere quando a pessoa está sendo digitada como avulsa; selecionar
  // um cliente já limpa a sugestão via handler abaixo.
  useEffect(() => {
    if (form.cliente_id) {
      setCpfSugestao(null);
      return;
    }
    const digitos = limparCpf(form.vendedor_documento);
    if (digitos.length !== 11) {
      setCpfSugestao(null);
      return;
    }
    const encontrado = clientes.find((c) => limparCpf(c.documento ?? "") === digitos);
    setCpfSugestao(encontrado ?? null);
  }, [form.vendedor_documento, form.cliente_id, clientes]);

  function usarClienteSugerido() {
    if (!cpfSugestao) return;
    setForm((f) => ({
      ...f,
      cliente_id: cpfSugestao.id,
      vendedor_documento: cpfSugestao.documento
        ? formatarCpf(cpfSugestao.documento)
        : f.vendedor_documento,
    }));
    setCpfSugestao(null);
  }

  const clienteSelecionado = clientes.find((c) => c.id === form.cliente_id);
  const cpfPreenchidoPeloCliente = !!clienteSelecionado?.documento;

  const custoTotal =
    (Number(form.valor_pago) || 0) + totalConserto + (Number(form.outros_custos) || 0);
  const precoVendaNum = Number(form.preco_venda) || 0;
  const precoLojistaNum = Number(form.preco_lojista) || 0;
  const lucroPrevisto = precoVendaNum - custoTotal;
  const lucroMinimo = precoLojistaNum - custoTotal;
  const margem = precoVendaNum > 0 ? (lucroPrevisto / precoVendaNum) * 100 : 0;

  function validarFormulario() {
    if (!form.marca.trim()) throw new Error("Informe a marca.");
    if (!form.modelo.trim()) throw new Error("Informe o modelo.");
    if (!form.cliente_id && !form.vendedor_nome.trim()) {
      throw new Error("Selecione um cliente cadastrado ou informe o nome de quem vendeu.");
    }
    if (!form.data_avaliacao) throw new Error("Informe a data da compra.");
    if (!(Number(form.valor_pago) >= 0))
      throw new Error("O valor de compra não pode ser negativo.");
    if ((Number(form.outros_custos) || 0) < 0)
      throw new Error("Outros custos não podem ser negativos.");
    if (form.preco_venda && Number(form.preco_venda) < 0) {
      throw new Error("O valor para cliente não pode ser negativo.");
    }
    if (form.preco_lojista && Number(form.preco_lojista) < 0) {
      throw new Error("O valor para lojista não pode ser negativo.");
    }
    // CPF é obrigatório somente no momento da compra (pedido, seção 1) — ao
    // editar um aparelho já comprado sem CPF registrado, não força a
    // preencher agora; só valida o formato se algo foi digitado.
    if (!seminovo) {
      if (!limparCpf(form.vendedor_documento)) throw new Error("Informe o CPF do vendedor.");
      if (!validarCpf(form.vendedor_documento)) throw new Error("CPF inválido.");
    } else if (form.vendedor_documento && !validarCpf(form.vendedor_documento)) {
      throw new Error("CPF inválido.");
    }
  }

  function irParaConfirmacao() {
    try {
      validarFormulario();
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    canvasRef.current?.obterBlob().then((blob) => {
      if (!blob) {
        toast.error("É necessário coletar a assinatura do vendedor para concluir a compra.");
        return;
      }
      setAssinaturaBlob(blob);
      setAssinaturaPreviewUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return URL.createObjectURL(blob);
      });
      setFase("confirmacao");
    });
  }

  const salvar = useMutation({
    mutationFn: async () => {
      validarFormulario();
      if (!seminovo && !assinaturaBlob) {
        throw new Error("É necessário coletar a assinatura do vendedor para concluir a compra.");
      }
      const valorPago = Number(form.valor_pago);
      const outrosCustos = Number(form.outros_custos) || 0;

      const payload = {
        user_id: empresaId,
        cliente_id: form.cliente_id || null,
        vendedor_nome: form.vendedor_nome.trim() || null,
        vendedor_telefone: form.vendedor_telefone.trim() || null,
        vendedor_documento: form.vendedor_documento ? formatarCpf(form.vendedor_documento) : null,
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        imei: form.imei.trim() || null,
        armazenamento: form.armazenamento.trim() || null,
        ram: form.ram.trim() || null,
        cor: form.cor.trim() || null,
        estado: form.estado || null,
        bateria_percentual: form.bateria_percentual ? Number(form.bateria_percentual) : null,
        acessorios: form.acessorios.trim() || null,
        senha_dispositivo: form.senha_dispositivo.trim() || null,
        padrao_desbloqueio: form.padrao_desbloqueio || null,
        observacoes: form.observacoes.trim() || null,
        data_avaliacao: new Date(form.data_avaliacao + "T12:00:00").toISOString(),
        valor_pago: valorPago,
        outros_custos: outrosCustos,
        preco_venda: form.preco_venda ? Number(form.preco_venda) : null,
        preco_lojista: form.preco_lojista ? Number(form.preco_lojista) : null,
        status: form.status,
      };

      if (seminovo) {
        const { error } = await supabase.from("seminovos").update(payload).eq("id", seminovo.id);
        if (error) throw error;
      } else {
        const { data: criado, error } = await supabase
          .from("seminovos")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        // Assinatura só pode subir depois de existir o id do aparelho — mesma
        // convenção de path de SeminovosFotos.tsx (empresa/aparelho/arquivo).
        if (assinaturaBlob) {
          const path = `${empresaId}/${criado.id}/assinatura-${randomId()}.png`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET_FOTOS)
            .upload(path, assinaturaBlob, { contentType: "image/png" });
          if (upErr) throw upErr;
          const { error: assErro } = await supabase
            .from("seminovos")
            .update({ assinatura_url: path, assinatura_coletada_em: new Date().toISOString() })
            .eq("id", criado.id);
          if (assErro) throw assErro;
        }

        // Lançamento de despesa só na criação — editar depois (corrigir um
        // valor digitado errado, por exemplo) não deve gerar uma segunda
        // saída duplicada no financeiro.
        if (valorPago > 0) {
          await supabase.from("lancamentos").insert({
            user_id: empresaId,
            tipo: "saida",
            categoria: "Compra de seminovo",
            descricao: `Compra de ${form.marca.trim()} ${form.modelo.trim()}${form.vendedor_nome.trim() ? ` — ${form.vendedor_nome.trim()}` : ""}`,
            valor: valorPago,
            data: form.data_avaliacao,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success(seminovo ? "Aparelho atualizado" : "Compra registrada");
      qc.invalidateQueries({ queryKey: ["seminovos"] });
      // Seminovos disponíveis espelham em Aparelhos (trigger no banco).
      qc.invalidateQueries({ queryKey: ["aparelhos"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function campo<K extends keyof FormState>(chave: K) {
    return {
      value: form[chave],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [chave]: e.target.value })),
    };
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {seminovo ? "Editar aparelho" : "Comprar aparelho"}
          </DialogTitle>
        </DialogHeader>

        <div className={fase === "confirmacao" ? "hidden" : "space-y-7"}>
          {/* SEÇÃO 1 — APARELHO */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
              Informações do aparelho
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Marca *</Label>
                <Input className="h-11" {...campo("marca")} placeholder="Apple" />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo *</Label>
                <Input className="h-11" {...campo("modelo")} placeholder="iPhone 11" />
              </div>
              <div className="space-y-1.5">
                <Label>Armazenamento</Label>
                <Input className="h-11" {...campo("armazenamento")} placeholder="128 GB" />
              </div>
              <div className="space-y-1.5">
                <Label>RAM</Label>
                <Input className="h-11" {...campo("ram")} />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <Input className="h-11" {...campo("cor")} />
              </div>
              <div className="space-y-1.5">
                <Label>IMEI</Label>
                <Input className="h-11" inputMode="numeric" {...campo("imei")} />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={form.estado}
                  onValueChange={(v) => setForm((f) => ({ ...f, estado: v }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bateria (%)</Label>
                <Input
                  className="h-11"
                  type="number"
                  min={0}
                  max={100}
                  {...campo("bateria_percentual")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data da compra *</Label>
                <Input className="h-11" type="date" {...campo("data_avaliacao")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Acessórios deixados</Label>
              <Input
                className="h-11"
                {...campo("acessorios")}
                placeholder="Carregador, caixa, fone..."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Senha do aparelho (PIN)</Label>
                <div className="relative">
                  <Input
                    className="h-11 pr-11"
                    type={verSenha ? "text" : "password"}
                    autoComplete="off"
                    {...campo("senha_dispositivo")}
                    placeholder="Senha ou PIN do cliente"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
                    onClick={() => setVerSenha((v) => !v)}
                    title={verSenha ? "Ocultar senha" : "Ver senha"}
                  >
                    {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Padrão de desbloqueio</Label>
                <PatternLock
                  value={form.padrao_desbloqueio}
                  onChange={(val) => setForm((f) => ({ ...f, padrao_desbloqueio: val }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                rows={2}
              />
            </div>
          </section>

          {/* SEÇÃO 2 — COMPRADO DE */}
          <section className="space-y-4 rounded-2xl border border-border bg-secondary/20 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
              👤 Dados do vendedor
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Cliente cadastrado (opcional)</Label>
                <Select
                  value={form.cliente_id || "none"}
                  onValueChange={(v) => {
                    if (v === "none") {
                      setForm((f) => ({ ...f, cliente_id: "" }));
                      return;
                    }
                    const cliente = clientes.find((c) => c.id === v);
                    setForm((f) => ({
                      ...f,
                      cliente_id: v,
                      vendedor_documento: cliente?.documento
                        ? formatarCpf(cliente.documento)
                        : f.vendedor_documento,
                    }));
                  }}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum — pessoa avulsa</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nome completo {form.cliente_id ? "" : "*"}</Label>
                <Input className="h-11" {...campo("vendedor_nome")} disabled={!!form.cliente_id} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone / WhatsApp</Label>
                <Input className="h-11" type="tel" {...campo("vendedor_telefone")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>CPF {seminovo ? "" : "*"}</Label>
                <Input
                  className="h-11"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={form.vendedor_documento}
                  disabled={cpfPreenchidoPeloCliente}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vendedor_documento: formatarCpf(e.target.value) }))
                  }
                />
                {limparCpf(form.vendedor_documento).length === 11 &&
                  !validarCpf(form.vendedor_documento) && (
                    <p className="text-xs font-medium text-destructive">CPF inválido.</p>
                  )}
                {cpfSugestao && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                    <span>
                      Cliente já cadastrado: <strong>{cpfSugestao.nome}</strong>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={usarClienteSugerido}
                    >
                      Usar este cadastro
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SEÇÃO 3 — ASSINATURA (só na compra — pedido, seção 1: "somente
              no processo de compra do aparelho do cliente") */}
          {!seminovo && (
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
                ✍️ Assinatura do vendedor
              </h3>
              <p className="text-xs text-muted-foreground">
                Peça para a pessoa assinar na tela com o dedo, caneta ou mouse.
              </p>
              <AssinaturaCanvas ref={canvasRef} />
            </section>
          )}

          {/* SEÇÃO 4 — CUSTOS */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-primary">Custos</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Valor de compra *</Label>
                <MoneyInput
                  className="h-11"
                  value={form.valor_pago}
                  onChange={(v) => setForm((f) => ({ ...f, valor_pago: String(v) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Outros custos</Label>
                <MoneyInput
                  className="h-11"
                  value={form.outros_custos}
                  onChange={(v) => setForm((f) => ({ ...f, outros_custos: String(v) }))}
                />
              </div>
            </div>

            {seminovo ? (
              <div className="border-t border-border pt-4">
                <ConsertoCustosSection
                  seminovoId={seminovo.id}
                  empresaId={empresaId}
                  podeGerenciar
                  onTotalChange={setTotalConserto}
                />
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                O detalhamento do custo de conserto fica disponível depois de registrar a compra —
                abra o aparelho novamente para adicionar.
              </p>
            )}

            <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
              Custo total: {brl(custoTotal)}
            </div>
          </section>

          {/* SEÇÃO 5 — PRECIFICAÇÃO */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-primary">Precificação</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Valor para cliente</Label>
                <MoneyInput
                  className="h-11"
                  value={form.preco_venda}
                  onChange={(v) => setForm((f) => ({ ...f, preco_venda: String(v) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor para lojista</Label>
                <MoneyInput
                  className="h-11"
                  value={form.preco_lojista}
                  onChange={(v) => setForm((f) => ({ ...f, preco_lojista: String(v) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-secondary/30 p-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Custo</p>
                <p className="font-bold">{brl(custoTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro previsto</p>
                <p
                  className={`font-bold ${lucroPrevisto >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {brl(lucroPrevisto)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro mínimo</p>
                <p
                  className={`font-bold ${lucroMinimo >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {brl(lucroMinimo)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem</p>
                <p className="font-bold">{margem.toFixed(1)}%</p>
              </div>
            </div>
          </section>

          {/* STATUS — "vendido"/"devolvido" só são alcançados pelas ações
              dedicadas (Vender/Devolver), que também mexem em venda e
              financeiro; por isso o campo some quando o aparelho já está
              num desses estados, em vez de deixar editar livremente aqui. */}
          {(!seminovo || (seminovo.status !== "vendido" && seminovo.status !== "devolvido")) && (
            <section className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_CADASTRO.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          )}
        </div>

        {/* CONFERÊNCIA — pedido, seção 5: resumo completo antes de gravar a
            compra de fato. Só existe no fluxo de compra (seminovo == null). */}
        {!seminovo && fase === "confirmacao" && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold">Confirmar compra</h3>

            <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm">
              <p className="mb-2 font-semibold text-foreground">Vendedor</p>
              <p>Nome: {clienteSelecionado?.nome ?? form.vendedor_nome}</p>
              <p>CPF: {form.vendedor_documento || "—"}</p>
              {form.vendedor_telefone && <p>Telefone: {form.vendedor_telefone}</p>}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <p className="mb-2 font-semibold text-foreground">Aparelho</p>
              <p>
                {form.marca} {form.modelo}
              </p>
              <p>
                {[form.armazenamento, form.cor].filter(Boolean).join(" · ") || "—"}
                {form.bateria_percentual ? ` · Bateria: ${form.bateria_percentual}%` : ""}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Compra</p>
                <p className="font-bold">{brl(Number(form.valor_pago) || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conserto</p>
                <p className="font-bold">{brl(totalConserto)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo total</p>
                <p className="font-bold">{brl(custoTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Preço previsto de venda</p>
                <p className="font-bold">{brl(Number(form.preco_venda) || 0)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 text-sm font-semibold text-foreground">Assinatura do vendedor</p>
              {assinaturaPreviewUrl && (
                <img
                  src={assinaturaPreviewUrl}
                  alt="Assinatura do vendedor"
                  className="h-32 w-full rounded-xl border border-border bg-white object-contain"
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          {fase === "confirmacao" ? (
            <>
              <Button variant="outline" className="h-11" onClick={() => setFase("formulario")}>
                Voltar e editar
              </Button>
              <Button className="h-11" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                {salvar.isPending ? "Registrando..." : "Confirmar compra"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                className="h-11"
                onClick={() => (seminovo ? salvar.mutate() : irParaConfirmacao())}
                disabled={salvar.isPending}
              >
                {salvar.isPending
                  ? "Salvando..."
                  : seminovo
                    ? "Salvar alterações"
                    : "Revisar e confirmar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
