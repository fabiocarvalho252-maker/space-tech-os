-- OS parada: em andamento (não Pronto nem encerrada) e sem mudar de status
-- há X dias (Configurações → OS; padrão 5, 0 desliga). Conta da última troca
-- de status no histórico — editar a OS não "destrava" o alerta.
ALTER TABLE public.os_config
  ADD COLUMN IF NOT EXISTS dias_alerta_os_parada integer NOT NULL DEFAULT 5
    CHECK (dias_alerta_os_parada BETWEEN 0 AND 365);

-- SECURITY INVOKER: no navegador o RLS de ordens_servico já limita à empresa;
-- no servidor (service role) passe p_empresa.
CREATE OR REPLACE FUNCTION public.os_paradas(p_dias integer, p_empresa uuid DEFAULT NULL)
RETURNS TABLE (os_id uuid, numero integer, status text, dias integer, responsavel_user_id uuid)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT o.id, o.numero, o.status,
         floor(extract(epoch FROM now() - coalesce(h.ultima, o.created_at)) / 86400)::int,
         o.responsavel_user_id
    FROM public.ordens_servico o
    LEFT JOIN LATERAL (
      SELECT max(created_at) AS ultima FROM public.os_historico
       WHERE os_id = o.id AND evento IN ('status', 'criacao')
    ) h ON true
   WHERE p_dias > 0
     AND (p_empresa IS NULL OR o.user_id = p_empresa)
     AND o.status NOT IN ('pronto', 'entregue', 'faturado', 'cancelado', 'reprovado')
     AND coalesce(h.ultima, o.created_at) < now() - make_interval(days => p_dias)
   ORDER BY 4 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.os_paradas(integer, uuid) TO authenticated;
