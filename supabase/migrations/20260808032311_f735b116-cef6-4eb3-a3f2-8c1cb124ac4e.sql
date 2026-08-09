
-- Create smtp_config table
CREATE TABLE IF NOT EXISTS public.smtp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 587,
    "user" TEXT NOT NULL,
    password TEXT NOT NULL,
    from_email TEXT NOT NULL,
    from_name TEXT,
    encryption TEXT DEFAULT 'tls', -- tls, ssl, none
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smtp_config TO authenticated;
GRANT ALL ON public.smtp_config TO service_role;

-- Enable RLS
ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own smtp config"
ON public.smtp_config
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
