-- Senha (PIN) e padrão de desbloqueio do aparelho na compra de seminovo
-- (pedido do usuário) — mesmos nomes/formato das colunas de ordens_servico,
-- para reaproveitar o componente PatternLock (padrão = sequência "1-9").
ALTER TABLE public.seminovos
  ADD COLUMN IF NOT EXISTS senha_dispositivo text,
  ADD COLUMN IF NOT EXISTS padrao_desbloqueio text;
