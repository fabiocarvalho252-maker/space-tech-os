// Modelos conhecidos por marca e tipo de aparelho, só para sugerir no campo
// Modelo da OS: escolhida a marca (e o tipo), aparecem apenas os modelos
// dela. Não precisa ser completo — os modelos já usados em OS anteriores
// daquela marca entram junto (sugerirModelos).

type Tipo = "Smartphone" | "Tablet" | "Smartwatch" | "Notebook" | "Fone de ouvido" | "Console";

/** "A10 A20 A30" → ["Galaxy A10", ...] com prefixo. */
const serie = (prefixo: string, nomes: string) =>
  nomes
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => `${prefixo}${n.replace(/_/g, " ")}`);

const CATALOGO: Record<string, Partial<Record<Tipo, string[]>>> = {
  Apple: {
    Smartphone: [
      ...serie("iPhone ", "7 7_Plus 8 8_Plus X XR XS XS_Max SE_2020 SE_2022"),
      ...serie(
        "iPhone ",
        "11 11_Pro 11_Pro_Max 12 12_Mini 12_Pro 12_Pro_Max 13 13_Mini 13_Pro 13_Pro_Max 14 14_Plus 14_Pro 14_Pro_Max 15 15_Plus 15_Pro 15_Pro_Max 16 16_Plus 16_Pro 16_Pro_Max 16e 17 17_Pro 17_Pro_Max Air",
      ),
    ],
    Tablet: serie("iPad ", "9ª_geração 10ª_geração Air_4 Air_5 Air_M2 Mini_6 Pro_11 Pro_12.9"),
    Smartwatch: serie(
      "Apple Watch ",
      "SE Series_6 Series_7 Series_8 Series_9 Series_10 Ultra Ultra_2",
    ),
    Notebook: serie("MacBook ", "Air_M1 Air_M2 Air_M3 Pro_13 Pro_14 Pro_16"),
    "Fone de ouvido": serie("AirPods ", "2 3 4 Pro Pro_2 Max"),
  },
  Samsung: {
    Smartphone: [
      ...serie(
        "Galaxy A",
        "01 02 02s 03 03s 03_Core 04 04e 04s 05 05s 06 10 10s 11 12 13 14 15 16 20 20s 21s 22 23 24 25 26 30 30s 31 32 33 34 35 36 50 51 52 52s 53 54 55 56 70 71 72 73",
      ),
      ...serie("Galaxy M", "12 13 14 15 21s 22 23 31 32 33 34 35 52 53 54 55 62"),
      ...serie(
        "Galaxy S",
        "9 9+ 10 10e 10+ 20 20+ 20_Ultra 20_FE 21 21+ 21_Ultra 21_FE 22 22+ 22_Ultra 23 23+ 23_Ultra 23_FE 24 24+ 24_Ultra 24_FE 25 25+ 25_Ultra 25_Edge",
      ),
      ...serie("Galaxy Note ", "9 10 10+ 10_Lite 20 20_Ultra"),
      ...serie("Galaxy Z ", "Flip_3 Flip_4 Flip_5 Flip_6 Fold_3 Fold_4 Fold_5 Fold_6"),
      ...serie("Galaxy J", "2_Prime 4 4_Core 5_Prime 6 7_Prime 8"),
    ],
    Tablet: serie("Galaxy Tab ", "A7 A7_Lite A8 A9 A9+ S6_Lite S7 S7_FE S8 S9 S9_FE S10"),
    Smartwatch: serie("Galaxy Watch ", "4 5 5_Pro 6 6_Classic 7 Ultra"),
    "Fone de ouvido": serie("Galaxy Buds ", "2 2_Pro FE Live 3 3_Pro"),
  },
  Motorola: {
    Smartphone: [
      ...serie(
        "Moto G",
        "5 6 6_Play 7 7_Play 7_Power 8 8_Play 8_Power 9 9_Play 9_Power 10 20 22 23 24 24_Power 30 31 32 34 35 41 42 50 51 52 53 54 55 60 60s 62 71 72 73 75 82 84 85 86 100 200 Stylus",
      ),
      ...serie("Moto E", "5 6 6_Plus 6i 6s 7 7_Plus 7_Power 13 14 15 20 22 32 40"),
      ...serie(
        "Motorola Edge ",
        "20 20_Lite 30 30_Neo 30_Ultra 40 40_Neo 50 50_Fusion 50_Pro 50_Ultra 60",
      ),
      ...serie("Motorola Razr ", "40 40_Ultra 50 50_Ultra"),
      "Moto One",
      "Moto One Fusion",
      "Moto One Macro",
      "Moto One Vision",
      "Moto One Action",
    ],
  },
  Xiaomi: {
    Smartphone: [
      ...serie("Redmi ", "9 9A 9C 9T 10 10A 10C 12 12C 13 13C 14C A1 A2 A3 A5"),
      ...serie(
        "Redmi Note ",
        "8 8_Pro 9 9S 9_Pro 10 10S 10_Pro 11 11S 11_Pro 12 12S 12_Pro 13 13_Pro 13_Pro+ 14 14_Pro 14_Pro+",
      ),
      ...serie(
        "Poco ",
        "X3 X3_Pro X4_Pro X5 X5_Pro X6 X6_Pro X7 X7_Pro M3 M4_Pro M5 M6_Pro F4 F5 F6 C40 C65",
      ),
      ...serie("Xiaomi ", "11T 11_Lite 12 12T 12_Lite 13 13T 13_Lite 14 14T 15"),
      ...serie("Mi ", "9 10 10T 11 11_Lite A2 A3"),
    ],
    Tablet: serie("", "Redmi_Pad Redmi_Pad_SE Xiaomi_Pad_5 Xiaomi_Pad_6"),
    Smartwatch: serie("", "Redmi_Watch_3 Redmi_Watch_4 Mi_Band_7 Mi_Band_8 Smart_Band_9"),
  },
  Realme: {
    Smartphone: serie(
      "Realme ",
      "C11 C21 C25 C30 C33 C35 C53 C55 C61 C67 C75 8 9 10 11 12 Note_50 GT_Master",
    ),
  },
  Infinix: {
    Smartphone: serie(
      "Infinix ",
      "Hot_30 Hot_40 Hot_40i Hot_50 Smart_7 Smart_8 Note_30 Note_40 Note_40_Pro GT_20_Pro",
    ),
  },
  LG: {
    Smartphone: serie("LG ", "K40 K41s K50 K50s K51s K52 K61 K62 K22 K12 Velvet G8"),
  },
  Asus: {
    Smartphone: serie("Zenfone ", "5 6 Max_Pro_M1 Max_Pro_M2 8 9 10"),
    Notebook: serie("", "Vivobook_15 Vivobook_16 Zenbook_14 TUF_Gaming ROG_Strix"),
  },
  Nokia: {
    Smartphone: serie("Nokia ", "C2 C20 C21 C30 G10 G20 G21 G50 G60"),
  },
  Positivo: {
    Smartphone: serie("Positivo ", "Twist_4 Twist_5 Twist_Mini S509"),
    Tablet: serie("Positivo ", "Tab_Q8 Tab_T810"),
    Notebook: serie("Positivo ", "Motion Vision"),
  },
  Multilaser: {
    Smartphone: serie("Multilaser ", "E_Lite F G H"),
    Tablet: serie("Multilaser ", "M7 M8 M9 M10"),
  },
  Lenovo: {
    Tablet: serie("Lenovo Tab ", "M8 M9 M10 M10_Plus P11 P12"),
    Notebook: serie("Lenovo ", "IdeaPad_1 IdeaPad_3 IdeaPad_Slim_3 ThinkPad_E14 Legion_5 LOQ"),
  },
  Dell: {
    Notebook: serie("Dell ", "Inspiron_15 Inspiron_14 Vostro_15 Latitude_5420 G15"),
  },
  Acer: {
    Notebook: serie("Acer ", "Aspire_3 Aspire_5 Nitro_5 Swift_3"),
  },
  Sony: {
    Console: serie(
      "",
      "PlayStation_4 PlayStation_4_Slim PlayStation_4_Pro PlayStation_5 PlayStation_5_Slim",
    ),
  },
  Huawei: {
    Smartphone: serie("Huawei ", "P30 P30_Lite P40_Lite Y9 Y7 Nova_5T"),
  },
};

