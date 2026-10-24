import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ImagePlus,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  Rocket,
  Search,
  ShieldCheck,
  Wrench,
  ClipboardList,
  FileText,
  Maximize2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buildSampleOsRenderData,
  renderOsTemplateHtml,
  type RenderOsData,
} from "@/lib/os-template-render";
import { OsTemplateThumbnail } from "@/components/os-templates/OsTemplateThumbnail";
import { GerarTermoGarantiaIA } from "@/components/GerarTermoGarantiaIA";
import type { OsTemplateDbRow } from "@/components/os-templates/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoWord } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { enviarLogoEmpresa } from "@/lib/logo-empresa";
import { termoGarantiaPadrao, termosOsPadrao } from "@/lib/termos-padrao";
import { digitsOnlyBR, isValidPhoneBR, maskPhoneBR, normalizarWhatsappBR } from "@/lib/whatsapp";
import {
  buscarCepDetalhado,
  buscarCnpj,
  formatarCep,
  formatarDocumento,
  somenteDigitos,
  validarCnpj,
  validarCpf,
} from "@/lib/documento";

// Configuração inicial: o dono de uma empresa recém-cadastrada cai aqui no
// primeiro acesso (ver o redirect em _authenticated/route.tsx) e preenche
// logo, dados, endereço, garantia e modelo do PDF antes de usar o sistema. Cada passo é
// salvo ao avançar, então um refresh no meio não perde nada; ao terminar (ou
// em "Fazer depois") grava profiles.onboarding_concluido_em e libera o resto.
export const Route = createFileRoute("/bem-vindo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Configuração inicial — SpaceTech" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/login" });

    // Funcionário de outra empresa: a configuração é do dono, não dele.
    const { data: membership } = await supabase
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", user.id);
    if (membership?.some((m) => m.empresa_id !== user.id)) throw redirect({ to: "/dashboard" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    // Quem já concluiu pode voltar aqui de propósito (os dados atuais vêm
    // preenchidos); só o redirect de _authenticated é limitado ao 1º acesso.
    if (!profile) throw redirect({ to: "/dashboard" });

    const [{ data: osConfig }, { data: saleConfig }, { data: termoGarantia }] = await Promise.all([
      supabase
        .from("os_config")
        .select("dias_garantia_padrao, termos_condicoes")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("sale_config")
        .select("dias_garantia_padrao")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("termos_garantia")
        .select("id, conteudo, ativo")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .maybeSingle(),
    ]);

    return { userId: user.id, profile, osConfig, saleConfig, termoGarantia };
  },
  component: BemVindo,
});

const PASSOS = [
  { titulo: "Sua empresa", icone: Building2 },
  { titulo: "Endereço", icone: MapPin },
  { titulo: "Garantia", icone: ShieldCheck },
  { titulo: "Modelo do PDF", icone: FileText },
  { titulo: "Tudo pronto", icone: Rocket },
] as const;

const OPCOES_GARANTIA = [30, 90, 180, 365];

function whatsappParaTela(valor: string | null | undefined): string {
  const digitos = digitsOnlyBR(valor ?? "");
  const semPais = digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  return maskPhoneBR(semPais);
}

