import { cn } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { enviarLogoEmpresa } from "@/lib/logo-empresa";
import { termosOsPadrao } from "@/lib/termos-padrao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HorarioSemanaEditor } from "@/components/HorarioSemanaEditor";
import { horarioInvalido } from "@/lib/horario-loja";
import { HORARIO_COMERCIAL, lerHorario, resumoHorario, type Horario } from "@/lib/whatsapp/robo";
import type { TablesInsert } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/AppShell";
import { statusWhatsapp } from "@/lib/whatsapp/whatsapp.functions";
import { AUTOMACOES } from "@/lib/whatsapp/automacoes";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield,
  Key,
  Eye,
  EyeOff,
  Building2,
  Wallet,
  Package,
  Wrench,
  ShoppingCart,
  CreditCard,
  Mail,
  MessageSquare,
  FileCheck,
  Layout,
  Users2,
  Lock,
  Upload,
  Loader2,
  Image as ImageIcon,
  Plus,
  Trash2,
  Banknote,
  Calendar,
  Settings,
  ArrowRight,
  QrCode,
  FileText,
  Printer,
  Smartphone,
  Check,
  ChevronDown,
  ChevronUp,
  Globe,
  Monitor,
  HelpCircle,
  ExternalLink,
  Copy,
  Tag,
  FileStack,
  HardDrive,
  Bot,
} from "lucide-react";
import { Explicacao } from "@/components/Explicacao";
import { OsTemplatesLibrary } from "@/components/os-templates/OsTemplatesLibrary";
import { BackupGoogleDriveCard } from "@/components/backup/BackupGoogleDriveCard";
import { PreferenciasAssistente } from "@/components/assistente/PreferenciasAssistente";
import { RoboWhatsappCard } from "@/components/whatsapp/RoboWhatsappCard";
import { useCurrentUser, useEmpresaId, useProfile } from "@/hooks/useCurrentUser";
import { brl, dataBR, STATUS_OS, STATUS_VENDAS, STATUS_COMPRAS } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useRef } from "react";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações — SpaceTech" }],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  // ?aba=backup abre direto numa aba (ex.: volta do Google Drive).
  const [aba, setAba] = useState("empresa");
  const [abaWhatsapp, setAbaWhatsapp] = useState<"conexao" | "robo" | "mensagens">("conexao");
  useEffect(() => {
    const inicial = new URLSearchParams(window.location.search).get("aba");
    if (inicial) setAba(inicial);
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showToken, setShowToken] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // States for forms
  const [mpForm, setMpForm] = useState({ access_token: "", public_key: "", webhook_secret: "" });
  const [empresaForm, setEmpresaForm] = useState({
    loja: "",
    nome: "",
    whatsapp: "",
    endereco: "",
    cidade: "",
    cnpj_cpf: "",
    logo_url: "",
  });
  // null = horário de funcionamento não informado (não sai nos comprovantes).
  const [horarioLoja, setHorarioLoja] = useState<Horario | null>(null);

  // Load Mercado Pago config
  const { data: mpConfig } = useQuery({
    queryKey: ["pagamento_config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamento_config").select("*").maybeSingle();
      if (error) throw error;
      if (data)
        setMpForm({
          access_token: data.mercado_pago_access_token || "",
          public_key: data.mercado_pago_public_key || "",
          webhook_secret: data.mercado_pago_webhook_secret || "",
        });
      return data;
    },
    enabled: !!user,
  });

  // Sync Empresa Form with profile
  useEffect(() => {
    if (profile) {
      setEmpresaForm({
        loja: profile.loja || "",
        nome: profile.nome || "",
        whatsapp: profile.whatsapp || "",
        endereco: profile.endereco || "",
        cidade: profile.cidade || "",
        cnpj_cpf: profile.cnpj_cpf || "",
        logo_url: profile.logo_url || "",
      });
      setHorarioLoja(
        profile.horario_funcionamento ? lerHorario(profile.horario_funcionamento) : null,
      );
    }
  }, [profile]);

  const salvarMp = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("pagamento_config").upsert(
        {
          user_id: empresaId!,
          mercado_pago_access_token: mpForm.access_token,
          mercado_pago_public_key: mpForm.public_key,
          mercado_pago_webhook_secret: mpForm.webhook_secret || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações do Mercado Pago atualizadas!");
      qc.invalidateQueries({ queryKey: ["pagamento_config"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar MP: " + e.message),
  });

  const salvarEmpresa = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (horarioLoja && horarioInvalido(horarioLoja))
        throw new Error(
          "confira o horário de funcionamento: o fechamento precisa ser depois da abertura",
        );
      const { error } = await supabase
        .from("profiles")
        .update({
          horario_funcionamento: horarioLoja,
          loja: empresaForm.loja,
          nome: empresaForm.nome,
          whatsapp: empresaForm.whatsapp,
          endereco: empresaForm.endereco,
          cidade: empresaForm.cidade,
          cnpj_cpf: empresaForm.cnpj_cpf,
          logo_url: empresaForm.logo_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados da empresa atualizados!");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar empresa: " + e.message),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      const publicUrl = await enviarLogoEmpresa(file, user.id);
      setEmpresaForm((prev) => ({ ...prev, logo_url: publicUrl }));
      toast.success("Logotipo enviado com sucesso!");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (error) {
      toast.error("Erro ao enviar logotipo: " + (error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const { data: categories = [], refetch: refetchCats } = useQuery({
    queryKey: ["finance-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_categories").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: accounts = [], refetch: refetchAccounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: methods = [], refetch: refetchMethods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: osConfig, refetch: refetchOsConfig } = useQuery({
    queryKey: ["os-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("os_config").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: checklists = [], refetch: refetchChecklists } = useQuery({
    queryKey: ["os-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("os_checklists").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: saleConfig, refetch: refetchSaleConfig } = useQuery({
    queryKey: ["sale-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sale_config").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: purchaseConfig, refetch: refetchPurchaseConfig } = useQuery({
    queryKey: ["purchase-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_config").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: estoqueConfig, refetch: refetchEstoqueConfig } = useQuery({
    queryKey: ["estoque-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estoque_config").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const salvarEstoqueConfig = useMutation({
    mutationFn: async (estoque_minimo_padrao: number) => {
      if (!user) return;
      const { error } = await supabase
        .from("estoque_config")
        .upsert(
          { user_id: empresaId!, estoque_minimo_padrao, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estoque mínimo padrão atualizado!");
      refetchEstoqueConfig();
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  const { data: categoriasProduto = [], refetch: refetchCategoriasProduto } = useQuery({
    queryKey: ["produto-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produto_categorias").select("*").order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [novaCategoria, setNovaCategoria] = useState("");

  const adicionarCategoria = useMutation({
    mutationFn: async (nome: string) => {
      if (!user) return;
      if (!nome.trim()) throw new Error("Informe o nome da categoria.");
      const { error } = await supabase
        .from("produto_categorias")
        .insert({ user_id: empresaId!, nome: nome.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovaCategoria("");
      refetchCategoriasProduto();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerCategoria = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produto_categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetchCategoriasProduto(),
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: smtpConfig, refetch: refetchSmtp } = useQuery({
    queryKey: ["smtp-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("smtp_config").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const salvarSmtp = useMutation({
    mutationFn: async (formData: Omit<TablesInsert<"smtp_config">, "user_id">) => {
      if (!user) return;
      const { error } = await supabase.from("smtp_config").upsert(
        {
          user_id: empresaId!,
          ...formData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações de e-mail atualizadas!");
      refetchSmtp();
    },
    onError: (e: Error) => toast.error("Erro ao salvar SMTP: " + e.message),
  });

  const { data: whatsappConfig, refetch: refetchWhatsapp } = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_config").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Estado real da instância da Evolution API (a mesma que a tela WhatsApp usa).
  // A conexão/QR Code fica só naquela tela; aqui é apenas leitura + atalho.
  const whatsappConexaoQuery = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => statusWhatsapp(),
    retry: false,
    enabled: !!user,
  });
  const whatsappNaoConfigurado =
    whatsappConexaoQuery.error instanceof Error &&
    /não foi configurada/i.test(whatsappConexaoQuery.error.message);
  const whatsappStatus = whatsappConexaoQuery.data?.status ?? "desconectado";

  const { data: catalogoConfig, refetch: refetchCatalogo } = useQuery({
    queryKey: ["catalogo-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalogo_config").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // As listas de opções (mensagens do WhatsApp, catálogo) leem a coluna pelo nome.
  const camposWhatsapp = whatsappConfig as Record<string, unknown> | null | undefined;
  const camposCatalogo = catalogoConfig as Record<string, unknown> | null | undefined;

  const salvarCatalogo = useMutation({
    mutationFn: async (formData: Partial<TablesInsert<"catalogo_config">>) => {
      if (!user) return;
      const { error } = await supabase.from("catalogo_config").upsert(
        {
          user_id: empresaId!,
          ...formData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações do catálogo atualizadas!");
      refetchCatalogo();
    },
    onError: (e: Error) => toast.error("Erro ao salvar catálogo: " + e.message),
  });

  const tabs = [
    { id: "empresa", label: "Minha Empresa", icon: Building2 },
    { id: "financeiro", label: "Financeiro", icon: Wallet },
    { id: "estoque", label: "Estoque", icon: Package },
    { id: "os", label: "OS", icon: Wrench },
    { id: "modelos", label: "Modelos de OS", icon: FileStack },
    { id: "vendas", label: "Vendas", icon: ShoppingCart },
    { id: "compras", label: "Compras", icon: ShoppingCart },
    { id: "mp", label: "Mercado Pago", icon: CreditCard },
    { id: "email", label: "E-mail", icon: Mail },
    { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
    { id: "catalogo", label: "Catálogo", icon: Layout },
    { id: "backup", label: "Backup", icon: HardDrive },
    { id: "assistente", label: "Assistente", icon: Bot },
    { id: "funcionarios", label: "Acesso de Funcionários", icon: Users2 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie as preferências e integrações do seu sistema"
      />

      <Tabs value={aba} onValueChange={setAba} className="space-y-6">
        <div className="w-full overflow-x-auto pb-2">
          <TabsList className="flex h-auto w-max bg-transparent p-0 gap-2">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary"
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Minha Empresa */}
        <TabsContent value="empresa" className="space-y-6 outline-none">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-bold mb-6">Dados da Empresa</h2>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome da Loja</Label>
                    <Input
                      value={empresaForm.loja}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, loja: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Responsável</Label>
                    <Input
                      value={empresaForm.nome}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, nome: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={empresaForm.whatsapp}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, whatsapp: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ / CPF</Label>
                    <Input
                      value={empresaForm.cnpj_cpf}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj_cpf: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Endereço Completo</Label>
                  <Input
                    value={empresaForm.endereco}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, endereco: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Horário de funcionamento</Label>
                    <Switch
                      checked={!!horarioLoja}
                      onCheckedChange={(v) => setHorarioLoja(v ? HORARIO_COMERCIAL : null)}
                      aria-label="Informar horário de funcionamento"
                    />
                  </div>
                  {horarioLoja ? (
                    <>
                      <HorarioSemanaEditor value={horarioLoja} onChange={setHorarioLoja} />
                      <p className="text-xs text-muted-foreground">
                        Sai nos comprovantes, na OS e nos PDFs:{" "}
                        <strong>{resumoHorario(horarioLoja) || "fechado todos os dias"}</strong>. O
                        robô do WhatsApp pode usar o mesmo horário (Configurações → WhatsApp).
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ligue para informar os dias e horários em que a loja abre.
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  <Label>Logotipo da Empresa</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/30">
                      {empresaForm.logo_url ? (
                        <img
                          src={empresaForm.logo_url}
                          alt="Preview Logo"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleLogoUpload}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {empresaForm.logo_url ? "Alterar Logo" : "Upload Logo"}
                        </Button>
                        {empresaForm.logo_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setEmpresaForm({ ...empresaForm, logo_url: "" })}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Recomendado: 512x512px (PNG ou JPG)
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>URL do Logotipo (opcional)</Label>
                  <Input
                    placeholder="https://..."
                    value={empresaForm.logo_url}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, logo_url: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full mt-4"
                  onClick={() => salvarEmpresa.mutate()}
                  disabled={salvarEmpresa.isPending}
                >
                  {salvarEmpresa.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-bold mb-4">Informações do Sistema</h2>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Status do Sistema
                  </p>
                  <p className="text-xl font-bold text-success flex items-center gap-2">
                    <Shield className="h-5 w-5" /> Online e Seguro
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Último Login
                  </p>
                  <p className="text-lg font-semibold">
                    {dataBR(user?.last_sign_in_at || new Date().toISOString())}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </TabsContent>

        {/* Mercado Pago */}
        <TabsContent value="mp" className="space-y-6 outline-none">
          <section className="max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Mercado Pago</h2>
                <p className="text-sm text-muted-foreground">
                  Integração oficial para receber via Pix.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Public Key</Label>
                <Input
                  placeholder="APP_USR-..."
                  value={mpForm.public_key}
                  onChange={(e) => setMpForm({ ...mpForm, public_key: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Access Token</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="APP_USR-..."
                    value={mpForm.access_token}
                    onChange={(e) => setMpForm({ ...mpForm, access_token: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Webhook Secret (opcional)</Label>
                <Input
                  placeholder="Chave secreta das Notificações"
                  value={mpForm.webhook_secret}
                  onChange={(e) => setMpForm({ ...mpForm, webhook_secret: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Usada para confirmar que as notificações de pagamento realmente vêm do Mercado
                  Pago. Encontre em Suas integrações → sua aplicação → Notificações → Assinatura
                  secreta.
                </p>
              </div>

              <div className="rounded-xl bg-muted p-4 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <Key className="h-3 w-3" /> Onde encontro isso?
                </p>
                Acesse o painel do Mercado Pago Developers, vá em suas aplicações e procure por
                "Credenciais de Produção".
              </div>

              <Button
                className="w-full"
                onClick={() => salvarMp.mutate()}
                disabled={salvarMp.isPending}
              >
                {salvarMp.isPending ? "Salvando..." : "Salvar Credenciais"}
              </Button>
            </div>
          </section>
        </TabsContent>

        {/* Financeiro */}
        <TabsContent value="financeiro" className="space-y-6 outline-none">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Contas Bancárias */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-primary" />
                  Contas Bancárias
                </h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" /> Nova Conta
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Conta Bancária</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const { error } = await supabase.from("bank_accounts").insert({
                          user_id: empresaId!,
                          banco: formData.get("banco") as string,
                          agencia: formData.get("agencia") as string,
                          conta: formData.get("conta") as string,
                          tipo: formData.get("tipo") as string,
                          saldo_inicial: Number(formData.get("saldo")),
                        });
                        if (error) toast.error(error.message);
                        else {
                          toast.success("Conta criada!");
                          refetchAccounts();
                        }
                      }}
                      className="grid gap-4 py-4"
                    >
                      <div className="space-y-2">
                        <Label>Banco</Label>
                        <Input name="banco" placeholder="Ex: Nubank, Itaú..." required />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Agência</Label>
                          <Input name="agencia" placeholder="0001" />
                        </div>
                        <div className="space-y-2">
                          <Label>Conta</Label>
                          <Input name="conta" placeholder="12345-6" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Saldo Inicial (R$)</Label>
                        <Input name="saldo" type="number" step="0.01" defaultValue="0" />
                      </div>
                      <Button type="submit">Salvar Conta</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-3">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-background"
                  >
                    <div>
                      <p className="font-semibold">{acc.banco}</p>
                      <p className="text-xs text-muted-foreground">
                        {acc.agencia} / {acc.conta}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        const { error } = await supabase
                          .from("bank_accounts")
                          .delete()
                          .eq("id", acc.id);
                        if (error) toast.error(error.message);
                        else refetchAccounts();
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {!accounts.length && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Nenhuma conta cadastrada.
                  </p>
                )}
              </div>
            </section>

            {/* Faturamento e Criação */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Ciclo de Faturamento
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Dia de Faturamento</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={profile?.billing_day || 5}
                      onChange={async (e) => {
                        const val = parseInt(e.target.value);
                        if (isNaN(val)) return;
                        const { error } = await supabase
                          .from("profiles")
                          .update({ billing_day: val })
                          .eq("id", user!.id);
                        if (!error) qc.invalidateQueries({ queryKey: ["profile"] });
                      }}
                    />
                    <div className="flex items-center text-xs text-muted-foreground px-2 bg-muted rounded-lg shrink-0">
                      Dia do mês
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Define o dia base para geração automática de relatórios mensais.
                  </p>
                </div>
                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium">Data de Criação da Conta</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    {dataBR(profile?.created_at || "")}
                  </p>
                </div>
              </div>
            </section>

            {/* Categorias Financeiras */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Categorias</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" /> Nova Categoria
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Categoria</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const { error } = await supabase.from("finance_categories").insert({
                          user_id: empresaId!,
                          nome: formData.get("nome") as string,
                          tipo: formData.get("tipo") as string,
                        });
                        if (error) toast.error(error.message);
                        else {
                          toast.success("Categoria criada!");
                          refetchCats();
                        }
                      }}
                      className="grid gap-4 py-4"
                    >
                      <div className="space-y-2">
                        <Label>Nome da Categoria</Label>
                        <Input name="nome" placeholder="Ex: Aluguel, Vendas..." required />
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <select
                          name="tipo"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="entrada">Entrada</option>
                          <option value="saida">Saída</option>
                        </select>
                      </div>
                      <Button type="submit">Adicionar Categoria</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2 px-3 rounded-lg bg-background border border-border"
                  >
                    <span className="text-sm">{cat.nome}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${cat.tipo === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                      >
                        {cat.tipo}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          await supabase.from("finance_categories").delete().eq("id", cat.id);
                          refetchCats();
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Formas de Pagamento */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Formas de Pagamento</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" /> Nova Forma
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Forma de Pagamento</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const { error } = await supabase.from("payment_methods").insert({
                          user_id: empresaId!,
                          nome: formData.get("nome") as string,
                          taxa: Number(formData.get("taxa")),
                        });
                        if (error) toast.error(error.message);
                        else {
                          toast.success("Forma adicionada!");
                          refetchMethods();
                        }
                      }}
                      className="grid gap-4 py-4"
                    >
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input name="nome" placeholder="Ex: Cartão de Crédito..." required />
                      </div>
                      <div className="space-y-2">
                        <Label>Taxa (%)</Label>
                        <Input name="taxa" type="number" step="0.01" defaultValue="0" />
                      </div>
                      <Button type="submit">Adicionar Forma</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-2">
                {methods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-2 px-3 rounded-lg bg-background border border-border"
                  >
                    <span className="text-sm font-medium">{method.nome}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Taxa: {method.taxa}%</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          await supabase.from("payment_methods").delete().eq("id", method.id);
                          refetchMethods();
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </TabsContent>

        {/* OS */}
        <TabsContent value="os" className="space-y-6 outline-none">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                Termos e Condições da OS
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Texto de Condições (Impressão)</Label>
                  <Textarea
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Digite os termos que aparecerão no final da OS..."
                    defaultValue={osConfig?.termos_condicoes || ""}
                    onBlur={async (e) => {
                      const val = e.target.value;
                      const { error } = await supabase.from("os_config").upsert(
                        {
                          user_id: empresaId!,
                          termos_condicoes: val,
                          updated_at: new Date().toISOString(),
                        },
                        { onConflict: "user_id" },
                      );
                      if (error) toast.error("Erro ao salvar termos: " + error.message);
                      else toast.success("Termos atualizados!");
                    }}
                  />
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <p>{osConfig?.termos_condicoes?.length || 0}/2000 caracteres</p>
                    <button
                      className="text-primary hover:underline"
                      onClick={async () => {
                        const defaultText = termosOsPadrao(osConfig?.dias_garantia_padrao || 90);
                        const { error } = await supabase.from("os_config").upsert(
                          {
                            user_id: empresaId!,
                            termos_condicoes: defaultText,
                            updated_at: new Date().toISOString(),
                          },
                          { onConflict: "user_id" },
                        );
                        if (!error) {
                          toast.success("Texto padrão restaurado!");
                          refetchOsConfig();
                        } else {
                          toast.error("Erro ao restaurar texto: " + error.message);
                        }
                      }}
                    >
                      Restaurar texto padrão
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    Deixe em branco para não imprimir nenhum texto de condições neste documento.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold">Modelos de Checklists</h2>
                  <p className="text-sm text-muted-foreground">
                    Checklists para preenchimento técnico na OS.
                  </p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" /> Novo Modelo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Novo Modelo de Checklist</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const { error } = await supabase.from("os_checklists").insert({
                          user_id: empresaId!,
                          nome: formData.get("nome") as string,
                          itens: [],
                        });
                        if (error) toast.error(error.message);
                        else {
                          toast.success("Modelo criado!");
                          refetchChecklists();
                        }
                      }}
                      className="grid gap-4 py-4"
                    >
                      <div className="space-y-2">
                        <Label>Nome do Modelo</Label>
                        <Input
                          name="nome"
                          placeholder="Ex: Triagem Entrada, Troca de Tela..."
                          required
                        />
                      </div>
                      <Button type="submit">Criar Modelo</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-3">
                {checklists.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-background"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <FileCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{check.nome}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          {Array.isArray(check.itens) ? check.itens.length : 0} Itens
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          const { error } = await supabase
                            .from("os_checklists")
                            .delete()
                            .eq("id", check.id);
                          if (!error) refetchChecklists();
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!checklists.length && (
                  <p className="text-center text-sm text-muted-foreground py-8 border-2 border-dashed border-border rounded-xl">
                    Nenhum modelo de checklist cadastrado.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" />
                Impressão e Visual
              </h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Exibir fotos na impressão</Label>
                    <p className="text-xs text-muted-foreground">
                      Inclui fotos de entrada e saída no PDF.
                    </p>
                  </div>
                  <Switch
                    checked={osConfig?.exibir_fotos_impressao || false}
                    onCheckedChange={async (val) => {
                      await supabase
                        .from("os_config")
                        .upsert(
                          { user_id: empresaId!, exibir_fotos_impressao: val },
                          { onConflict: "user_id" },
                        );
                      refetchOsConfig();
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Imprimir em 2 vias</Label>
                    <p className="text-xs text-muted-foreground">
                      Gera via do cliente e via da empresa.
                    </p>
                  </div>
                  <Switch
                    checked={osConfig?.imprimir_duas_vias || false}
                    onCheckedChange={async (val) => {
                      await supabase
                        .from("os_config")
                        .upsert(
                          { user_id: empresaId!, imprimir_duas_vias: val },
                          { onConflict: "user_id" },
                        );
                      refetchOsConfig();
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>QR Code Área do Cliente</Label>
                    <p className="text-xs text-muted-foreground">
                      Link direto para consulta online.
                    </p>
                  </div>
                  <Switch
                    checked={osConfig?.imprimir_qrcode_cliente || false}
                    onCheckedChange={async (val) => {
                      await supabase
                        .from("os_config")
                        .upsert(
                          { user_id: empresaId!, imprimir_qrcode_cliente: val },
                          { onConflict: "user_id" },
                        );
                      refetchOsConfig();
                    }}
                  />
                </div>
                <div className="space-y-2 pt-4 border-t border-border">
                  <Label>Garantia Padrão (Dias)</Label>
                  <Input
                    type="number"
                    value={osConfig?.dias_garantia_padrao || 90}
                    onChange={async (e) => {
                      await supabase.from("os_config").upsert(
                        {
                          user_id: empresaId!,
                          dias_garantia_padrao: Number(e.target.value),
                        },
                        { onConflict: "user_id" },
                      );
                      refetchOsConfig();
                    }}
                  />
                </div>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="modelos" className="space-y-6 outline-none">
          <OsTemplatesLibrary />
        </TabsContent>

        <TabsContent value="vendas" className="space-y-6 outline-none">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Venda no balcão
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Tipo de caixa</Label>
                  <select
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={saleConfig?.tipo_caixa || "venda_rapida"}
                    onChange={async (e) => {
                      await supabase
                        .from("sale_config")
                        .upsert(
                          { user_id: empresaId!, tipo_caixa: e.target.value },
                          { onConflict: "user_id" },
                        );
                      refetchSaleConfig();
                    }}
                  >
                    <option value="venda_rapida">Venda rápida (Sem abrir/fechar caixa)</option>
                    <option value="controle_caixa">
                      Controle de caixa (Turnos, sangria, conferência)
                    </option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status Padrão Venda</Label>
                    <select
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={saleConfig?.status_padrao_venda || "aberto"}
                      onChange={async (e) => {
                        await supabase
                          .from("sale_config")
                          .upsert(
                            { user_id: empresaId!, status_padrao_venda: e.target.value },
                            { onConflict: "user_id" },
                          );
                        refetchSaleConfig();
                      }}
                    >
                      {STATUS_VENDAS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status Padrão OS</Label>
                    <select
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={saleConfig?.status_padrao_os || "recebido"}
                      onChange={async (e) => {
                        await supabase
                          .from("sale_config")
                          .upsert(
                            { user_id: empresaId!, status_padrao_os: e.target.value },
                            { onConflict: "user_id" },
                          );
                        refetchSaleConfig();
                      }}
                    >
                      {STATUS_OS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label>Permitir desconto na finalização</Label>
                    <Switch
                      checked={saleConfig?.permitir_desconto ?? true}
                      onCheckedChange={async (val) => {
                        await supabase
                          .from("sale_config")
                          .upsert(
                            { user_id: empresaId!, permitir_desconto: val },
                            { onConflict: "user_id" },
                          );
                        refetchSaleConfig();
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Editar preço unitário no carrinho</Label>
                    <Switch
                      checked={saleConfig?.editar_preco_carrinho ?? true}
                      onCheckedChange={async (val) => {
                        await supabase
                          .from("sale_config")
                          .upsert(
                            { user_id: empresaId!, editar_preco_carrinho: val },
                            { onConflict: "user_id" },
                          );
                        refetchSaleConfig();
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
                  <div className="space-y-2">
                    <Label>Teto de desconto (%)</Label>
                    <Input
                      type="number"
                      value={saleConfig?.teto_desconto_percentual || 100}
                      onChange={async (e) => {
                        await supabase.from("sale_config").upsert(
                          {
                            user_id: empresaId!,
                            teto_desconto_percentual: Number(e.target.value),
                          },
                          { onConflict: "user_id" },
                        );
                        refetchSaleConfig();
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Garantia Padrão (Dias)</Label>
                    <Input
                      type="number"
                      value={saleConfig?.dias_garantia_padrao || 90}
                      onChange={async (e) => {
                        await supabase.from("sale_config").upsert(
                          {
                            user_id: empresaId!,
                            dias_garantia_padrao: Number(e.target.value),
                          },
                          { onConflict: "user_id" },
                        );
                        refetchSaleConfig();
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Texto da Proposta Comercial
              </h2>
              <div className="space-y-4">
                <Textarea
                  className="min-h-[250px] font-mono text-sm"
                  placeholder="Termos e condições da proposta..."
                  value={saleConfig?.texto_proposta || ""}
                  onChange={async (e) => {
                    await supabase
                      .from("sale_config")
                      .upsert(
                        { user_id: empresaId!, texto_proposta: e.target.value },
                        { onConflict: "user_id" },
                      );
                    refetchSaleConfig();
                  }}
                />
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <p>{saleConfig?.texto_proposta?.length || 0}/2000 caracteres</p>
                  <div className="flex gap-4">
                    <button
                      className="text-primary hover:underline"
                      onClick={async () => {
                        await supabase.from("sale_config").upsert(
                          {
                            user_id: empresaId!,
                            texto_proposta: osConfig?.termos_condicoes || "",
                          },
                          { onConflict: "user_id" },
                        );
                        refetchSaleConfig();
                        toast.success("Copiado da aba O.S.!");
                      }}
                    >
                      Copiar da aba O.S.
                    </button>
                    <button
                      className="text-primary hover:underline"
                      onClick={async () => {
                        const def = `Formas de pagamento: Pix, dinheiro, cartão de débito ou crédito.\nParcelamento: em até 3x no cartão.\nPrazo de entrega: até 5 dias úteis após a confirmação do pedido.\nValidade desta proposta: 7 dias.\nGarantia: 90 dias contra defeito de fabricação.\n\nEsta proposta é uma previsão de valores, não uma cobrança. Os valores valem para os produtos e as quantidades descritos e podem mudar se o pedido for alterado ou se algum item estiver indisponível no estoque.`;
                        await supabase
                          .from("sale_config")
                          .upsert(
                            { user_id: empresaId!, texto_proposta: def },
                            { onConflict: "user_id" },
                          );
                        refetchSaleConfig();
                        toast.success("Texto padrão restaurado!");
                      }}
                    >
                      Restaurar padrão
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-primary" />
                  Numeração das vendas
                </h2>
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Próximo número de Venda</Label>
                    <Input
                      className="h-8 w-24"
                      type="number"
                      value={saleConfig?.proximo_numero_venda || 1}
                      onChange={async (e) => {
                        await supabase.from("sale_config").upsert(
                          {
                            user_id: empresaId!,
                            proximo_numero_venda: Number(e.target.value),
                          },
                          { onConflict: "user_id" },
                        );
                        refetchSaleConfig();
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="compras" className="space-y-6 outline-none">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Configurações de Compra
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Situação ao faturar pela listagem</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Ao escolher esta situação, o sistema abrirá o faturamento antes de aplicar a
                    situação.
                  </p>
                  <select
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={purchaseConfig?.situacao_faturar || ""}
                    onChange={async (e) => {
                      await supabase.from("purchase_config").upsert(
                        {
                          user_id: empresaId!,
                          situacao_faturar: e.target.value === "" ? null : e.target.value,
                        },
                        { onConflict: "user_id" },
                      );
                      refetchPurchaseConfig();
                    }}
                  >
                    <option value="">Nenhuma</option>
                    {STATUS_COMPRAS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="estoque" className="space-y-6 outline-none">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Estoque mínimo padrão</h2>
                  <p className="text-sm text-muted-foreground">
                    Usado ao cadastrar um novo produto em Produtos — pode ser ajustado por produto
                    depois.
                  </p>
                </div>
              </div>
              <form
                className="flex items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  salvarEstoqueConfig.mutate(Number(fd.get("estoque_minimo_padrao")) || 0);
                }}
              >
                <div className="space-y-2">
                  <Label>Quantidade mínima</Label>
                  <Input
                    name="estoque_minimo_padrao"
                    type="number"
                    min={0}
                    className="w-40"
                    defaultValue={estoqueConfig?.estoque_minimo_padrao ?? 1}
                    key={estoqueConfig?.estoque_minimo_padrao ?? "novo"}
                  />
                </div>
                <Button type="submit" disabled={salvarEstoqueConfig.isPending}>
                  {salvarEstoqueConfig.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </form>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Categorias de produtos</h2>
                  <p className="text-sm text-muted-foreground">
                    Sugeridas automaticamente ao digitar a categoria em Produtos.
                  </p>
                </div>
              </div>

              <form
                className="mb-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  adicionarCategoria.mutate(novaCategoria);
                }}
              >
                <Input
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  placeholder="Nova categoria (ex: Telas, Baterias)"
                />
                <Button
                  type="submit"
                  disabled={adicionarCategoria.isPending}
                  className="gap-2 shrink-0"
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </form>

              {categoriasProduto.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada ainda.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categoriasProduto.map((c) => (
                    <span
                      key={c.id}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pl-3 pr-1.5 text-sm"
                    >
                      {c.nome}
                      <button
                        type="button"
                        onClick={() => removerCategoria.mutate(c.id)}
                        aria-label={`Remover categoria ${c.nome}`}
                        className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="email" className="space-y-6 outline-none">
          <section className="max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">E-mail</h2>
                <p className="text-sm text-muted-foreground">
                  Configure o SMTP da sua empresa e envie avisos, orçamentos e laudos com o seu
                  próprio endereço de e-mail.
                </p>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    salvarSmtp.mutate({
                      host: fd.get("host") as string,
                      port: Number(fd.get("port")),
                      user: fd.get("user") as string,
                      password: fd.get("password") as string,
                      from_email: fd.get("from_email") as string,
                      from_name: fd.get("from_name") as string,
                      encryption: fd.get("encryption") as string,
                    });
                  }}
                  className="space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Servidor SMTP (Host)</Label>
                      <Input
                        name="host"
                        placeholder="smtp.exemplo.com"
                        defaultValue={smtpConfig?.host || ""}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Porta</Label>
                      <Input
                        name="port"
                        type="number"
                        placeholder="587"
                        defaultValue={smtpConfig?.port || 587}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Usuário</Label>
                      <Input
                        name="user"
                        placeholder="email@exemplo.com"
                        defaultValue={smtpConfig?.user || ""}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha</Label>
                      <Input
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        defaultValue={smtpConfig?.password || ""}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>E-mail de Remetente</Label>
                      <Input
                        name="from_email"
                        placeholder="contato@empresa.com"
                        defaultValue={smtpConfig?.from_email || ""}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do Remetente</Label>
                      <Input
                        name="from_name"
                        placeholder="Minha Loja"
                        defaultValue={smtpConfig?.from_name || ""}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Criptografia</Label>
                    <select
                      name="encryption"
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      defaultValue={smtpConfig?.encryption || "tls"}
                    >
                      <option value="tls">TLS (Recomendado)</option>
                      <option value="ssl">SSL</option>
                      <option value="none">Nenhuma</option>
                    </select>
                  </div>

                  <Button type="submit" className="w-full" disabled={salvarSmtp.isPending}>
                    {salvarSmtp.isPending ? "Salvando..." : "Salvar Configurações"}
                  </Button>
                </form>
              </div>

              <div className="space-y-6">
                <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                  <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Por que configurar o e-mail da empresa?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Quando você cadastra seu próprio SMTP, todos os e-mails do sistema — avisos de
                    OS pronta, orçamentos, laudos e notificações — chegam ao cliente com o nome e o
                    endereço de e-mail da sua empresa, transmitindo mais profissionalismo e
                    aumentando a taxa de entrega. Sem configuração, o sistema usa o servidor padrão.
                  </p>
                </div>

                <div className="rounded-xl bg-muted p-4 text-[10px] text-muted-foreground uppercase font-bold tracking-wider space-y-2">
                  <p>Dicas de configuração:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Gmail: Use "Senhas de App"</li>
                    <li>Outlook: porta 587 (STARTTLS)</li>
                    <li>Locaweb/Hostgator: Consulte o suporte</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-6 outline-none">
          <section className="max-w-6xl rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-500">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">WhatsApp</h2>
                <p className="text-sm text-muted-foreground">
                  Conexão do número, robô de atendimento e mensagens automáticas.
                </p>
              </div>
            </div>

            <div className="mb-6 flex w-full gap-2 overflow-x-auto pb-1">
              {(
                [
                  ["conexao", "Conexão", QrCode],
                  ["robo", "Robô de atendimento", Bot],
                  ["mensagens", "Mensagens automáticas", MessageSquare],
                ] as const
              ).map(([id, rotulo, Icone]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAbaWhatsapp(id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                    abaWhatsapp === id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card hover:bg-secondary/50"
                  }`}
                >
                  <Icone className="h-4 w-4" />
                  {rotulo}
                </button>
              ))}
            </div>

            {abaWhatsapp === "conexao" && (
              <div className="max-w-3xl space-y-4">
                <Explicacao>
                  O número de WhatsApp da loja ligado ao sistema. Por ele saem os avisos de OS,
                  cobranças, pesquisas e as respostas do robô. Para trocar de número, ler o QR Code
                  ou desconectar, use <strong>Gerenciar conexão</strong>.
                </Explicacao>
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Conexão da instância
                  </h3>
                  <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/30">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">
                          Status
                        </Label>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${
                              whatsappStatus === "conectado"
                                ? "bg-success animate-pulse"
                                : whatsappStatus === "conectando"
                                  ? "bg-amber-500 animate-pulse"
                                  : "bg-destructive"
                            }`}
                          />
                          <span className="font-bold">
                            {whatsappNaoConfigurado
                              ? "Não configurado no servidor"
                              : whatsappStatus === "conectado"
                                ? "Conectado"
                                : whatsappStatus === "conectando"
                                  ? "Conectando…"
                                  : whatsappStatus === "erro"
                                    ? "Erro na conexão"
                                    : "Desconectado"}
                          </span>
                        </div>
                        {whatsappConexaoQuery.data?.status === "conectado" &&
                          whatsappConexaoQuery.data?.phone_number && (
                            <p className="text-xs text-muted-foreground">
                              Número: <strong>{whatsappConexaoQuery.data.phone_number}</strong>
                            </p>
                          )}
                      </div>
                      <Button asChild size="sm" className="bg-green-600 hover:bg-green-700 gap-2">
                        <Link to="/whatsapp-conexao">
                          <QrCode className="h-4 w-4" />
                          {whatsappStatus === "conectado"
                            ? "Gerenciar conexão"
                            : "Conectar via QR Code"}
                        </Link>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A conexão do número da empresa (leitura do QR Code, troca de número e
                      desconexão) é feita na tela <strong>WhatsApp</strong> do menu lateral. Os
                      ajustes de mensagens automáticas abaixo continuam sendo salvos aqui.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {abaWhatsapp === "robo" && (
              <div className="max-w-3xl space-y-4">
                <Explicacao>
                  O robô responde sozinho quem escreve para a loja, com um menu: status da OS,
                  orçamento, garantia e falar com um atendente. Aqui você liga/desliga, define o
                  horário e muda as mensagens e opções quando quiser. Ele fica quieto quando alguém
                  da equipe responde.
                </Explicacao>
                <RoboWhatsappCard />
              </div>
            )}

            {abaWhatsapp === "mensagens" && (
              <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-7 space-y-8">
                  <Explicacao>
                    Mensagens que o sistema manda sozinho (OS pronta, pesquisa, aniversário,
                    cobrança Pix...) ou deixa prontas no botão de WhatsApp da OS. Ligue as que
                    quiser, abra para editar o texto e veja ao lado como o cliente recebe.
                  </Explicacao>
                  {/* Mensagens e automações */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        Mensagens e automações
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Expanda um bloco para editar o texto; ele é salvo ao sair do campo.{" "}
                      <strong>Automático</strong> é enviado sozinho quando ligado.{" "}
                      <strong>Envio manual</strong> aparece como mensagem pronta no botão de
                      WhatsApp da OS. <strong>Em breve</strong> ainda não é enviado pelo sistema.
                    </p>

                    <div className="space-y-2">
                      {[
                        {
                          id: "notif_os_pronta",
                          label: "Avisar o cliente quando a OS ficar Pronta",
                          key: "notif_os_pronta",
                          uso: "auto",
                        },
                        {
                          id: "notif_pesquisa_auto",
                          label: "Pesquisa de satisfação no dia seguinte à entrega",
                          key: "notif_pesquisa_auto",
                          textoKey: "pesquisa_pos_os_texto",
                          uso: "auto",
                        },
                        {
                          id: "ia_pesquisa_personalizada",
                          label: "IA: escrever a pesquisa pós-OS para cada cliente",
                          key: "ia_pesquisa_personalizada",
                          uso: "auto",
                        },
                        {
                          id: "ia_agradecer_pesquisa",
                          label: "IA: agradecer quem responde a pesquisa",
                          key: "ia_agradecer_pesquisa",
                          uso: "auto",
                        },
                        {
                          id: "notif_pesquisa_venda_auto",
                          label: "Pesquisa pós-venda no dia seguinte à compra",
                          key: "notif_pesquisa_venda_auto",
                          textoKey: "pesquisa_pos_venda_texto",
                          uso: "auto",
                        },
                        {
                          id: "notif_boas_vindas_auto",
                          label: "Boas-vindas ao cliente novo",
                          key: "notif_boas_vindas_auto",
                          textoKey: "boas_vindas_texto",
                          uso: "auto",
                        },
                        {
                          id: "notif_relatorio_auto",
                          label: "Resumo semanal da loja para o dono",
                          key: "notif_relatorio_auto",
                          uso: "auto",
                        },
                        {
                          id: "notif_aniversario_auto",
                          label: "Feliz aniversário para o cliente",
                          key: "notif_aniversario_auto",
                          textoKey: "feliz_aniversario_texto",
                          uso: "auto",
                        },
                        {
                          id: "notif_cobranca_lembrete_auto",
                          label: "Lembrete de cobrança Pix perto do vencimento",
                          key: "notif_cobranca_lembrete_auto",
                          textoKey: "cobranca_lembrete_texto",
                          uso: "auto",
                        },
                        {
                          id: "notif_cobranca_paga_auto",
                          label: "Confirmação de pagamento recebido",
                          key: "notif_cobranca_paga_auto",
                          textoKey: "cobranca_paga_texto",
                          uso: "auto",
                        },
                        {
                          id: "notif_cobranca_atraso_auto",
                          label: "Aviso de cobrança atrasada",
                          key: "notif_cobranca_atraso_auto",
                          textoKey: "cobranca_atraso_texto",
                          uso: "auto",
                        },
                        {
                          id: "notif_os_criada",
                          label: "OS criada",
                          key: "notif_os_criada",
                          uso: "manual",
                        },
                        {
                          id: "notif_os_editada",
                          label: "OS atualizada",
                          key: "notif_os_editada",
                          uso: "manual",
                        },
                        {
                          id: "pesquisa_pos_os",
                          label: "Pesquisa de satisfação pós-OS",
                          key: "pesquisa_pos_os",
                          uso: "manual",
                        },
                        {
                          id: "lembrete_tecnico",
                          label: "Equipe: Lembrete de visita/entrega ao técnico",
                          key: "lembrete_tecnico",
                          uso: "breve",
                        },
                      ].map((item) => (
                        <details
                          key={item.id}
                          className="group rounded-xl border border-border bg-card overflow-hidden"
                        >
                          <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors list-none">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              {item.label}
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                                  item.uso === "auto"
                                    ? "bg-green-500/15 text-green-600"
                                    : item.uso === "manual"
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground",
                                )}
                              >
                                {item.uso === "auto"
                                  ? "Automático"
                                  : item.uso === "manual"
                                    ? "Envio manual"
                                    : "Em breve"}
                              </span>
                            </span>
                            <div
                              className="flex items-center gap-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.uso === "auto" && (
                                <Switch
                                  checked={
                                    (camposWhatsapp?.[item.key] as boolean | null | undefined) ??
                                    false
                                  }
                                  onCheckedChange={async (val) => {
                                    await supabase.from("whatsapp_config").upsert(
                                      {
                                        user_id: empresaId!,
                                        [item.key]: val,
                                      } as TablesInsert<"whatsapp_config">,
                                      { onConflict: "user_id" },
                                    );
                                    refetchWhatsapp();
                                  }}
                                />
                              )}
                              <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform" />
                            </div>
                          </summary>
                          <div className="p-4 pt-0 border-t border-border bg-muted/10 space-y-4">
                            {(() => {
                              const auto = AUTOMACOES.find((a) => a.config === item.key);
                              if (!auto) return null;
                              const lista =
                                (camposWhatsapp?.["aprovacao_automacoes"] as
                                  string[] | undefined) ?? [];
                              const exige = lista.includes(auto.chave);
                              return (
                                <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-background/50 p-3">
                                  <Switch
                                    checked={exige}
                                    onCheckedChange={async (val) => {
                                      const nova = val
                                        ? [...new Set([...lista, auto.chave])]
                                        : lista.filter((x) => x !== auto.chave);
                                      await supabase
                                        .from("whatsapp_config")
                                        .upsert(
                                          { user_id: empresaId!, aprovacao_automacoes: nova },
                                          { onConflict: "user_id" },
                                        );
                                      refetchWhatsapp();
                                    }}
                                  />
                                  <span className="space-y-0.5">
                                    <span className="block text-sm font-medium">
                                      Exigir aprovação antes de enviar
                                    </span>
                                    <span className="block text-[11px] text-muted-foreground">
                                      A mensagem fica em WhatsApp → Fila e automações → Aguardando
                                      aprovação até alguém da equipe aprovar, editar ou rejeitar.
                                    </span>
                                  </span>
                                </label>
                              );
                            })()}
                            <div className="space-y-2">
                              {item.key === "ia_pesquisa_personalizada" ? (
                                <p className="text-[11px] text-muted-foreground">
                                  Com a pesquisa pós-OS automática ligada, a IA (Gemini, com o
                                  ChatGPT de reserva se configurado) escreve cada mensagem com o
                                  primeiro nome do cliente, o aparelho e o serviço feito, usando o
                                  texto da pesquisa como referência de tom. Se a IA não responder,
                                  vai o texto fixo de sempre.
                                </p>
                              ) : item.key === "ia_agradecer_pesquisa" ? (
                                <p className="text-[11px] text-muted-foreground">
                                  Quando o cliente responde à pesquisa (pós-OS ou pós-venda,
                                  automática ou enviada à mão), a IA lê a resposta.{" "}
                                  <strong>Elogio ou resposta neutra:</strong> ela agradece sozinha,
                                  uma vez por pesquisa. <strong>Reclamação:</strong> nada é enviado
                                  — aparece um aviso no sininho para você responder pessoalmente. A
                                  avaliação fica registrada no histórico da OS. Se você já tiver
                                  mandado outra mensagem ao cliente depois da pesquisa, a IA não
                                  entra na conversa.
                                </p>
                              ) : item.key === "notif_relatorio_auto" ? (
                                <>
                                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    WhatsApp que recebe o resumo
                                  </Label>
                                  <Input
                                    inputMode="tel"
                                    placeholder="DDD + número (vazio = WhatsApp do cadastro da empresa)"
                                    defaultValue={whatsappConfig?.relatorio_numero || ""}
                                    onBlur={async (e) => {
                                      await supabase.from("whatsapp_config").upsert(
                                        {
                                          user_id: empresaId!,
                                          relatorio_numero: e.target.value.trim() || null,
                                        },
                                        { onConflict: "user_id" },
                                      );
                                      refetchWhatsapp();
                                    }}
                                  />
                                  <p className="text-[11px] text-muted-foreground">
                                    Toda segunda-feira, a partir das 9h (com o sistema aberto em
                                    algum computador), chega o resumo da semana anterior: OS abertas
                                    e entregues, faturamento, vendas, entradas e saídas pagas,
                                    contas a receber vencidas, clientes novos e estoque baixo. O
                                    ideal é o celular pessoal do dono.
                                  </p>
                                </>
                              ) : (
                                <>
                                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Texto da Mensagem
                                  </Label>
                                  <Textarea
                                    className="min-h-[100px] text-sm"
                                    defaultValue={
                                      (camposWhatsapp?.[item.textoKey ?? `${item.key}_texto`] as
                                        string | null) || ""
                                    }
                                    onBlur={async (e) => {
                                      await supabase.from("whatsapp_config").upsert(
                                        {
                                          user_id: empresaId!,
                                          [item.textoKey ?? `${item.key}_texto`]: e.target.value,
                                        } as TablesInsert<"whatsapp_config">,
                                        { onConflict: "user_id" },
                                      );
                                      refetchWhatsapp();
                                    }}
                                  />
                                  <p className="text-[10px] text-muted-foreground">
                                    {item.key.startsWith("notif_cobranca_") ? (
                                      <>
                                        Variáveis disponíveis: {"{{cliente}}"}, {"{{valor}}"},{" "}
                                        {item.key === "notif_cobranca_lembrete_auto" && (
                                          <>{"{{vencimento}}"}, </>
                                        )}
                                        {item.key === "notif_cobranca_atraso_auto" && (
                                          <>
                                            {"{{vencimento}}"}, {"{{dias}}"},{" "}
                                          </>
                                        )}
                                        {"{{loja}}"}.
                                      </>
                                    ) : (
                                      <>
                                        Variáveis disponíveis: {"{{cliente}}"}, {"{{numero}}"},{" "}
                                        {"{{status}}"}, {"{{tecnico}}"}
                                        {item.key === "notif_os_pronta" && (
                                          <>
                                            , {"{{aparelho}}"}, {"{{link}}"}
                                          </>
                                        )}
                                        {item.key === "notif_pesquisa_auto" && (
                                          <>, {"{{aparelho}}"}</>
                                        )}
                                        {item.uso === "auto" && <>, {"{{loja}}"}</>}.
                                      </>
                                    )}
                                  </p>
                                </>
                              )}
                              {item.key === "notif_os_pronta" && (
                                <p className="text-[11px] text-muted-foreground">
                                  Enviado sozinho, uma vez por OS, quando o status muda para Pronto
                                  — pela lista ou pela edição da OS. Precisa do WhatsApp conectado e
                                  do telefone do cliente cadastrado.
                                </p>
                              )}
                              {item.key === "notif_pesquisa_venda_auto" && (
                                <p className="text-[11px] text-muted-foreground">
                                  Vai uma vez por venda finalizada com cliente e telefone, entre 20
                                  horas e 7 dias depois da compra, das 9h às 20h, com o sistema
                                  aberto em algum computador. Só vale para vendas feitas depois de
                                  ligar a opção.
                                </p>
                              )}
                              {item.key === "notif_boas_vindas_auto" && (
                                <p className="text-[11px] text-muted-foreground">
                                  Vai uma vez para cada cliente cadastrado com telefone depois de
                                  ligar a opção — em Clientes, na OS ou no PDV —, das 9h às 20h, com
                                  o sistema aberto em algum computador. Quem foi cadastrado à noite
                                  recebe no dia seguinte.
                                </p>
                              )}
                              {item.key === "notif_aniversario_auto" && (
                                <p className="text-[11px] text-muted-foreground">
                                  Vai no dia do aniversário, das 9h às 20h, com o sistema aberto em
                                  algum computador — uma vez por ano. Só para clientes com data de
                                  nascimento e telefone no cadastro (Clientes → editar).
                                </p>
                              )}
                              {item.key === "notif_cobranca_lembrete_auto" && (
                                <p className="text-[11px] text-muted-foreground">
                                  Para cobranças Pix (Cobranças) com cliente e telefone, ainda
                                  pendentes, que vencem nas próximas 24 horas: vai o texto e, em
                                  seguida, o Pix copia e cola. Uma vez por cobrança, das 9h às 20h,
                                  pela fila. Se a cobrança for paga ou cancelada antes de a mensagem
                                  sair, ela não é enviada. Só vale para cobranças criadas depois de
                                  ligar. Parcelas do Crediário têm avisos próprios.
                                </p>
                              )}
                              {item.key === "notif_cobranca_atraso_auto" && (
                                <p className="text-[11px] text-muted-foreground">
                                  Para cobranças (Cobranças) com cliente e telefone que passaram do
                                  vencimento sem pagamento: o cliente recebe um aviso com 1, 7 e 15
                                  dias de atraso — o texto e, em seguida, um Pix copia e cola novo,
                                  válido por 3 dias. Das 9h às 20h, pela fila. Se a cobrança for
                                  paga ou cancelada antes de a mensagem sair, ela não é enviada. Só
                                  vale para cobranças que vencerem depois de ligar. Parcelas do
                                  Crediário têm avisos próprios.
                                </p>
                              )}
                              {item.key === "notif_cobranca_paga_auto" && (
                                <p className="text-[11px] text-muted-foreground">
                                  Quando o Mercado Pago confirma o pagamento de uma cobrança Pix, o
                                  cliente recebe a confirmação (uma vez, pela fila). O envio confere
                                  de novo no sistema que a cobrança está paga — nunca vai por
                                  suposição.
                                </p>
                              )}
                              {item.key === "notif_pesquisa_auto" && (
                                <p className="text-[11px] text-muted-foreground">
                                  Usa o mesmo texto da pesquisa manual pós-OS. Vai uma vez por OS
                                  entregue, entre 20 horas e 7 dias depois da entrega, das 9h às
                                  20h, com o sistema aberto em algum computador. Só vale para
                                  entregas feitas depois de ligar a opção, e não repete se a
                                  pesquisa já foi enviada à mão.
                                </p>
                              )}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => toast.success("Configurações salvas com sucesso!")}
                  >
                    Salvar configurações WhatsApp
                  </Button>
                </div>

                {/* Preview */}
                <div className="lg:col-span-5">
                  <div className="sticky top-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                      Prévia no WhatsApp
                    </h3>
                    <div className="relative mx-auto w-full max-w-[320px] aspect-[9/18.5] bg-[#0b141a] rounded-[3rem] border-[8px] border-[#202c33] shadow-2xl overflow-hidden">
                      {/* Top Bar */}
                      <div className="h-14 bg-[#202c33] flex items-center px-4 gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted/20 flex items-center justify-center">
                          <Users2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-white">Cliente</p>
                          <p className="text-[10px] text-green-500">online</p>
                        </div>
                      </div>

                      {/* Chat area */}
                      <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat h-[calc(100%-100px)]">
                        <div className="flex justify-end">
                          <div className="max-w-[85%] bg-[#005c4b] text-white p-2.5 rounded-lg rounded-tr-none shadow-sm relative group">
                            <p className="text-xs leading-relaxed">
                              {whatsappConfig?.notif_os_criada_texto ||
                                "Abra um bloco ao lado para ver a mensagem aqui."}
                            </p>
                            <div className="flex justify-end mt-1 gap-1">
                              <span className="text-[9px] opacity-70">00:22</span>
                              <Check className="h-2.5 w-2.5 text-blue-400" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom bar */}
                      <div className="h-12 bg-[#202c33] absolute bottom-0 w-full flex items-center px-4 gap-3">
                        <div className="flex-1 h-8 bg-[#2a3942] rounded-full px-4 flex items-center">
                          <span className="text-[10px] text-muted-foreground">Mensagem</span>
                        </div>
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="catalogo" className="space-y-6 outline-none">
          <section className="max-w-6xl rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                <Layout className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Seu E-commerce B2C</h2>
                <p className="text-sm text-muted-foreground">
                  Personalize o visual e as informações da sua loja virtual. Compartilhe os links de
                  acesso com seus clientes para que comprem diretamente pelo catálogo.
                </p>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7 space-y-8">
                {/* Status da Loja */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Status da Loja
                  </h3>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
                    <div className="space-y-1">
                      <Label className="font-bold">Loja Ativa e Pública</Label>
                      <p className="text-xs text-muted-foreground">
                        Desmarque para ocultar temporariamente o catálogo.
                      </p>
                    </div>
                    <Switch
                      checked={catalogoConfig?.loja_ativa ?? true}
                      onCheckedChange={(val) => salvarCatalogo.mutate({ loja_ativa: val })}
                    />
                  </div>
                </div>

                {/* Endereço da loja */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Endereço da loja
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Subdomínio SpaceTech (ERP + loja) e, opcionalmente, domínio com sua marca.
                  </p>

                  <div className="grid gap-4">
                    {/* Loja Padrão */}
                    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          Loja padrão (SpaceTech)
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `https://${catalogoConfig?.subdominio || "spacetech"}.spacetech.app/catalogo`,
                              );
                              toast.success("Link copiado!");
                            }}
                          >
                            <Copy className="h-3 w-3" /> Copiar
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1">
                            <ExternalLink className="h-3 w-3" /> Abrir
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-primary underline">
                        https://{catalogoConfig?.subdominio || "spacetech"}.spacetech.app/catalogo
                      </p>
                    </div>

                    {/* Domínio Próprio */}
                    <div className="p-4 rounded-xl border border-border bg-card space-y-3 opacity-60">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          Domínio próprio
                        </span>
                        <Button variant="link" size="sm" className="h-7 text-[10px] p-0">
                          Tutorial DNS/SSL
                        </Button>
                      </div>
                      <p className="text-sm font-medium italic">
                        Não configurado. Siga o tutorial.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                      <h4 className="text-xs font-bold uppercase">Subdomínio SpaceTech</h4>
                      <div className="space-y-2">
                        <Label className="text-[10px]">Subdomínio *</Label>
                        <div className="flex gap-2">
                          <Input
                            className="h-8 text-xs"
                            defaultValue={catalogoConfig?.subdominio || "spacetech"}
                            onBlur={(e) => salvarCatalogo.mutate({ subdominio: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-1 text-[10px] text-muted-foreground">
                        <p>
                          ERP: https://{catalogoConfig?.subdominio || "spacetech"}.spacetech.app/
                        </p>
                        <p>
                          Loja: https://{catalogoConfig?.subdominio || "spacetech"}
                          .spacetech.app/catalogo
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 p-4 rounded-xl bg-card border border-border relative overflow-hidden group">
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-orange-500 text-[8px] font-bold text-white uppercase">
                        Add-on premium
                      </div>
                      <h4 className="text-xs font-bold uppercase">Domínio personalizado</h4>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Use o endereço da sua marca na loja online — exemplo:
                        https://seudominio.com.br
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Por apenas</p>
                          <p className="text-sm font-bold text-primary">R$ 49,90/mês</p>
                        </div>
                        <Button size="sm" className="h-8 text-[10px]">
                          Contratar add-on
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Estoque do ERP */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Estoque do ERP no catálogo
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    O catálogo usa o mesmo saldo da tabela de produtos do sistema.
                  </p>

                  <div className="space-y-2">
                    {[
                      {
                        key: "ignorar_estoque",
                        label: "Ignorar estoque do sistema",
                        desc: "Ativo por padrão. Desative para vincular vitrine ao saldo real.",
                      },
                      {
                        key: "exibir_apenas_com_estoque",
                        label: "Exibir apenas produtos com estoque",
                        desc: "Clientes só veem produtos com saldo maior que zero.",
                      },
                      {
                        key: "permitir_vender_sem_estoque",
                        label: "Permitir vender sem estoque",
                        desc: "Permite pedido acima do saldo (inclusive estoque negativo).",
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-3 rounded-xl border border-border bg-background"
                      >
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium flex items-center gap-1.5">
                            {item.label}
                            <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                          </Label>
                          <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                        </div>
                        <Switch
                          checked={
                            (camposCatalogo?.[item.key] as boolean | null | undefined) ?? false
                          }
                          onCheckedChange={(val) => salvarCatalogo.mutate({ [item.key]: val })}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* WhatsApp Flutuante */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    WhatsApp Flutuante
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Ativar Ícone</Label>
                      <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-input bg-background">
                        <Switch
                          checked={catalogoConfig?.whatsapp_flutuante_ativo ?? true}
                          onCheckedChange={(val) =>
                            salvarCatalogo.mutate({ whatsapp_flutuante_ativo: val })
                          }
                        />
                        <span className="text-sm">Sim, mostrar no canto inferior</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp Atendimento</Label>
                      <Input
                        placeholder="(00) 00000-0000"
                        defaultValue={catalogoConfig?.whatsapp_atendimento || ""}
                        onBlur={(e) =>
                          salvarCatalogo.mutate({ whatsapp_atendimento: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem Inicial</Label>
                    <Input
                      placeholder="Olá, gostaria de mais informações..."
                      defaultValue={catalogoConfig?.whatsapp_mensagem_inicial || ""}
                      onBlur={(e) =>
                        salvarCatalogo.mutate({ whatsapp_mensagem_inicial: e.target.value })
                      }
                    />
                  </div>
                </div>

                <Button className="w-full" onClick={() => toast.success("Configurações salvas!")}>
                  Salvar Configurações
                </Button>
              </div>

              {/* Preview */}
              <div className="lg:col-span-5">
                <div className="sticky top-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    Preview da Loja
                  </h3>
                  <div className="rounded-3xl border border-border bg-muted/30 aspect-[9/16] overflow-hidden flex flex-col shadow-2xl">
                    <div className="h-10 bg-card border-b border-border flex items-center px-4 justify-between">
                      <div className="flex gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-red-400" />
                        <div className="h-2 w-2 rounded-full bg-yellow-400" />
                        <div className="h-2 w-2 rounded-full bg-green-400" />
                      </div>
                      <div className="h-6 w-32 bg-muted rounded-full" />
                      <div className="w-6" />
                    </div>
                    <div className="flex-1 flex items-center justify-center p-8 text-center bg-card">
                      <div className="space-y-4">
                        <div className="mx-auto h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary flex">
                          <Monitor className="h-8 w-8" />
                        </div>
                        <h4 className="font-bold">Carregando preview...</h4>
                        <p className="text-xs text-muted-foreground">
                          O preview da sua loja aparecerá aqui em tempo real.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* Backup */}
        <TabsContent value="backup" className="space-y-6 outline-none">
          <div className="max-w-3xl">
            <BackupGoogleDriveCard escopo="empresa" />
          </div>
        </TabsContent>

        {/* Assistente (preferência de cada login, não da empresa) */}
        <TabsContent value="assistente" className="space-y-6 outline-none">
          <section className="max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-lg font-bold">Assistente do sistema</h2>
            <p className="mb-6 mt-1 text-sm text-muted-foreground">
              Fica no botão da SPACE TECH IA e pergunta se você quer resolver o que está parado.
              Cada funcionário liga ou desliga o seu, aqui ou em Ajustes, dentro do próprio painel.
            </p>
            <PreferenciasAssistente />
          </section>
        </TabsContent>

        {/* Acesso de Funcionários */}
        <TabsContent value="funcionarios" className="space-y-6 outline-none">
          <section className="max-w-2xl mx-auto space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Equipe e permissões</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Convide sua equipe, defina o papel de cada pessoa (Gerente, Técnico, Atendente,
                Financeiro) e ajuste o que cada papel pode ver e gerenciar em cada módulo — tudo
                isso agora vive em Usuários e Permissões.
              </p>
            </div>
            <Button asChild>
              <Link to="/usuarios">Abrir Usuários e Permissões</Link>
            </Button>
          </section>
        </TabsContent>

        {/* Placeholders for remaining tabs */}
        {tabs
          .filter(
            (t) =>
              ![
                "empresa",
                "mp",
                "financeiro",
                "estoque",
                "os",
                "vendas",
                "compras",
                "email",
                "whatsapp",
                "catalogo",
                "backup",
                "funcionarios",
              ].includes(t.id),
          )
          .map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="outline-none">
              <section className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <tab.icon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold">{tab.label}</h3>
                <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
                  Configurações específicas do módulo de {tab.label} estarão disponíveis em breve
                  nesta seção.
                </p>
                <Button variant="outline" className="mt-6 gap-2" disabled>
                  <Lock className="h-4 w-4" /> Em desenvolvimento
                </Button>
              </section>
            </TabsContent>
          ))}
      </Tabs>
    </div>
  );
}
