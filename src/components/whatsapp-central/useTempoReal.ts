import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tempo real da Central: qualquer mudança nas conversas da empresa (mensagem
 * nova, atribuição, status) recarrega as consultas na hora. O RLS de
 * whatsapp_conversas vale também aqui. Se o Realtime não conectar (ex.: o
 * proxy do domínio sem WebSocket), desiste depois de duas tentativas e a
 * tela segue com a atualização por consulta curta (4–5 s).
 */
export function useTempoReal(empresaId: string | undefined): boolean {
  const qc = useQueryClient();
  const [conectado, setConectado] = useState(false);
  const pendente = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!empresaId) return;
    let falhas = 0;
    const canal = supabase
      .channel(`whatsapp-central-${empresaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_conversas",
          filter: `user_id=eq.${empresaId}`,
        },
        () => {
          // Várias mudanças juntas (ex.: fila enviando) viram uma recarga só.
          if (pendente.current) return;
          pendente.current = setTimeout(() => {
            pendente.current = null;
            void qc.invalidateQueries({ queryKey: ["whatsapp-central"] });
          }, 300);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          falhas = 0;
          setConectado(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConectado(false);
          if (++falhas >= 2) void supabase.removeChannel(canal);
        } else if (status === "CLOSED") {
          setConectado(false);
        }
      });
    return () => {
      if (pendente.current) clearTimeout(pendente.current);
      void supabase.removeChannel(canal);
    };
  }, [empresaId, qc]);

  return conectado;
}