function BemVindo() {
  const { userId, profile, osConfig, saleConfig, termoGarantia } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [passo, setPasso] = useState(0);
  const [salvando, setSalvando] = useState(false);

  const [empresa, setEmpresa] = useState({
    loja: profile.loja ?? "",
    nome: profile.nome ?? "",
    documento: formatarDocumento(profile.cnpj_cpf ?? ""),
    whatsapp: whatsappParaTela(profile.whatsapp),
  });
  const [logoUrl, setLogoUrl] = useState(profile.logo_url ?? "");
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const inputLogo = useRef<HTMLInputElement>(null);

  // Endereço: na tela fica separado (o CEP preenche rua/bairro/cidade), no
  // banco vai como profiles.endereco + profiles.cidade, como em Configurações.
  const [endereco, setEndereco] = useState({
    cep: "",
    rua: profile.endereco ?? "",
    numero: "",
    bairro: "",
    cidade: profile.cidade ?? "",
    uf: "",
  });
  const [buscandoCep, setBuscandoCep] = useState(false);

  const garantiaInicial = osConfig?.dias_garantia_padrao ?? saleConfig?.dias_garantia_padrao ?? 90;
  const [garantia, setGarantia] = useState(garantiaInicial);
  // Termo de garantia padrão (termos_garantia, is_default): sai impresso na
  // OS e no PDF enquanto estiver ativo.
  const [termoAtivo, setTermoAtivo] = useState(termoGarantia?.ativo ?? true);
  const [termo, setTermo] = useState(
    termoGarantia?.conteudo || termoGarantiaPadrao(profile.loja ?? "", garantiaInicial),
  );
  // Enquanto o texto for o padrão, ele acompanha a garantia e o nome da loja;
  // depois que a pessoa edita, não mexemos mais no que ela escreveu.
  const [termoEditado, setTermoEditado] = useState(!!termoGarantia?.conteudo);

  useEffect(() => {
    if (!termoEditado) setTermo(termoGarantiaPadrao(empresa.loja, garantia || 90));
  }, [garantia, empresa.loja, termoEditado]);

  const [modeloId, setModeloId] = useState<string | null>(null);

  async function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnviandoLogo(true);
    try {
      setLogoUrl(await enviarLogoEmpresa(file, userId));
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (erro) {
      toast.error("Não foi possível enviar a logo", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setEnviandoLogo(false);
    }
  }

  async function preencherPeloCnpj() {
    if (!validarCnpj(empresa.documento)) {
      toast.error("CNPJ inválido.");
      return;
    }
    setBuscandoCnpj(true);
    try {
      const d = await buscarCnpj(empresa.documento);
      setEmpresa((f) => ({
        ...f,
        loja: f.loja.trim() ? f.loja : d.nomeFantasia || d.razaoSocial,
        whatsapp: f.whatsapp || maskPhoneBR(somenteDigitos(d.telefone)),
      }));
      if (d.endereco && !endereco.rua.trim()) setEndereco((f) => ({ ...f, rua: d.endereco }));
      toast.success("Dados do CNPJ preenchidos", {
        description: d.situacao ? `Situação na Receita: ${d.situacao}` : undefined,
      });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível consultar o CNPJ.");
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function mudarCep(valor: string) {
    const cep = formatarCep(valor);
    setEndereco((f) => ({ ...f, cep }));
    if (somenteDigitos(cep).length !== 8) return;
    setBuscandoCep(true);
    try {
      const d = await buscarCepDetalhado(cep);
      setEndereco((f) => ({
        ...f,
        rua: d.logradouro || f.rua,
        bairro: d.bairro || f.bairro,
        cidade: d.cidade || f.cidade,
        uf: d.uf || f.uf,
      }));
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvarEmpresa(): Promise<boolean> {
    if (empresa.loja.trim().length < 2) {
      toast.error("Informe o nome da assistência.");
      return false;
    }
    const doc = somenteDigitos(empresa.documento);
    if (doc && !(doc.length === 11 ? validarCpf(doc) : doc.length === 14 && validarCnpj(doc))) {
      toast.error("CPF/CNPJ inválido — confira ou deixe em branco.");
      return false;
    }
    if (empresa.whatsapp && !isValidPhoneBR(empresa.whatsapp)) {
      toast.error("WhatsApp inválido — informe DDD + número.");
      return false;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        loja: empresa.loja.trim(),
        nome: empresa.nome.trim() || null,
        cnpj_cpf: doc ? formatarDocumento(doc) : null,
        whatsapp: empresa.whatsapp ? normalizarWhatsappBR(empresa.whatsapp) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) {
      toast.error("Erro ao salvar os dados da empresa", { description: error.message });
      return false;
    }
    return true;
  }

  async function salvarEndereco(): Promise<boolean> {
    const linha = [
      [endereco.rua.trim(), endereco.numero.trim()].filter(Boolean).join(", "),
      endereco.bairro.trim(),
      endereco.cep ? `CEP ${endereco.cep}` : "",
    ]
      .filter(Boolean)
      .join(" - ");
    const cidade = [endereco.cidade.trim(), endereco.uf.trim().toUpperCase()]
      .filter(Boolean)
      .join(" - ");
    const { error } = await supabase
      .from("profiles")
      .update({
        endereco: linha || null,
        cidade: cidade || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) {
      toast.error("Erro ao salvar o endereço", { description: error.message });
      return false;
    }
    return true;
  }

  async function salvarGarantia(): Promise<boolean> {
    const dias = Math.round(Number(garantia));
    if (!Number.isFinite(dias) || dias < 0 || dias > 3650) {
      toast.error("Informe a garantia em dias (0 a 3650).");
      return false;
    }
    if (termoAtivo && !termo.trim()) {
      toast.error("Escreva o termo de garantia ou desative-o.");
      return false;
    }
    const agora = new Date().toISOString();
    const [os, venda] = await Promise.all([
      supabase.from("os_config").upsert(
        {
          user_id: userId,
          dias_garantia_padrao: dias,
          // Condições do orçamento: só preenche o padrão se ainda estiver
          // vazio — o texto continua editável em Configurações > OS.
          ...(osConfig?.termos_condicoes ? {} : { termos_condicoes: termosOsPadrao(dias) }),
          updated_at: agora,
        },
        { onConflict: "user_id" },
      ),
      supabase
        .from("sale_config")
        .upsert(
          { user_id: userId, dias_garantia_padrao: dias, updated_at: agora },
          { onConflict: "user_id" },
        ),
    ]);
    let error = os.error ?? venda.error;

    // O termo existente é atualizado; sem termo, só cria um se for ativado.
    const { data: atual } = await supabase
      .from("termos_garantia")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    if (!error && atual) {
      ({ error } = await supabase
        .from("termos_garantia")
        .update({ conteudo: termo, ativo: termoAtivo, updated_at: agora })
        .eq("id", atual.id));
    } else if (!error && termoAtivo) {
      ({ error } = await supabase.from("termos_garantia").insert({
        user_id: userId,
        titulo: `Garantia de ${dias} dias`,
        conteudo: termo,
        is_default: true,
        ativo: true,
      }));
    }

    if (error) {
      toast.error("Erro ao salvar a garantia", { description: error.message });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["os-config"] });
    qc.invalidateQueries({ queryKey: ["termos_garantia"] });
    qc.invalidateQueries({ queryKey: ["termo-garantia-padrao"] });
    return true;
  }

  async function salvarModelo(): Promise<boolean> {
    if (!modeloId) return true;
    const { error } = await supabase.rpc("definir_template_padrao", {
      p_template_id: modeloId,
    });
    if (error) {
      toast.error("Erro ao salvar o modelo do PDF", { description: error.message });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["os-templates"] });
    return true;
  }

  async function avancar() {
    const salvar = [salvarEmpresa, salvarEndereco, salvarGarantia, salvarModelo][passo];
    setSalvando(true);
    const ok = salvar ? await salvar() : true;
    setSalvando(false);
    if (ok) setPasso((p) => Math.min(p + 1, PASSOS.length - 1));
  }

  async function concluir(destino: string) {
    setSalvando(true);
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_concluido_em: new Date().toISOString() })
      .eq("id", userId);
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível concluir", { description: error.message });
      return;
    }
    qc.invalidateQueries({ queryKey: ["profile"] });
    navigate({ to: destino });
  }

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-gradient-ink px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <LogoWord className="text-lg text-white" />
          <div className="flex items-center gap-1">
            {passo < PASSOS.length - 1 && (
              <button
                type="button"
                onClick={() => concluir("/dashboard")}
                disabled={salvando}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Fazer depois
              </button>
            )}
            <button
              type="button"
              onClick={sair}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </header>

        <ol className="mb-5 grid grid-cols-5 gap-2">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="flex flex-col gap-2">
              <div
                className={cn("h-1.5 rounded-full", i <= passo ? "bg-primary" : "bg-white/20")}
              />
              <span
                className={cn(
                  "hidden items-center gap-1.5 text-xs font-semibold sm:flex",
                  i <= passo ? "text-white" : "text-white/50",
                )}
              >
                {i < passo ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <p.icone className="h-3.5 w-3.5" />
                )}
                {p.titulo}
              </span>
            </li>
          ))}
        </ol>

        <main className="rounded-3xl bg-card p-5 shadow-panel sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Passo {passo + 1} de {PASSOS.length}
          </p>

          {passo === 0 && (
            <section className="mt-2 space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Bem-vindo ao SpaceTech!</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vamos deixar o sistema com a cara da sua assistência. Esses dados aparecem nas OS,
                  orçamentos e comprovantes impressos.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => inputLogo.current?.click()}
                  disabled={enviandoLogo}
                  className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/40 transition hover:border-primary"
                  aria-label="Enviar logo"
                >
                  {enviandoLogo ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo da empresa"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImagePlus className="h-7 w-7 text-muted-foreground" />
                  )}
                </button>
                <div className="text-sm">
                  <p className="font-semibold">Logo da assistência</p>
                  <p className="text-muted-foreground">
                    PNG ou JPG, até 5 MB. De preferência quadrada.
                  </p>
                  <button
                    type="button"
                    onClick={() => inputLogo.current?.click()}
                    disabled={enviandoLogo}
                    className="mt-1 font-semibold text-primary hover:underline"
                  >
                    {logoUrl ? "Trocar logo" : "Escolher imagem"}
                  </button>
                </div>
                <input
                  ref={inputLogo}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={escolherLogo}
                />
              </div>

              <Campo
                label="Nome da assistência *"
                value={empresa.loja}
                onChange={(v) => setEmpresa((f) => ({ ...f, loja: v }))}
                placeholder="Ex.: Space Tech Assistência"
              />
              <Campo
                label="Seu nome (responsável)"
                value={empresa.nome}
                onChange={(v) => setEmpresa((f) => ({ ...f, nome: v }))}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">CNPJ ou CPF</label>
                <div className="flex gap-2">
                  <input
                    value={empresa.documento}
                    onChange={(e) =>
                      setEmpresa((f) => ({ ...f, documento: formatarDocumento(e.target.value) }))
                    }
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    className={estiloInput}
                  />
                  {somenteDigitos(empresa.documento).length === 14 && (
                    <button
                      type="button"
                      onClick={preencherPeloCnpj}
                      disabled={buscandoCnpj}
                      className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition hover:border-primary hover:text-primary"
                    >
                      {buscandoCnpj ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">Preencher</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Com CNPJ, preenchemos nome e endereço pela Receita Federal.
                </p>
              </div>
              <Campo
                label="WhatsApp da loja"
                value={empresa.whatsapp}
                onChange={(v) => setEmpresa((f) => ({ ...f, whatsapp: maskPhoneBR(v) }))}
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
            </section>
          )}

          {passo === 1 && (
            <section className="mt-2 space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Onde fica a loja?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Digite o CEP que a gente preenche o resto. O endereço sai no cabeçalho da OS.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">CEP</label>
                  <div className="relative">
                    <input
                      value={endereco.cep}
                      onChange={(e) => mudarCep(e.target.value)}
                      inputMode="numeric"
                      placeholder="00000-000"
                      className={estiloInput}
                    />
                    {buscandoCep && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <Campo
                  label="Rua / Avenida"
                  value={endereco.rua}
                  onChange={(v) => setEndereco((f) => ({ ...f, rua: v }))}
                />
                <Campo
                  label="Número"
                  value={endereco.numero}
                  onChange={(v) => setEndereco((f) => ({ ...f, numero: v }))}
                />
              </div>
              <Campo
                label="Bairro"
                value={endereco.bairro}
                onChange={(v) => setEndereco((f) => ({ ...f, bairro: v }))}
              />
              <div className="grid gap-4 grid-cols-[1fr_5rem]">
                <Campo
                  label="Cidade"
                  value={endereco.cidade}
                  onChange={(v) => setEndereco((f) => ({ ...f, cidade: v }))}
                />
                <Campo
                  label="UF"
                  value={endereco.uf}
                  onChange={(v) => setEndereco((f) => ({ ...f, uf: v.toUpperCase().slice(0, 2) }))}
                />
              </div>
            </section>
          )}

          {passo === 2 && (
            <section className="mt-2 space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Garantia</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  A garantia padrão já vem preenchida em cada OS e venda — dá para mudar caso a
                  caso. O prazo começa a contar na entrega do aparelho.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Garantia padrão</label>
                <div className="flex flex-wrap items-center gap-2">
                  {OPCOES_GARANTIA.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setGarantia(d)}
                      className={cn(
                        "h-10 rounded-xl border px-4 text-sm font-semibold transition",
                        garantia === d
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary",
                      )}
                    >
                      {d} dias
                    </button>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={3650}
                      value={garantia}
                      onChange={(e) => setGarantia(Number(e.target.value))}
                      className="h-10 w-24 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/12"
                    />
                    <span className="text-sm text-muted-foreground">dias</span>
                  </div>
                </div>
              </div>

              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-border p-4">
                <span>
                  <span className="block text-sm font-semibold">Ativar termo de garantia</span>
                  <span className="block text-xs text-muted-foreground">
                    Imprime o termo no fim de cada OS e no PDF enviado ao cliente.
                  </span>
                </span>
                <Switch checked={termoAtivo} onCheckedChange={setTermoAtivo} />
              </label>

              {termoAtivo && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold">Termo de garantia</label>
                    {termoEditado && (
                      <button
                        type="button"
                        onClick={() => setTermoEditado(false)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Usar texto padrão
                      </button>
                    )}
                  </div>
                  <GerarTermoGarantiaIA
                    loja={empresa.loja}
                    dias={garantia}
                    onGerado={(texto) => {
                      setTermoEditado(true);
                      setTermo(texto);
                    }}
                  />
                  <textarea
                    value={termo}
                    onChange={(e) => {
                      setTermoEditado(true);
                      setTermo(e.target.value);
                    }}
                    rows={9}
                    className="w-full rounded-xl border border-input bg-card p-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/12"
                  />
                </div>
              )}
            </section>
          )}

          {passo === 3 && (
            <section className="mt-2 space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Modelo do PDF</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha como a OS sai na impressão e no PDF enviado ao cliente. A prévia já usa a
                  sua logo e os seus dados.
                </p>
              </div>
              <EscolherModeloPdf
                empresaId={userId}
                selecionado={modeloId}
                onSelecionar={setModeloId}
                empresa={{
                  nome: empresa.loja || "Sua Empresa",
                  logoUrl: logoUrl || null,
                  cnpj: empresa.documento || null,
                  endereco: profile.endereco ?? null,
                  telefone: empresa.whatsapp || null,
                  responsavel: null,
                }}
                termoGarantia={termoAtivo ? termo : null}
              />
            </section>
          )}

          {passo === 4 && (
            <section className="mt-2 space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-primary">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <Rocket className="h-8 w-8 text-primary-foreground" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight">Tudo pronto!</h1>
                  <p className="text-sm text-muted-foreground">
                    {empresa.loja} já está configurada. Tudo isso pode ser alterado depois em
                    Configurações.
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold">Por onde começar:</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Atalho
                    icone={Wrench}
                    titulo="Cadastrar serviços"
                    texto="Troca de tela, bateria, conector..."
                    onClick={() => concluir("/servicos")}
                  />
                  <Atalho
                    icone={Package}
                    titulo="Cadastrar produtos"
                    texto="Películas, capas, cabos e peças"
                    onClick={() => concluir("/estoque")}
                  />
                  <Atalho
                    icone={ClipboardList}
                    titulo="Abrir a primeira OS"
                    texto="Cliente, aparelho e defeito"
                    onClick={() => concluir("/ordens")}
                  />
                  <Atalho
                    icone={MessageSquare}
                    titulo="Conectar o WhatsApp"
                    texto="Avisar o cliente quando ficar pronto"
                    onClick={() => concluir("/whatsapp")}
                  />
                </div>
              </div>
            </section>
          )}

          <footer className="mt-8 flex items-center justify-between gap-3">
            {passo > 0 ? (
              <button
                type="button"
                onClick={() => setPasso((p) => p - 1)}
                disabled={salvando}
                className="flex h-12 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={passo === PASSOS.length - 1 ? () => concluir("/dashboard") : avancar}
              disabled={salvando || enviandoLogo}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-60"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {passo === PASSOS.length - 1 ? "Ir para o painel" : "Continuar"}
              {!salvando && <ArrowRight className="h-4 w-4" />}
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}

const estiloInput =
  "h-12 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/12";

function Campo({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={estiloInput}
      />
    </div>
  );
}

function Atalho({
  icone: Icone,
  titulo,
  texto,
  onClick,
}: {
  icone: React.ElementType;
  titulo: string;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary hover:bg-primary/5"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icone className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{texto}</span>
      </span>
    </button>
  );
}

function EscolherModeloPdf({
  empresaId,
  selecionado,
  onSelecionar,
  empresa,
  termoGarantia,
}: {
  empresaId: string;
  selecionado: string | null;
  onSelecionar: (id: string) => void;
  empresa: RenderOsData["empresa"];
  termoGarantia: string | null;
}) {
  const [ampliado, setAmpliado] = useState<OsTemplateDbRow | null>(null);

  const { data: modelos, isLoading } = useQuery({
    queryKey: ["os-templates", empresaId],
    queryFn: async () => {
      const buscar = () =>
        supabase
          .from("os_templates")
          .select("*")
          .eq("user_id", empresaId)
          .eq("ativo", true)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });
      let { data, error } = await buscar();
      if (error) throw error;
      // Empresa nova ainda não tem os modelos prontos: cria (mesma RPC da
      // biblioteca em Configurações > Modelos de OS) e busca de novo.
      if (!data?.length) {
        const seed = await supabase.rpc("garantir_templates_padrao", {
          p_user_id: empresaId,
        });
        if (seed.error) throw seed.error;
        ({ data, error } = await buscar());
        if (error) throw error;
      }
      return (data ?? []) as unknown as OsTemplateDbRow[];
    },
  });

  // Sem escolha ainda: marca o modelo que já é o padrão da empresa.
  useEffect(() => {
    if (selecionado || !modelos?.length) return;
    const padrao = modelos.find((m) => m.padrao) ?? modelos[0];
    if (padrao) onSelecionar(padrao.id);
  }, [modelos, selecionado, onSelecionar]);

  const amostra = buildSampleOsRenderData(
    empresa,
    termoGarantia ? { termoGarantiaTexto: termoGarantia } : {},
  );

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(modelos ?? []).map((m) => {
          const ativo = m.id === selecionado;
          return (
            <div
              key={m.id}
              className={cn(
                "group relative overflow-hidden rounded-2xl border-2 transition",
                ativo
                  ? "border-primary shadow-soft ring-4 ring-primary/25"
                  : "border-border hover:border-primary/50",
              )}
            >
              <button
                type="button"
                onClick={() => onSelecionar(m.id)}
                className="block w-full text-left"
                aria-pressed={ativo}
              >
                <div className="pointer-events-none relative bg-muted/30">
                  <OsTemplateThumbnail
                    html={renderOsTemplateHtml(m, amostra)}
                    orientacao={m.orientacao}
                  />
                  {ativo && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
                      <Check className="h-3 w-3" /> Escolhido
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 p-2.5">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      ativo ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {ativo && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate text-xs font-semibold">{m.nome}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAmpliado(m)}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow transition hover:bg-black/85"
                aria-label={`Ampliar prévia de ${m.nome}`}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!ampliado} onOpenChange={(open) => !open && setAmpliado(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ampliado?.nome}</DialogTitle>
          </DialogHeader>
          {ampliado && (
            <div className="overflow-hidden rounded-xl border border-border">
              <OsTemplateThumbnail
                html={renderOsTemplateHtml(ampliado, amostra)}
                orientacao={ampliado.orientacao}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (ampliado) onSelecionar(ampliado.id);
              setAmpliado(null);
            }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground"
          >
            <Check className="h-4 w-4" /> Usar este modelo
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
