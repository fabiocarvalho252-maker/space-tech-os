-- Defeitos visíveis anotados no momento da compra do seminovo (pedido do
-- usuário, 02/11/2026): chaves de SEMINOVO_DEFEITOS (src/lib/seminovos-defeitos.ts)
-- + texto livre para o que não está na lista. Saem no comprovante de compra.
ALTER TABLE public.seminovos
  ADD COLUMN IF NOT EXISTS defeitos_visiveis text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS defeitos_obs text;
