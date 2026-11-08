-- 1) Avaliação das vendas (balcão/PDV): página pública /avaliar/venda/:id,
--    mesma ideia da avaliação da OS — nota de 1 a 5 + comentário, uma por
--    venda, só para venda finalizada/faturada. Só pelo UUID da venda (o link
--    que vai na pesquisa pós-venda).
-- 2) Link de avaliação no Google da loja (Configurações → Empresa): quem dá
--    5 estrelas (OS ou venda) é convidado a avaliar também no Google.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS link_avaliacao_google text;

CREATE TABLE IF NOT EXISTS public.venda_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venda_id uuid NOT NULL UNIQUE REFERENCES public.vendas(id) ON DELETE CASCADE,
  nota smallint NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario text CHECK (char_length(comentario) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS venda_avaliacoes_user_created_idx
  ON public.venda_avaliacoes (user_id, created_at DESC);

ALTER TABLE public.venda_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venda_avaliacoes ver" ON public.venda_avaliacoes;
CREATE POLICY "venda_avaliacoes ver" ON public.venda_avaliacoes
  FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'vendas', 'ver'));

GRANT SELECT ON public.venda_avaliacoes TO authenticated;

-- Link do Google só se for um endereço https.
CREATE OR REPLACE FUNCTION public.link_google_da_loja(p_empresa uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN p.link_avaliacao_google ~* '^https://[^\s]+$' THEN p.link_avaliacao_google END
    FROM public.profiles p WHERE p.id = p_empresa;
$$;
REVOKE ALL ON FUNCTION public.link_google_da_loja(uuid) FROM PUBLIC, anon, authenticated;

-- OS: agora também devolve o link do Google quando a nota é 5.
CREATE OR REPLACE FUNCTION public.avaliacao_os_publica(p_identificador text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_av public.os_avaliacoes%ROWTYPE;
BEGIN
  IF p_identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_identificador::uuid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_av FROM public.os_avaliacoes WHERE os_id = v_os.id;
  RETURN jsonb_build_object(
    'pode_avaliar', v_os.data_entrega IS NOT NULL OR v_os.status IN ('entregue', 'faturado'),
    'nota', v_av.nota,
    'comentario', v_av.comentario,
    'google', CASE WHEN v_av.nota = 5 THEN public.link_google_da_loja(v_os.user_id) END
  );
END;
$$;

-- Venda: o que a página de avaliação mostra (loja, itens, total) + situação.
CREATE OR REPLACE FUNCTION public.venda_publica_avaliacao(p_identificador text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_venda public.vendas%ROWTYPE;
  v_av public.venda_avaliacoes%ROWTYPE;
BEGIN
  IF p_identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_venda FROM public.vendas WHERE id = p_identificador::uuid;
  IF NOT FOUND OR v_venda.status = 'cancelado' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_av FROM public.venda_avaliacoes WHERE venda_id = v_venda.id;
  RETURN jsonb_build_object(
    'numero', v_venda.numero,
    'data', v_venda.created_at,
    'total', v_venda.total,
    'loja', (SELECT coalesce(nullif(p.loja, ''), p.nome) FROM public.profiles p WHERE p.id = v_venda.user_id),
    'logo', (SELECT p.logo_url FROM public.profiles p WHERE p.id = v_venda.user_id),
    'whatsapp', (SELECT p.whatsapp FROM public.profiles p WHERE p.id = v_venda.user_id),
    'cliente', (SELECT split_part(btrim(c.nome), ' ', 1) FROM public.clientes c WHERE c.id = v_venda.cliente_id),
    'itens', coalesce((
      SELECT jsonb_agg(jsonb_build_object('descricao', i.descricao, 'quantidade', i.quantidade)
                       ORDER BY i.created_at)
        FROM public.venda_itens i WHERE i.venda_id = v_venda.id
    ), '[]'::jsonb),
    'pode_avaliar', v_venda.status IN ('finalizado', 'faturado'),
    'nota', v_av.nota,
    'comentario', v_av.comentario,
    'google', CASE WHEN v_av.nota = 5 THEN public.link_google_da_loja(v_venda.user_id) END
  );
END;
$$;

-- Grava a avaliação da venda. Devolve 'ok', 'ja_avaliada', 'nao_finalizada' ou 'invalida'.
CREATE OR REPLACE FUNCTION public.avaliar_venda_publica(
  p_identificador text,
  p_nota integer,
  p_comentario text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_venda public.vendas%ROWTYPE;
  v_comentario text := nullif(btrim(left(coalesce(p_comentario, ''), 500)), '');
BEGIN
  IF p_identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR p_nota IS NULL OR p_nota NOT BETWEEN 1 AND 5 THEN
    RETURN 'invalida';
  END IF;
  SELECT * INTO v_venda FROM public.vendas WHERE id = p_identificador::uuid;
  IF NOT FOUND THEN
    RETURN 'invalida';
  END IF;
  IF v_venda.status NOT IN ('finalizado', 'faturado') THEN
    RETURN 'nao_finalizada';
  END IF;

  INSERT INTO public.venda_avaliacoes (user_id, venda_id, nota, comentario)
  VALUES (v_venda.user_id, v_venda.id, p_nota, v_comentario)
  ON CONFLICT (venda_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'ja_avaliada';
  END IF;
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.venda_publica_avaliacao(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.avaliar_venda_publica(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.venda_publica_avaliacao(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.avaliar_venda_publica(text, integer, text) TO anon, authenticated;
