// Categorias de custo de conserto usadas em Compra de Seminovos — valores
// espelham o CHECK constraint de seminovos_conserto_itens (ver migration
// 20260901090000_seminovos_conserto_itens.sql). Única fonte de verdade para
// o select do formulário e para os ícones/labels usados nos cards e no
// resumo por categoria.
import {
  BatteryCharging,
  Box,
  Camera,
  CircleDot,
  Frame,
  MoreHorizontal,
  Package,
  Plug,
  Smartphone,
  Volume2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type CategoriaConserto =
  | "tela"
  | "bateria"
  | "tampa"
  | "conector"
  | "camera"
  | "botao_flex"
  | "carcaca_aro"
  | "alto_falante"
  | "mao_de_obra"
  | "kit"
  | "outros";

export const CATEGORIAS_CONSERTO: { value: CategoriaConserto; label: string; icon: LucideIcon }[] =
  [
    { value: "tela", label: "Tela", icon: Smartphone },
    { value: "bateria", label: "Bateria", icon: BatteryCharging },
    { value: "tampa", label: "Tampa traseira", icon: Box },
    { value: "conector", label: "Conector de carga", icon: Plug },
    { value: "camera", label: "Câmera", icon: Camera },
    { value: "botao_flex", label: "Botões/Flex", icon: CircleDot },
    { value: "carcaca_aro", label: "Carcaça/Aro", icon: Frame },
    { value: "alto_falante", label: "Alto-falante/Auricular", icon: Volume2 },
    { value: "mao_de_obra", label: "Mão de obra", icon: Wrench },
    { value: "kit", label: "Kit", icon: Package },
    { value: "outros", label: "Outros", icon: MoreHorizontal },
  ];

const CATEGORIA_OUTROS = { value: "outros" as const, label: "Outros", icon: MoreHorizontal };

export function categoriaConsertoInfo(value: string) {
  return CATEGORIAS_CONSERTO.find((c) => c.value === value) ?? CATEGORIA_OUTROS;
}
