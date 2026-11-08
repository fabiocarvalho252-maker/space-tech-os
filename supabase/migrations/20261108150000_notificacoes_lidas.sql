-- Sino de notificações: o que cada usuário já abriu. As notificações são
-- calculadas na hora (estoque baixo, OS aguardando, cliente abriu o link...);
-- aqui fica só a "assinatura" do conteúdo visto. A notificação some depois de
-- aberta e volta quando o conteúdo muda (outro produto, outra OS...).
-- Por usuário, para valer em qualquer aparelho.
CREATE TABLE IF NOT EXISTS public.notificacoes_lidas (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  chave text NOT NULL,
  assinatura text NOT NULL,
  lida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chave)
);

ALTER TABLE public.notificacoes_lidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notificacoes_lidas proprias" ON public.notificacoes_lidas;
CREATE POLICY "notificacoes_lidas proprias" ON public.notificacoes_lidas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_lidas TO authenticated;
