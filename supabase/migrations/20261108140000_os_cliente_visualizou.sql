-- Área do Cliente (/consulta/:id): registra no histórico interno da OS que o
-- cliente abriu o link — a loja vê na aba Histórico da OS e no sino de
-- notificações. Mesma regra das outras funções públicas da consulta: só pelo
-- UUID da OS.
--
-- * No máximo um registro a cada 6 horas por OS (recarregar a página ou
--   abrir várias vezes no mesmo dia não enche o histórico).
-- * Quem é da loja (dono ou funcionário com acesso às OS) e abre o link
--   logado — p.ex. pelo "Abrir Área do Cliente" — não conta.
-- * O evento 'cliente_visualizou' fica fora de detalhes_os_publica(), que só
--   devolve criacao/status/aprovacao_cliente.
CREATE OR REPLACE FUNCTION public.registrar_visualizacao_os_publica(p_identificador text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os_id uuid;
  v_empresa uuid;
BEGIN
  IF p_identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN;
  END IF;

  SELECT id, user_id INTO v_os_id, v_empresa
    FROM public.ordens_servico WHERE id = p_identificador::uuid;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL AND public.has_permission(v_empresa, 'ordens', 'ver') THEN
    RETURN;
  END IF;

  -- Duas abas abrindo juntas não geram dois registros.
  PERFORM pg_advisory_xact_lock(hashtext('os_cliente_visualizou:' || v_os_id::text));

  IF EXISTS (
    SELECT 1 FROM public.os_historico
     WHERE os_id = v_os_id
       AND evento = 'cliente_visualizou'
       AND created_at > now() - interval '6 hours'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.os_historico (user_id, os_id, evento, descricao)
  VALUES (v_empresa, v_os_id, 'cliente_visualizou', 'Cliente abriu a Área do Cliente (link da OS)');
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_visualizacao_os_publica(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_visualizacao_os_publica(text) TO anon, authenticated;

-- Sino de notificações: visualizações recentes por empresa.
CREATE INDEX IF NOT EXISTS os_historico_cliente_visualizou_idx
  ON public.os_historico (user_id, created_at DESC)
  WHERE evento = 'cliente_visualizou';
