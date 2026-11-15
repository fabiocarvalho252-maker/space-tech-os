// Origem da campanha (UTM) capturada na página de cadastro.
// Regra: só guarda os parâmetros utm_* da lista abaixo, em minúsculas e com
// tamanho limitado. Pura (sem banco e sem browser), para ser testável.

export const CHAVES_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
export type ChaveUtm = (typeof CHAVES_UTM)[number];
export type OrigemCampanha = Partial<Record<ChaveUtm, string>>;

const TAMANHO_MAXIMO_VALOR = 100;

function valorUtmValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().toLowerCase();
  if (!limpo || limpo.length > TAMANHO_MAXIMO_VALOR) return null;
  return limpo;
}

export function extrairOrigemCampanha(parametros: Record<string, unknown>): OrigemCampanha {
  const origem: OrigemCampanha = {};
  for (const chave of CHAVES_UTM) {
    const valor = valorUtmValido(parametros[chave]);
    if (valor) origem[chave] = valor;
  }
  return origem;
}

// Uma visita sem UTM não apaga a origem já salva; uma visita com UTM substitui.
export function mesclarOrigemCampanha(salva: OrigemCampanha, nova: OrigemCampanha): OrigemCampanha {
  return Object.keys(nova).length > 0 ? nova : salva;
}

// Texto curto para mostrar a origem na tela do admin.
export function descreverOrigemCampanha(origem: OrigemCampanha | null): string {
  if (!origem) return "Não informada";
  const partes = [origem.utm_source, origem.utm_medium, origem.utm_campaign].filter(
    (parte): parte is string => Boolean(parte),
  );
  return partes.length > 0 ? partes.join(" · ") : "Não informada";
}

// Opções da pergunta "Como você conheceu o SPACE TECH OS?" no cadastro.
export const OPCOES_COMO_CONHECEU = [
  { valor: "instagram", rotulo: "Instagram" },
  { valor: "tiktok", rotulo: "TikTok" },
  { valor: "facebook", rotulo: "Facebook" },
  { valor: "google", rotulo: "Google" },
  { valor: "whatsapp", rotulo: "WhatsApp" },
  { valor: "indicacao", rotulo: "Indicação de outra assistência" },
  { valor: "outro", rotulo: "Outro" },
] as const;
