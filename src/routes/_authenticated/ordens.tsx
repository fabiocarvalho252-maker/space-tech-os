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
  Clock,
  Tag,
  ShieldCheck,
  Star,
  Sparkles,
  Wand2,
  MoreVertical,
  Undo2,
  KeyRound,
  Share2,
  ExternalLink,
  Link2,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
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
import { useOsParadas } from "@/hooks/useOsParadas";
import { imprimirEtiquetaOs } from "@/lib/etiqueta-os";
import { EnviarOsModal } from "@/components/EnviarOsModal";
import { ClienteAcessoModal, type ClienteAcesso } from "@/components/ClienteAcessoModal";
import { gerarAcessoCliente } from "@/lib/cliente-conta/cliente-conta.functions";
import { AssinaturaDigitalModal } from "@/components/AssinaturaDigitalModal";
import { MARCAS_COM_MODELOS, sugerirModelos } from "@/lib/catalogo-modelos";
import {
  BarraEtapas,
  BlocoResumo,
  LinhaResumo,
  type EtapaInfo,
} from "@/components/os/EtapasNovaOs";
import { avisarOsProntaFn } from "@/lib/whatsapp/whatsapp.functions";
import { renderOsTemplateHtml, type RenderOsData } from "@/lib/os-template-render";

import { useCurrentUser, useMinhaEmpresa, useProfile } from "@/hooks/useCurrentUser";
import { dataBR, dataHoraBR, STATUS_OS, STATUS_OS_COR, statusLabel } from "@/lib/format";
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
import { buscarTemplatePadrao } from "@/lib/os-template-busca";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
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

function checklistPreenchido(c: Record<string, string> | null | undefined) {
  return Object.values(c ?? {}).some((v) => v && v !== "nao_testado");
}

