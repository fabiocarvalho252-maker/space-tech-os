// Conteúdo editável da landing page pública (/). Fica salvo como um único
// JSON em public.site_landing e é editado pelo administrador do site em
// /admin/landing. O que não estiver salvo cai nos padrões abaixo, então a
// página sempre renderiza completa mesmo com o banco vazio.
import { z } from "zod";

// Ícones disponíveis para os cards (chaves mapeadas em
// components/landing/icones.ts).
export const ICONES_LANDING = [
  "wrench",
  "package",
  "users",
  "cart",
  "smartphone",
  "wallet",
  "receipt",
  "sparkles",
  "shield",
  "calendar",
  "chart",
  "printer",
  "message",
  "qrcode",
] as const;
export type IconeLanding = (typeof ICONES_LANDING)[number];

const texto = (max: number) => z.string().trim().max(max);
// Imagens: URL pública do bucket "landing" (ou vazio = usar o mockup padrão).
const imagem = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || /^https?:\/\//.test(v), "URL de imagem inválida.");

export const landingSchema = z.object({
  hero: z.object({
    selo: texto(80),
    titulo: texto(160),
    subtitulo: texto(300),
    ctaPrimario: texto(40),
    ctaSecundario: texto(40),
    nota: texto(160),
    imagem,
  }),
  recursos: z.object({
    titulo: texto(120),
    subtitulo: texto(300),
    itens: z
      .array(
        z.object({
          icone: z.enum(ICONES_LANDING),
          titulo: texto(60),
          descricao: texto(200),
          emBreve: z.boolean(),
        }),
      )
      .max(16),
  }),
  beneficios: z.object({
    titulo: texto(120),
    subtitulo: texto(300),
    blocos: z
      .array(
        z.object({
          titulo: texto(120),
          texto: texto(400),
          itens: z.array(texto(80)).max(8),
          imagem,
        }),
      )
      .max(4),
  }),
  passos: z.object({
    titulo: texto(120),
    itens: z.array(z.object({ titulo: texto(60), texto: texto(200) })).max(4),
  }),
  mobile: z.object({
    titulo: texto(120),
    texto: texto(300),
    itens: z.array(texto(80)).max(6),
    imagem,
  }),
  planos: z.object({
    titulo: texto(120),
    subtitulo: texto(300),
    textoSemPreco: texto(60),
  }),
  depoimentos: z.object({
    titulo: texto(120),
    subtitulo: texto(300),
    itens: z
      .array(
        z.object({
          nome: texto(80),
          empresa: texto(80),
          texto: texto(500),
          foto: imagem,
        }),
      )
      .max(9),
  }),
  ctaFinal: z.object({
    titulo: texto(120),
    texto: texto(300),
    ctaPrimario: texto(40),
    ctaSecundario: texto(40),
  }),
  seo: z.object({
    ogImagem: imagem,
  }),
});

export type LandingConteudo = z.infer<typeof landingSchema>;

