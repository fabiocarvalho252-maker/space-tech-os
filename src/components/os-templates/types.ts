import type { OsTemplateRow } from "@/lib/os-template-render";

// The full os_templates DB row — OsTemplateRow (from the shared render
// engine) plus the columns the render engine itself never needs to look at
// (descrição, favorito/padrão/ativo/builtin flags, audit columns).
export type OsTemplateDbRow = OsTemplateRow & {
  descricao: string | null;
  favorito: boolean;
  padrao: boolean;
  ativo: boolean;
  builtin: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export const CATEGORIA_LABEL: Record<string, string> = {
  minimalista: "Minimalista",
  profissional: "Profissional",
  tecnico: "Técnico",
  assistencia: "Assistência",
  completo: "Completo",
  fotos: "Com Fotos",
};

export const CATEGORIAS = Object.keys(CATEGORIA_LABEL);
