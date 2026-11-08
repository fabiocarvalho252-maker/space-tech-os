-- Avaliação do atendimento pela Área do Cliente (/consulta/:id): nota de 1 a
-- 5 e comentário opcional, depois que o aparelho foi entregue. Uma por OS.
-- Fica registrada no histórico da OS (evento 'pesquisa_respondida', o mesmo
-- da pesquisa de satisfação do WhatsApp) e aparece no sino da loja.
-- Mesma regra das outras funções públicas da consulta: só pelo UUID da OS.
CREATE TABLE IF NOT EXISTS public.os_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  os_id uuid NOT NULL UNIQUE REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  nota smallint NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario text CHECK (char_length(comentario) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_avaliacoes_user_created_idx
  ON public.os_avaliacoes (user_id, created_at DESC);

ALTER TABLE public.os_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "os_avaliacoes ver" ON public.os_avaliacoes;
CREATE POLICY "os_avaliacoes ver" ON public.os_avaliacoes
  FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'ver'));

GRANT SELECT ON public.os_avaliacoes TO authenticated;

-- Situação da avaliação para a página do cliente.
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
    'comentario', v_av.comentario
  );
END;
$$;

-- Grava a avaliação. Devolve 'ok', 'ja_avaliada', 'nao_entregue' ou 'invalida'.
CREATE OR REPLACE FUNCTION public.avaliar_os_publica(
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
  v_os public.ordens_servico%ROWTYPE;
  v_comentario text := nullif(btrim(left(coalesce(p_comentario, ''), 500)), '');
BEGIN
  IF p_identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR p_nota IS NULL OR p_nota NOT BETWEEN 1 AND 5 THEN
    RETURN 'invalida';
  END IF;
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_identificador::uuid;
  IF NOT FOUND THEN
    RETURN 'invalida';
  END IF;
  IF NOT (v_os.data_entrega IS NOT NULL OR v_os.status IN ('entregue', 'faturado')) THEN
    RETURN 'nao_entregue';
  END IF;

  INSERT INTO public.os_avaliacoes (user_id, os_id, nota, comentario)
  VALUES (v_os.user_id, v_os.id, p_nota, v_comentario)
  ON CONFLICT (os_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'ja_avaliada';
  END IF;

  INSERT INTO public.os_historico (user_id, os_id, evento, descricao)
  VALUES (
    v_os.user_id, v_os.id, 'pesquisa_respondida',
    format('Cliente avaliou pela Área do Cliente: %s (%s/5)%s',
           repeat('★', p_nota) || repeat('☆', 5 - p_nota), p_nota,
           CASE WHEN v_comentario IS NOT NULL THEN format(' — "%s"', left(v_comentario, 200)) ELSE '' END)
  );
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.avaliacao_os_publica(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.avaliar_os_publica(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avaliacao_os_publica(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.avaliar_os_publica(text, integer, text) TO anon, authenticated;
