-- Nome de quem assinou (usado na assinatura de quem finalizou a OS, que
-- pode não ser o técnico responsável). Aparece embaixo da assinatura no PDF.
alter table public.service_order_photos add column if not exists assinante_nome text;
