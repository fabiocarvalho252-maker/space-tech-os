-- Auditoria geral: quem criou, alterou ou apagou o quê, e quando, nas tabelas
-- que mexem com dinheiro, cadastro e acesso. Gravada por gatilho no próprio
-- banco (vale para a tela, a IA, o robô e os crons), não editável por
-- ninguém pelo app, visível só para o dono da empresa e administradores.
-- Senhas, tokens e códigos Pix não são gravados (aparecem como "***").
-- Tudo aditivo.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL,              -- empresa (mesmo padrão das outras tabelas)
  ator_id     UUID,                       -- quem fez; null = sistema (cron, webhook)
  ator_nome   TEXT,
  tabela      TEXT NOT NULL,
  registro_id TEXT,
  acao        TEXT NOT NULL CHECK (acao IN ('criou', 'alterou', 'apagou')),
  rotulo      TEXT,                       -- nome/número do registro, para leitura
  alteracoes  JSONB,                      -- alterou: {campo: [antes, depois]}; criou/apagou: o registro
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_empresa_data_idx ON public.audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_empresa_tabela_idx ON public.audit_log (user_id, tabela, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log ver" ON public.audit_log;
CREATE POLICY "audit_log ver" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_empresas ue
       WHERE ue.user_id = auth.uid() AND ue.empresa_id = audit_log.user_id AND ue.role = 'admin'
    )
  );
-- Sem políticas de INSERT/UPDATE/DELETE: só o gatilho (SECURITY DEFINER) grava.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM anon, authenticated;
REVOKE ALL ON public.audit_log FROM anon;

-- Campos que nunca vão para a auditoria em texto.
CREATE OR REPLACE FUNCTION public.audit_mascarar(p JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_object_agg(
           k,
           CASE
             WHEN k ~* '(token|secret|senha|padrao_desbloqueio|qr_code|access_key|api_key)'
                  AND v IS NOT NULL AND v <> 'null'::jsonb
               THEN '"***"'::jsonb
             ELSE v
           END), '{}'::jsonb)
    FROM jsonb_each(p) AS e(k, v)
$$;

-- Gatilho genérico. TG_ARGV[0] = coluna da empresa (user_id/empresa_id/id);
-- TG_ARGV[1] = campos ignorados numa alteração, separados por vírgula
-- (ex.: produtos.quantidade, que já tem o histórico de estoque);
-- TG_ARGV[2] = 'sem_criacao_sistema' para não registrar linhas criadas pelo
-- próprio sistema (sem usuário logado), como as permissões padrão do cadastro.
CREATE OR REPLACE FUNCTION public.audit_registrar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_col_empresa TEXT := TG_ARGV[0];
  v_ignorar TEXT[] := ARRAY['updated_at', 'created_at']
    || COALESCE(string_to_array(NULLIF(TG_ARGV[1], ''), ','), ARRAY[]::TEXT[]);
  v_novo JSONB := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_velho JSONB := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_base JSONB := COALESCE(v_novo, v_velho);
  v_empresa UUID;
  v_diff JSONB := '{}'::jsonb;
  v_chave TEXT;
  v_ator UUID := auth.uid();
  v_ator_nome TEXT;
