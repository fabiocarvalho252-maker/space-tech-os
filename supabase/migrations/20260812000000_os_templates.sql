-- "Modelos de OS" — a real print/PDF template library. Before this, OS
-- printing/PDF had a single hardcoded layout (see ordens.tsx's imprimir()
-- and os-pdf.server.ts) and an orphaned os_config.modelo_impressao column
-- that nothing ever read. This adds a proper per-empresa templates table
-- driving both: `config` holds which sections show, in what order, the
-- color theme and the photo layout — read by the shared render engine
-- (src/lib/os-template-render.ts) instead of each caller hardcoding HTML.
CREATE TABLE public.os_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL CHECK (categoria IN ('minimalista', 'profissional', 'tecnico', 'assistencia', 'completo', 'fotos')),
  orientacao TEXT NOT NULL DEFAULT 'retrato' CHECK (orientacao IN ('retrato', 'paisagem')),
  paginas INTEGER NOT NULL DEFAULT 1 CHECK (paginas BETWEEN 1 AND 2),
  tema TEXT NOT NULL DEFAULT 'roxo' CHECK (tema IN ('azul', 'verde', 'roxo', 'preto', 'vermelho', 'minimalista')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  favorito BOOLEAN NOT NULL DEFAULT false,
  padrao BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  builtin BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one "padrão" template per empresa at a time.
CREATE UNIQUE INDEX os_templates_padrao_uk ON public.os_templates (user_id) WHERE padrao;
CREATE INDEX ON public.os_templates (user_id, ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_templates TO authenticated;
GRANT ALL ON public.os_templates TO service_role;
ALTER TABLE public.os_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_templates ver" ON public.os_templates FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "os_templates gerenciar" ON public.os_templates FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));

CREATE TRIGGER os_templates_set_updated_at
  BEFORE UPDATE ON public.os_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomically flips "padrão" to a single template, replacing whatever the
-- empresa had marked before — the alternative (two separate UPDATEs from
-- the client) would trip the unique partial index on any interleaving.
CREATE OR REPLACE FUNCTION public.definir_template_padrao(p_template_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM os_templates WHERE id = p_template_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Modelo não encontrado.';
  END IF;
  IF NOT public.has_permission(v_user_id, 'configuracoes', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar modelos de OS.';
  END IF;

  UPDATE os_templates SET padrao = false WHERE user_id = v_user_id AND padrao AND id <> p_template_id;
  UPDATE os_templates SET padrao = true WHERE id = p_template_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.definir_template_padrao(UUID) TO authenticated;

-- Seeds the 6 starter templates for an empresa that doesn't have any yet —
-- called lazily from the "Modelos de OS" screen (see
-- os-templates.functions.ts) rather than hooked into handle_new_user, so it
-- self-heals for every empresa that visits the screen (existing accounts
-- included) without needing to touch the shared signup trigger.
CREATE OR REPLACE FUNCTION public.garantir_templates_padrao(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() is NULL outside of a real authenticated request (e.g. the
  -- one-time backfill DO block below, run as the migration's own role) —
  -- only enforce the permission check when there's an actual session to
  -- check. SECURITY DEFINER so the INSERTs below bypass RLS in that same
  -- unauthenticated-backfill case.
  IF auth.uid() IS NOT NULL AND NOT public.has_permission(p_user_id, 'configuracoes', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar modelos de OS.';
  END IF;
  IF EXISTS (SELECT 1 FROM os_templates WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

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
END;
$$;
GRANT EXECUTE ON FUNCTION public.garantir_templates_padrao(UUID) TO authenticated;

-- Backfill for every empresa that already exists.
DO $$
DECLARE
  v_empresa RECORD;
BEGIN
  FOR v_empresa IN SELECT id FROM public.profiles LOOP
    PERFORM public.garantir_templates_padrao(v_empresa.id);
  END LOOP;
END;
$$;
