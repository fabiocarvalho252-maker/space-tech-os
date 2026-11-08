-- Transcrição dos áudios recebidos no WhatsApp (Gemini gratuito).
-- A transcrição aparece embaixo do áudio na Central de Conversas e o robô
-- de atendimento usa o texto como se o cliente tivesse digitado.
-- Usado por src/lib/whatsapp/transcricao.server.ts (só service_role).

ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS transcricao TEXT;

-- Cota diária própria dos áudios, separada da do chat da IA.
ALTER TABLE public.ia_uso_diario ADD COLUMN IF NOT EXISTS audios INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.consumir_transcricao_audio(p_empresa UUID, p_limite INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dia DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ok BOOLEAN;
BEGIN
  INSERT INTO public.ia_uso_diario (empresa_id, dia, quantidade, audios)
  VALUES (p_empresa, v_dia, 0, 1)
  ON CONFLICT (empresa_id, dia) DO UPDATE
    SET audios = ia_uso_diario.audios + 1
    WHERE ia_uso_diario.audios < p_limite
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.devolver_transcricao_audio(p_empresa UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.ia_uso_diario
     SET audios = GREATEST(audios - 1, 0)
   WHERE empresa_id = p_empresa
     AND dia = (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

REVOKE EXECUTE ON FUNCTION public.consumir_transcricao_audio(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.devolver_transcricao_audio(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_transcricao_audio(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.devolver_transcricao_audio(UUID) TO service_role;
