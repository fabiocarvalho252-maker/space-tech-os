-- Pedido do usuário: Básico passa a R$ 40,00/mês. Anual mantém o desconto
-- de 5% já configurado: 40 × 12 × 0,95 = 456,00.
update public.plans
set monthly_price = 40.00, annual_price = 456.00
where slug = 'basico';
