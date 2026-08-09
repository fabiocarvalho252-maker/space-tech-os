-- Create finance categories table if not exists
CREATE TABLE IF NOT EXISTS public.finance_categories (
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
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_categories' AND policyname = 'Users can manage their own categories') THEN
        CREATE POLICY "Users can manage their own categories" ON public.finance_categories
            FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Create payment methods table if not exists
CREATE TABLE IF NOT EXISTS public.payment_methods (
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
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_methods' AND policyname = 'Users can manage their own payment methods') THEN
        CREATE POLICY "Users can manage their own payment methods" ON public.payment_methods
            FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Create bank accounts table if not exists
CREATE TABLE IF NOT EXISTS public.bank_accounts (
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
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_accounts' AND policyname = 'Users can manage their own bank accounts') THEN
        CREATE POLICY "Users can manage their own bank accounts" ON public.bank_accounts
            FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Add billing_day to profiles if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='billing_day') THEN
        ALTER TABLE public.profiles ADD COLUMN billing_day INTEGER DEFAULT 5;
    END IF;
END $$;

-- Update lancamentos table to link with account and payment method if columns don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lancamentos' AND column_name='bank_account_id') THEN
        ALTER TABLE public.lancamentos ADD COLUMN bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lancamentos' AND column_name='payment_method_id') THEN
        ALTER TABLE public.lancamentos ADD COLUMN payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lancamentos' AND column_name='status') THEN
        ALTER TABLE public.lancamentos ADD COLUMN status TEXT DEFAULT 'pago' CHECK (status IN ('pendente', 'pago', 'cancelado'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lancamentos' AND column_name='vencimento') THEN
        ALTER TABLE public.lancamentos ADD COLUMN vencimento DATE;
    END IF;
END $$;

-- Trigger function for default payment methods
CREATE OR REPLACE FUNCTION public.handle_new_user_payment_methods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.payment_methods (user_id, nome, taxa, prazo_recebimento)
    VALUES 
        (NEW.id, 'Pix', 0, 0),
        (NEW.id, 'Dinheiro', 0, 0),
        (NEW.id, 'Cartão de Crédito', 3.99, 30),
        (NEW.id, 'Cartão de Débito', 1.99, 1),
        (NEW.id, 'Boleto', 2.50, 3)
    ON CONFLICT (user_id, nome) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_new_user_payment_methods ON public.profiles;
CREATE TRIGGER trg_new_user_payment_methods
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_payment_methods();

-- Insert defaults for all users
INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Serviços', 'entrada' FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Vendas', 'entrada' FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Aluguel', 'saida' FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.finance_categories (user_id, nome, tipo)
SELECT id, 'Peças', 'saida' FROM public.profiles ON CONFLICT DO NOTHING;

INSERT INTO public.payment_methods (user_id, nome, taxa, prazo_recebimento)
SELECT id, 'Pix', 0, 0 FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.payment_methods (user_id, nome, taxa, prazo_recebimento)
SELECT id, 'Dinheiro', 0, 0 FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.payment_methods (user_id, nome, taxa, prazo_recebimento)
SELECT id, 'Cartão de Crédito', 3.99, 30 FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.payment_methods (user_id, nome, taxa, prazo_recebimento)
SELECT id, 'Cartão de Débito', 1.99, 1 FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.payment_methods (user_id, nome, taxa, prazo_recebimento)
SELECT id, 'Boleto', 2.50, 3 FROM public.profiles ON CONFLICT DO NOTHING;
