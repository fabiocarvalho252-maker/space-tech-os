import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Printer,
  Trash2,
  Package,
  ShoppingCart,
  Minus,
  QrCode,
  Edit,
  Filter,
  X,
  Search,
  ChevronDown,
  MessageCircle,
  DollarSign,
  Receipt,
  Eye,
  EyeOff,
  Sparkles,
  Wand2,
  MoreVertical,
  Undo2,
  KeyRound,
  Share2,
  UserCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ajustarLaudo } from "@/lib/laudo.functions";
import {
  analyzeDeviceDescription,
  CATEGORIAS_CONHECIDAS,
  MARCAS_CONHECIDAS,
  CORES_CONHECIDAS,
} from "@/lib/device-analyzer";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/AppShell";
import { OsFotos } from "@/components/OsFotos";
import { NovaOsFotos } from "@/components/NovaOsFotos";
import { enviarFotosEntrada, type LadoFoto } from "@/lib/os-fotos-entrada";
import { AparelhoCard3D } from "@/components/AparelhoCard3D";
import { useLadosAparelho, useLadosAparelhos } from "@/hooks/useLadosAparelho";
import { PatternLock } from "@/components/PatternLock";
import { FaturarOsModal } from "@/components/FaturarOsModal";
import { WhatsAppSendModal, type WhatsAppOsAlvo } from "@/components/WhatsAppSendModal";
import { EnviarOsModal } from "@/components/EnviarOsModal";
import { ClienteAcessoModal, type ClienteAcesso } from "@/components/ClienteAcessoModal";
import { gerarAcessoCliente } from "@/lib/cliente-conta/cliente-conta.functions";
import { AssinaturaDigitalModal } from "@/components/AssinaturaDigitalModal";
import { avisarOsProntaFn } from "@/lib/whatsapp/whatsapp.functions";
import {
  renderOsTemplateHtml,
  FALLBACK_TEMPLATE,
  type OsTemplateRow,
  type RenderOsData,
} from "@/lib/os-template-render";

import { useCurrentUser, useMinhaEmpresa, useProfile } from "@/hooks/useCurrentUser";
import { dataBR, STATUS_OS, STATUS_OS_COR, statusLabel } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { origemPublica } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClienteCampo } from "@/components/ClienteRapido";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/ordens")({
  head: () => ({
    meta: [
      { title: "Ordens de serviço — SpaceTech" },
      { name: "description", content: "Crie, acompanhe e imprima ordens de serviço." },
      { property: "og:title", content: "Ordens de serviço — SpaceTech" },
      { property: "og:description", content: "Controle completo das OS da sua assistência." },
    ],
  }),
  // ?os=<id> lets other screens (the Home "Ordens em Aberto" table) deep-link
  // straight into this existing edit dialog instead of needing a separate
  // OS detail page/route.
  validateSearch: (search: Record<string, unknown>): { os?: string } => {
    const os = search["os"];
    return typeof os === "string" ? { os } : {};
  },
  component: Ordens,
});

// Uma OS como vem da listagem (com o nome/telefone do cliente embutidos).
type OsListada = Tables<"ordens_servico"> & {
  clientes: { nome: string; telefone: string | null } | null;
};
type MembroEmpresa = Database["public"]["Functions"]["get_empresa_membros"]["Returns"][number];
type ItemNovaOs = {
  tipo: "produto" | "servico";
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
};

// Valores já digitados em OS anteriores, para sugerir no autocompletar.
const valoresUsados = (ordens: OsListada[], campo: "aparelho" | "marca" | "modelo" | "cor") =>
  ordens.map((o) => o[campo]).filter((v): v is string => !!v);

const vazio = {
  cliente_id: "",
  aparelho: "",
  marca: "",
  modelo: "",
  imei: "",
  serial_number: "",
  cor: "",
  defeito: "",
  diagnostico: "",
  valor: "0",
  status: "recebido",
  senha_dispositivo: "",
  padrao_desbloqueio: "",
  responsavel: "",
  responsavel_user_id: "",
  acessorios: "",
  itens: [] as ItemNovaOs[],
};

const ACESSORIOS_COMUNS = [
  "Chip",
  "Capinha",
  "Carregador",
  "Cabo",
  "Película",
  "Cartão de memória",
  "Caixa",
];

// Acessórios ficam como texto livre ("Chip, Capinha"); os botões só
// acrescentam ou tiram o item da lista.
function alternarAcessorio(texto: string, item: string): string {
  const lista = texto
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const tem = lista.some((t) => t.toLowerCase() === item.toLowerCase());
  return (
    tem ? lista.filter((t) => t.toLowerCase() !== item.toLowerCase()) : [...lista, item]
  ).join(", ");
}

