-- Create finance categories table
CREATE TABLE public.finance_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, nome, tipo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own categories" ON public.finance_categories
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create payment methods table
CREATE TABLE public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    taxa NUMERIC(5,2) DEFAULT 0,
    prazo_recebimento INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own payment methods" ON public.payment_methods
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create bank accounts table
CREATE TABLE public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    banco TEXT NOT NULL,
    agencia TEXT,
    conta TEXT,
    tipo TEXT, -- corrente, poupanca
    saldo_inicial NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own bank accounts" ON public.bank_accounts
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add billing_day to profiles
ALTER TABLE public.profiles ADD COLUMN billing_day INTEGER DEFAULT 5;

-- Update lancamentos table to link with account and payment method
ALTER TABLE public.lancamentos ADD COLUMN bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.lancamentos ADD COLUMN payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL;
ALTER TABLE public.lancamentos ADD COLUMN status TEXT DEFAULT 'pago' CHECK (status IN ('pendente', 'pago', 'cancelado'));
ALTER TABLE public.lancamentos ADD COLUMN vencimento DATE;

-- Initial default categories
INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Serviços', 'entrada' FROM public.profiles
ON CONFLICT DO NOTHING;

INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Vendas', 'entrada' FROM public.profiles
ON CONFLICT DO NOTHING;

INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Aluguel', 'saida' FROM public.profiles
ON CONFLICT DO NOTHING;

INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Peças', 'saida' FROM public.profiles
ON CONFLICT DO NOTHING;
