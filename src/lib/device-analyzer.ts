// Local "IA" for the Nova OS assistant: reads the free-text description the
// attendant types (e.g. "iPhone 13 Pro Max dourado com tela quebrada") and
// extracts aparelho/marca/modelo/cor from a static catalog of brands,
// model aliases and colors — no external AI call, no network round trip.
//
// analyzeDeviceDescription() is deliberately async even though today's
// implementation is 100% local/synchronous: it's the seam meant to later
// call a real AI Gateway (see ia.functions.ts/laudo.functions.ts for that
// pattern elsewhere in the app) without touching any call site.
//
// Never invents a value — every field that can't be identified with
// confidence comes back null instead of a guess. IMEI/serial numbers are
// intentionally out of scope: this only ever fills aparelho/marca/modelo/cor.
export type DeviceAnalysis = {
  aparelho: string | null;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
};

const CATEGORIAS = [
  "Smartphone",
  "Tablet",
  "Notebook",
  "Smartwatch",
  "Fone de ouvido",
  "Console",
] as const;

// Catálogos exportados apenas para sugerir opções em campos de digitação
// (autocomplete de Aparelho/Marca/Cor) — não usados pela análise em si.
export const CATEGORIAS_CONHECIDAS: readonly string[] = CATEGORIAS;

export const MARCAS_CONHECIDAS: readonly string[] = [
  "Apple",
  "Samsung",
  "Motorola",
  "Xiaomi",
  "LG",
  "Lenovo",
  "Dell",
  "Acer",
  "Asus",
  "Huawei",
  "Nokia",
  "Sony",
  "Multilaser",
  "Positivo",
];

export function analyzeDeviceDescription(texto: string): Promise<DeviceAnalysis> {
  return Promise.resolve(analisarLocalmente(texto));
}

function analisarLocalmente(texto: string): DeviceAnalysis {
  const t = texto.toLowerCase();
  if (!t.trim()) return { aparelho: null, marca: null, modelo: null, cor: null };

  const modelo = detectarModelo(t);
  // Um alias sem palavra-chave de marca/categoria no texto ("13 Pro Max",
  // "Samsung A54") ainda assim identifica um modelo — nesse caso a
  // marca/categoria são deduzidas do próprio prefixo do modelo reconhecido,
  // em vez de ficarem null por não haver a palavra "iPhone"/"Galaxy" solta
  // no texto.
  const inferido = inferirPelaFamiliaDoModelo(modelo);

  return {
    aparelho: detectarCategoria(t) ?? inferido.aparelho,
    marca: detectarMarca(t) ?? inferido.marca,
    modelo,
    cor: detectarCor(t),
  };
}

function inferirPelaFamiliaDoModelo(
  modelo: string | null,
): { marca: string | null; aparelho: (typeof CATEGORIAS)[number] | null } {
  if (!modelo) return { marca: null, aparelho: null };
  if (/^iPhone\b/.test(modelo)) return { marca: "Apple", aparelho: "Smartphone" };
  if (/^iPad\b/.test(modelo)) return { marca: "Apple", aparelho: "Tablet" };
  if (/^MacBook\b/.test(modelo)) return { marca: "Apple", aparelho: "Notebook" };
  if (/^Apple Watch\b/.test(modelo)) return { marca: "Apple", aparelho: "Smartwatch" };
  if (/^Galaxy Tab\b/.test(modelo)) return { marca: "Samsung", aparelho: "Tablet" };
  if (/^Galaxy Watch\b/.test(modelo)) return { marca: "Samsung", aparelho: "Smartwatch" };
  if (/^Galaxy\b/.test(modelo)) return { marca: "Samsung", aparelho: "Smartphone" };
  if (/^Moto\b/.test(modelo)) return { marca: "Motorola", aparelho: "Smartphone" };
  if (/^(Redmi|Poco|Xiaomi)\b/i.test(modelo)) return { marca: "Xiaomi", aparelho: "Smartphone" };
  return { marca: null, aparelho: null };
}