function ChecklistGrade({
  valor,
  onChange,
}: {
  valor: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {CHECKLIST_ITENS.map((item) => {
        const atual = valor[item.key] || "nao_testado";
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
                  onClick={() => onChange({ ...valor, [item.key]: s.value })}
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
  );
}

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

const ETAPAS_NOVA_OS: EtapaInfo[] = [
  { titulo: "Cliente", descricao: "Quem está deixando o aparelho." },
  { titulo: "Aparelho", descricao: "Qual aparelho, e a senha para testar." },
  { titulo: "Problema", descricao: "O defeito, como o aparelho chegou e o que veio junto." },
  { titulo: "Atendimento", descricao: "Técnico, previsão de entrega e diagnóstico." },
  { titulo: "Revisão", descricao: "Confira tudo antes de criar a OS." },
];

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
  const [whatsappModelo, setWhatsappModelo] = useState<string | undefined>(undefined);
  const [enviarOsAlvo, setEnviarOsAlvo] = useState<OsListada | null>(null);
  const [enviarOsModo, setEnviarOsModo] = useState<"os" | "orcamento">("os");
  const [enviarOsOpen, setEnviarOsOpen] = useState(false);
  const [assinaturaOs, setAssinaturaOs] = useState<OsListada | null>(null);
  const [assinaturaOpen, setAssinaturaOpen] = useState(false);
  // Etapa atual da Nova OS e a mais adiantada já vista (libera voltar/pular).
  const [etapaNova, setEtapaNova] = useState(0);
  const [maxEtapaNova, setMaxEtapaNova] = useState(0);
  // Etapa de assinaturas (cliente + quem finalizou) antes de imprimir/gerar o
  // PDF da OS; `seguir` monta o documento depois que elas forem salvas.
  const [assinarAntes, setAssinarAntes] = useState<{
    os: OsListada;
    rotulo: string;
    seguir: (salvando: Promise<void>) => void;
  } | null>(null);
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
  const [checklistSaida, setChecklistSaida] = useState<Record<string, string>>({});
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

    // Serviço com garantia própria: o prazo da OS passa a ser o maior entre
    // os serviços dela (ainda dá para mudar à mão na aba de entrega).
    if (tipo === "servico" && item?.garantia_dias != null) {
      const prazos = [...itensEdicao.map((i) => i.produto_id), item.id]
        .map((id) => produtos.find((p) => p.id === id)?.garantia_dias)
        .filter((d): d is number => d != null);
      const prazo = String(Math.max(...prazos));
      if (prazo !== garantiaDias) {
        setGarantiaDias(prazo);
        toast.info(`Prazo de garantia da OS ajustado para ${prazo} dias (garantia do serviço).`);
      }
    }
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
    setChecklistSaida((os.checklist_saida || {}) as Record<string, string>);
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
    () =>
      Array.from(
        new Set([...MARCAS_CONHECIDAS, ...MARCAS_COM_MODELOS, ...valoresUsados(ordens, "marca")]),
      ).sort(),
    [ordens],
  );
  // Só os modelos da marca digitada (e do tipo de aparelho, se for um dos
  // conhecidos) — catálogo + os já usados em OS daquela marca.
  const sugestoesModelo = useMemo(
    () => sugerirModelos(form.marca, form.aparelho, ordens),
    [ordens, form.marca, form.aparelho],
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
  // Inativos ficam fora dos seletores (os itens já lançados guardam a própria descrição).
  const pecas = useMemo(
    () => produtos.filter((p) => p.categoria !== "Serviço" && p.ativo),
    [produtos],
  );
  const servicosCadastrados = useMemo(
    () => produtos.filter((p) => p.categoria === "Serviço" && p.ativo),
    [produtos],
  );

  // Só passa da etapa do aparelho com ele preenchido; voltar é sempre livre.
  function irParaEtapa(destino: number) {
    if (destino > 1 && etapaNova <= 1 && !form.aparelho.trim()) {
      toast.error("Informe o aparelho para continuar.");
      setEtapaNova(1);
      setMaxEtapaNova((m) => Math.max(m, 1));
      return;
    }
    setEtapaNova(destino);
    setMaxEtapaNova((m) => Math.max(m, destino));
  }

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
          serial_number: form.serial_number || null,
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
      const cliente = clientes.find((c) => c.id === os.cliente_id);
      return { ...os, clientes: cliente ? { nome: cliente.nome, telefone: null } : null };
    },
    onSuccess: (nova) => {
      // O aparelho acabou de chegar no balcão: oferece a etiqueta na hora.
      toast.success(`OS #${nova.numero} criada`, {
        duration: 10_000,
        action: {
          label: "Imprimir etiqueta",
          onClick: () => {
            if (!imprimirEtiquetaOs(nova, profile?.loja || "Assistência")) {
              toast.error("Permita pop-ups para imprimir a etiqueta.");
            }
          },
        },
      });
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
          laudo_tecnico: laudo.trim() || null,
          anotacoes,
          desconto: Number(desconto) || 0,
          valor_pago: Number(valorPago) || 0,
          status_pagamento: statusPagamento,
          valor: totalOs,
          status: form.status,
          checklist_entrada: checklist,
          checklist_saida: checklistSaida,
          // Data em que a saída foi feita: mantém a primeira; limpa se esvaziar.
          checklist_saida_em: checklistPreenchido(checklistSaida)
            ? (ordens.find((o) => o.id === selectedOsId)?.checklist_saida_em ??
              new Date().toISOString())
            : null,
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
  // Sem o aviso automático (desligado, sem conexão, falhou...), oferece
  // mandar o link da Área do Cliente na hora, já com o modelo escolhido.
  function oferecerLinkCliente(osId: string) {
    const os = ordens.find((o) => o.id === osId);
    if (!os) return;
    toast.info(`OS #${os.numero} pronta`, {
      description: "Mande o link da Área do Cliente para o cliente acompanhar.",
      duration: 10_000,
      action: { label: "Enviar link", onClick: () => enviarWhatsAppOs(os, "area_cliente") },
    });
  }

  // Entregou sem refazer os testes: lembra do checklist de saída.
  function lembrarChecklistSaida(osId: string, status: string) {
    if (status !== "entregue" && status !== "faturado") return;
    const os = ordens.find((o) => o.id === osId);
    if (!os || os.checklist_saida_em) return;
    toast.info(`OS #${os.numero}: faça o checklist de saída`, {
      description: "Registra que o aparelho saiu funcionando — protege a loja em reclamação.",
      duration: 10_000,
      action: {
        label: "Abrir",
        onClick: () => {
          abrirEdicao(os);
          setTabEdicao("checklist");
        },
      },
    });
  }

  function avisarSePronta(osId: string, status: string) {
    if (status !== "pronto") return;
    avisarOsProntaFn({ data: { osId } })
      .then((r) => {
        if (!r.enviado && r.motivo !== "aguardando_aprovacao" && r.motivo !== "ja_enviado") {
          oferecerLinkCliente(osId);
        }
        if (r.enviado) {
          toast.success("Cliente avisado no WhatsApp que a OS está pronta");
          qc.invalidateQueries({ queryKey: ["os-historico", osId] });
        } else if (r.motivo === "desconectado") {
          toast.warning("Aviso de OS pronta não enviado: WhatsApp desconectado");
        } else if (r.motivo === "falhou") {
          toast.warning("Não foi possível enviar o aviso de OS pronta no WhatsApp");
        } else if (r.motivo === "aguardando_aprovacao") {
          toast.info("Aviso de OS pronta aguardando aprovação em WhatsApp → Fila e automações");
        } else if (r.motivo === "opt_out") {
          toast.info(
            "Aviso de OS pronta não enviado: o cliente pediu para não receber mensagens automáticas",
          );
        }
      })
      .catch(() => {});
  }

  const mudarStatus = useMutation({
    // Qualquer status pode ir para qualquer outro: a loja não precisa seguir
    // uma sequência (o antigo "Fluxo entre Status" foi retirado).
    mutationFn: async ({ id, status }: { id: string; status: string; origem?: string }) => {
      const { error } = await supabase.from("ordens_servico").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["os-historico", variables.id] });
      toast.success("Status atualizado");
      avisarSePronta(variables.id, variables.status);
      lembrarChecklistSaida(variables.id, variables.status);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Retorno em garantia: nº da OS de origem e quais OS já voltaram.
  const indiceGarantia = useMemo(() => {
    const numero = new Map(ordens.map((o) => [o.id, o.numero]));
    const origemDe: Record<string, number> = {};
    const retornos: Record<string, number> = {};
    for (const o of ordens) {
      if (!o.os_origem_id) continue;
      const n = numero.get(o.os_origem_id);
      if (n !== undefined) origemDe[o.id] = n;
      retornos[o.os_origem_id] = (retornos[o.os_origem_id] ?? 0) + 1;
    }
    return { origemDe, retornos };
  }, [ordens]);

  const [confirmRetorno, setConfirmRetorno] = useState<OsListada | null>(null);
  const abrirRetorno = useMutation({
    mutationFn: async (origem: OsListada) => {
      const { data: nova, error } = await supabase
        .from("ordens_servico")
        .insert({
          user_id: empresaId!,
          os_origem_id: origem.id,
          cliente_id: origem.cliente_id,
          aparelho: origem.aparelho,
          marca: origem.marca,
          modelo: origem.modelo,
          imei: origem.imei,
          serial_number: origem.serial_number,
          cor: origem.cor,
          responsavel_user_id: origem.responsavel_user_id,
          responsavel: origem.responsavel,
          defeito: `Retorno em garantia da OS #${origem.numero}: `,
          valor: 0,
          status: "recebido",
        })
        .select("*, clientes(nome, telefone)")
        .single();
      if (error) throw error;
      await supabase.from("os_historico").insert({
        user_id: origem.user_id,
        os_id: origem.id,
        evento: "garantia_retorno",
        descricao: `Retorno em garantia aberto: OS #${nova.numero}`,
        created_by: user?.id ?? null,
      });
      await supabase.from("os_historico").insert({
        user_id: origem.user_id,
        os_id: nova.id,
        evento: "garantia_retorno",
        descricao: `Retorno em garantia da OS #${origem.numero}`,
        created_by: user?.id ?? null,
      });
      return nova as OsListada;
    },
    onSuccess: async (nova) => {
      setConfirmRetorno(null);
      toast.success(`OS #${nova.numero} aberta como retorno em garantia`);
      await qc.invalidateQueries({ queryKey: ["ordens"] });
      abrirEdicao(nova);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function pedirRetorno(os: OsListada) {
    if (!["entregue", "faturado"].includes(os.status) && !os.data_entrega) {
      toast.error("O retorno em garantia é aberto a partir de uma OS já entregue.");
      return;
    }
    // Garantia vencida: confirma antes (às vezes a loja cobre por cortesia).
    const vencida =
      !!os.garantia_vencimento && new Date(`${os.garantia_vencimento}T23:59:59`) < new Date();
    if (vencida) setConfirmRetorno(os);
    else abrirRetorno.mutate(os);
  }

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

  function enviarWhatsAppOs(os: OsListada, modelo?: string) {
    setWhatsappOs(os);
    setWhatsappModelo(modelo);
    setWhatsappOpen(true);
  }

  function abrirEnviarOs(os: OsListada, modo: "os" | "orcamento") {
    setEnviarOsAlvo(os);
    setEnviarOsModo(modo);
    setEnviarOsOpen(true);
  }

  function enviarOs(os: OsListada, modo: "os" | "orcamento" = "os") {
    if (modo === "orcamento") return abrirEnviarOs(os, modo);
    setAssinarAntes({
      os,
      rotulo: "Salvar e gerar PDF",
      seguir: (salvando) => void salvando.then(() => abrirEnviarOs(os, modo)),
    });
  }

  // Orçamento sai direto; OS e não fiscal passam antes pelas assinaturas.
  function imprimir(os: (typeof ordens)[number], modo: "os" | "orcamento" | "nao_fiscal" = "os") {
    if (modo === "orcamento") return void imprimirDocumento(os, modo);
    setAssinarAntes({
      os,
      rotulo: "Salvar e imprimir",
      seguir: (salvando) => void imprimirDocumento(os, modo, salvando),
    });
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

  async function imprimirDocumento(
    os: (typeof ordens)[number],
    modo: "os" | "orcamento" | "nao_fiscal" = "os",
    antes?: Promise<void>,
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
    // Assinaturas recém-feitas precisam estar salvas antes de buscar as fotos.
    if (antes) await antes;

    // Termo padrão, config de impressão, fotos, itens e o modelo (template)
    // configurado em Configurações → Modelos de OS — o padrão da empresa, ou
    // (se ela nunca visitou essa tela) o primeiro modelo ativo qualquer.
    const [
      { data: termo },
      { data: osConfigData },
      { data: fotosData },
      { data: itensData },
      templatesData,
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
      // Orçamento usa o modelo de Orçamento; OS e não fiscal, o de Faturamento.
      buscarTemplatePadrao(supabase, empresaId || "", modo === "orcamento" ? "orcamento" : "os"),
    ]);

    const osConfig = osConfigData;
    const fotos = fotosData ?? [];
    const itensOs = itensData ?? [];
    const template = templatesData;

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
      checklistSaida: (os.checklist_saida_em ? (os.checklist_saida ?? {}) : {}) as Record<
        string,
        string
      >,
      estadoFisico: (os.estado_fisico ?? {}) as Record<string, boolean>,
      estadoFisicoObs: os.estado_fisico_obs ?? null,
      acessorios: os.acessorios ?? null,
      fotos: fotosComUrl,
      assinaturaClienteSrc,
      assinaturaTecnicoSrc,
      assinaturaTecnicoNome: assinaturaTecnico?.assinante_nome || os.responsavel || null,
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
    imprimirEtiqueta: (os) => {
      if (!imprimirEtiquetaOs(os, profile?.loja || "Assistência")) {
        toast.error("Permita pop-ups para imprimir a etiqueta.");
      }
    },
    gerarAcessoOs,
    abrirRetorno: pedirRetorno,
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
                setEtapaNova(0);
                setMaxEtapaNova(0);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Nova OS
              </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-4 overflow-hidden p-0 sm:p-0">
              <DialogHeader className="px-5 pt-5">
                <DialogTitle>Nova ordem de serviço</DialogTitle>
                <DialogDescription>
                  Preencha em etapas — só o aparelho é obrigatório.
                </DialogDescription>
              </DialogHeader>
              <div className="px-5">
                <BarraEtapas
                  etapas={ETAPAS_NOVA_OS}
                  atual={etapaNova}
                  maxVisitada={maxEtapaNova}
                  onIr={irParaEtapa}
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
                {etapaNova === 0 && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Cliente</Label>
                      <ClienteCampo
                        clientes={clientes}
                        value={form.cliente_id}
                        onChange={(id) => setForm({ ...form, cliente_id: id })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Digite o nome ou o telefone. Se ainda não tiver cadastro, dá para cadastrar
                        na hora.
                      </p>
                    </div>
                    {!form.cliente_id && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                        Sem cliente a OS pode ser criada, mas não dá para avisar pelo WhatsApp nem
                        mandar o link de aprovação do orçamento.
                      </div>
                    )}
                  </div>
                )}

                {etapaNova === 1 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo
                      label="Aparelho *"
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
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Padrão de desbloqueio</Label>
                      <PatternLock
                        value={form.padrao_desbloqueio}
                        onChange={(val) => setForm({ ...form, padrao_desbloqueio: val })}
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}

                {etapaNova === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Defeito relatado pelo cliente</Label>
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
                        placeholder="Ex: tela quebrada, não carrega, caiu na água..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado físico na entrada</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {ESTADO_FISICO_ITENS.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() =>
                              setEstadoFisico({
                                ...estadoFisico,
                                [item.key]: !estadoFisico[item.key],
                              })
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
                    <AcessoriosCampo
                      value={form.acessorios}
                      onChange={(v) => setForm({ ...form, acessorios: v })}
                    />
                    <div className="border-t border-border pt-4">
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
                )}

                {etapaNova === 3 && (
                  <div className="grid gap-3 sm:grid-cols-2">
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
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Diagnóstico técnico (se já souber)</Label>
                      <Textarea
                        value={form.diagnostico}
                        onChange={(e) => setForm({ ...form, diagnostico: e.target.value })}
                        placeholder="Pode deixar em branco e preencher depois da análise."
                      />
                    </div>
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Serviços, peças e valores entram depois, ao abrir a OS (aba Produtos e
                      Serviços) — é lá que sai o orçamento para o cliente aprovar.
                    </p>
                  </div>
                )}

                {etapaNova === 4 && (
                  <div className="space-y-3">
                    <BlocoResumo titulo="Cliente" onAlterar={() => irParaEtapa(0)}>
                      <LinhaResumo
                        rotulo="Nome"
                        valor={
                          clientes.find((c) => c.id === form.cliente_id)?.nome ?? "Sem cliente"
                        }
                      />
                    </BlocoResumo>
                    <BlocoResumo titulo="Aparelho" onAlterar={() => irParaEtapa(1)}>
                      <LinhaResumo
                        rotulo="Aparelho"
                        valor={[form.aparelho, form.marca, form.modelo].filter(Boolean).join(" ")}
                      />
                      <LinhaResumo rotulo="Cor" valor={form.cor} />
                      <LinhaResumo
                        rotulo="IMEI / série"
                        valor={[form.imei, form.serial_number].filter(Boolean).join(" · ")}
                      />
                      <LinhaResumo
                        rotulo="Senha / padrão"
                        valor={
                          [
                            form.senha_dispositivo && "PIN informado",
                            form.padrao_desbloqueio && "Padrão informado",
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Não informado"
                        }
                      />
                    </BlocoResumo>
                    <BlocoResumo titulo="Problema e entrada" onAlterar={() => irParaEtapa(2)}>
                      <LinhaResumo rotulo="Defeito" valor={form.defeito} />
                      <LinhaResumo
                        rotulo="Estado físico"
                        valor={
                          [
                            ...ESTADO_FISICO_ITENS.filter((i) => estadoFisico[i.key]).map(
                              (i) => i.label,
                            ),
                            estadoFisicoObs.trim(),
                          ]
                            .filter(Boolean)
                            .join(", ") || "Sem avarias marcadas"
                        }
                      />
                      <LinhaResumo rotulo="Acessórios" valor={form.acessorios || "Nenhum"} />
                      <LinhaResumo
                        rotulo="Fotos"
                        valor={fotosNovaOs.length ? `${fotosNovaOs.length} foto(s)` : "Nenhuma"}
                      />
                    </BlocoResumo>
                    <BlocoResumo titulo="Atendimento" onAlterar={() => irParaEtapa(3)}>
                      <LinhaResumo
                        rotulo="Técnico"
                        valor={(() => {
                          const t = tecnicos.find((m) => m.user_id === form.responsavel_user_id);
                          return t ? nomeTecnico(t) : "Sem técnico";
                        })()}
                      />
                      <LinhaResumo
                        rotulo="Previsão"
                        valor={previsaoData ? dataBR(previsaoData) : "Sem previsão"}
                      />
                      <LinhaResumo rotulo="Diagnóstico" valor={form.diagnostico} />
                    </BlocoResumo>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => (etapaNova === 0 ? setOpen(false) : irParaEtapa(etapaNova - 1))}
                >
                  {etapaNova === 0 ? (
                    "Cancelar"
                  ) : (
                    <>
                      <ChevronLeft className="h-4 w-4" /> Voltar
                    </>
                  )}
                </Button>
                {etapaNova < ETAPAS_NOVA_OS.length - 1 ? (
                  <Button type="button" onClick={() => irParaEtapa(etapaNova + 1)}>
                    Próximo <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                    {criar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Criar OS
                  </Button>
                )}
              </div>
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

      <ListaOs
        lista={lista.slice(0, limiteLista)}
        acoes={acoesListaRef}
        navigate={navigate}
        garantia={indiceGarantia}
      />
      <ConfirmDialog
        open={!!confirmRetorno}
        onOpenChange={(v) => !v && setConfirmRetorno(null)}
        title="Garantia vencida"
        description={
          confirmRetorno
            ? `A garantia da OS Nº ${confirmRetorno.numero} venceu em ${dataBR(confirmRetorno.garantia_vencimento)}. Abrir o retorno em garantia mesmo assim?`
            : ""
        }
        confirmLabel="Abrir retorno"
        loading={abrirRetorno.isPending}
        onConfirm={() => confirmRetorno && abrirRetorno.mutate(confirmRetorno)}
      />
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
                <ChecklistGrade valor={checklist} onChange={setChecklist} />
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-base font-bold">Checklist de saída</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setChecklistSaida({ ...checklist })}
                      disabled={!checklistPreenchido(checklist)}
                    >
                      Copiar da entrada
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setChecklistSaida(
                          Object.fromEntries(
                            CHECKLIST_ITENS.map((i) => [
                              i.key,
                              checklist[i.key] === "nao_se_aplica" ? "nao_se_aplica" : "ok",
                            ]),
                          ),
                        )
                      }
                    >
                      Tudo OK
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Refaça os testes na entrega: fica registrado que o aparelho saiu funcionando (sai
                  no PDF e na Área do Cliente, ao lado da entrada).
                </p>
                <ChecklistGrade valor={checklistSaida} onChange={setChecklistSaida} />
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
          // Finalizou: assinaturas do cliente e de quem finalizou, depois o
          // envio pelo WhatsApp (que pode anexar o PDF já assinado).
          const alvo = ordens.find((o) => o.id === os.id);
          const abrirWhatsApp = () => {
            setWhatsappOs(os);
            setWhatsappOpen(true);
          };
          if (!alvo) return abrirWhatsApp();
          setAssinarAntes({
            os: alvo,
            rotulo: "Salvar e continuar",
            seguir: (salvando) => void salvando.then(abrirWhatsApp),
          });
        }}
      />

      <WhatsAppSendModal
        os={whatsappOs}
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
        templateInicial={whatsappModelo}
      />
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
      <AssinaturaDigitalModal
        os={assinarAntes?.os ?? null}
        open={!!assinarAntes}
        onOpenChange={(v) => !v && setAssinarAntes(null)}
        aoConcluir={assinarAntes?.seguir ?? (() => {})}
        rotuloConcluir={assinarAntes?.rotulo ?? "Salvar e gerar"}
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
  enviarWhatsAppOs: (os: OsListada, modelo?: string) => void;
  imprimirEtiqueta: (os: OsListada) => void;
  abrirRetorno: (os: OsListada) => void;
  gerarAcessoOs: (os: OsListada) => void;
  abrirAssinatura: (os: OsListada) => void;
  confirmarEstorno: (os: OsListada) => void;
  confirmarExclusao: (os: OsListada) => void;
};

// A lista fica fora do componente principal e memoizada: o formulário de
// Nova OS/edição vive no estado da página, e sem isso cada tecla digitada
// redesenhava todas as OS (tabela + cards mobile), deixando a digitação
// lenta. As ações vão por ref para que o memo não seja quebrado.
// Última vez que o cliente abriu o link da OS (Área do Cliente) — evento
// gravado por registrar_visualizacao_os_publica(), no máx. 1 a cada 6 h.
function useVistasCliente() {
  return useQuery({
    queryKey: ["os-vistas-cliente"],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_historico")
        .select("os_id, created_at")
        .eq("evento", "cliente_visualizou")
        .gte("created_at", new Date(Date.now() - 90 * 86400_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const mapa: Record<string, string> = {};
      for (const v of data ?? []) mapa[v.os_id] ??= v.created_at;
      return mapa;
    },
  });
}

// Nota que o cliente deu pela Área do Cliente (os_avaliacoes, uma por OS).
function useAvaliacoesOs() {
  return useQuery({
    queryKey: ["os-avaliacoes-lista"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_avaliacoes")
        .select("os_id, nota, comentario")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const mapa: Record<string, { nota: number; comentario: string | null }> = {};
      for (const a of data ?? []) mapa[a.os_id] = { nota: a.nota, comentario: a.comentario };
      return mapa;
    },
  });
}

function NotaDoCliente({ av }: { av: { nota: number; comentario: string | null } | undefined }) {
  if (!av) return null;
  const baixa = av.nota <= 2;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        baixa
          ? "bg-destructive/10 text-destructive"
          : "bg-amber-400/15 text-amber-600 dark:text-amber-400"
      }`}
      title={`Avaliação do cliente: ${av.nota} de 5${av.comentario ? ` — "${av.comentario}"` : ""}`}
    >
      <Star className="h-3 w-3 fill-current" /> {av.nota}
    </span>
  );
}

function OsParadaSelo({ dias }: { dias: number | undefined }) {
  if (dias === undefined) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
      title={`Sem mudar de status há ${dias} dias`}
    >
      <Clock className="h-3 w-3" /> Parada há {dias}d
    </span>
  );
}

function SeloGarantia({
  origem,
  retornos,
}: {
  origem: number | undefined;
  retornos: number | undefined;
}) {
  return (
    <>
      {origem !== undefined && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400"
          title={`Retorno em garantia da OS #${origem}`}
        >
          <ShieldCheck className="h-3 w-3" /> Garantia da #{origem}
        </span>
      )}
      {!!retornos && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600"
          title={`${retornos} retorno(s) em garantia`}
        >
          <Undo2 className="h-3 w-3" /> Retornou{retornos > 1 ? ` ${retornos}x` : ""}
        </span>
      )}
    </>
  );
}

function haQuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return min <= 1 ? "agora" : `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

function VistoPeloCliente({ em }: { em: string | undefined }) {
  if (!em) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
      title={`Cliente abriu o link da OS em ${dataHoraBR(em)}`}
    >
      <Eye className="h-3 w-3" /> Visto {haQuanto(em)}
    </span>
  );
}

const ListaOs = memo(function ListaOs({
  lista,
  acoes,
  navigate,
  garantia,
}: {
  lista: OsListada[];
  acoes: { current: AcoesListaOs };
  navigate: ReturnType<typeof useNavigate>;
  garantia: { origemDe: Record<string, number>; retornos: Record<string, number> };
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const { data: ladosPorOs = {} } = useLadosAparelhos();
  const { data: vistas = {} } = useVistasCliente();
  const { data: avaliacoes = {} } = useAvaliacoesOs();
  const { data: paradasLista = [] } = useOsParadas();
  const paradas = useMemo(
    () => Object.fromEntries(paradasLista.map((p) => [p.os_id, p.dias])),
    [paradasLista],
  );
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
                      <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        #{os.numero}
                        <VistoPeloCliente em={vistas[os.id]} />
                        <NotaDoCliente av={avaliacoes[os.id]} />
                        <OsParadaSelo dias={paradas[os.id]} />
                        <SeloGarantia
                          origem={garantia.origemDe[os.id]}
                          retornos={garantia.retornos[os.id]}
                        />
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
                    <span>{dataHoraBR(os.created_at)}</span>
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
                      onLinkCliente={(o) => acoes.current.enviarWhatsAppOs(o, "area_cliente")}
                      onEtiqueta={(o) => acoes.current.imprimirEtiqueta(o)}
                      onRetorno={(o) => acoes.current.abrirRetorno(o)}
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
                  <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    #{os.numero}
                    <VistoPeloCliente em={vistas[os.id]} />
                    <NotaDoCliente av={avaliacoes[os.id]} />
                    <OsParadaSelo dias={paradas[os.id]} />
                    <SeloGarantia
                      origem={garantia.origemDe[os.id]}
                      retornos={garantia.retornos[os.id]}
                    />
                  </span>
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
              <span>Aberta: {dataHoraBR(os.created_at)}</span>
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
                onLinkCliente={(o) => acoes.current.enviarWhatsAppOs(o, "area_cliente")}
                onEtiqueta={(o) => acoes.current.imprimirEtiqueta(o)}
                onRetorno={(o) => acoes.current.abrirRetorno(o)}
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
  onLinkCliente,
  onEtiqueta,
  onRetorno,
  onGerarAcesso,
  onAssinatura,
  onEstornar,
  navigate,
}: {
  os: OsListada;
  onImprimir: (os: OsListada, modo: "os" | "orcamento" | "nao_fiscal") => void;
  onEnviarOrcamento: (os: OsListada) => void;
  onWhatsApp: (os: OsListada) => void;
  onLinkCliente: (os: OsListada) => void;
  onEtiqueta: (os: OsListada) => void;
  onRetorno: (os: OsListada) => void;
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
        <DropdownMenuItem onClick={() => onEtiqueta(os)}>
          <Tag className="mr-2 h-4 w-4" /> Etiqueta do aparelho
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAssinatura(os)}>Assinatura digital</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEnviarOrcamento(os)}>
          Enviar orçamento (PDF)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onWhatsApp(os)}>Enviar por WhatsApp</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Área do Cliente</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onLinkCliente(os)}>
          <Link2 className="mr-2 h-4 w-4" /> Enviar link por WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open(`${origemPublica()}/consulta/${os.id}`, "_blank", "noopener")}
        >
          <ExternalLink className="mr-2 h-4 w-4" /> Abrir Área do Cliente
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onGerarAcesso(os)}>
          <KeyRound className="mr-2 h-4 w-4" /> Gerar acesso do cliente
        </DropdownMenuItem>
        {(os.status === "entregue" || os.status === "faturado" || !!os.data_entrega) && (
          <DropdownMenuItem onClick={() => onRetorno(os)}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Abrir retorno em garantia
          </DropdownMenuItem>
        )}
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
