// Formulário enxuto (01/11/2026): 4 passos numerados (Aparelho, De quem
// comprou, Valores, Assinatura), campos pouco usados em "Mais detalhes".
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
import { usePodeFinalizarSeminovo } from "@/hooks/useCurrentUser";
import { formatarCpf, limparCpf, validarCpf } from "@/lib/cpf";
import { randomId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/MoneyInput";
import { PatternLock } from "@/components/PatternLock";
import { NovaOsFotos } from "@/components/NovaOsFotos";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
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
import { ClienteSelect } from "@/components/ClienteSelect";
import { SEMINOVO_DEFEITOS, descreverDefeitos } from "@/lib/seminovos-defeitos";

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
  { value: "aguardando_finalizacao", label: "Aguardando finalização" },
  { value: "disponivel", label: "Disponível para venda" },
  { value: "sucata", label: "Sucata" },
  { value: "sem_solucao", label: "Sem solução" },
];

// Bloco numerado do formulário (1 Aparelho, 2 Vendedor, 3 Valores, 4 Assinatura).
function Secao({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2.5 text-base font-bold">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
          {numero}
        </span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

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
  defeitos_visiveis: string[];
  defeitos_obs: string;
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
  defeitos_visiveis: [],
  defeitos_obs: "",
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
  const podeFinalizar = usePodeFinalizarSeminovo();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(formVazio);
  // Só existe uma vez que o aparelho já foi salvo (o detalhamento precisa de
  // um seminovo_id para anexar os itens) — nula ao criar, atualizada pela
  // própria ConsertoCustosSection quando editando um aparelho existente.
  const [totalConserto, setTotalConserto] = useState(0);
  const [verSenha, setVerSenha] = useState(false);
  // Campos menos usados (RAM, data, acessórios, senha, observações...) ficam
  // recolhidos para o formulário mostrar só o essencial.
  const [maisDetalhes, setMaisDetalhes] = useState(false);

  // CPF + assinatura só fazem parte do momento da compra (pedido, seção 1:
  // "somente no processo de compra do aparelho do cliente") — só existem
  // quando `seminovo` é null. `fase` intercala o formulário com a tela de
  // conferência (pedido, seção 5) antes do registro efetivo; o canvas fica
  // sempre montado (escondido via CSS, não desmontado) para não perder o
  // traço ao voltar da conferência para editar.
  // "recusa": a avaliação não virou compra (sem CPF, assinatura nem
  // lançamento no Financeiro) — fica registrada como "recusado".
  const [fase, setFase] = useState<"formulario" | "confirmacao" | "recusa">("formulario");
  const [valorOferecido, setValorOferecido] = useState("0");
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [cpfSugestao, setCpfSugestao] = useState<ClienteRow | null>(null);
  const canvasRef = useRef<AssinaturaCanvasHandle>(null);
  const [assinaturaBlob, setAssinaturaBlob] = useState<Blob | null>(null);
  const [assinaturaPreviewUrl, setAssinaturaPreviewUrl] = useState<string | null>(null);
  // Fotos tiradas na compra — só em memória até o aparelho ser criado.
  const [fotosCompra, setFotosCompra] = useState<File[]>([]);

  useEffect(() => {
    if (!seminovo) setTotalConserto(0);
  }, [seminovo]);

  useEffect(() => {
    if (!open) {
      setFase("formulario");
      setValorOferecido("0");
      setMotivoRecusa("");
      setVerSenha(false);
      setMaisDetalhes(false);
      setCpfSugestao(null);
      setAssinaturaBlob(null);
      setFotosCompra([]);
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
        defeitos_visiveis: seminovo.defeitos_visiveis ?? [],
        defeitos_obs: seminovo.defeitos_obs ?? "",
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
      throw new Error("O menor preço não pode ser negativo.");
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
      // A data da compra fica em "Mais detalhes": abre para o erro ser visível.
      if (!form.data_avaliacao) setMaisDetalhes(true);
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

  async function enviarFotosCompra(seminovoId: string, oQue: string) {
    if (!fotosCompra.length) return;
    try {
      const paths: string[] = [];
      for (const file of fotosCompra) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${empresaId}/${seminovoId}/${randomId()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET_FOTOS).upload(path, file);
        if (upErr) throw upErr;
        paths.push(path);
      }
      const { error: fotosErro } = await supabase
        .from("seminovos")
        .update({ fotos: paths })
        .eq("id", seminovoId);
      if (fotosErro) throw fotosErro;
    } catch (e) {
      toast.warning(
        `${oQue}, mas as fotos não foram enviadas: ${(e as Error).message}. Envie pelo botão de fotos do aparelho.`,
      );
    }
  }

  function irParaRecusa() {
    const erro = !form.marca.trim()
      ? "Informe a marca."
      : !form.modelo.trim()
        ? "Informe o modelo."
        : !form.cliente_id && !form.vendedor_nome.trim()
          ? "Selecione um cliente cadastrado ou informe o nome de quem ofereceu."
          : null;
    if (erro) toast.error(erro);
    else setFase("recusa");
  }

  const recusar = useMutation({
    mutationFn: async () => {
      const oferecido = Number(valorOferecido) || 0;
      if (oferecido < 0) throw new Error("O valor oferecido não pode ser negativo.");
      const motivo = motivoRecusa.trim();
      const observacoes = [form.observacoes.trim(), motivo && `Motivo da recusa: ${motivo}`]
        .filter(Boolean)
        .join("\n");
      const { data: criado, error } = await supabase
        .from("seminovos")
        .insert({
          user_id: empresaId,
          cliente_id: form.cliente_id || null,
          vendedor_nome: form.vendedor_nome.trim() || null,
          vendedor_telefone: form.vendedor_telefone.trim() || null,
          vendedor_documento:
            form.vendedor_documento && validarCpf(form.vendedor_documento)
              ? formatarCpf(form.vendedor_documento)
              : null,
          marca: form.marca.trim(),
          modelo: form.modelo.trim(),
          imei: form.imei.trim() || null,
          armazenamento: form.armazenamento.trim() || null,
          ram: form.ram.trim() || null,
          cor: form.cor.trim() || null,
          estado: form.estado || null,
          bateria_percentual: form.bateria_percentual ? Number(form.bateria_percentual) : null,
          acessorios: form.acessorios.trim() || null,
          defeitos_visiveis: form.defeitos_visiveis,
          defeitos_obs: form.defeitos_obs.trim() || null,
          observacoes: observacoes || null,
          data_avaliacao: new Date(form.data_avaliacao + "T12:00:00").toISOString(),
          valor_oferecido: oferecido,
          valor_pago: 0,
          outros_custos: 0,
          status: "recusado",
        })
        .select("id")
        .single();
      if (error) throw error;
      await enviarFotosCompra(criado.id, "Avaliação registrada");
    },
    onSuccess: () => {
      toast.success("Avaliação recusada registrada");
      qc.invalidateQueries({ queryKey: ["seminovos"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
        defeitos_visiveis: form.defeitos_visiveis,
        defeitos_obs: form.defeitos_obs.trim() || null,
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

        // A compra já existe neste ponto — falha nas fotos não deve fazer o
        // usuário registrar a compra de novo; avisa e deixa enviar pelo
        // botão de fotos do aparelho (SeminovosFotos, mesmo path).
        await enviarFotosCompra(criado.id, "Compra registrada");

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

        <div className={fase !== "formulario" ? "hidden" : "space-y-8"}>
          {/* 1 — APARELHO: o essencial à vista, o resto em "Mais detalhes" */}
          <Secao numero={1} titulo="Aparelho">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Marca *</Label>
                <Input className="h-11" {...campo("marca")} placeholder="Apple" />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo *</Label>
                <Input className="h-11" {...campo("modelo")} placeholder="iPhone 11" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Armazenamento</Label>
                  <Input className="h-11" {...campo("armazenamento")} placeholder="128 GB" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cor</Label>
                  <Input className="h-11" {...campo("cor")} />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_7rem] gap-4">
                <div className="space-y-1.5">
                  <Label>IMEI</Label>
                  <Input className="h-11" inputMode="numeric" {...campo("imei")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bateria %</Label>
                  <Input
                    className="h-11"
                    type="number"
                    min={0}
                    max={100}
                    {...campo("bateria_percentual")}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Estado</Label>
              <div className="grid grid-cols-4 gap-2">
                {ESTADOS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, estado: e }))}
                    className={`h-11 rounded-xl border text-sm font-medium transition ${
                      form.estado === e
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Defeitos visíveis</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, defeitos_visiveis: [], defeitos_obs: "" }))
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    !form.defeitos_visiveis.length && !form.defeitos_obs.trim()
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  Sem defeitos visíveis
                </button>
                {SEMINOVO_DEFEITOS.map((d) => {
                  const marcado = form.defeitos_visiveis.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          defeitos_visiveis: marcado
                            ? f.defeitos_visiveis.filter((k) => k !== d.key)
                            : [...f.defeitos_visiveis, d.key],
                        }))
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        marcado
                          ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                          : "border-border text-muted-foreground hover:border-primary"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <Input
                className="h-11"
                value={form.defeitos_obs}
                onChange={(e) => setForm((f) => ({ ...f, defeitos_obs: e.target.value }))}
                placeholder="Outros defeitos (ex.: trinca no canto superior direito)"
              />
            </div>

            {/* Fotos só na compra; depois de registrado, ficam no botão de
                fotos do aparelho (SeminovosFotos). */}
            {!seminovo && (
              <NovaOsFotos
                fotos={fotosCompra}
                onChange={setFotosCompra}
                titulo="Fotos do aparelho"
              />
            )}

            <div className="rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => setMaisDetalhes((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
              >
                <span>
                  Mais detalhes
                  <span className="ml-1 font-normal text-muted-foreground">
                    (data, RAM, acessórios, senha, observações)
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${maisDetalhes ? "rotate-180" : ""}`}
                />
              </button>
              {maisDetalhes && (
                <div className="space-y-4 border-t border-border p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Data da compra *</Label>
                      <Input className="h-11" type="date" {...campo("data_avaliacao")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>RAM</Label>
                      <Input className="h-11" {...campo("ram")} />
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
                </div>
              )}
            </div>
          </Secao>

          {/* 2 — DE QUEM COMPROU */}
          <Secao numero={2} titulo="De quem comprou">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Cliente cadastrado</Label>
                <ClienteSelect
                  clientes={clientes}
                  value={form.cliente_id}
                  semClienteLabel="Pessoa não cadastrada — preencher abaixo"
                  className="h-11"
                  onChange={(v) => {
                    const cliente = clientes.find((c) => c.id === v);
                    setForm((f) => ({
                      ...f,
                      cliente_id: v,
                      vendedor_documento: cliente?.documento
                        ? formatarCpf(cliente.documento)
                        : f.vendedor_documento,
                    }));
                  }}
                />
              </div>
              {!form.cliente_id && (
                <>
                  <div className="space-y-1.5">
                    <Label>Nome completo *</Label>
                    <Input className="h-11" {...campo("vendedor_nome")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone / WhatsApp</Label>
                    <Input className="h-11" type="tel" {...campo("vendedor_telefone")} />
                  </div>
                </>
              )}
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
          </Secao>

          {/* 3 — VALORES: custo e preços juntos, com o resultado logo abaixo */}
          <Secao numero={3} titulo="Valores">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Valor pago ao vendedor *</Label>
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
              <div className="space-y-1.5">
                <Label>Preço de venda</Label>
                <MoneyInput
                  className="h-11"
                  value={form.preco_venda}
                  onChange={(v) => setForm((f) => ({ ...f, preco_venda: String(v) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Menor preço</Label>
                <MoneyInput
                  className="h-11"
                  value={form.preco_lojista}
                  onChange={(v) => setForm((f) => ({ ...f, preco_lojista: String(v) }))}
                />
              </div>
            </div>

            {seminovo && (
              <div className="rounded-2xl border border-border p-4">
                <ConsertoCustosSection
                  seminovoId={seminovo.id}
                  empresaId={empresaId}
                  podeGerenciar
                  onTotalChange={setTotalConserto}
                />
              </div>
            )}

            <div className="grid grid-cols-3 divide-x divide-border rounded-2xl bg-primary/5 py-3 text-center text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Custo total</p>
                <p className="font-bold">{brl(custoTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro previsto</p>
                <p
                  className={`font-bold ${lucroPrevisto >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {brl(lucroPrevisto)}
                </p>
                {form.preco_lojista && (
                  <p
                    className={`text-[11px] ${lucroMinimo >= 0 ? "text-muted-foreground" : "text-destructive"}`}
                  >
                    no menor preço: {brl(lucroMinimo)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem</p>
                <p className="font-bold">{margem.toFixed(1)}%</p>
              </div>
            </div>
            {!seminovo && (
              <p className="text-xs text-muted-foreground">
                Custos de conserto podem ser lançados depois, abrindo o aparelho em Editar.
              </p>
            )}
          </Secao>

          {/* 4 — ASSINATURA: só no momento da compra */}
          {!seminovo && (
            <Secao numero={4} titulo="Assinatura de quem vendeu">
              <p className="-mt-2 text-xs text-muted-foreground">
                Peça para a pessoa assinar na tela com o dedo, caneta ou mouse.
              </p>
              <AssinaturaCanvas ref={canvasRef} />
            </Secao>
          )}

          {/* STATUS — só na edição. Na compra o aparelho entra como
              "Pendente"; "vendido"/"devolvido" só pelas ações dedicadas
              (Vender/Devolver), que também mexem em venda e financeiro. */}
          {seminovo &&
            seminovo.status !== "vendido" &&
            seminovo.status !== "devolvido" &&
            seminovo.status !== "recusado" && (
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
                    {STATUS_CADASTRO.filter(
                      // Liberar para venda é da avaliação final (dono/admin).
                      (s) =>
                        s.value !== "disponivel" ||
                        podeFinalizar ||
                        seminovo.status === "disponivel",
                    ).map((s) => (
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
              <p>
                Defeitos visíveis:{" "}
                {descreverDefeitos(form.defeitos_visiveis, form.defeitos_obs) ?? "nenhum"}
              </p>
              <p>Fotos: {fotosCompra.length ? `${fotosCompra.length} anexada(s)` : "nenhuma"}</p>
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

        {!seminovo && fase === "recusa" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold">Avaliação recusada</h3>
              <p className="text-sm text-muted-foreground">
                {form.marca} {form.modelo} — {clienteSelecionado?.nome ?? form.vendedor_nome}. Fica
                registrada no histórico, sem compra, sem assinatura e sem lançamento no Financeiro.
              </p>
            </div>
            <div className="space-y-1.5 sm:w-64">
              <Label>Valor oferecido</Label>
              <MoneyInput value={valorOferecido} onChange={(v) => setValorOferecido(String(v))} />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo da recusa</Label>
              <Textarea
                rows={3}
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                placeholder="Ex.: cliente não aceitou o valor, tela trincada, aparelho bloqueado..."
              />
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          {fase === "recusa" ? (
            <>
              <Button variant="outline" className="h-11" onClick={() => setFase("formulario")}>
                Voltar
              </Button>
              <Button
                className="h-11"
                onClick={() => recusar.mutate()}
                disabled={recusar.isPending}
              >
                {recusar.isPending ? "Registrando..." : "Registrar recusa"}
              </Button>
            </>
          ) : fase === "confirmacao" ? (
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
              {!seminovo && (
                <Button
                  variant="outline"
                  className="h-11 border-destructive/40 text-destructive hover:bg-destructive/5"
                  onClick={irParaRecusa}
                >
                  Não comprou
                </Button>
              )}
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
