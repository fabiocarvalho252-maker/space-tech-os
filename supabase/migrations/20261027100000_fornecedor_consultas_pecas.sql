-- Histórico da "Consultar Peças" (tela Fornecedores): cada linha é uma
-- consulta de uma peça a um fornecedor pelo WhatsApp (link wa.me).
-- O status só avança com ação do usuário: "conversa_aberta" quando ele abre
-- a conversa, "respondida" quando ele marca que o fornecedor respondeu.
-- O sistema nunca afirma que a mensagem foi enviada. Tudo aditivo.

CREATE TABLE IF NOT EXISTS public.fornecedor_consultas_pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lote_id UUID NOT NULL,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  peca TEXT NOT NULL,
  marca TEXT,
  modelo TEXT NOT NULL,
  qualidade TEXT,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preparada'
    CHECK (status IN ('preparada', 'conversa_aberta', 'respondida')),
  conversa_aberta_em TIMESTAMPTZ,
  respondida_em TIMESTAMPTZ,
  criado_por UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fornecedor_consultas_pecas_empresa_idx
  ON public.fornecedor_consultas_pecas (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fornecedor_consultas_pecas_fornecedor_idx
  ON public.fornecedor_consultas_pecas (fornecedor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedor_consultas_pecas TO authenticated;
GRANT ALL ON public.fornecedor_consultas_pecas TO service_role;
ALTER TABLE public.fornecedor_consultas_pecas ENABLE ROW LEVEL SECURITY;

-- Consultar é uso do cadastro, não alteração dele: quem vê fornecedores pode
-- registrar e acompanhar consultas; apagar histórico exige "gerenciar".
DROP POLICY IF EXISTS "consultas_pecas ver" ON public.fornecedor_consultas_pecas;
CREATE POLICY "consultas_pecas ver" ON public.fornecedor_consultas_pecas FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'fornecedores', 'ver'));
DROP POLICY IF EXISTS "consultas_pecas inserir" ON public.fornecedor_consultas_pecas;
CREATE POLICY "consultas_pecas inserir" ON public.fornecedor_consultas_pecas FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(user_id, 'fornecedores', 'ver'));
DROP POLICY IF EXISTS "consultas_pecas atualizar" ON public.fornecedor_consultas_pecas;
CREATE POLICY "consultas_pecas atualizar" ON public.fornecedor_consultas_pecas FOR UPDATE TO authenticated
  USING (public.has_permission(user_id, 'fornecedores', 'ver'))
  WITH CHECK (public.has_permission(user_id, 'fornecedores', 'ver'));
DROP POLICY IF EXISTS "consultas_pecas apagar" ON public.fornecedor_consultas_pecas;
CREATE POLICY "consultas_pecas apagar" ON public.fornecedor_consultas_pecas FOR DELETE TO authenticated
  USING (public.has_permission(user_id, 'fornecedores', 'gerenciar'));
