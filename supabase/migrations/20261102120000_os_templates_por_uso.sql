-- Modelos por tipo de documento (pedido do usuário, 02/11/2026): cada modelo
-- é de Faturamento (OS), Orçamento ou Venda de aparelho, com um padrão por
-- tipo. Os modelos que já existiam são de Faturamento ('os').
ALTER TABLE public.os_templates
  ADD COLUMN IF NOT EXISTS uso text NOT NULL DEFAULT 'os';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'os_templates_uso_check') THEN
    ALTER TABLE public.os_templates
      ADD CONSTRAINT os_templates_uso_check CHECK (uso IN ('os', 'orcamento', 'venda_aparelho'));
  END IF;
END $$;

-- Um padrão por empresa E por tipo.
DROP INDEX IF EXISTS public.os_templates_padrao_uk;
CREATE UNIQUE INDEX IF NOT EXISTS os_templates_padrao_uso_uk
  ON public.os_templates (user_id, uso) WHERE padrao AND ativo;

CREATE OR REPLACE FUNCTION public.definir_template_padrao(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_uso TEXT;
BEGIN
  SELECT user_id, uso INTO v_user_id, v_uso FROM os_templates WHERE id = p_template_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Modelo não encontrado.';
  END IF;
  IF NOT public.has_permission(v_user_id, 'configuracoes', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar modelos de OS.';
  END IF;

  UPDATE os_templates SET padrao = false
    WHERE user_id = v_user_id AND uso = v_uso AND padrao AND id <> p_template_id;
  UPDATE os_templates SET padrao = true WHERE id = p_template_id;
END;
$function$;

-- Modelos iniciais de Orçamento e de Venda de aparelho (cada tipo só é
-- criado se a empresa ainda não tem nenhum modelo ativo dele).
CREATE OR REPLACE FUNCTION public.garantir_templates_por_uso(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tema TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_permission(p_user_id, 'configuracoes', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar modelos de OS.';
  END IF;

  -- Mesma cor do modelo de Faturamento padrão, para os documentos combinarem.
  SELECT tema INTO v_tema FROM os_templates
    WHERE user_id = p_user_id AND uso = 'os' AND padrao AND ativo LIMIT 1;
  v_tema := COALESCE(v_tema, 'roxo');

  IF NOT EXISTS (SELECT 1 FROM os_templates WHERE user_id = p_user_id AND uso = 'orcamento' AND ativo) THEN
    INSERT INTO os_templates (user_id, uso, nome, descricao, categoria, orientacao, paginas, tema, config, builtin, padrao, created_by)
    VALUES
      (p_user_id, 'orcamento', 'Orçamento — Completo',
       'Cliente, aparelho, defeito, diagnóstico, serviços e valores, com o link/QR para o cliente aprovar.',
       'profissional', 'retrato', 1, v_tema,
       '{"secoes":["cabecalho","cliente","aparelho","defeito","diagnostico","estado_fisico","itens","valores","qrcode","assinaturas"],"fotos_layout":"0"}'::jsonb,
       true, true, p_user_id),
      (p_user_id, 'orcamento', 'Orçamento — Simples',
       'Só o essencial: cliente, aparelho, serviços e valores.',
       'minimalista', 'retrato', 1, v_tema,
       '{"secoes":["cabecalho","cliente","aparelho","itens","valores","qrcode"],"fotos_layout":"0"}'::jsonb,
       true, false, p_user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM os_templates WHERE user_id = p_user_id AND uso = 'venda_aparelho' AND ativo) THEN
    INSERT INTO os_templates (user_id, uso, nome, descricao, categoria, orientacao, paginas, tema, config, builtin, padrao, created_by)
    VALUES
      (p_user_id, 'venda_aparelho', 'Venda de aparelho — Completo',
       'Comprador, aparelho (IMEI, condição), valores e pagamento, garantia, termos e assinaturas.',
       'profissional', 'retrato', 1, v_tema,
       '{"secoes":["cabecalho","cliente","aparelho","valores","garantia","termos","assinaturas"],"fotos_layout":"0"}'::jsonb,
       true, true, p_user_id),
      (p_user_id, 'venda_aparelho', 'Venda de aparelho — Simples',
       'Comprador, aparelho, valores e assinaturas.',
       'minimalista', 'retrato', 1, v_tema,
       '{"secoes":["cabecalho","cliente","aparelho","valores","assinaturas"],"fotos_layout":"0"}'::jsonb,
       true, false, p_user_id);
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.garantir_templates_por_uso(uuid) TO authenticated;

-- Empresa nova: os modelos de Faturamento continuam vindo de
-- garantir_templates_padrao(); ela agora também garante os outros tipos.
CREATE OR REPLACE FUNCTION public.garantir_templates_padrao(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_permission(p_user_id, 'configuracoes', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar modelos de OS.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM os_templates WHERE user_id = p_user_id AND uso = 'os') THEN
    INSERT INTO os_templates (user_id, nome, descricao, categoria, orientacao, paginas, tema, config, builtin, padrao, created_by)
    VALUES
      (p_user_id, 'Space Tech — Profissional',
       'Cabeçalho com logo, dados da OS e cliente, serviços, garantia, QR Code e assinaturas.',
       'profissional', 'retrato', 1, 'roxo',
       '{"secoes":["cabecalho","cliente","aparelho","defeito","diagnostico","itens","valores","garantia","qrcode","assinaturas"],"fotos_layout":"0"}'::jsonb,
       true, true, p_user_id),
      (p_user_id, 'Assistência Técnica — Completo',
       'Checklist de entrada, IMEI/senha/acessórios, peças e mão de obra, fotos e garantia.',
       'assistencia', 'retrato', 1, 'verde',
       '{"secoes":["cabecalho","cliente","aparelho","checklist","estado_fisico","defeito","diagnostico","itens","valores","garantia","fotos","assinaturas"],"fotos_layout":"4"}'::jsonb,
       true, false, p_user_id),
      (p_user_id, 'Minimalista',
       'Muito espaço em branco, linhas finas, só o essencial.',
       'minimalista', 'retrato', 1, 'minimalista',
       '{"secoes":["cabecalho","cliente","aparelho","itens","valores","assinaturas"],"fotos_layout":"0"}'::jsonb,
       true, false, p_user_id),
      (p_user_id, 'Técnico',
       'Foco no aparelho: IMEI, série, estado físico, checklist e diagnóstico.',
       'tecnico', 'retrato', 1, 'vermelho',
       '{"secoes":["cabecalho","aparelho","estado_fisico","checklist","defeito","diagnostico","itens","assinaturas"],"fotos_layout":"0"}'::jsonb,
       true, false, p_user_id),
      (p_user_id, 'Com Fotos',
       'Espaço maior para fotos de entrada, defeito, diagnóstico e serviço.',
       'fotos', 'retrato', 1, 'azul',
       '{"secoes":["cabecalho","cliente","aparelho","defeito","diagnostico","fotos","itens","valores","assinaturas"],"fotos_layout":"grande"}'::jsonb,
       true, false, p_user_id),
      (p_user_id, 'Completo — 2 Páginas',
       'Página 1: dados e fotos. Página 2: serviços, valores, garantia, QR Code e assinaturas.',
       'completo', 'retrato', 2, 'preto',
       '{"secoes":["cabecalho","cliente","aparelho","defeito","diagnostico","fotos","quebra_pagina","itens","valores","garantia","qrcode","assinaturas"],"fotos_layout":"4"}'::jsonb,
       true, false, p_user_id);
  END IF;
  PERFORM public.garantir_templates_por_uso(p_user_id);
END;
$function$;

-- Empresas que já têm modelos de Faturamento ganham os de Orçamento e Venda.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.os_templates LOOP
    PERFORM public.garantir_templates_por_uso(r.user_id);
  END LOOP;
END $$;
