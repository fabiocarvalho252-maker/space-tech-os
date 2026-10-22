-- Crediário — ponte no servidor para o app de proteção (ver
-- docs/crediario-app-protecao.md). Guarda as credenciais do app instalado no
-- aparelho. O app em si é construído à parte por um desenvolvedor Android;
-- aqui fica só o lado do servidor.
--
-- Fluxo: a loja gera um código de ativação (válido 24h, uso único) no painel;
-- o app troca esse código em POST /api/crediario/dispositivo/ativar por um
-- segredo próprio do aparelho. Daí em diante o app se autentica com esse
-- segredo (guardamos só o hash) para sincronizar estado e confirmar comandos.
--
-- A equipe NÃO lê esta tabela (sem GRANT para authenticated): só o servidor,
-- com service_role. O código sai pela função abaixo.

CREATE TABLE public.crediario_dispositivos (
  contrato_id UUID PRIMARY KEY REFERENCES public.crediario_contratos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_ativacao TEXT UNIQUE,
  codigo_expira_em TIMESTAMPTZ,
  segredo_hash TEXT,
  ativado_em TIMESTAMPTZ,
  imei_informado TEXT,
  modelo_informado TEXT,
  app_versao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.crediario_dispositivos TO service_role;
ALTER TABLE public.crediario_dispositivos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER crediario_dispositivos_updated BEFORE UPDATE ON public.crediario_dispositivos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Gera (ou regera) o código de ativação do contrato. Regerar invalida o
-- segredo do aparelho anterior: serve para reinstalar depois de uma troca
-- de aparelho ou de uma reinstalação.
CREATE OR REPLACE FUNCTION public.gerar_codigo_ativacao_crediario(p_contrato_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c crediario_contratos%ROWTYPE;
  -- Sem 0/O/1/I/L, para não confundir ao digitar.
  v_alfabeto CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codigo TEXT;
  v_bytes BYTEA;
BEGIN
  SELECT * INTO c FROM crediario_contratos WHERE id = p_contrato_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado.';
  END IF;
  IF NOT public.has_permission(c.user_id, 'crediario', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar o crediário.';
  END IF;
  IF c.status IN ('quitado', 'cancelado') THEN
    RAISE EXCEPTION 'Contrato encerrado: não há proteção para instalar.';
  END IF;

  LOOP
    v_bytes := extensions.gen_random_bytes(8);
    v_codigo := '';
    FOR i IN 0..7 LOOP
      v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % length(v_alfabeto)) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM crediario_dispositivos WHERE codigo_ativacao = v_codigo);
  END LOOP;

  INSERT INTO crediario_dispositivos (contrato_id, user_id, codigo_ativacao, codigo_expira_em)
  VALUES (c.id, c.user_id, v_codigo, now() + interval '24 hours')
  ON CONFLICT (contrato_id) DO UPDATE SET
    codigo_ativacao = EXCLUDED.codigo_ativacao,
    codigo_expira_em = EXCLUDED.codigo_expira_em,
    segredo_hash = NULL,
    ativado_em = NULL;

  UPDATE crediario_contratos SET provisionado_em = NULL WHERE id = c.id;
  PERFORM public.crediario_log(c.id, 'Código de ativação do app de proteção gerado');
  RETURN v_codigo;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gerar_codigo_ativacao_crediario(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_codigo_ativacao_crediario(UUID) TO authenticated;

-- Situação do provisionamento, para o painel (sem expor o segredo nem o
-- código). security_invoker: respeita o RLS/permission de quem consulta.
CREATE VIEW public.vw_crediario_dispositivos WITH (security_invoker = on) AS
SELECT
  d.contrato_id,
  d.user_id,
  (d.ativado_em IS NOT NULL) AS ativado,
  d.ativado_em,
  d.modelo_informado,
  d.app_versao,
  (d.codigo_expira_em IS NOT NULL AND d.codigo_expira_em > now() AND d.ativado_em IS NULL) AS codigo_pendente,
  d.codigo_expira_em,
  c.ultimo_contato
FROM public.crediario_dispositivos d
JOIN public.crediario_contratos c ON c.id = d.contrato_id
WHERE public.has_permission(d.user_id, 'crediario', 'ver');

GRANT SELECT ON public.vw_crediario_dispositivos TO authenticated;
GRANT SELECT ON public.vw_crediario_dispositivos TO service_role;
