import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Printer,
  Trash2,
  FileCheck,
  Package,
  ShoppingCart,
  Minus,
  QrCode,
  Edit,
  Filter,
  X,
  MessageCircle,
  DollarSign,
  Receipt,
  Eye,
  EyeOff,
  Sparkles,
  Wand2,
  MoreVertical,
  Undo2,
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { OsFotos } from "@/components/OsFotos";
import { PatternLock } from "@/components/PatternLock";
import { FaturarOsModal } from "@/components/FaturarOsModal";
import { WhatsAppSendModal } from "@/components/WhatsAppSendModal";
import { renderToString } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

import { useCurrentUser, useProfile } from "@/hooks/useCurrentUser";
import { brl, dataBR, STATUS_OS, statusLabel } from "@/lib/format";
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
  itens: [] as any[],
};

function Ordens() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const { data: user } = useCurrentUser();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedOsId, setSelectedOsId] = useState<string | null>(null);
  const [faturarOpen, setFaturarOpen] = useState(false);
  const [whatsappOs, setWhatsappOs] = useState<any>(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [form, setForm] = useState(vazio);
  const [filtro, setFiltro] = useState("todas");
  const [showFilters, setShowFilters] = useState(false);
  const [filtrosAvancados, setFiltrosAvancados] = useState({
    dataInicio: "",
    dataFim: "",
    responsavel: "",
    busca: "",
  });

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
  const itemVazio = { descricao: "", observacao: "", preco_unitario: "", quantidade: "1" };
  const [novoProduto, setNovoProduto] = useState(itemVazio);
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
    const item = catalogo.find((p: any) => p.nome === base.descricao);
    setItensEdicao([
      ...itensEdicao,
      {
        tipo,
        descricao: base.descricao,
        observacao: base.observacao || undefined,
        quantidade: Number(base.quantidade) || 1,
        preco_unitario: Number(base.preco_unitario) || Number((item as any)?.preco_venda) || 0,
        produto_id: tipo === "produto" ? ((item as any)?.id ?? null) : null,
      },
    ]);
    if (tipo === "produto") setNovoProduto(itemVazio);
    else setNovoServico(itemVazio);
  }

  async function abrirEdicao(os: any) {
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
      itens: [],
    });
    setEditOpen(true);
    const { data } = await supabase
      .from("os_itens" as any)
      .select("*")
      .eq("os_id", os.id);
    setItensEdicao(
      ((data as any[]) ?? []).map((i) => ({
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
    const os: any = ordens.find((o) => o.id === selectedOsId);
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

  useEffect(() => {
    if (!searchParams.os || !ordens.length) return;
    const alvo = ordens.find((o: any) => o.id === searchParams.os);
    if (alvo) abrirEdicao(alvo);
    navigate({ to: "/ordens", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.os, ordens]);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () =>
      (await supabase.from("clientes").select("id, nome").order("nome")).data ?? [],
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => (await supabase.from("produtos").select("*").order("nome")).data ?? [],
  });
  // "produtos" mistura estoque real com o cadastro de serviços (categoria "Serviço",
  // sem controle de estoque) — separar aqui evita que serviços apareçam nos seletores de peça.
  const pecas = useMemo(
    () => (produtos as any[]).filter((p) => p.categoria !== "Serviço"),
    [produtos],
  );
  const servicosCadastrados = useMemo(
    () => (produtos as any[]).filter((p) => p.categoria === "Serviço"),
    [produtos],
  );

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.aparelho.trim()) throw new Error("Informe o aparelho");

      const { data: os, error } = await supabase
        .from("ordens_servico")
        .insert({
          user_id: user!.id,
          cliente_id: form.cliente_id || null,
          aparelho: form.aparelho,
          marca: form.marca,
          modelo: form.modelo,
          imei: form.imei,
          cor: form.cor,
          senha_dispositivo: form.senha_dispositivo,
          padrao_desbloqueio: form.padrao_desbloqueio,
          defeito: form.defeito,
          diagnostico: form.diagnostico,
          valor: Number(form.valor) || 0,
          status: form.status,
        } as any)
        .select()
        .single();

      if (error) throw error;

      if (form.itens.length > 0) {
        const { error: itensError } = await supabase.from("os_itens" as any).insert(
          form.itens.map((i) => ({
            user_id: user!.id,
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
    },
    onSuccess: () => {
      toast.success("OS criada");
      setForm(vazio);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editar = useMutation({
    mutationFn: async () => {
      if (!selectedOsId) return;
      if (!form.aparelho.trim()) throw new Error("Informe o aparelho");

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
          defeito: form.defeito,
          diagnostico: form.diagnostico,
          laudo_tecnico: laudo,
          anotacoes,
          desconto: Number(desconto) || 0,
          valor_pago: Number(valorPago) || 0,
          status_pagamento: statusPagamento,
          valor: totalOs,
          status: form.status,
        } as any)
        .eq("id", selectedOsId);

      if (error) throw error;

      const { error: delError } = await supabase
        .from("os_itens" as any)
        .delete()
        .eq("os_id", selectedOsId);
      if (delError) throw delError;

      if (itensEdicao.length > 0) {
        const { error: insError } = await supabase.from("os_itens" as any).insert(
          itensEdicao.map((i) => ({
            user_id: user!.id,
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
    },
    onSuccess: () => {
      toast.success("OS atualizada");
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
      const { data, error } = await supabase
        .from("os_status_flows" as any)
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status, origem }: { id: string; status: string; origem?: string }) => {
      // Validar fluxo se houver fluxos configurados
      if (origem && statusFlows.length > 0) {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Status atualizado");
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
    onError: (e: any) => {
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

  function enviarWhatsAppOs(os: any) {
    setWhatsappOs(os);
    setWhatsappOpen(true);
  }

  const estornar = useMutation({
    mutationFn: async (osId: string) => {
      const { data: faturamento, error: erroBusca } = await supabase
        .from("os_faturamentos" as any)
        .select("id")
        .eq("os_id", osId)
        .neq("status", "cancelado")
        .maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!faturamento) throw new Error("Esta OS não possui lançamento financeiro para estornar.");
      const { error } = await supabase.rpc("cancelar_faturamento_os" as any, {
        p_faturamento_id: (faturamento as any).id,
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

    // Buscar o termo padrão e a configuração de OS
    const [{ data: termo }, { data: osConfigData }, { data: fotos }] = await Promise.all([
      supabase
        .from("termos_garantia")
        .select("conteudo")
        .eq("user_id", user?.id || "")
        .eq("is_default", true)
        .single(),
      supabase
        .from("os_config" as any)
        .select("*")
        .eq("user_id", user?.id || "")
        .maybeSingle(),
      supabase
        .from("service_order_photos" as any)
        .select("*")
        .eq("os_id", os.id),
    ]);

    const osConfig = osConfigData as any;

    // Gerar QR Code se configurado
    let qrCodeHtml = "";
    if (osConfig?.imprimir_qrcode_cliente) {
      const clienteUrl = `${window.location.origin}/consulta/${os.id}`;
      qrCodeHtml = renderToString(
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <QRCodeSVG value={clienteUrl} size={100} />
          <p style={{ fontSize: "10px", marginTop: "5px" }}>Acompanhe sua OS online</p>
        </div>,
      );
    }

    // Gerar HTML de fotos se configurado
    let fotosHtml = "";
    if (osConfig?.exibir_fotos_impressao && fotos && fotos.length > 0) {
      fotosHtml = `
        <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
          <h3 style="font-size: 14px; margin-bottom: 10px;">Fotos do Equipamento</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            ${fotos
              .map(
                (f: any) => `
              <div style="text-align: center;">
                <img src="${supabase.storage.from("os-fotos").getPublicUrl(f.file_path).data.publicUrl}" 
                     style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px; border: 1px solid #eee;" />
                <p style="font-size: 8px; color: #999; margin-top: 2px;">${f.phase === "entrada" ? "Entrada" : f.phase === "reparo" ? "Durante" : "Saída"}</p>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
    }

    const tituloDoc = modo === "orcamento" ? "Orçamento" : "Ordem de Serviço";
    const conteudoVias = [];
    const numVias = osConfig?.imprimir_duas_vias ? 2 : 1;

    for (let i = 0; i < numVias; i++) {
      conteudoVias.push(`
        <div class="via" style="${i > 0 ? "margin-top: 50px; border-top: 2px dashed #ccc; padding-top: 50px; page-break-before: always;" : ""}">
          <header>
            <div>
              <h1>${profile?.loja ?? "Assistência Técnica"}</h1>
              <small>${tituloDoc} nº ${os.numero} - ${i === 0 ? "Via do Cliente" : "Via da Empresa"}</small>
            </div>
            <div style="text-align:right">
              <strong>${dataBR(os.created_at)}</strong><br>
              <small>${statusLabel(os.status)}</small>
            </div>
          </header>
          
          <table>
            <tr><td>Cliente</td><td>${os.clientes?.nome ?? "—"}</td></tr>
            <tr><td>Telefone</td><td>${os.clientes?.telefone ?? "—"}</td></tr>
            <tr><td>Aparelho</td><td>${os.aparelho} ${os.marca ?? ""} ${os.modelo ?? ""}</td></tr>
            <tr><td>Senha (PIN)</td><td>${(os as any).senha_dispositivo || "—"}</td></tr>
            <tr><td>Padrão</td><td>${(os as any).padrao_desbloqueio ? `Sequência: ${(os as any).padrao_desbloqueio}` : "—"}</td></tr>
            <tr><td>Defeito relatado</td><td>${os.defeito ?? "—"}</td></tr>
            <tr><td>Diagnóstico</td><td>${os.diagnostico ?? "—"}</td></tr>
          </table>

          <p class="total">Total: ${brl(os.valor)}</p>
          ${modo === "nao_fiscal" ? '<p style="font-size:10px;color:#999;margin-top:4px;">Documento sem valor fiscal.</p>' : ""}

          ${termo?.conteudo ? `<div class="garantia"><strong>Termos de Garantia:</strong><br>${termo.conteudo}</div>` : ""}
          ${osConfig?.termos_condicoes ? `<div class="condicoes"><strong>Condições do Orçamento:</strong><br>${osConfig.termos_condicoes}</div>` : ""}
          
          ${qrCodeHtml}
          ${fotosHtml}
          
          <footer style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px;">
            <div style="display: flex; justify-content: space-between;">
              <div style="width: 45%; border-top: 1px solid #000; margin-top: 30px; text-align: center; font-size: 10px;">Assinatura do Cliente</div>
              <div style="width: 45%; border-top: 1px solid #000; margin-top: 30px; text-align: center; font-size: 10px;">Assinatura do Técnico</div>
            </div>
          </footer>
        </div>
      `);
    }

    janela.document.open();
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>${tituloDoc} ${os.numero}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:40px;color:#1b1b2b;line-height:1.4}
        h1{margin:0;font-size:20px}
        header{display:flex;justify-content:space-between;border-bottom:2px solid #4f46e5;padding-bottom:12px}
        table{width:100%;margin-top:20px;border-collapse:collapse}
        td{padding:6px 0;vertical-align:top;border-bottom: 1px solid #f3f4f6}
        td:first-child{width:150px;color:#666;font-size:12px;font-weight:600}
        .total{margin-top:20px;font-size:18px;font-weight:800;color:#4f46e5}
        .garantia{margin-top:20px;padding:12px;background:#f9fafb;border-radius:8px;font-size:10px;color:#444;white-space:pre-line;border: 1px solid #f3f4f6}
        .condicoes{margin-top:15px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-size:9px;color:#666;white-space:pre-line}
        @media print { .via { page-break-after: always; } .via:last-child { page-break-after: avoid; } }
      </style>
      </head><body>
      ${conteudoVias.join("")}
      <script>window.onload=()=>window.print()<\/script>
      </body></html>`);

    janela.document.close();
  }

  const lista = useMemo(() => {
    let base = (
      filtro === "todas" ? ordens : ordens.filter((o) => (o as any).status === filtro)
    ) as any[];

    if (filtrosAvancados.dataInicio) {
      base = base.filter((o) => new Date(o.created_at) >= new Date(filtrosAvancados.dataInicio));
    }
    if (filtrosAvancados.dataFim) {
      const dataFim = new Date(filtrosAvancados.dataFim);
      dataFim.setHours(23, 59, 59, 999);
      base = base.filter((o) => new Date(o.created_at) <= dataFim);
    }
    if (filtrosAvancados.responsavel) {
      base = base.filter((o) =>
        o.responsavel?.toLowerCase().includes(filtrosAvancados.responsavel.toLowerCase()),
      );
    }
    if (filtrosAvancados.busca) {
      const b = filtrosAvancados.busca.toLowerCase();
      base = base.filter(
        (o) =>
          o.aparelho?.toLowerCase().includes(b) ||
          o.clientes?.nome?.toLowerCase().includes(b) ||
          o.numero?.toString().includes(b),
      );
    }

    return base;
  }, [ordens, filtro, filtrosAvancados]);

  const getVencimentoGarantia = (dataFinal: string | null) => {
    if (!dataFinal) return "—";
    const date = new Date(dataFinal);
    // Use mid-day to avoid TZ shifts and ensure calculation is from "Data Final"
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + 90);
    return date.toLocaleDateString("pt-BR");
  };

  return (
    <div>
      <PageHeader
        title="Ordens de serviço"
        subtitle="Do orçamento à entrega, com impressão profissional"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
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
                  <select
                    value={form.cliente_id}
                    onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="">Sem cliente vinculado</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <Campo
                  label="Aparelho"
                  value={form.aparelho}
                  onChange={(v) => setForm({ ...form, aparelho: v })}
                />
                <Campo
                  label="Marca"
                  value={form.marca}
                  onChange={(v) => setForm({ ...form, marca: v })}
                />
                <Campo
                  label="Modelo"
                  value={form.modelo}
                  onChange={(v) => setForm({ ...form, modelo: v })}
                />
                <Campo
                  label="Cor"
                  value={form.cor}
                  onChange={(v) => setForm({ ...form, cor: v })}
                />
                <Campo
                  label="IMEI / Serial"
                  value={form.imei}
                  onChange={(v) => setForm({ ...form, imei: v })}
                />
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

                <div className="space-y-3 sm:col-span-2 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-bold flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" /> Peças e Serviços
                    </Label>
                    <div className="flex gap-2">
                      <select
                        className="h-8 rounded-md border border-input bg-card px-2 text-xs"
                        onChange={(e) => {
                          const p = pecas.find((x) => x.id === e.target.value);
                          if (!p) return;
                          if (p.quantidade <= 0) {
                            toast.error("Produto sem estoque");
                            return;
                          }
                          const itens = [
                            ...form.itens,
                            {
                              tipo: "produto",
                              produto_id: p.id,
                              descricao: p.nome,
                              quantidade: 1,
                              preco_unitario: Number(p.preco_venda),
                            },
                          ];
                          const novoTotal = itens.reduce(
                            (s, i) => s + i.quantidade * i.preco_unitario,
                            0,
                          );
                          setForm({ ...form, itens, valor: String(novoTotal) });
                        }}
                        value=""
                      >
                        <option value="">+ Adicionar Peça</option>
                        {pecas.map((p) => (
                          <option key={p.id} value={p.id} disabled={p.quantidade <= 0}>
                            {p.nome} ({p.quantidade} un) - {brl(p.preco_venda)}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          const desc = prompt("Descrição do serviço:");
                          if (!desc) return;
                          const preco = prompt("Preço (R$):", "0");
                          if (!preco) return;
                          const itens = [
                            ...form.itens,
                            {
                              tipo: "servico",
                              produto_id: null,
                              descricao: desc,
                              quantidade: 1,
                              preco_unitario: Number(preco),
                            },
                          ];
                          const novoTotal = itens.reduce(
                            (s, i) => s + i.quantidade * i.preco_unitario,
                            0,
                          );
                          setForm({ ...form, itens, valor: String(novoTotal) });
                        }}
                      >
                        + Mão de obra
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {form.itens.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-lg border border-border p-2 bg-muted/30 text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {brl(item.preco_unitario)} cada
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="p-1 rounded hover:bg-muted"
                            onClick={() => {
                              const itens = form.itens.map((it, i) =>
                                i === idx
                                  ? { ...it, quantidade: Math.max(1, it.quantidade - 1) }
                                  : it,
                              );
                              const novoTotal = itens.reduce(
                                (s, i) => s + i.quantidade * i.preco_unitario,
                                0,
                              );
                              setForm({ ...form, itens, valor: String(novoTotal) });
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="font-bold w-4 text-center">{item.quantidade}</span>
                          <button
                            className="p-1 rounded hover:bg-muted"
                            onClick={() => {
                              const p = (produtos as any[]).find((x) => x.id === item.produto_id);
                              if (p && item.quantidade >= p.quantidade) {
                                toast.error("Estoque insuficiente");
                                return;
                              }
                              const itens = form.itens.map((it, i) =>
                                i === idx ? { ...it, quantidade: it.quantidade + 1 } : it,
                              );
                              const novoTotal = itens.reduce(
                                (s, i) => s + i.quantidade * i.preco_unitario,
                                0,
                              );
                              setForm({ ...form, itens, valor: String(novoTotal) });
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            const itens = form.itens.filter((_, i) => i !== idx);
                            const novoTotal = itens.reduce(
                              (s, i) => s + i.quantidade * i.preco_unitario,
                              0,
                            );
                            setForm({ ...form, itens, valor: String(novoTotal) });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {!form.itens.length && (
                      <p className="text-center text-xs text-muted-foreground py-2 border border-dashed border-border rounded-lg">
                        Nenhuma peça ou serviço adicionado.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Valor Total (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  />
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
              <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                Criar OS
              </Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[{ value: "todas", label: "Todas" }, ...STATUS_OS].map((s) => (
          <button
            key={s.value}
            onClick={() => setFiltro(s.value)}
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
          className={`ml-auto gap-2 rounded-full ${showFilters ? "bg-primary/10 border-primary text-primary" : ""}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
          Filtros
        </Button>
      </div>

      {showFilters && (
        <div className="mb-6 grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-4 animate-in fade-in slide-in-from-top-2">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Busca Geral</Label>
            <Input
              placeholder="Aparelho, Cliente, nº"
              className="h-9 text-xs"
              value={filtrosAvancados.busca}
              onChange={(e) => setFiltrosAvancados((prev) => ({ ...prev, busca: e.target.value }))}
            />
          </div>
        </div>
      )}

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
            {lista.map((os: any) => (
              <tr key={os.id} className="hover:bg-muted/10 transition-colors">
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-muted-foreground">
                      #{os.numero}
                    </span>
                    <span className="font-bold text-base">
                      {os.clientes?.nome ?? "Sem cliente"}
                    </span>
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
                <td className="p-4 text-muted-foreground">{getVencimentoGarantia(os.previsao)}</td>
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
                      mudarStatus.mutate({ id: os.id, status: e.target.value, origem: os.status })
                    }
                    className={`h-8 w-full rounded-lg border px-2 text-xs font-medium transition ${
                      os.status === "faturado"
                        ? "bg-violet-500/10 text-violet-600 border-violet-500/20"
                        : os.status === "entregue" || os.status === "pronto"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-primary/10 text-primary border-primary/20"
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
                    <OsFotos osId={os.id} numero={os.numero} />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => abrirEdicao(os)}
                      title="Editar OS"
                    >
                      <Edit className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const url = `${window.location.origin}/consulta/${os.id}`;
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
                      onClick={() =>
                        toast.info("Funcionalidade de Nota Fiscal em desenvolvimento.")
                      }
                      title="Emitir Nota Fiscal"
                    >
                      <FileCheck className="h-4 w-4 text-primary" />
                    </Button>
                    <AcoesOsMenu
                      os={os}
                      onImprimir={imprimir}
                      onWhatsApp={enviarWhatsAppOs}
                      onEstornar={(o) => setConfirmEstornar({ id: o.id, numero: o.numero })}
                      navigate={navigate}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmExcluirOs({ id: os.id, numero: os.numero })}
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
        {lista.map((os: any) => (
          <div key={os.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-muted-foreground">#{os.numero}</span>
                <h3 className="font-bold">{os.clientes?.nome ?? "Sem cliente"}</h3>
                <p className="text-xs text-muted-foreground">
                  {os.responsavel || "Técnico não atribuído"}
                </p>
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
              <span>Garantia: {getVencimentoGarantia(os.previsao)}</span>
            </div>

            <select
              value={os.status}
              onChange={(e) =>
                mudarStatus.mutate({ id: os.id, status: e.target.value, origem: os.status })
              }
              className={`mt-3 h-9 w-full rounded-lg border px-2 text-xs font-medium transition ${
                os.status === "faturado"
                  ? "bg-violet-500/10 text-violet-600 border-violet-500/20"
                  : os.status === "entregue" || os.status === "pronto"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-primary/10 text-primary border-primary/20"
              }`}
            >
              {STATUS_OS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
              <OsFotos osId={os.id} numero={os.numero} />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => abrirEdicao(os)}
                title="Editar OS"
              >
                <Edit className="h-4 w-4 text-primary" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const url = `${window.location.origin}/consulta/${os.id}`;
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
                onClick={() => toast.info("Funcionalidade de Nota Fiscal em desenvolvimento.")}
                title="Emitir Nota Fiscal"
              >
                <FileCheck className="h-4 w-4 text-primary" />
              </Button>
              <AcoesOsMenu
                os={os}
                onImprimir={imprimir}
                onWhatsApp={enviarWhatsAppOs}
                onEstornar={(o) => setConfirmEstornar({ id: o.id, numero: o.numero })}
                navigate={navigate}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmExcluirOs({ id: os.id, numero: os.numero })}
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
            <Button variant="outline" size="sm" onClick={() => setTabEdicao("pagamentos")}>
              <DollarSign className="mr-2 h-4 w-4" /> Pagamento Parcial
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFaturarOpen(true)}>
              <Receipt className="mr-2 h-4 w-4" /> Faturar
            </Button>
            <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              OS {ordens.find((o) => o.id === selectedOsId)?.numero ?? "—"}
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
              <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            </TabsList>

            {/* DETALHES */}
            <TabsContent value="detalhes" className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Cliente</Label>
                  <select
                    value={form.cliente_id}
                    onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="">Sem cliente vinculado</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <Campo
                  label="Aparelho"
                  value={form.aparelho}
                  onChange={(v) => setForm({ ...form, aparelho: v })}
                />
                <Campo
                  label="Marca"
                  value={form.marca}
                  onChange={(v) => setForm({ ...form, marca: v })}
                />
                <Campo
                  label="Modelo"
                  value={form.modelo}
                  onChange={(v) => setForm({ ...form, modelo: v })}
                />
                <Campo
                  label="Cor"
                  value={form.cor}
                  onChange={(v) => setForm({ ...form, cor: v })}
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
                  numero={ordens.find((o) => o.id === selectedOsId)?.numero as any}
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

      <FaturarOsModal osId={selectedOsId} open={faturarOpen} onOpenChange={setFaturarOpen} />

      <WhatsAppSendModal os={whatsappOs} open={whatsappOpen} onOpenChange={setWhatsappOpen} />

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

function AcoesOsMenu({
  os,
  onImprimir,
  onWhatsApp,
  onEstornar,
  navigate,
}: {
  os: any;
  onImprimir: (os: any, modo: "os" | "orcamento" | "nao_fiscal") => void;
  onWhatsApp: (os: any) => void;
  onEstornar: (os: any) => void;
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
        <DropdownMenuItem onClick={() => toast.info("Assinatura digital — em desenvolvimento.")}>
          Assinatura digital
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onWhatsApp(os)}>Enviar por WhatsApp</DropdownMenuItem>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
