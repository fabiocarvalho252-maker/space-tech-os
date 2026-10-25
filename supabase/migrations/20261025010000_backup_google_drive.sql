-- Backup no Google Drive (src/lib/backup/). Cada empresa pode conectar o
-- próprio Google Drive em Configurações → Backup e receber um ZIP com os
-- seus dados; o operador do site conecta o Drive da plataforma no /admin,
-- que recebe o dump completo feito por scripts/backup-banco.sh.
--
-- id = id da empresa (dono) ou 'plataforma'. O refresh_token dá acesso ao
-- Drive da pessoa, então a tabela não tem nenhuma policy: só o servidor
-- (service role) lê e escreve; a tela recebe só o status por server function.
CREATE TABLE IF NOT EXISTS public.backup_google_drive (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  refresh_token TEXT NOT NULL,
  pasta_id TEXT,
  automatico BOOLEAN NOT NULL DEFAULT true,
  incluir_fotos BOOLEAN NOT NULL DEFAULT true,
  ultimo_backup_em TIMESTAMPTZ,
  ultimo_status TEXT CHECK (ultimo_status IN ('ok', 'erro')),
  ultimo_erro TEXT,
  ultimo_arquivo TEXT,
  ultimo_tamanho BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 'plataforma' OR id = user_id::text)
);

ALTER TABLE public.backup_google_drive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_google_drive FROM anon, authenticated;
GRANT ALL ON public.backup_google_drive TO service_role;

-- Tabelas com dados de uma empresa: as que têm user_id apontando para
-- auth.users com ON DELETE CASCADE (as mesmas que somem ao excluir a
-- empresa). Ficam de fora as que guardam credenciais de integração.
CREATE OR REPLACE FUNCTION public.backup_tabelas_empresa()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT c.conrelid::regclass::text
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE c.contype = 'f'
    AND c.confrelid = 'auth.users'::regclass
    AND c.connamespace = 'public'::regnamespace
    AND c.confdeltype = 'c'
    AND a.attname = 'user_id'
    AND c.conrelid::regclass::text NOT IN (
      'backup_google_drive', 'pagamento_config', 'smtp_config',
      'whatsapp_connections', 'whatsapp_otps', 'user_roles', 'user_empresas'
    )
  ORDER BY 1
$$;

-- Arquivos do Storage de uma empresa: fotos/PDFs ficam em <empresa>/...
-- e o logo em logos/<empresa>-....
CREATE OR REPLACE FUNCTION public.backup_arquivos_empresa(p_empresa UUID)
RETURNS TABLE (bucket_id TEXT, name TEXT, tamanho BIGINT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
  SELECT o.bucket_id, o.name, COALESCE((o.metadata->>'size')::BIGINT, 0)
  FROM storage.objects o
  WHERE o.name LIKE p_empresa::text || '/%'
     OR (o.bucket_id = 'logos' AND o.name LIKE 'logos/' || p_empresa::text || '%')
  ORDER BY 1, 2
$$;

REVOKE EXECUTE ON FUNCTION public.backup_tabelas_empresa() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_arquivos_empresa(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_tabelas_empresa() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_arquivos_empresa(UUID) TO service_role;