/** Compara sem acento e sem diferença de maiúscula. */
function normalizar(v: string) {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/**
 * Sugestões do campo Modelo para a marca (e o tipo de aparelho) digitados:
 * o catálogo da marca + os modelos já usados em OS daquela marca. Sem marca,
 * só os modelos já usados.
 */
export function sugerirModelos(
  marca: string,
  aparelho: string,
  usados: { marca: string | null; modelo: string | null }[],
): string[] {
  const m = normalizar(marca);
  const doHistorico = usados
    .filter((o) => o.modelo && (!m || normalizar(o.marca ?? "") === m))
    .map((o) => o.modelo!.trim());
  if (!m) return semRepetidos(doHistorico);

  const chave = Object.keys(CATALOGO).find((k) => normalizar(k) === m);
  const porTipo = chave ? CATALOGO[chave]! : {};
  const tipo = (Object.keys(porTipo) as Tipo[]).find((t) => normalizar(t) === normalizar(aparelho));
  const doCatalogo = tipo ? porTipo[tipo]! : Object.values(porTipo).flat();
  return semRepetidos([...doCatalogo, ...doHistorico]);
}

/**
 * Tira repetidos sem olhar maiúsculas/acentos ("a03 core" = "A03 CORE") e o
 * que o catálogo já tem com o nome completo ("A05" quando há "Galaxy A05").
 * Fica a primeira grafia — o catálogo vem antes do histórico.
 */
function semRepetidos(lista: string[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const item of lista) {
    const n = normalizar(item);
    if (!n || vistos.has(n)) continue;
    if (saida.some((s) => normalizar(s).endsWith(` ${n}`))) continue;
    vistos.add(n);
    saida.push(item);
  }
  return saida.sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

/** Marcas do catálogo de modelos (para somar às sugestões de Marca). */
export const MARCAS_COM_MODELOS = Object.keys(CATALOGO);
