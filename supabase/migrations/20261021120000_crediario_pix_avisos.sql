-- Crediário, parte 2: Pix por parcela e avisos por WhatsApp.
--
-- Pix: reaproveita `cobrancas` (mesma integração Mercado Pago do módulo
-- Cobranças) com um vínculo opcional à parcela. Quando o Mercado Pago
-- confirma o pagamento, reconciliarPagamento() (src/lib/pix/pix-service.ts)
-- chama registrar_pagamento_crediario() com o service_role — que baixa a
-- parcela, o lançamento no Financeiro e libera o aparelho se for o caso.
--
-- Avisos: o pg_cron chama POST /api/crediario/cron de hora em hora (via
-- pg_net); o app envia pelo WhatsApp da empresa o aviso do dia do
-- vencimento e o aviso de bloqueio, com o Pix copia-e-cola. URL e token do
-- endpoint ficam no Supabase Vault (crediario_cron_url/crediario_cron_token),
-- criados fora desta migration para não versionar segredo.

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS crediario_parcela_id UUID
    REFERENCES public.crediario_parcelas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS cobrancas_crediario_parcela_idx
  ON public.cobrancas (crediario_parcela_id) WHERE crediario_parcela_id IS NOT NULL;

CREATE TABLE public.crediario_avisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.crediario_contratos(id) ON DELETE CASCADE,
  parcela_id UUID REFERENCES public.crediario_parcelas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('vencimento', 'bloqueio', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('enviado', 'falhou')),
  telefone TEXT,
  erro TEXT,
  com_pix BOOLEAN NOT NULL DEFAULT false,
  enviado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- null = automático
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aviso automático sai uma vez por parcela e tipo; o manual pode repetir.
CREATE UNIQUE INDEX crediario_avisos_auto_uk ON public.crediario_avisos (parcela_id, tipo)
  WHERE tipo IN ('vencimento', 'bloqueio');
CREATE INDEX crediario_avisos_contrato_idx ON public.crediario_avisos (contrato_id, created_at);

GRANT SELECT ON public.crediario_avisos TO authenticated;
GRANT ALL ON public.crediario_avisos TO service_role;
ALTER TABLE public.crediario_avisos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crediario_avisos ver" ON public.crediario_avisos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'crediario', 'ver'));

-- O webhook do Pix e o endpoint dos avisos rodam como service_role.
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_crediario(UUID, NUMERIC, DATE, UUID, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.processar_inadimplencia_crediario(UUID) TO service_role;

-- Minuto 10: depois da rotina de inadimplência (minuto 5), para o aviso de
-- bloqueio já enxergar o bloqueio da hora. Sem os segredos no Vault, não
-- faz nada.
SELECT cron.schedule(
  'crediario-avisos',
  '10 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'crediario_cron_url'),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'crediario_cron_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'crediario_cron_url')
  $$
);