export const LANDING_PADRAO: LandingConteudo = {
  hero: {
    selo: "Sistema de gestão para assistência técnica",
    titulo: "Controle sua assistência técnica de um jeito mais inteligente.",
    subtitulo:
      "Ordens de serviço, clientes, estoque, vendas, financeiro e muito mais. Tudo em um único sistema.",
    ctaPrimario: "Começar agora",
    ctaSecundario: "Já tenho uma conta",
    nota: "Comece agora e organize sua assistência em um só lugar.",
    imagem: "",
  },
  recursos: {
    titulo: "Tudo o que sua assistência precisa.",
    subtitulo: "Os módulos conversam entre si: a venda baixa o estoque e já entra no financeiro.",
    itens: [
      {
        icone: "wrench",
        titulo: "Ordem de Serviço",
        descricao: "Controle cada atendimento do início ao fim.",
        emBreve: false,
      },
      {
        icone: "package",
        titulo: "Estoque",
        descricao: "Saiba o que entrou, saiu e o que precisa ser reposto.",
        emBreve: false,
      },
      {
        icone: "users",
        titulo: "Clientes",
        descricao: "Tenha todas as informações dos seus clientes organizadas.",
        emBreve: false,
      },
      {
        icone: "cart",
        titulo: "Vendas e PDV",
        descricao: "Venda produtos e serviços com rapidez.",
        emBreve: false,
      },
      {
        icone: "smartphone",
        titulo: "Seminovos",
        descricao: "Controle compra, custo, venda e garantia dos aparelhos.",
        emBreve: false,
      },
      {
        icone: "wallet",
        titulo: "Financeiro",
        descricao: "Tenha uma visão clara das entradas, saídas e resultados.",
        emBreve: false,
      },
      {
        icone: "receipt",
        titulo: "Nota Fiscal",
        descricao: "Organize suas operações fiscais.",
        emBreve: true,
      },
      {
        icone: "sparkles",
        titulo: "Inteligência Artificial",
        descricao: "Tenha recursos inteligentes para acelerar sua rotina.",
        emBreve: false,
      },
    ],
  },
  beneficios: {
    titulo: "Menos trabalho manual. Mais controle.",
    subtitulo: "Pare de depender de caderno, planilha e memória para tocar a assistência.",
    blocos: [
      {
        titulo: "Toda a operação em um lugar só",
        texto:
          "Cliente, aparelho, OS, peças e pagamento ficam ligados. Você encontra qualquer atendimento em segundos.",
        itens: [
          "Centralização das informações",
          "Organização das OS",
          "Histórico de clientes",
          "Controle de estoque",
        ],
        imagem: "",
      },
      {
        titulo: "Venda, compre e acompanhe o resultado",
        texto:
          "Do balcão ao fechamento do mês: vendas rápidas, compra de seminovos e o financeiro sempre atualizado.",
        itens: [
          "Venda rápida",
          "Gestão financeira",
          "Controle de seminovos",
          "Acesso pelo celular",
          "Sistema responsivo",
        ],
        imagem: "",
      },
    ],
  },
  passos: {
    titulo: "Como funciona",
    itens: [
      { titulo: "Crie sua conta", texto: "Faça seu cadastro rapidamente." },
      {
        titulo: "Configure sua assistência",
        texto: "Cadastre clientes, produtos, serviços e informações da empresa.",
      },
      { titulo: "Comece a trabalhar", texto: "Controle sua operação pelo SPACE TECH OS." },
    ],
  },
  mobile: {
    titulo: "Sua assistência na palma da mão.",
    texto: "Acesse suas informações de qualquer lugar, pelo computador, tablet ou celular.",
    itens: ["OS abertas", "Vendas do dia", "Clientes", "Estoque", "Faturamento"],
    imagem: "",
  },
  planos: {
    titulo: "Um plano completo para sua assistência.",
    subtitulo: "Teste grátis por 7 dias, sem cartão. Depois, pague por mês ou por ano.",
    textoSemPreco: "Consulte as condições",
  },
  depoimentos: {
    titulo: "Feito para quem vive a rotina de uma assistência técnica.",
    subtitulo:
      "Cliente ligando para saber do aparelho, peça que sumiu do estoque, caixa que não fecha. O SPACE TECH OS foi pensado para isso.",
    itens: [],
  },
  ctaFinal: {
    titulo: "Pronto para organizar sua assistência?",
    texto: "Comece a usar o SPACE TECH OS e tenha sua operação muito mais organizada.",
    ctaPrimario: "Criar minha conta",
    ctaSecundario: "Já tenho uma conta",
  },
  seo: { ogImagem: "" },
};

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Mescla o que foi salvo sobre os padrões (arrays salvos substituem os
// padrões por inteiro) e descarta o que não passar na validação — um campo
// inválido volta ao padrão em vez de derrubar a página.
function mesclar(padrao: unknown, salvo: unknown): unknown {
  if (salvo === undefined || salvo === null) return padrao;
  if (ehObjeto(padrao) && ehObjeto(salvo)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(padrao)) out[k] = mesclar(padrao[k], salvo[k]);
    return out;
  }
  if (Array.isArray(padrao)) return Array.isArray(salvo) ? salvo : padrao;
  return typeof salvo === typeof padrao ? salvo : padrao;
}

export function normalizarLanding(salvo: unknown): LandingConteudo {
  const mesclado = mesclar(LANDING_PADRAO, salvo);
  const r = landingSchema.safeParse(mesclado);
  return r.success ? r.data : LANDING_PADRAO;
}