BEGIN
  v_empresa := NULLIF(v_base ->> v_col_empresa, '')::uuid;
  IF v_empresa IS NULL THEN
    RETURN NULL;
  END IF;
  -- Conta da empresa sendo excluída (apaga tudo em cascata): nada a auditar.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_empresa) THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' AND v_ator IS NULL AND TG_ARGV[2] = 'sem_criacao_sistema' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR v_chave IN SELECT jsonb_object_keys(v_novo) LOOP
      CONTINUE WHEN v_chave = ANY (v_ignorar);
      IF (v_novo -> v_chave) IS DISTINCT FROM (v_velho -> v_chave) THEN
        v_diff := v_diff || jsonb_build_object(
          v_chave, jsonb_build_array(v_velho -> v_chave, v_novo -> v_chave));
      END IF;
    END LOOP;
    IF v_diff = '{}'::jsonb THEN
      RETURN NULL;  -- nada que importe mudou
    END IF;
    -- Máscara no par [antes, depois] inteiro.
    SELECT COALESCE(jsonb_object_agg(k,
             CASE WHEN k ~* '(token|secret|senha|padrao_desbloqueio|qr_code|access_key|api_key)'
                  THEN '["***", "***"]'::jsonb ELSE v END), '{}'::jsonb)
      INTO v_diff FROM jsonb_each(v_diff) AS e(k, v);
  END IF;

  IF v_ator IS NOT NULL THEN
    SELECT COALESCE(NULLIF(p.nome, ''), u.email) INTO v_ator_nome
      FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
     WHERE u.id = v_ator;
  END IF;

  INSERT INTO public.audit_log (user_id, ator_id, ator_nome, tabela, registro_id, acao, rotulo, alteracoes)
  VALUES (
    v_empresa,
    v_ator,
    v_ator_nome,
    TG_TABLE_NAME,
    v_base ->> 'id',
    CASE TG_OP WHEN 'INSERT' THEN 'criou' WHEN 'UPDATE' THEN 'alterou' ELSE 'apagou' END,
    left(COALESCE(
      NULLIF(v_base ->> 'nome', ''),
      NULLIF(v_base ->> 'razao_social', ''),
      CASE WHEN v_base ? 'numero' THEN '#' || (v_base ->> 'numero') END,
      NULLIF(v_base ->> 'descricao', ''),
      NULLIF(v_base ->> 'titulo', ''),
      NULLIF(trim(COALESCE(v_base ->> 'marca', '') || ' ' || COALESCE(v_base ->> 'modelo', '')), ''),
      NULLIF(v_base ->> 'modulo', ''),
      NULLIF(v_base ->> 'role', '')
    ), 120),
    CASE WHEN TG_OP = 'UPDATE' THEN v_diff ELSE public.audit_mascarar(v_base) END
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_registrar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_mascarar(JSONB) FROM PUBLIC, anon;

-- Liga o gatilho numa tabela (idempotente).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('clientes',            'user_id',    '',                 ''),
    ('fornecedores',        'user_id',    '',                 ''),
    ('produtos',            'user_id',    'quantidade',       ''),
    ('ordens_servico',      'user_id',    '',                 ''),
    ('vendas',              'user_id',    '',                 ''),
    ('compras',             'user_id',    '',                 ''),
    ('lancamentos',         'user_id',    '',                 ''),
    ('cobrancas',           'user_id',    'mp_id,expires_at', ''),
    ('seminovos',           'user_id',    '',                 ''),
    ('crediario_contratos', 'user_id',    '',                 ''),
    ('termos_garantia',     'user_id',    '',                 ''),
    ('agendamentos',        'user_id',    '',                 ''),
    ('user_empresas',       'empresa_id', '',                 'sem_criacao_sistema'),
    ('role_permissions',    'empresa_id', '',                 'sem_criacao_sistema'),
    ('empresa_convites',    'empresa_id', '',                 ''),
    ('os_config',           'user_id',    '',                 ''),
    ('sale_config',         'user_id',    '',                 ''),
    ('estoque_config',      'user_id',    '',                 ''),
    ('pagamento_config',    'user_id',    '',                 ''),
    -- Dados da empresa; campos do sistema (plano, créditos, avisos) ficam de fora.
    ('profiles',            'id',
       'billing_day,trial_aviso_enviado_em,plano,acesso_ate,status,plano_solicitado,plano_solicitado_em,ia_creditos,plan_id,onboarding_concluido_em,aviso_inatividade_enviado_em',
       'sem_criacao_sistema')
  ) AS t(tabela, col, ignorar, opcao)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zz_audit ON public.%I', r.tabela);
    EXECUTE format(
      'CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.audit_registrar(%L, %L, %L)',
      r.tabela, r.col, r.ignorar, r.opcao);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
