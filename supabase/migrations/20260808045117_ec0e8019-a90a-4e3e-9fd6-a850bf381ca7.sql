ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS imei text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS cor text,
  ADD COLUMN IF NOT EXISTS anotacoes text,
  ADD COLUMN IF NOT EXISTS laudo_tecnico text,
  ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pago numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_pagamento text NOT NULL DEFAULT 'pendente';

ALTER TABLE public.os_itens
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'produto',
  ADD COLUMN IF NOT EXISTS observacao text;