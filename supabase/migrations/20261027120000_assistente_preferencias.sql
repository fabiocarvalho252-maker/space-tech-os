-- Assistente do sistema (balão de sugestões no botão da SPACE TECH IA).
-- As sugestões são montadas no navegador com as consultas que o próprio
-- usuário já pode fazer (RLS), sem IA; aqui fica só a preferência pessoal
-- de cada login — não da empresa: cada funcionário liga/desliga o seu.
--   ativo: assistente ligado (padrão) ou desligado.
--   categorias_desligadas: tipos de aviso que a pessoa não quer ver
--     ('os', 'financeiro', 'estoque', 'agenda', 'whatsapp', 'dicas').
--   silenciado_ate: "silenciar por hoje" — sem balão nem contador até lá.
--   dispensados: {chave da sugestão: ISO até quando fica escondida}.
-- Tudo aditivo.

CREATE TABLE IF NOT EXISTS public.assistente_preferencias (
  user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  categorias_desligadas TEXT[] NOT NULL DEFAULT '{}',
  silenciado_ate TIMESTAMPTZ,
  dispensados JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.assistente_preferencias TO authenticated;
GRANT ALL ON public.assistente_preferencias TO service_role;
ALTER TABLE public.assistente_preferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assistente_preferencias proprias" ON public.assistente_preferencias;
CREATE POLICY "assistente_preferencias proprias" ON public.assistente_preferencias
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
