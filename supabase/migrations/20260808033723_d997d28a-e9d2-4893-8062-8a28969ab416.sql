
-- Create the enum for roles if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create table for invitations
CREATE TABLE public.empresa_convites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo text UNIQUE NOT NULL,
    empresa_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    criado_por uuid REFERENCES auth.users(id) NOT NULL,
    permissao public.app_role NOT NULL DEFAULT 'user',
    usado_em timestamp with time zone,
    usado_por uuid REFERENCES auth.users(id),
    expira_em timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Table to track which users have access to which companies
CREATE TABLE public.user_empresas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    empresa_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'user',
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, empresa_id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_convites TO authenticated;
GRANT ALL ON public.empresa_convites TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_empresas TO authenticated;
GRANT ALL ON public.user_empresas TO service_role;

-- RLS
ALTER TABLE public.empresa_convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;

-- Policies for empresa_convites
CREATE POLICY "Users can manage their own company invitations"
    ON public.empresa_convites
    FOR ALL
    TO authenticated
    USING (empresa_id IN (SELECT id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Anyone can select a specific invitation to use it"
    ON public.empresa_convites
    FOR SELECT
    TO authenticated
    USING (true);

-- Policies for user_empresas
CREATE POLICY "Users can see their own company connections"
    ON public.user_empresas
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage company connections"
    ON public.user_empresas
    FOR ALL
    TO authenticated
    USING (empresa_id IN (SELECT id FROM public.profiles WHERE id = auth.uid()));
