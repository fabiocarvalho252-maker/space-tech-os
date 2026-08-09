
-- Create purchase_config table
CREATE TABLE IF NOT EXISTS public.purchase_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    situacao_faturar TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- Create purchase_status_flows table
CREATE TABLE IF NOT EXISTS public.purchase_status_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, from_status, to_status)
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_config TO authenticated;
GRANT ALL ON public.purchase_config TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_status_flows TO authenticated;
GRANT ALL ON public.purchase_status_flows TO service_role;

-- Enable RLS
ALTER TABLE public.purchase_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_status_flows ENABLE ROW LEVEL SECURITY;

-- Policies for purchase_config
CREATE POLICY "Users can manage their own purchase config"
ON public.purchase_config
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies for purchase_status_flows
CREATE POLICY "Users can manage their own purchase status flows"
ON public.purchase_status_flows
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Seed default status flows for existing users
DO $$
DECLARE
    u RECORD;
    statuses TEXT[] := ARRAY['aberto', 'aprovado', 'em_andamento', 'recebido', 'finalizado', 'faturado', 'cancelado'];
    s1 TEXT;
    s2 TEXT;
BEGIN
    FOR u IN SELECT id FROM auth.users LOOP
        -- Default config
        INSERT INTO public.purchase_config (user_id) VALUES (u.id) ON CONFLICT DO NOTHING;
        
        -- Some default flows
        INSERT INTO public.purchase_status_flows (user_id, from_status, to_status)
        VALUES 
            (u.id, 'aberto', 'aprovado'),
            (u.id, 'aprovado', 'em_andamento'),
            (u.id, 'em_andamento', 'recebido'),
            (u.id, 'recebido', 'finalizado'),
            (u.id, 'finalizado', 'faturado'),
            (u.id, 'aberto', 'cancelado')
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
