import { z } from "zod";

export type ChatRole = "user" | "assistant";

// Ações que a SPACE TECH IA pode propor (ex.: pedido por voz "abre uma OS
// pro João, iPhone 11 com tela quebrada"). A IA nunca grava sozinha: a
// proposta vira um cartão no chat e só é executada quando o usuário
// confirma (executarAcaoIA, com o RLS de quem está logado).
export const acaoIASchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("criar_cliente"),
    nome: z.string().trim().min(1).max(120),
    telefone: z.string().trim().max(30).nullable(),
    documento: z.string().trim().max(30).nullable(),
  }),
  z.object({
    tipo: z.literal("abrir_os"),
    cliente_id: z.guid().nullable(),
    cliente_nome: z.string().trim().max(120).nullable(),
    // Cliente que ainda não existe: é cadastrado junto com a OS.
    novo_cliente: z
      .object({
        nome: z.string().trim().min(1).max(120),
        telefone: z.string().trim().max(30).nullable(),
      })
      .nullable(),
    aparelho: z.string().trim().min(1).max(120),
    marca: z.string().trim().max(60).nullable(),
    modelo: z.string().trim().max(60).nullable(),
    defeito: z.string().trim().max(1000).nullable(),
    valor: z.number().min(0).max(1_000_000).nullable(),
  }),
  z.object({
    tipo: z.literal("mudar_status_os"),
    os_id: z.guid(),
    numero: z.number().int(),
    aparelho: z.string().max(120),
    status_atual: z.string().max(40),
    status_novo: z.string().max(40),
  }),
]);

export type AcaoIA = z.infer<typeof acaoIASchema>;

export type ChatMessage = {
  role: ChatRole;
  content: string;
  /** Cartão de confirmação de uma ação proposta pela IA. */
  acao?: AcaoIA;
  acaoEstado?: "pendente" | "feita" | "cancelada";
};
