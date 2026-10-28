-- Vencimento da cobrança (data em que o cliente deve pagar), separado da
-- validade do QR Pix (expires_at). A tela Cobranças mostra "Atrasada · N dias"
-- quando a cobrança não foi paga e o vencimento já passou.
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS vencimento DATE;

-- Cobranças antigas: do crediário herdam o vencimento da parcela; as demais,
-- a data em que foram criadas (horário de Brasília).
UPDATE public.cobrancas c
   SET vencimento = p.vencimento
  FROM public.crediario_parcelas p
 WHERE c.crediario_parcela_id = p.id
   AND c.vencimento IS NULL;

UPDATE public.cobrancas
   SET vencimento = (created_at AT TIME ZONE 'America/Sao_Paulo')::date
 WHERE vencimento IS NULL;

ALTER TABLE public.cobrancas
  ALTER COLUMN vencimento SET DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  ALTER COLUMN vencimento SET NOT NULL;

NOTIFY pgrst, 'reload schema';
