-- Pedido do usuário: a recompensa por indicação deixa de ser comissão em
-- dinheiro (10%) e passa a ser R$ 10,00 de desconto na próxima mensalidade
-- de quem indicou — um crédito por empresa indicada que assina.
--
-- Cada crédito continua sendo uma linha em referral_commissions:
--   available = desconto ainda não usado
--   used      = já descontado de uma mensalidade (used_at / used_note)
-- Nenhuma comissão foi gerada até agora (tabela vazia), então nada muda
-- para valores já existentes.
alter table public.referral_commissions
  drop constraint referral_commissions_status_check;
alter table public.referral_commissions
  add constraint referral_commissions_status_check check (
    status = any (array[
      'pending', 'available', 'requested', 'approved', 'paid', 'rejected', 'canceled', 'used'
    ])
  );

alter table public.referral_commissions
  add column if not exists used_at timestamptz,
  add column if not exists used_note text;

update public.referral_program_config
set commission_type = 'FIXED',
    commission_value = 10.00,
    first_payment_only = true,
    recurring_commission = false,
    description = coalesce(
      nullif(description, ''),
      'Ganhe R$ 10,00 de desconto na sua próxima mensalidade para cada assistência indicada que assinar o SPACE TECH OS.'
    ),
    updated_at = now();

-- Bonificações em Pix que o administrador paga (fora do sistema) a quem
-- indica muitas empresas ficam registradas em referral_withdrawals, que já
-- só aceita payment_method = 'pix'; lançadas direto com status 'paid'.
