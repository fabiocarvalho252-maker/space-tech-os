-- Links de assinatura enviados pelo /admin (Administração do site) para quem
-- quer assinar o SPACE TECH. Só o operador do site usa, sempre pelo servidor
-- (service role, depois de checarSiteAdmin) — sem acesso direto pelo
-- navegador: RLS ligado e nenhuma policy. Quem "virou cliente" é calculado
-- na listagem (telefone igual em profiles criado depois do envio).
CREATE TABLE IF NOT EXISTS public.convites_assinatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  telefone TEXT NOT NULL,
  chave_telefone TEXT NOT NULL,
  oferta TEXT NOT NULL CHECK (oferta IN ('teste', 'mensal', 'anual')),
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('enviado', 'falhou')),
  erro TEXT,
  enviado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS convites_assinatura_criado_idx
  ON public.convites_assinatura (created_at DESC);
CREATE INDEX IF NOT EXISTS convites_assinatura_chave_idx
  ON public.convites_assinatura (chave_telefone);

GRANT ALL ON public.convites_assinatura TO service_role;
ALTER TABLE public.convites_assinatura ENABLE ROW LEVEL SECURITY;
