-- Every new company (profiles row) already gets default payment methods seeded via
-- trg_new_user_payment_methods (see 20260808030016), but there was no equivalent
-- trigger for finance_categories — only a one-time backfill for companies that
-- existed at that time. Any company created since then has zero finance categories,
-- which leaves the required "Categoria (receita)" field on the Faturar OS screen
-- with nothing to select (the dropdown has no options to show).

CREATE OR REPLACE FUNCTION public.handle_new_user_finance_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.finance_categories (user_id, nome, tipo)
    VALUES
        (NEW.id, 'Serviços', 'entrada'),
        (NEW.id, 'Vendas', 'entrada'),
        (NEW.id, 'Aluguel', 'saida'),
        (NEW.id, 'Peças', 'saida')
    ON CONFLICT (user_id, nome, tipo) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_user_finance_categories ON public.profiles;
CREATE TRIGGER trg_new_user_finance_categories
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_finance_categories();

-- Backfill: seed the same defaults for existing companies that are still missing them
-- (created after the 20260808030016 one-time backfill, so never got them).
INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Serviços', 'entrada' FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Vendas', 'entrada' FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Aluguel', 'saida' FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Peças', 'saida' FROM public.profiles ON CONFLICT DO NOTHING;