function detectarCategoria(t: string): (typeof CATEGORIAS)[number] | null {
  if (/macbook|notebook|laptop|ultrabook|ideapad|thinkpad|inspiron|vostro|aspire|\bvaio\b/.test(t))
    return "Notebook";
  if (/\bipad\b|galaxy\s*tab|\btab\s*[a-z]?\d|\btablet\b|mi\s*pad|lenovo\s*tab/.test(t))
    return "Tablet";
  if (/apple\s*watch|galaxy\s*watch|\bsmartwatch\b|rel[oó]gio\s*inteligente/.test(t))
    return "Smartwatch";
  if (/fone\s*de\s*ouvido|\bairpods\b|\bfone\b|\bheadset\b|\bfones\b|\bbuds\b/.test(t))
    return "Fone de ouvido";
  if (/playstation|\bps[45]\b|\bxbox\b|nintendo\s*switch|\bconsole\b/.test(t)) return "Console";
  if (
    /\biphone\b|\bcelular\b|\bsmartphone\b|\bgalaxy\b|\bmoto(?:rola)?\b|\bredmi\b|\bpoco\b|\bxiaomi\b|\bzenfone\b/.test(
      t,
    )
  )
    return "Smartphone";
  return null;
}

function detectarMarca(t: string): string | null {
  if (/\biphone\b|\bipad\b|\bmacbook\b|apple\s*watch|\bapple\b/.test(t)) return "Apple";
  if (/\bsamsung\b|\bgalaxy\b/.test(t)) return "Samsung";
  if (/\bmoto(?:rola)?\b/.test(t)) return "Motorola";
  if (/\bxiaomi\b|\bredmi\b|\bpoco\b/.test(t)) return "Xiaomi";
  if (/\blg\b/.test(t)) return "LG";
  if (/\blenovo\b/.test(t)) return "Lenovo";
  if (/\bdell\b/.test(t)) return "Dell";
  if (/\bacer\b/.test(t)) return "Acer";
  if (/\basus\b|\bzenfone\b/.test(t)) return "Asus";
  if (/\bhuawei\b/.test(t)) return "Huawei";
  if (/\bnokia\b/.test(t)) return "Nokia";
  if (/\bsony\b|\bxperia\b/.test(t)) return "Sony";
  if (/\bmultilaser\b/.test(t)) return "Multilaser";
  if (/\bpositivo\b/.test(t)) return "Positivo";
  return null;
}

const SUFIXO_IPHONE: Record<string, string> = {
  "pro max": "Pro Max",
  pro: "Pro",
  plus: "Plus",
  mini: "Mini",
  se: "SE",
};

function detectarModelo(t: string): string | null {
  return (
    detectarModeloIphone(t) ??
    detectarModeloIpad(t) ??
    detectarModeloMacbook(t) ??
    detectarModeloAppleWatch(t) ??
    detectarModeloGalaxyTab(t) ??
    detectarModeloGalaxyWatch(t) ??
    // Xiaomi antes do fallback genérico do Galaxy: "note" sozinho também é
    // uma família Samsung (Galaxy Note), então "Redmi Note 13" precisa ser
    // reconhecido pela palavra "redmi" antes que o "note 13" bata com esse
    // fallback.
    detectarModeloXiaomi(t) ??
    detectarModeloGalaxyPhone(t) ??
    detectarModeloMoto(t)
  );
}

function detectarModeloIphone(t: string): string | null {
  const m = t.match(/iphone\s*(\d{1,2})\s*(pro\s*max|pro|plus|mini|se)?/i);
  if (m && m[1]) return montarModeloIphone(m[1], m[2]);

  // Aliases sem a palavra "iphone" ("Apple 13 Pro Max", ou até só "13 Pro
  // Max") só contam como iPhone quando nada indica outra marca — evita
  // confundir com "Galaxy S23 Plus" etc.
  if (/\bsamsung\b|\bgalaxy\b|\bmoto(?:rola)?\b|\bxiaomi\b|\bredmi\b|\bpoco\b/.test(t)) return null;
  const alias = t.match(/\b(?:apple\s*)?(\d{1,2})\s*(pro\s*max|pro|mini|se)\b/i);
  if (alias && alias[1]) return montarModeloIphone(alias[1], alias[2]);
  return null;
}

function montarModeloIphone(numero: string, sufixo?: string): string {
  const suf = sufixo ? SUFIXO_IPHONE[sufixo.replace(/\s+/g, " ").trim().toLowerCase()] : undefined;
  return `iPhone ${numero}${suf ? ` ${suf}` : ""}`;
}

function detectarModeloIpad(t: string): string | null {
  const m = t.match(/\bipad\s*(pro|air|mini)?\s*(\d{1,2})?\b/i);
  if (!m) return null;
  const tipo = m[1];
  const suf = tipo ? ` ${capitalizarPalavras(tipo)}` : "";
  const geracao = m[2] ? ` ${m[2]}` : "";
  return `iPad${suf}${geracao}`;
}