function AcessoriosCampo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const marcados = value.split(",").map((t) => t.trim().toLowerCase());
  return (
    <div className="space-y-2">
      <Label>Acessórios deixados</Label>
      <div className="flex flex-wrap gap-1.5">
        {ACESSORIOS_COMUNS.map((a) => {
          const ativo = marcados.includes(a.toLowerCase());
          return (
            <button
              key={a}
              type="button"
              onClick={() => onChange(alternarAcessorio(value, a))}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                ativo
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary"
              }`}
            >
              {a}
            </button>
          );
        })}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nenhum — ou escreva outros"
      />
    </div>
  );
}

// Checklist funcional de entrada — cada item aceita 4 estados possíveis.
const CHECKLIST_STATUS = [
  {
    value: "ok",
    label: "OK",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  { value: "defeito", label: "Defeito", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  {
    value: "nao_testado",
    label: "Não testado",
    className: "bg-secondary text-muted-foreground border-border",
  },
  {
    value: "nao_se_aplica",
    label: "N/A",
    className: "bg-secondary text-muted-foreground border-border",
  },
] as const;

const CHECKLIST_ITENS = [
  { key: "liga", label: "Liga" },
  { key: "desliga", label: "Desliga" },
  { key: "tela", label: "Tela" },
  { key: "touch", label: "Touch" },
  { key: "cameras", label: "Câmeras" },
  { key: "flash", label: "Flash" },
  { key: "alto_falante", label: "Alto-falante" },
  { key: "microfone", label: "Microfone" },
  { key: "vibracao", label: "Vibração" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "bluetooth", label: "Bluetooth" },
  { key: "rede_movel", label: "Rede móvel" },
  { key: "carregamento", label: "Carregamento" },
  { key: "biometria", label: "Biometria" },
  { key: "face_id", label: "Face ID" },
  { key: "botoes", label: "Botões" },
  { key: "sensores", label: "Sensores" },
  { key: "nfc", label: "NFC" },
] as const;

const ESTADO_FISICO_ITENS = [
  { key: "tela_trincada", label: "Tela trincada" },
  { key: "tela_riscada", label: "Tela riscada" },
  { key: "tampa_quebrada", label: "Tampa traseira quebrada" },
  { key: "carcaca_amassada", label: "Carcaça amassada" },
  { key: "camera_danificada", label: "Câmera danificada" },
  { key: "oxidacao", label: "Oxidação" },
  { key: "sinais_liquido", label: "Sinais de líquido" },
  { key: "parafusos_ausentes", label: "Parafusos ausentes" },
  { key: "lacre_violado", label: "Lacre violado" },
  { key: "outros", label: "Outros" },
] as const;

const OS_POR_PAGINA = 20;

function Ordens() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const { data: user } = useCurrentUser();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedOsId, setSelectedOsId] = useState<string | null>(null);
  const [faturarOpen, setFaturarOpen] = useState(false);
  const [whatsappOs, setWhatsappOs] = useState<WhatsAppOsAlvo | null>(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [enviarOsAlvo, setEnviarOsAlvo] = useState<OsListada | null>(null);
  const [enviarOsModo, setEnviarOsModo] = useState<"os" | "orcamento">("os");
  const [enviarOsOpen, setEnviarOsOpen] = useState(false);
  const [assinaturaOs, setAssinaturaOs] = useState<OsListada | null>(null);
  const [assinaturaOpen, setAssinaturaOpen] = useState(false);
  const [form, setForm] = useState(vazio);
  const [filtro, setFiltro] = useState("todas");
  const [showFilters, setShowFilters] = useState(false);
  // "Minhas OS": só as atribuídas a quem está logado (o técnico na bancada).
  const [soMinhas, setSoMinhas] = useState(false);
  const [filtrosAvancados, setFiltrosAvancados] = useState({
    dataInicio: "",
    dataFim: "",
    responsavel: "",
    busca: "",
  });
  // Only the newest OS are listed until "Mostrar mais antigas" — a shop
  // piles up hundreds, and the counter's daily work is the recent ones.
  const [limiteLista, setLimiteLista] = useState(OS_POR_PAGINA);

  // Estados do editor completo da OS
  type ItemOs = {
    id?: string | undefined;
    tipo: "produto" | "servico";
    descricao: string;
    observacao?: string | undefined;
    quantidade: number;
    preco_unitario: number;
    produto_id?: string | null | undefined;
  };
  const [tabEdicao, setTabEdicao] = useState("detalhes");
  const [itensEdicao, setItensEdicao] = useState<ItemOs[]>([]);
  const [laudo, setLaudo] = useState("");
  const [anotacoes, setAnotacoes] = useState("");
  const [desconto, setDesconto] = useState("0");
  const [valorPago, setValorPago] = useState("0");
  const [statusPagamento, setStatusPagamento] = useState("pendente");
  const [verSenha, setVerSenha] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, string>>({});
  const [estadoFisico, setEstadoFisico] = useState<Record<string, boolean>>({});
  const [estadoFisicoObs, setEstadoFisicoObs] = useState("");
  const [garantiaDias, setGarantiaDias] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [previsaoData, setPrevisaoData] = useState("");
  const itemVazio = { descricao: "", observacao: "", preco_unitario: "", quantidade: "1" };
  const [novoProduto, setNovoProduto] = useState(itemVazio);
  const [fotosNovaOs, setFotosNovaOs] = useState<File[]>([]);
  const [ladosNovaOs, setLadosNovaOs] = useState<Map<File, LadoFoto>>(new Map());
  const [novoServico, setNovoServico] = useState(itemVazio);

  const totalProdutos = useMemo(
    () =>
      itensEdicao
        .filter((i) => i.tipo === "produto")
        .reduce((s, i) => s + i.quantidade * i.preco_unitario, 0),
    [itensEdicao],
  );
  const totalServicos = useMemo(
    () =>
      itensEdicao
        .filter((i) => i.tipo === "servico")
        .reduce((s, i) => s + i.quantidade * i.preco_unitario, 0),
    [itensEdicao],
  );
  const totalOs = Math.max(totalProdutos + totalServicos - (Number(desconto) || 0), 0);

  function adicionarItem(tipo: "produto" | "servico") {
    const base = tipo === "produto" ? novoProduto : novoServico;
    if (!base.descricao.trim()) {
      toast.error(tipo === "produto" ? "Informe o produto" : "Informe o serviço");
      return;
    }
    const catalogo = tipo === "produto" ? pecas : servicosCadastrados;
    const item = catalogo.find((p) => p.nome === base.descricao);
    setItensEdicao([
      ...itensEdicao,
      {
        tipo,
        descricao: base.descricao,
        observacao: base.observacao || undefined,
        quantidade: Number(base.quantidade) || 1,
        preco_unitario: Number(base.preco_unitario) || Number(item?.preco_venda) || 0,
        // Linking serviço items to their produtos row too (not just tipo
        // "produto") keeps their preco_custo ("Custo Adicional" em Serviços)
        // available for o cálculo de CMV no Painel — sem isso, todo custo de
        // peça lançado como serviço ficava invisível no lucro do dia.
        produto_id: item?.id ?? null,
      },
    ]);
    if (tipo === "produto") setNovoProduto(itemVazio);
    else setNovoServico(itemVazio);
  }

  async function abrirEdicao(os: OsListada) {
    setSelectedOsId(os.id);
    setTabEdicao("detalhes");
    setVerSenha(false);
    setNovoProduto(itemVazio);
    setNovoServico(itemVazio);
    setLaudo(os.laudo_tecnico || "");
    setAnotacoes(os.anotacoes || "");
    setDesconto(String(os.desconto ?? 0));
    setValorPago(String(os.valor_pago ?? 0));
    setStatusPagamento(os.status_pagamento || "pendente");
    setChecklist((os.checklist_entrada || {}) as Record<string, string>);
    setEstadoFisico((os.estado_fisico || {}) as Record<string, boolean>);
    setEstadoFisicoObs(os.estado_fisico_obs || "");
    setGarantiaDias(os.garantia_dias != null ? String(os.garantia_dias) : "");
    setDataEntrega(os.data_entrega ? os.data_entrega.slice(0, 10) : "");
    setPrevisaoData(os.previsao || "");
    setForm({
      cliente_id: os.cliente_id || "",
      aparelho: os.aparelho,
      marca: os.marca || "",
      modelo: os.modelo || "",
      imei: os.imei || "",
      serial_number: os.serial_number || "",
      cor: os.cor || "",
      defeito: os.defeito || "",
      diagnostico: os.diagnostico || "",
      valor: String(os.valor),
      status: os.status,
      senha_dispositivo: os.senha_dispositivo || "",
      padrao_desbloqueio: os.padrao_desbloqueio || "",
      responsavel: os.responsavel || "",
      responsavel_user_id: os.responsavel_user_id || "",
      acessorios: os.acessorios || "",
      itens: [],
    });
    setEditOpen(true);
    const { data } = await supabase.from("os_itens").select("*").eq("os_id", os.id);
    setItensEdicao(
      (data ?? []).map((i) => ({
        id: i.id,
        tipo: (i.tipo === "servico" ? "servico" : "produto") as "produto" | "servico",
        descricao: i.descricao,
        observacao: i.observacao ?? undefined,
        quantidade: Number(i.quantidade) || 1,
        preco_unitario: Number(i.preco_unitario) || 0,
        produto_id: i.produto_id,
      })),
    );
  }

  function enviarWhatsApp() {
    const os = ordens.find((o) => o.id === selectedOsId);
    if (!os) return;
    setWhatsappOs({ ...os, status: form.status, valor: totalOs });
    setWhatsappOpen(true);
  }

  const iaLaudo = useMutation({
    mutationFn: async (modo: "revisar" | "melhorar") => {
      if (!laudo.trim()) throw new Error("Escreva o laudo antes de usar a IA.");
      const res = await ajustarLaudo({ data: { texto: laudo, modo } });
      return res.texto;
    },
    onSuccess: (texto) => {
      setLaudo(texto);
      toast.success("Laudo atualizado pela IA");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const analiseAparelho = useMutation({
    mutationFn: async () => {
      if (!form.defeito.trim()) throw new Error("Escreva o defeito relatado antes de analisar.");
      return analyzeDeviceDescription(form.defeito);
    },
    onSuccess: (res) => {
      const encontrou = res.aparelho || res.marca || res.modelo || res.cor;
      if (!encontrou) {
        toast.info("Nenhum aparelho reconhecido no texto.");
        return;
      }
      setForm((f) => ({
        ...f,
        aparelho: res.aparelho ?? f.aparelho,
        marca: res.marca ?? f.marca,
        modelo: res.modelo ?? f.modelo,
        cor: res.cor ?? f.cor,
      }));
      toast.success("Aparelho identificado a partir do defeito relatado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ["ordens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*, clientes(nome, telefone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: ladosOsEditada } = useLadosAparelho(editOpen ? selectedOsId : null);

  const sugestoesAparelho = useMemo(
    () =>
      Array.from(new Set([...CATEGORIAS_CONHECIDAS, ...valoresUsados(ordens, "aparelho")])).sort(),
    [ordens],
  );
  const sugestoesMarca = useMemo(
    () => Array.from(new Set([...MARCAS_CONHECIDAS, ...valoresUsados(ordens, "marca")])).sort(),
    [ordens],
  );
  const sugestoesModelo = useMemo(
    () => Array.from(new Set(valoresUsados(ordens, "modelo"))).sort(),
    [ordens],
  );
  const sugestoesCor = useMemo(
    () => Array.from(new Set([...CORES_CONHECIDAS, ...valoresUsados(ordens, "cor")])).sort(),
    [ordens],
  );

  useEffect(() => {
    if (!searchParams.os || !ordens.length) return;
    const alvo = ordens.find((o) => o.id === searchParams.os);
    if (alvo) abrirEdicao(alvo);
    navigate({ to: "/ordens", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.os, ordens]);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () =>
      (await supabase.from("clientes").select("id, nome").order("nome")).data ?? [],
  });

  const { data: minhaEmpresa } = useMinhaEmpresa();
  const empresaId = minhaEmpresa?.empresa_id;
  const { data: tecnicos = [] } = useQuery({
    queryKey: ["empresa-membros-tecnicos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_empresa_membros", {
        p_empresa_id: empresaId as string,
      });
      if (error) throw error;
      return (data ?? []).filter((m) => ["tecnico", "gerente", "admin"].includes(m.role));
    },
  });
  const nomeTecnico = (m: { nome?: string | null; email: string }) => m.nome || m.email;

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => (await supabase.from("produtos").select("*").order("nome")).data ?? [],
  });
  // "produtos" mistura estoque real com o cadastro de serviços (categoria "Serviço",
  // sem controle de estoque) — separar aqui evita que serviços apareçam nos seletores de peça.
  const pecas = useMemo(() => produtos.filter((p) => p.categoria !== "Serviço"), [produtos]);
  const servicosCadastrados = useMemo(
    () => produtos.filter((p) => p.categoria === "Serviço"),
    [produtos],
  );

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.aparelho.trim()) throw new Error("Informe o aparelho");

      const tecnicoSelecionado = tecnicos.find((m) => m.user_id === form.responsavel_user_id);

      const { data: os, error } = await supabase
        .from("ordens_servico")
        .insert({
          user_id: empresaId!,
          cliente_id: form.cliente_id || null,
          aparelho: form.aparelho,
          marca: form.marca,
          modelo: form.modelo,
          imei: form.imei,
          cor: form.cor,
          senha_dispositivo: form.senha_dispositivo,
          padrao_desbloqueio: form.padrao_desbloqueio,
          responsavel_user_id: form.responsavel_user_id || null,
          responsavel: tecnicoSelecionado ? nomeTecnico(tecnicoSelecionado) : null,
          defeito: form.defeito,
          diagnostico: form.diagnostico,
          valor: Number(form.valor) || 0,
          status: form.status,
          acessorios: form.acessorios.trim() || null,
          estado_fisico: estadoFisico,
          estado_fisico_obs: estadoFisicoObs.trim() || null,
          previsao: previsaoData || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (form.itens.length > 0) {
        const { error: itensError } = await supabase.from("os_itens").insert(
          form.itens.map((i) => ({
            user_id: empresaId!,
            os_id: os.id,
            tipo: i.tipo,
            produto_id: i.produto_id,
            descricao: i.descricao,
            quantidade: i.quantidade,
            preco_unitario: i.preco_unitario,
          })),
        );
        if (itensError) throw itensError;
      }

      // A OS já existe neste ponto — falha nas fotos não deve fazer o
      // usuário criar a OS de novo; avisa e deixa enviar pela galeria.
      if (fotosNovaOs.length > 0) {
        try {
          await enviarFotosEntrada(empresaId!, os.id, fotosNovaOs, ladosNovaOs);
        } catch (e) {
          toast.warning(
            `OS criada, mas as fotos não foram enviadas: ${(e as Error).message}. Envie pela galeria da OS.`,
          );
        }
      }
    },
    onSuccess: () => {
      toast.success("OS criada");
      setForm(vazio);
      setFotosNovaOs([]);
      setLadosNovaOs(new Map());
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["os-fotos-lados"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editar = useMutation({
    mutationFn: async () => {
      if (!selectedOsId) return;
      if (!form.aparelho.trim()) throw new Error("Informe o aparelho");

      const tecnicoSelecionado = tecnicos.find((m) => m.user_id === form.responsavel_user_id);

      const { error } = await supabase
        .from("ordens_servico")
        .update({
          cliente_id: form.cliente_id || null,
          aparelho: form.aparelho,
          marca: form.marca,
          modelo: form.modelo,
          imei: form.imei,
          serial_number: form.serial_number,
          cor: form.cor,
          senha_dispositivo: form.senha_dispositivo,
          padrao_desbloqueio: form.padrao_desbloqueio,
          responsavel_user_id: form.responsavel_user_id || null,
          responsavel: tecnicoSelecionado ? nomeTecnico(tecnicoSelecionado) : null,
          defeito: form.defeito,
          diagnostico: form.diagnostico,
          laudo_tecnico: laudo,
          anotacoes,
          desconto: Number(desconto) || 0,
          valor_pago: Number(valorPago) || 0,
          status_pagamento: statusPagamento,
          valor: totalOs,
          status: form.status,
          checklist_entrada: checklist,
          estado_fisico: estadoFisico,
          estado_fisico_obs: estadoFisicoObs || null,
          acessorios: form.acessorios.trim() || null,
          garantia_dias: garantiaDias ? Number(garantiaDias) : null,
          data_entrega: dataEntrega || null,
          previsao: previsaoData || null,
        })
        .eq("id", selectedOsId);

      if (error) throw error;

      const { error: delError } = await supabase
        .from("os_itens")
        .delete()
        .eq("os_id", selectedOsId);
      if (delError) throw delError;

      if (itensEdicao.length > 0) {
        const { error: insError } = await supabase.from("os_itens").insert(
          itensEdicao.map((i) => ({
            user_id: empresaId!,
            os_id: selectedOsId,
            produto_id: i.produto_id ?? null,
            tipo: i.tipo,
            descricao: i.descricao,
            observacao: i.observacao ?? null,
            quantidade: i.quantidade,
            preco_unitario: i.preco_unitario,
          })),
        );
        if (insError) throw insError;
      }
      // Só avisa "pronta" se o status mudou nesta edição.
      const anterior = ordens.find((o) => o.id === selectedOsId)?.status;
      return { id: selectedOsId, status: anterior === form.status ? "" : form.status };
    },
    onSuccess: (salva) => {
      toast.success("OS atualizada");
      if (salva) avisarSePronta(salva.id, salva.status);
      setEditOpen(false);
      setSelectedOsId(null);
      setForm(vazio);
      setItensEdicao([]);
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: statusFlows = [] } = useQuery({
    queryKey: ["os-status-flows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("os_status_flows").select("*").eq("ativo", true);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["os-historico", selectedOsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_historico")
        .select("*")
        .eq("os_id", selectedOsId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOsId && editOpen,
  });

  // Aviso automático "OS pronta" no WhatsApp (se ligado em Configurações).
  // O servidor confere tudo — ligado, telefone, já enviado — e só avisa
  // aqui quando a mensagem saiu ou falhou de verdade.
  function avisarSePronta(osId: string, status: string) {
    if (status !== "pronto") return;
    avisarOsProntaFn({ data: { osId } })
      .then((r) => {
        if (r.enviado) {
          toast.success("Cliente avisado no WhatsApp que a OS está pronta");
          qc.invalidateQueries({ queryKey: ["os-historico", osId] });
        } else if (r.motivo === "desconectado") {
          toast.warning("Aviso de OS pronta não enviado: WhatsApp desconectado");
        } else if (r.motivo === "falhou") {
          toast.warning("Não foi possível enviar o aviso de OS pronta no WhatsApp");
        }
      })
      .catch(() => {});
  }

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status, origem }: { id: string; status: string; origem?: string }) => {
      // Validar fluxo se houver fluxos configurados. Cancelar é sempre
      // permitido independente do fluxo configurado — é uma saída de
      // emergência, não uma etapa do fluxo normal, e o cadastro de fluxos
      // (Configurações > Fluxo entre Status) nunca inclui "cancelado" como
      // destino por padrão, o que travava o cancelamento de qualquer OS.
      if (origem && status !== "cancelado" && statusFlows.length > 0) {
        const permitido = statusFlows.some((f) => f.origem === origem && f.destino === status);
        if (!permitido) {
          throw new Error(
            `Transição de ${statusLabel(origem)} para ${statusLabel(status)} não permitida no seu fluxo.`,
          );
        }
      }

      const { error } = await supabase.from("ordens_servico").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["os-historico", variables.id] });
      toast.success("Status atualizado");
      avisarSePronta(variables.id, variables.status);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("OS removida");
      setConfirmExcluirOs(null);
      qc.invalidateQueries({ queryKey: ["ordens"] });
    },
    onError: (e: Error & { code?: string }) => {
      if (e?.code === "23503") {
        toast.error("Não é possível excluir: esta OS possui faturamento registrado.", {
          description: "Cancele o faturamento antes de excluir a OS.",
        });
        return;
      }
      toast.error(e?.message ?? "Erro ao remover OS");
    },
  });

  const [confirmExcluirOs, setConfirmExcluirOs] = useState<{ id: string; numero: number } | null>(
    null,
  );
  const [confirmEstornar, setConfirmEstornar] = useState<{ id: string; numero: number } | null>(
    null,
  );

  function enviarWhatsAppOs(os: OsListada) {
    setWhatsappOs(os);
    setWhatsappOpen(true);
  }

  function enviarOs(os: OsListada, modo: "os" | "orcamento" = "os") {
    setEnviarOsAlvo(os);
    setEnviarOsModo(modo);
    setEnviarOsOpen(true);
  }

  const [acesso, setAcesso] = useState<ClienteAcesso | null>(null);
  const [acessoOpen, setAcessoOpen] = useState(false);

  const gerarAcesso = useMutation({
    mutationFn: (os: OsListada) =>
      gerarAcessoCliente({ data: { clienteId: os.cliente_id as string } }),
    onSuccess: (res, os) => {
      setAcesso({ ...res, osNumero: os.numero ?? null });
      setAcessoOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function gerarAcessoOs(os: OsListada) {
    if (!os.cliente_id) {
      toast.error("Esta OS não tem um cliente vinculado.");
      return;
    }
    gerarAcesso.mutate(os);
  }

  const estornar = useMutation({
    mutationFn: async (osId: string) => {
      const { data: faturamento, error: erroBusca } = await supabase
        .from("os_faturamentos")
        .select("id")
        .eq("os_id", osId)
        .neq("status", "cancelado")
        .maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!faturamento) throw new Error("Esta OS não possui lançamento financeiro para estornar.");
      const { error } = await supabase.rpc("cancelar_faturamento_os", {
        p_faturamento_id: faturamento.id,
        p_motivo: "Estorno solicitado na listagem de Ordens de Serviço",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento estornado. Um estorno foi registrado no financeiro.");
      setConfirmEstornar(null);
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-home"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmEstornar(null);
    },
  });

  async function imprimir(
    os: (typeof ordens)[number],
    modo: "os" | "orcamento" | "nao_fiscal" = "os",
  ) {
    // Open the window synchronously, still inside the click's user-gesture —
    // opening it *after* the awaited queries below would make most browsers
    // treat it as an unrequested popup and block it silently.
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

    // Termo padrão, config de impressão, fotos, itens e o modelo (template)
    // configurado em Configurações → Modelos de OS — o padrão da empresa, ou
    // (se ela nunca visitou essa tela) o primeiro modelo ativo qualquer.
    const [
      { data: termo },
      { data: osConfigData },
      { data: fotosData },
      { data: itensData },
      { data: templatesData },
    ] = await Promise.all([
      supabase
        .from("termos_garantia")
        .select("conteudo")
        .eq("user_id", empresaId || "")
        .eq("is_default", true)
        .eq("ativo", true)
        .maybeSingle(),
      supabase
        .from("os_config")
        .select("*")
        .eq("user_id", empresaId || "")
        .maybeSingle(),
      supabase.from("service_order_photos").select("*").eq("service_order_id", os.id),
      supabase.from("os_itens").select("*").eq("os_id", os.id),
      supabase
        .from("os_templates")
        .select("*")
        .eq("user_id", empresaId || "")
        .eq("ativo", true)
        .order("padrao", { ascending: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(1),
    ]);

    const osConfig = osConfigData;
    const fotos = fotosData ?? [];
    const itensOs = itensData ?? [];
    const template = (templatesData?.[0] as OsTemplateRow | undefined) ?? FALLBACK_TEMPLATE;

    // Fotos e assinaturas: bucket "os-fotos" é privado — precisa de signed
    // URL, uma public URL retornaria 400/403 em silêncio na <img>.
    const fotosGaleria = fotos.filter(
      (f) => f.category !== "assinatura_cliente" && f.category !== "assinatura_tecnico",
    );
    const fotosComUrl = osConfig?.exibir_fotos_impressao
      ? (
          await Promise.all(
            fotosGaleria.map(async (f) => {
              const { data: signed } = await supabase.storage
                .from("os-fotos")
                .createSignedUrl(f.url, 3600);
              return { src: signed?.signedUrl ?? "", category: f.category as string };
            }),
          )
        ).filter((f) => f.src)
      : [];

    const assinaturaCliente = fotos.find((f) => f.category === "assinatura_cliente");
    const assinaturaTecnico = fotos.find((f) => f.category === "assinatura_tecnico");
    const [assinaturaClienteSrc, assinaturaTecnicoSrc] = await Promise.all([
      assinaturaCliente
        ? supabase.storage
            .from("os-fotos")
            .createSignedUrl(assinaturaCliente.url, 3600)
            .then((r) => r.data?.signedUrl ?? null)
        : Promise.resolve(null),
      assinaturaTecnico
        ? supabase.storage
            .from("os-fotos")
            .createSignedUrl(assinaturaTecnico.url, 3600)
            .then((r) => r.data?.signedUrl ?? null)
        : Promise.resolve(null),
    ]);

    const data: RenderOsData = {
      numero: os.numero,
      statusLabel: statusLabel(os.status),
      createdAt: os.created_at,
      cliente: os.clientes ? { nome: os.clientes.nome, telefone: os.clientes.telefone } : null,
      aparelho: os.aparelho,
      marca: os.marca ?? null,
      modelo: os.modelo ?? null,
      imei: os.imei ?? null,
      serialNumber: os.serial_number ?? null,
      cor: os.cor ?? null,
      senhaDispositivo: os.senha_dispositivo ?? null,
      padraoDesbloqueio: os.padrao_desbloqueio ?? null,
      defeito: os.defeito ?? null,
      diagnostico: os.diagnostico ?? null,
      itens: itensOs.map((i) => ({
        descricao: i.descricao,
        tipo: i.tipo,
        quantidade: Number(i.quantidade),
        precoUnitario: Number(i.preco_unitario),
      })),
      valor: Number(os.valor),
      desconto: Number(os.desconto ?? 0),
      garantiaDias: os.garantia_dias ?? null,
      garantiaVencimento: os.garantia_vencimento ?? null,
      checklist: (os.checklist_entrada ?? {}) as Record<string, string>,
      estadoFisico: (os.estado_fisico ?? {}) as Record<string, boolean>,
      estadoFisicoObs: os.estado_fisico_obs ?? null,
      acessorios: os.acessorios ?? null,
      fotos: fotosComUrl,
      assinaturaClienteSrc,
      assinaturaTecnicoSrc,
      termoGarantiaTexto: termo?.conteudo ?? null,
      condicoesTexto: osConfig?.termos_condicoes ?? null,
      empresa: {
        nome: profile?.loja || profile?.nome || "Assistência Técnica",
        logoUrl: profile?.logo_url ?? null,
        cnpj: profile?.cnpj_cpf ?? null,
        endereco: profile?.endereco ?? null,
        telefone: profile?.whatsapp ?? null,
        responsavel: null,
      },
      qrCodeUrl: osConfig?.imprimir_qrcode_cliente ? `${origemPublica()}/consulta/${os.id}` : null,
      modo,
      duasVias: !!osConfig?.imprimir_duas_vias,
    };

    const html = renderOsTemplateHtml(template, data);
    janela.document.open();
    janela.document.write(
      html.replace("</body>", "<script>window.onload=()=>window.print()<\\/script></body>"),
    );
    janela.document.close();
  }

  const lista = useMemo(() => {
    let base: OsListada[] = filtro === "todas" ? ordens : ordens.filter((o) => o.status === filtro);

    if (filtrosAvancados.dataInicio) {
      base = base.filter((o) => new Date(o.created_at) >= new Date(filtrosAvancados.dataInicio));
    }
    if (filtrosAvancados.dataFim) {
      const dataFim = new Date(filtrosAvancados.dataFim);
      dataFim.setHours(23, 59, 59, 999);
      base = base.filter((o) => new Date(o.created_at) <= dataFim);
    }
    if (soMinhas) base = base.filter((o) => o.responsavel_user_id === user?.id);
    if (filtrosAvancados.responsavel) {
      base = base.filter((o) =>
        o.responsavel?.toLowerCase().includes(filtrosAvancados.responsavel.toLowerCase()),
      );
    }
    const b = filtrosAvancados.busca.trim().toLowerCase();
    if (b) {
      base = base.filter((o) =>
        [
          o.numero?.toString(),
          o.clientes?.nome,
          o.clientes?.telefone,
          o.aparelho,
          o.marca,
          o.modelo,
          o.imei,
        ].some((v) => v?.toLowerCase().includes(b)),
      );
    }

    return base;
  }, [ordens, filtro, filtrosAvancados, soMinhas, user?.id]);

  const minhasEmAberto = useMemo(
    () =>
      ordens.filter(
        (o) =>
          o.responsavel_user_id === user?.id &&
          !["pronto", "entregue", "faturado", "cancelado", "reprovado"].includes(o.status),
      ).length,
    [ordens, user?.id],
  );

  const acoesListaRef = useRef<AcoesListaOs>(null!);
  acoesListaRef.current = {
    mudarStatus: (v) => mudarStatus.mutate(v),
    abrirEdicao,
    enviarOs,
    imprimir,
    enviarWhatsAppOs,
    gerarAcessoOs,
    abrirAssinatura: (os) => {
      setAssinaturaOs(os);
      setAssinaturaOpen(true);
    },
    confirmarEstorno: (os) => setConfirmEstornar({ id: os.id, numero: os.numero }),
    confirmarExclusao: (os) => setConfirmExcluirOs({ id: os.id, numero: os.numero }),
  };

  return (
    <div>
      <PageHeader
        title="Ordens de serviço"
        subtitle="Do orçamento à entrega, com impressão profissional"
        action={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              // "Nova OS" reutiliza o mesmo estado `form` da edição — sem
              // isso, se o usuário abrir a edição de uma OS (ex.: da cliente
              // Agda), cancelar sem salvar e então clicar em "Nova OS", os
              // campos (incluindo Valor Total) vinham pré-preenchidos com os
              // dados da última OS editada, criando uma OS nova com o valor
              // de outro cliente.
              if (v) {
                // Técnico já vem preenchido com quem está abrindo a OS, se
                // a pessoa for técnico/gerente/admin da empresa.
                const souTecnico = tecnicos.some((m) => m.user_id === user?.id);
                setForm({ ...vazio, responsavel_user_id: souTecnico ? user!.id : "" });
                setEstadoFisico({});
                setEstadoFisicoObs("");
                setPrevisaoData("");
                setFotosNovaOs([]);
                setLadosNovaOs(new Map());
                setNovoProduto(itemVazio);
                setNovoServico(itemVazio);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Nova OS
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova ordem de serviço</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Cliente</Label>
                  <ClienteCampo
                    clientes={clientes}
                    value={form.cliente_id}
                    onChange={(id) => setForm({ ...form, cliente_id: id })}
                  />
                </div>
                <Campo
                  label="Aparelho"
                  value={form.aparelho}
                  onChange={(v) => setForm({ ...form, aparelho: v })}
                  sugestoesId="sugestoes-aparelho-novo"
                  sugestoes={sugestoesAparelho}
                />
                <Campo
                  label="Marca"
                  value={form.marca}
                  onChange={(v) => setForm({ ...form, marca: v })}
                  sugestoesId="sugestoes-marca-novo"
                  sugestoes={sugestoesMarca}
                />
                <Campo
                  label="Modelo"
                  value={form.modelo}
                  onChange={(v) => setForm({ ...form, modelo: v })}
                  sugestoesId="sugestoes-modelo-novo"
                  sugestoes={sugestoesModelo}
                />
                <Campo
                  label="Cor"
                  value={form.cor}
                  onChange={(v) => setForm({ ...form, cor: v })}
                  sugestoesId="sugestoes-cor-novo"
                  sugestoes={sugestoesCor}
                />
                <Campo
                  label="IMEI"
                  value={form.imei}
                  onChange={(v) => setForm({ ...form, imei: v })}
                />
                <div className="space-y-1.5">
                  <Label>Técnico responsável</Label>
                  <Select
                    value={form.responsavel_user_id}
                    onValueChange={(v) => setForm({ ...form, responsavel_user_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem técnico atribuído" />
                    </SelectTrigger>
                    <SelectContent>
                      {tecnicos.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {nomeTecnico(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Previsão de entrega</Label>
                  <Input
                    type="date"
                    value={previsaoData}
                    onChange={(e) => setPrevisaoData(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nº de série</Label>
                  <Input
                    value={form.serial_number}
                    onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Senha (PIN)</Label>
                  <Input
                    value={form.senha_dispositivo}
                    onChange={(e) => setForm({ ...form, senha_dispositivo: e.target.value })}
                    placeholder="Ex: 1234"
                  />
                </div>
                <div className="space-y-3 sm:col-span-2">
                  <Label>Padrão de Desbloqueio</Label>
                  <PatternLock
                    value={form.padrao_desbloqueio}
                    onChange={(val) => setForm({ ...form, padrao_desbloqueio: val })}
                    className="mt-2"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Defeito relatado</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={analiseAparelho.isPending}
                      onClick={() => analiseAparelho.mutate()}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {analiseAparelho.isPending ? "Analisando..." : "Identificar aparelho"}
                    </Button>
                  </div>
                  <Textarea
                    value={form.defeito}
                    onChange={(e) => setForm({ ...form, defeito: e.target.value })}
                    placeholder="Ex: iPhone 13 Pro Max dourado com tela quebrada"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Diagnóstico técnico</Label>
                  <Textarea
                    value={form.diagnostico}
                    onChange={(e) => setForm({ ...form, diagnostico: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <AcessoriosCampo
                    value={form.acessorios}
                    onChange={(v) => setForm({ ...form, acessorios: v })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Estado físico na entrada</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ESTADO_FISICO_ITENS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          setEstadoFisico({ ...estadoFisico, [item.key]: !estadoFisico[item.key] })
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          estadoFisico[item.key]
                            ? "border-red-500/40 bg-red-500/10 text-red-600"
                            : "border-border hover:border-primary"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <Input
                    value={estadoFisicoObs}
                    onChange={(e) => setEstadoFisicoObs(e.target.value)}
                    placeholder="Observações (ex.: trinca no canto superior)"
                  />
                </div>
                <div className="border-t border-border pt-4 sm:col-span-2">
                  <NovaOsFotos
                    fotos={fotosNovaOs}
                    onChange={setFotosNovaOs}
                    lados={ladosNovaOs}
                    onLadosChange={setLadosNovaOs}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Marque a frente e a traseira do aparelho para vê-lo em 3D na lista de OS.
                  </p>
                </div>
              </div>
              <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                Criar OS
              </Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filtrosAvancados.busca}
          onChange={(e) => {
            setFiltrosAvancados((prev) => ({ ...prev, busca: e.target.value }));
            setLimiteLista(OS_POR_PAGINA);
          }}
          placeholder="Pesquisar OS por nº, cliente, telefone, aparelho, modelo ou IMEI..."
          className="h-11 pl-9 pr-9"
        />
        {filtrosAvancados.busca && (
          <button
            type="button"
            onClick={() => setFiltrosAvancados((prev) => ({ ...prev, busca: "" }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar pesquisa"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[{ value: "todas", label: "Todas" }, ...STATUS_OS].map((s) => (
          <button
            key={s.value}
            onClick={() => {
              setFiltro(s.value);
              setLimiteLista(OS_POR_PAGINA);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filtro === s.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {s.label}
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className={`ml-auto gap-2 rounded-full ${soMinhas ? "bg-primary/10 border-primary text-primary" : ""}`}
          onClick={() => {
            setSoMinhas(!soMinhas);
            setLimiteLista(OS_POR_PAGINA);
          }}
          title="Só as OS em que você é o técnico responsável"
        >
          <UserCheck className="h-4 w-4" />
          Minhas OS
          {minhasEmAberto > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {minhasEmAberto}
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 rounded-full ${showFilters ? "bg-primary/10 border-primary text-primary" : ""}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
          Filtros
        </Button>
      </div>

      {showFilters && (
        <div className="mb-6 grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-3 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Data Início</Label>
            <Input
              type="date"
              className="h-9 text-xs"
              value={filtrosAvancados.dataInicio}
              onChange={(e) =>
                setFiltrosAvancados((prev) => ({ ...prev, dataInicio: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data Fim</Label>
            <Input
              type="date"
              className="h-9 text-xs"
              value={filtrosAvancados.dataFim}
              onChange={(e) =>
                setFiltrosAvancados((prev) => ({ ...prev, dataFim: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Responsável</Label>
            <Input
              placeholder="Nome do técnico"
              className="h-9 text-xs"
              value={filtrosAvancados.responsavel}
              onChange={(e) =>
                setFiltrosAvancados((prev) => ({ ...prev, responsavel: e.target.value }))
              }
            />
          </div>
        </div>
      )}

      <ListaOs lista={lista.slice(0, limiteLista)} acoes={acoesListaRef} navigate={navigate} />
      {lista.length > limiteLista ? (
        <div className="mt-4 flex flex-col items-center gap-1">
          <Button
            variant="outline"
            className="gap-2 rounded-full"
            onClick={() => setLimiteLista((n) => n + OS_POR_PAGINA)}
          >
            <ChevronDown className="h-4 w-4" />
            Mostrar mais antigas ({lista.length - limiteLista})
          </Button>
          <p className="text-xs text-muted-foreground">
            Mostrando as {limiteLista} mais recentes de {lista.length}
          </p>
        </div>
      ) : (
        filtrosAvancados.busca.trim() &&
        !lista.length && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Nenhuma OS encontrada para essa pesquisa.
          </p>
        )
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Ordem de Serviço</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const os = ordens.find((o) => o.id === selectedOsId);
                if (os) imprimir(os);
              }}
            >
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={enviarWhatsApp}>
              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const os = ordens.find((o) => o.id === selectedOsId);
                if (os) enviarOs(os);
              }}
            >
              <Share2 className="mr-2 h-4 w-4" /> Enviar OS
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTabEdicao("pagamentos")}>
              <DollarSign className="mr-2 h-4 w-4" /> Pagamento Parcial
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFaturarOpen(true)}>
              <Receipt className="mr-2 h-4 w-4" /> Faturar
            </Button>
            <span className="ml-auto flex items-center gap-2">
              <AparelhoCard3D
                lados={ladosOsEditada}
                tamanho="md"
                titulo={`OS #${ordens.find((o) => o.id === selectedOsId)?.numero ?? ""} — ${[form.aparelho, form.marca, form.modelo].filter(Boolean).join(" ")}`}
              />
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                OS {ordens.find((o) => o.id === selectedOsId)?.numero ?? "—"}
              </span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Atualize os dados da ordem, produtos, serviços, desconto, anexos e anotações.
          </p>

          <Tabs value={tabEdicao} onValueChange={setTabEdicao} className="mt-2">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="detalhes">Detalhes da OS</TabsTrigger>
              <TabsTrigger value="itens">Produtos e Serviços</TabsTrigger>
              <TabsTrigger value="fotos">Imagens e Fotos</TabsTrigger>
              <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="estado-fisico">Estado Físico</TabsTrigger>
              <TabsTrigger value="garantia">Garantia</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
              <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            </TabsList>

            {/* DETALHES */}
            <TabsContent value="detalhes" className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Cliente</Label>
                  <ClienteCampo
                    clientes={clientes}
                    value={form.cliente_id}
                    onChange={(id) => setForm({ ...form, cliente_id: id })}
                  />
                </div>
                <Campo
                  label="Aparelho"
                  value={form.aparelho}
                  onChange={(v) => setForm({ ...form, aparelho: v })}
                  sugestoesId="sugestoes-aparelho-editar"
                  sugestoes={sugestoesAparelho}
                />
                <Campo
                  label="Marca"
                  value={form.marca}
                  onChange={(v) => setForm({ ...form, marca: v })}
                  sugestoesId="sugestoes-marca-editar"
                  sugestoes={sugestoesMarca}
                />
                <Campo
                  label="Modelo"
                  value={form.modelo}
                  onChange={(v) => setForm({ ...form, modelo: v })}
                  sugestoesId="sugestoes-modelo-editar"
                  sugestoes={sugestoesModelo}
                />
                <Campo
                  label="Cor"
                  value={form.cor}
                  onChange={(v) => setForm({ ...form, cor: v })}
                  sugestoesId="sugestoes-cor-editar"
                  sugestoes={sugestoesCor}
                />
                <Campo
                  label="IMEI"
                  value={form.imei}
                  onChange={(v) => setForm({ ...form, imei: v })}
                />
                <Campo
                  label="Número de série"
                  value={form.serial_number}
                  onChange={(v) => setForm({ ...form, serial_number: v })}
                />
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    {STATUS_OS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Técnico responsável</Label>
                  <Select
                    value={form.responsavel_user_id}
                    onValueChange={(v) => setForm({ ...form, responsavel_user_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem técnico atribuído" />
                    </SelectTrigger>
                    <SelectContent>
                      {tecnicos.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {nomeTecnico(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Defeito relatado</Label>
                  <Textarea
                    value={form.defeito}
                    onChange={(e) => setForm({ ...form, defeito: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Diagnóstico técnico</Label>
                  <Textarea
                    value={form.diagnostico}
                    onChange={(e) => setForm({ ...form, diagnostico: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* PRODUTOS E SERVIÇOS */}
            <TabsContent value="itens" className="mt-4 space-y-6">
              <div className="rounded-xl border border-border p-4">
                <h4 className="mb-3 text-sm font-semibold">Incluir produto</h4>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Produto</Label>
                    <Input
                      list="lista-produtos-edicao"
                      value={novoProduto.descricao}
                      onChange={(e) =>
                        setNovoProduto({ ...novoProduto, descricao: e.target.value })
                      }
                      placeholder="Digite o nome do produto"
                    />
                    <datalist id="lista-produtos-edicao">
                      {pecas.map((p) => (
                        <option key={p.id} value={p.nome} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço unitário</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Preço"
                      value={novoProduto.preco_unitario}
                      onChange={(e) =>
                        setNovoProduto({ ...novoProduto, preco_unitario: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Quantidade"
                      value={novoProduto.quantidade}
                      onChange={(e) =>
                        setNovoProduto({ ...novoProduto, quantidade: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Button className="mt-3" size="sm" onClick={() => adicionarItem("produto")}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar
                </Button>
              </div>

              <div className="rounded-xl border border-border p-4">
                <h4 className="mb-3 text-sm font-semibold">Incluir serviço</h4>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Serviço</Label>
                    <Input
                      list="lista-servicos-edicao"
                      value={novoServico.descricao}
                      onChange={(e) =>
                        setNovoServico({ ...novoServico, descricao: e.target.value })
                      }
                      placeholder="Digite o nome do serviço"
                    />
                    <datalist id="lista-servicos-edicao">
                      {servicosCadastrados.map((s) => (
                        <option key={s.id} value={s.nome} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Breve descrição (opcional)</Label>
                    <Input
                      value={novoServico.observacao}
                      onChange={(e) =>
                        setNovoServico({ ...novoServico, observacao: e.target.value })
                      }
                      placeholder="Detalhe deste serviço — ex.: com troca do filtro"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço unitário</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Preço"
                      value={novoServico.preco_unitario}
                      onChange={(e) =>
                        setNovoServico({ ...novoServico, preco_unitario: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Quantidade"
                      value={novoServico.quantidade}
                      onChange={(e) =>
                        setNovoServico({ ...novoServico, quantidade: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Button className="mt-3" size="sm" onClick={() => adicionarItem("servico")}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar
                </Button>
              </div>

              {itensEdicao.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="p-3 text-left">Item</th>
                          <th className="p-3 text-left">Tipo</th>
                          <th className="p-3 text-right">Qtd</th>
                          <th className="p-3 text-right">Unit.</th>
                          <th className="p-3 text-right">Total</th>
                          <th className="p-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {itensEdicao.map((it, idx) => (
                          <tr key={idx} className="border-t border-border">
                            <td className="p-3">
                              {it.descricao}
                              {it.observacao && (
                                <span className="block text-xs text-muted-foreground">
                                  {it.observacao}
                                </span>
                              )}
                            </td>
                            <td className="p-3 capitalize">{it.tipo}</td>
                            <td className="p-3 text-right">{it.quantidade}</td>
                            <td className="p-3 text-right">{brl(it.preco_unitario)}</td>
                            <td className="p-3 text-right">
                              {brl(it.quantidade * it.preco_unitario)}
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  setItensEdicao(itensEdicao.filter((_, i) => i !== idx))
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Laudo técnico do serviço executado</Label>
                <Textarea
                  rows={6}
                  value={laudo}
                  onChange={(e) => setLaudo(e.target.value)}
                  placeholder="Descreva o serviço executado"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Selecione o texto e clique</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={iaLaudo.isPending}
                    onClick={() => iaLaudo.mutate("revisar")}
                  >
                    <Wand2 className="mr-2 h-4 w-4" /> Revisar texto
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={iaLaudo.isPending}
                    onClick={() => iaLaudo.mutate("melhorar")}
                  >
                    <Sparkles className="mr-2 h-4 w-4" /> Melhorar com IA
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* FOTOS */}
            <TabsContent value="fotos" className="mt-4">
              {selectedOsId ? (
                <OsFotos
                  osId={selectedOsId}
                  numero={ordens.find((o) => o.id === selectedOsId)?.numero as number}
                  empresaId={ordens.find((o) => o.id === selectedOsId)?.user_id as string}
                />
              ) : null}
            </TabsContent>

            {/* ANOTAÇÕES */}
            <TabsContent value="anotacoes" className="mt-4 space-y-2">
              <Label>Anotações internas</Label>
              <Textarea
                rows={8}
                value={anotacoes}
                onChange={(e) => setAnotacoes(e.target.value)}
                placeholder="Observações internas desta ordem (não saem na impressão do cliente)"
              />
            </TabsContent>

            {/* CHECKLIST */}
            <TabsContent value="checklist" className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Senha (PIN)</Label>
                <div className="flex gap-2">
                  <Input
                    type={verSenha ? "text" : "password"}
                    value={form.senha_dispositivo}
                    onChange={(e) => setForm({ ...form, senha_dispositivo: e.target.value })}
                    placeholder="Ex: 1234"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setVerSenha(!verSenha)}
                    title="Ver Senha"
                  >
                    {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <Label>Padrão de Desbloqueio</Label>
                <PatternLock
                  value={form.padrao_desbloqueio}
                  onChange={(val) => setForm({ ...form, padrao_desbloqueio: val })}
                  className="mt-2"
                />
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <Label className="text-base font-bold">Checklist de entrada</Label>
                <p className="text-xs text-muted-foreground">
                  Registre o estado de cada item no momento em que o aparelho foi recebido.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CHECKLIST_ITENS.map((item) => {
                    const atual = checklist[item.key] || "nao_testado";
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
                      >
                        <span className="text-sm font-medium">{item.label}</span>
                        <div className="flex gap-1">
                          {CHECKLIST_STATUS.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              title={s.label}
                              onClick={() => setChecklist({ ...checklist, [item.key]: s.value })}
                              className={`h-7 rounded-md border px-2 text-[11px] font-semibold transition ${
                                atual === s.value
                                  ? s.className
                                  : "border-border bg-transparent text-muted-foreground/50 hover:bg-muted"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* ESTADO FÍSICO */}
            <TabsContent value="estado-fisico" className="mt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Marque as avarias visíveis no aparelho no momento da entrada.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ESTADO_FISICO_ITENS.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm cursor-pointer hover:bg-muted/30"
                  >
                    <input
                      type="checkbox"
                      checked={!!estadoFisico[item.key]}
                      onChange={(e) =>
                        setEstadoFisico({ ...estadoFisico, [item.key]: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>Observações sobre o estado físico</Label>
                <Textarea
                  rows={4}
                  value={estadoFisicoObs}
                  onChange={(e) => setEstadoFisicoObs(e.target.value)}
                  placeholder="Detalhe as avarias marcadas acima, se necessário"
                />
              </div>
              <AcessoriosCampo
                value={form.acessorios}
                onChange={(v) => setForm({ ...form, acessorios: v })}
              />
            </TabsContent>

            {/* GARANTIA */}
            <TabsContent value="garantia" className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Data inicial</Label>
                  <Input
                    disabled
                    value={dataBR(ordens.find((o) => o.id === selectedOsId)?.created_at)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data prevista</Label>
                  <Input
                    type="date"
                    value={previsaoData}
                    onChange={(e) => setPrevisaoData(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de entrega</Label>
                  <Input
                    type="date"
                    value={dataEntrega}
                    onChange={(e) => setDataEntrega(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Preenchida automaticamente ao marcar a OS como "Entregue".
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Prazo de garantia (dias)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={garantiaDias}
                    onChange={(e) => setGarantiaDias(e.target.value)}
                    placeholder="Ex: 90"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vencimento da garantia</span>
                  <strong className="text-primary">
                    {dataBR(ordens.find((o) => o.id === selectedOsId)?.garantia_vencimento) || "—"}
                  </strong>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Calculado a partir da data de entrega + prazo de garantia. Salve a OS após
                  informar a data de entrega para ver o vencimento atualizado.
                </p>
              </div>
            </TabsContent>

            {/* HISTÓRICO */}
            <TabsContent value="historico" className="mt-4">
              {historico.length ? (
                <ol className="space-y-4 border-l-2 border-border pl-4">
                  {historico.map((h) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                      <p className="text-sm font-medium">{h.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString("pt-BR")}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum evento registrado ainda.
                </p>
              )}
            </TabsContent>

            {/* PAGAMENTOS */}
            <TabsContent value="pagamentos" className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Valor pago (parcial)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={valorPago}
                    onChange={(e) => setValorPago(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Situação do pagamento</Label>
                  <select
                    value={statusPagamento}
                    onChange={(e) => setStatusPagamento(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="parcial">Parcial</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Total da OS</span>
                  <strong>{brl(totalOs)}</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Pago</span>
                  <strong>{brl(Number(valorPago) || 0)}</strong>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Saldo restante</span>
                  <strong className="text-primary">
                    {brl(Math.max(totalOs - (Number(valorPago) || 0), 0))}
                  </strong>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* RESUMO */}
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
            <h4 className="mb-3 text-sm font-semibold">Resumo da OS</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Produtos:</span>
                <strong>{brl(totalProdutos)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Serviços:</span>
                <strong>{brl(totalServicos)}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-muted-foreground">Desconto</span>
                <Input
                  type="number"
                  step="0.01"
                  className="h-9 w-32 text-right"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                />
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base">
                <span>Total:</span>
                <strong className="text-primary">{brl(totalOs)}</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => editar.mutate()} disabled={editar.isPending}>
              Salvar
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Voltar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FaturarOsModal
        osId={selectedOsId}
        open={faturarOpen}
        onOpenChange={setFaturarOpen}
        onFaturado={(os) => {
          setWhatsappOs(os);
          setWhatsappOpen(true);
        }}
      />

      <WhatsAppSendModal os={whatsappOs} open={whatsappOpen} onOpenChange={setWhatsappOpen} />
      <EnviarOsModal
        os={enviarOsAlvo}
        modo={enviarOsModo}
        open={enviarOsOpen}
        onOpenChange={setEnviarOsOpen}
      />
      <ClienteAcessoModal acesso={acesso} open={acessoOpen} onOpenChange={setAcessoOpen} />

      <AssinaturaDigitalModal
        os={assinaturaOs}
        open={assinaturaOpen}
        onOpenChange={setAssinaturaOpen}
      />

      <ConfirmDialog
        open={!!confirmExcluirOs}
        onOpenChange={(v) => !v && setConfirmExcluirOs(null)}
        title="Deseja realmente excluir esta Ordem de Serviço?"
        description={
          confirmExcluirOs
            ? `A OS Nº ${confirmExcluirOs.numero} será removida permanentemente.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        loading={remover.isPending}
        onConfirm={() => confirmExcluirOs && remover.mutate(confirmExcluirOs.id)}
      />

      <ConfirmDialog
        open={!!confirmEstornar}
        onOpenChange={(v) => !v && setConfirmEstornar(null)}
        title="Deseja realmente estornar o lançamento desta OS?"
        description={
          confirmEstornar
            ? `Isso pode alterar os dados financeiros já registrados para a OS Nº ${confirmEstornar.numero} — parcelas pendentes serão canceladas e parcelas já recebidas geram um estorno no financeiro.`
            : ""
        }
        confirmLabel="Estornar"
        destructive
        loading={estornar.isPending}
        onConfirm={() => confirmEstornar && estornar.mutate(confirmEstornar.id)}
      />
    </div>
  );
}

// garantia_vencimento vem pronto do banco (data_entrega + garantia_dias da
// própria OS) — só existe depois que o aparelho foi de fato entregue.
const getVencimentoGarantia = (garantiaVencimento: string | null) => {
  if (!garantiaVencimento) return "—";
  return dataBR(garantiaVencimento);
};

type AcoesListaOs = {
  mudarStatus: (v: { id: string; status: string; origem?: string }) => void;
  abrirEdicao: (os: OsListada) => void;
  enviarOs: (os: OsListada, modo?: "os" | "orcamento") => void;
  imprimir: (os: OsListada, modo: "os" | "orcamento" | "nao_fiscal") => void;
  enviarWhatsAppOs: (os: OsListada) => void;
  gerarAcessoOs: (os: OsListada) => void;
  abrirAssinatura: (os: OsListada) => void;
  confirmarEstorno: (os: OsListada) => void;
  confirmarExclusao: (os: OsListada) => void;
};

// A lista fica fora do componente principal e memoizada: o formulário de
// Nova OS/edição vive no estado da página, e sem isso cada tecla digitada
// redesenhava todas as OS (tabela + cards mobile), deixando a digitação
// lenta. As ações vão por ref para que o memo não seja quebrado.
const ListaOs = memo(function ListaOs({
  lista,
  acoes,
  navigate,
}: {
  lista: OsListada[];
  acoes: { current: AcoesListaOs };
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const { data: ladosPorOs = {} } = useLadosAparelhos();
  const tituloAparelho = (os: OsListada) =>
    `OS #${os.numero} — ${[os.aparelho, os.marca, os.modelo].filter(Boolean).join(" ") || "Aparelho"}`;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-soft md:block">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-bottom border-border bg-muted/30">
              <th className="p-4 font-bold text-muted-foreground whitespace-nowrap">
                Ordem de Serviço
              </th>
              <th className="p-4 font-bold text-muted-foreground whitespace-nowrap">Responsável</th>
              <th className="p-4 font-bold text-muted-foreground whitespace-nowrap">Data Final</th>
              <th className="p-4 font-bold text-muted-foreground whitespace-nowrap">
                Venc. Garantia
              </th>
              <th className="p-4 font-bold text-muted-foreground whitespace-nowrap">Valor</th>
              <th className="p-4 font-bold text-muted-foreground whitespace-nowrap">Status</th>
              <th className="p-4 font-bold text-muted-foreground text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lista.map((os) => (
              <tr key={os.id} className="hover:bg-muted/10 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <AparelhoCard3D lados={ladosPorOs[os.id]} titulo={tituloAparelho(os)} />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-muted-foreground">
                        #{os.numero}
                      </span>
                      <span className="font-bold text-base">
                        {os.clientes?.nome ?? "Sem cliente"}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-muted-foreground font-medium">
                  {os.responsavel || "Técnico não atribuído"}
                </td>
                <td className="p-4 text-muted-foreground">
                  <div className="flex flex-col">
                    <span>{dataBR(os.created_at)}</span>
                    <span className="text-xs text-primary">{dataBR(os.previsao)}</span>
                  </div>
                </td>
                <td className="p-4 text-muted-foreground">
                  {getVencimentoGarantia(os.garantia_vencimento)}
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-primary text-base">{brl(os.valor)}</span>
                    {Number(os.desconto) > 0 && (
                      <span className="text-[10px] text-muted-foreground opacity-70">
                        Desconto: {brl(os.desconto)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <select
                    value={os.status}
                    onChange={(e) =>
                      acoes.current.mudarStatus({
                        id: os.id,
                        status: e.target.value,
                        origem: os.status,
                      })
                    }
                    className={`h-8 w-full rounded-lg border px-2 text-xs font-medium transition ${
                      STATUS_OS_COR[os.status as keyof typeof STATUS_OS_COR] ??
                      "bg-primary/10 text-primary border-primary/20"
                    }`}
                  >
                    {STATUS_OS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-1">
                    <OsFotos osId={os.id} numero={os.numero} empresaId={os.user_id} />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => acoes.current.abrirEdicao(os)}
                      title="Editar OS"
                    >
                      <Edit className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const url = `${origemPublica()}/consulta/${os.id}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Link da Área do Cliente copiado!");
                      }}
                      title="Copiar Link Área do Cliente"
                    >
                      <QrCode className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => acoes.current.enviarOs(os)}
                      title="Enviar OS (PDF)"
                    >
                      <Share2 className="h-4 w-4 text-primary" />
                    </Button>
                    <AcoesOsMenu
                      os={os}
                      onImprimir={(o, modo) => acoes.current.imprimir(o, modo)}
                      onEnviarOrcamento={(o) => acoes.current.enviarOs(o, "orcamento")}
                      onWhatsApp={(o) => acoes.current.enviarWhatsAppOs(o)}
                      onGerarAcesso={(o) => acoes.current.gerarAcessoOs(o)}
                      onAssinatura={(o) => acoes.current.abrirAssinatura(o)}
                      onEstornar={(o) => acoes.current.confirmarEstorno(o)}
                      navigate={navigate}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => acoes.current.confirmarExclusao(os)}
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-muted-foreground">
                  Nenhuma ordem de serviço neste filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {lista.map((os) => (
          <div key={os.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <AparelhoCard3D lados={ladosPorOs[os.id]} titulo={tituloAparelho(os)} />
                <div>
                  <span className="text-xs font-semibold text-muted-foreground">#{os.numero}</span>
                  <h3 className="font-bold">{os.clientes?.nome ?? "Sem cliente"}</h3>
                  <p className="text-xs text-muted-foreground">
                    {os.responsavel || "Técnico não atribuído"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-extrabold text-primary">{brl(os.valor)}</span>
                {Number(os.desconto) > 0 && (
                  <span className="text-[10px] text-muted-foreground opacity-70">
                    Desconto: {brl(os.desconto)}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Aberta: {dataBR(os.created_at)}</span>
              <span className="text-primary">Previsão: {dataBR(os.previsao)}</span>
              <span>Garantia: {getVencimentoGarantia(os.garantia_vencimento)}</span>
            </div>

            <select
              value={os.status}
              onChange={(e) =>
                acoes.current.mudarStatus({ id: os.id, status: e.target.value, origem: os.status })
              }
              className={`mt-3 h-9 w-full rounded-lg border px-2 text-xs font-medium transition ${
                STATUS_OS_COR[os.status as keyof typeof STATUS_OS_COR] ??
                "bg-primary/10 text-primary border-primary/20"
              }`}
            >
              {STATUS_OS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
              <OsFotos osId={os.id} numero={os.numero} empresaId={os.user_id} />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => acoes.current.abrirEdicao(os)}
                title="Editar OS"
              >
                <Edit className="h-4 w-4 text-primary" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const url = `${origemPublica()}/consulta/${os.id}`;
                  navigator.clipboard.writeText(url);
                  toast.success("Link da Área do Cliente copiado!");
                }}
                title="Copiar Link Área do Cliente"
              >
                <QrCode className="h-4 w-4 text-primary" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => acoes.current.enviarOs(os)}
                title="Enviar OS (PDF)"
              >
                <Share2 className="h-4 w-4 text-primary" />
              </Button>
              <AcoesOsMenu
                os={os}
                onImprimir={(o, modo) => acoes.current.imprimir(o, modo)}
                onEnviarOrcamento={(o) => acoes.current.enviarOs(o, "orcamento")}
                onWhatsApp={(o) => acoes.current.enviarWhatsAppOs(o)}
                onGerarAcesso={(o) => acoes.current.gerarAcessoOs(o)}
                onAssinatura={(o) => acoes.current.abrirAssinatura(o)}
                onEstornar={(o) => acoes.current.confirmarEstorno(o)}
                navigate={navigate}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => acoes.current.confirmarExclusao(os)}
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {!lista.length && (
          <p className="py-12 text-center text-muted-foreground">
            Nenhuma ordem de serviço neste filtro.
          </p>
        )}
      </div>
    </>
  );
});

function AcoesOsMenu({
  os,
  onImprimir,
  onEnviarOrcamento,
  onWhatsApp,
  onGerarAcesso,
  onAssinatura,
  onEstornar,
  navigate,
}: {
  os: OsListada;
  onImprimir: (os: OsListada, modo: "os" | "orcamento" | "nao_fiscal") => void;
  onEnviarOrcamento: (os: OsListada) => void;
  onWhatsApp: (os: OsListada) => void;
  onGerarAcesso: (os: OsListada) => void;
  onAssinatura: (os: OsListada) => void;
  onEstornar: (os: OsListada) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8" title="Mais ações">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Impressão</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onImprimir(os, "orcamento")}>
          Orçamento A4
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onImprimir(os, "os")}>Imprimir A4</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onImprimir(os, "nao_fiscal")}>
          Imprimir não fiscal
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAssinatura(os)}>Assinatura digital</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEnviarOrcamento(os)}>
          Enviar orçamento (PDF)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onWhatsApp(os)}>Enviar por WhatsApp</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onGerarAcesso(os)}>
          <KeyRound className="mr-2 h-4 w-4" /> Gerar acesso do cliente
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/cobrancas" })}>
          Emitir cobrança
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={() => onEstornar(os)}
        >
          <Undo2 className="mr-2 h-4 w-4" /> Estornar lançamento
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Campo({
  label,
  value,
  onChange,
  sugestoesId,
  sugestoes,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  sugestoesId?: string;
  sugestoes?: string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} list={sugestoesId} />
      {sugestoesId && sugestoes && (
        <datalist id={sugestoesId}>
          {sugestoes.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
