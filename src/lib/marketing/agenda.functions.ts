// Agenda de publicações do /admin/marketing — só para o administrador do site
// (conferido aqui no servidor). Agendar não publica na hora: quem publica é o
// worker, no horário marcado (ver agenda.server.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checarSiteAdmin } from "@/lib/site-admin.functions";
import type { Agenda } from "./agenda.server";

export type { Agenda, ItemAgenda, StatusAgenda, ResultadoAgenda } from "./agenda.server";

export const obterAgendaMarketing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Agenda> => {
    checarSiteAdmin(context.claims);
    const { lerAgenda } = await import("./agenda.server");
    return lerAgenda();
  });

const agendarSchema = z.object({
  conteudo: z.string().regex(/^[A-Z]{2}-\d{2}$/),
  plataformas: z
    .array(z.enum(["instagram", "facebook"]))
    .min(1)
    .max(2),
  // Horário de Brasília, ex.: "2026-11-20T12:00".
  quando: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
});

export const agendarConteudoMarketing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => agendarSchema.parse(data))
  .handler(async ({ data, context }) => {
    checarSiteAdmin(context.claims);
    const { agendarConteudo } = await import("./agenda.server");
    const item = await agendarConteudo({
      ...data,
      email: String(context.claims["email"] ?? ""),
    });
    return { id: item.id, quando: item.quando };
  });

const cancelarSchema = z.object({
  id: z.string().regex(/^ag-[a-z0-9-]+$/),
});

export const cancelarAgendamentoMarketing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => cancelarSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);
    const { cancelarAgendamento } = await import("./agenda.server");
    await cancelarAgendamento(data.id, String(context.claims["email"] ?? ""));
    return { ok: true };
  });