function detectarModeloMacbook(t: string): string | null {
  const m = t.match(/\bmacbook\s*(pro|air)?\b/i);
  if (!m) return null;
  const tipo = m[1];
  const suf = tipo ? ` ${capitalizarPalavras(tipo)}` : "";
  return `MacBook${suf}`;
}

function detectarModeloAppleWatch(t: string): string | null {
  const m = t.match(/apple\s*watch\s*(series\s*\d{1,2}|ultra\s*\d?|se)?/i);
  if (!m) return null;
  const suf = m[1] ? ` ${capitalizarPalavras(m[1])}` : "";
  return `Apple Watch${suf}`;
}

// Título-caso preservando dígitos como estão ("13" continua "13", nunca
// vira maiúscula/minúscula) — usado para normalizar trechos capturados de
// texto livre do usuário (ex.: "series 9" → "Series 9").
function capitalizarPalavras(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((p) => (/^\d/.test(p) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(" ");
}

function detectarModeloGalaxyTab(t: string): string | null {
  const m = t.match(/(?:galaxy\s*)?\btab\s*([a-z]?\d{1,2}\+?)\b/i);
  if (!m || !m[1]) return null;
  return `Galaxy Tab ${m[1].toUpperCase()}`;
}

function detectarModeloGalaxyWatch(t: string): string | null {
  const m = t.match(/galaxy\s*watch\s*(\d{1,2})?/i);
  if (!m) return null;
  return `Galaxy Watch${m[1] ? ` ${m[1]}` : ""}`;
}

function detectarModeloGalaxyPhone(t: string): string | null {
  const m = t.match(/\b(a|s|m|z|note)\s?-?(\d{2,3})\s*(fe|ultra|plus|\+)?\b/i);
  if (!m || !m[1] || !m[2]) return null;
  const letra = m[1].toUpperCase();
  const grupoSufixo = m[3];
  const sufixo = grupoSufixo
    ? ` ${grupoSufixo === "+" ? "Plus" : capitalizarPalavras(grupoSufixo)}`
    : "";
  return `Galaxy ${letra}${m[2]}${sufixo}`;
}

function detectarModeloMoto(t: string): string | null {
  const m = t.match(/\bmoto(?:rola)?\b\s*-?\s*([a-z]{1,5})?\s*-?\s*(\d{1,3})\b/i);
  if (!m || !m[2]) return null;
  const letra = m[1] ? m[1].toUpperCase() : "";
  return `Moto ${letra}${m[2]}`.trim();
}

function detectarModeloXiaomi(t: string): string | null {
  const m = t.match(
    /\b(redmi\s*note\s*\d{1,2}\w*|redmi\s*\d{1,2}\w*|poco\s*[a-z]?\d{1,2}\w*|xiaomi\s*\d{1,2}\w*)\b/i,
  );
  if (!m || !m[1]) return null;
  return capitalizarPalavras(m[1]);
}

const CORES: Record<string, string> = {
  preto: "Preto",
  black: "Preto",
  branco: "Branco",
  white: "Branco",
  prateado: "Prata",
  prateada: "Prata",
  prata: "Prata",
  silver: "Prata",
  dourado: "Dourado",
  dourada: "Dourado",
  gold: "Dourado",
  azul: "Azul",
  blue: "Azul",
  verde: "Verde",
  green: "Verde",
  vermelho: "Vermelho",
  vermelha: "Vermelho",
  red: "Vermelho",
  rosa: "Rosa",
  pink: "Rosa",
  roxo: "Roxo",
  roxa: "Roxo",
  violeta: "Roxo",
  purple: "Roxo",
  grafite: "Grafite",
  graphite: "Grafite",
  cinza: "Cinza",
  amarelo: "Amarelo",
  amarela: "Amarelo",
  yellow: "Amarelo",
  laranja: "Laranja",
  orange: "Laranja",
  bege: "Bege",
  beige: "Bege",
  marrom: "Marrom",
  brown: "Marrom",
  turquesa: "Turquesa",
  coral: "Coral",
  champagne: "Champagne",
  titanio: "Titânio",
  "titânio": "Titânio",
};

export const CORES_CONHECIDAS: readonly string[] = Array.from(new Set(Object.values(CORES))).sort();

function detectarCor(t: string): string | null {
  const chaves = Object.keys(CORES).sort((a, b) => b.length - a.length);
  for (const chave of chaves) {
    if (t.includes(chave)) return CORES[chave] ?? null;
  }
  return null;
}
