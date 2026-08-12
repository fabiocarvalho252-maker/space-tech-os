-- WhatsApp account activation (replaces e-mail confirmation for empresa
-- signups at /cadastro; login stays e-mail + senha). GOTRUE_MAILER_AUTOCONFIRM
-- is being flipped to true at the infra level alongside this migration, so
-- Supabase Auth itself no longer gates signInWithPassword/signUp on e-mail
-- confirmation — profiles.status is now the sole activation gate for empresa
-- accounts, enforced app-side (login screen + _authenticated route guard).
--
-- Área do Cliente signups (account_type = 'cliente') are untouched: they
-- never get a profiles row (see handle_new_user below) and keep using
-- Supabase's default flow.

-- 1) Activation status on the empresa profile. Existing rows default/backfill
-- to 'active' (they already went through the old e-mail flow or predate it)
-- — only new signups start 'pending'.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active'));
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';

-- 2) One whatsapp per empresa, stored normalized (digits only, "55" country
-- prefix — same convention as whatsapp-service.ts's paraE164BR). Partial so
-- companies that haven't set a contact WhatsApp (NULL/empty) aren't affected.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_whatsapp_key
  ON public.profiles (whatsapp) WHERE whatsapp IS NOT NULL AND whatsapp <> '';

-- 3) OTP codes for WhatsApp activation. Server-only end to end (no grants to
-- authenticated/anon below) — every read/write goes through supabaseAdmin
-- from src/lib/auth/ativacao-whatsapp.functions.ts, which already resolves
-- the caller's identity from the verified Supabase session, so RLS policies
-- would add nothing here.
CREATE TABLE public.whatsapp_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_otps_user_id_created_at_idx
  ON public.whatsapp_otps (user_id, created_at DESC);
ALTER TABLE public.whatsapp_otps ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.whatsapp_otps TO service_role;

-- 4) Singleton connection row for the platform-owned "spacetech_system"
-- Evolution API instance that sends activation codes — distinct from
-- whatsapp_connections (one per empresa, requires a company's own WhatsApp
-- to be QR-paired). This one is paired once by the SPACE TECH operator and
-- used for every empresa's activation OTP. Server-only (site-admin screen +
-- src/lib/whatsapp/system-instance.ts), same no-authenticated-grant reasoning
-- as whatsapp_otps above.
CREATE TABLE public.whatsapp_system_connection (
    id TEXT PRIMARY KEY DEFAULT 'spacetech_system',
    instance_name TEXT NOT NULL DEFAULT 'spacetech_system',
    status TEXT NOT NULL DEFAULT 'desconectado'
      CHECK (status IN ('desconectado', 'conectando', 'conectado', 'erro')),
    phone_number TEXT,
    qr_code TEXT,
    last_connected_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER whatsapp_system_connection_set_updated_at
  BEFORE UPDATE ON public.whatsapp_system_connection
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.whatsapp_system_connection ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.whatsapp_system_connection TO service_role;
INSERT INTO public.whatsapp_system_connection (id) VALUES ('spacetech_system')
  ON CONFLICT (id) DO NOTHING;

-- 5) handle_new_user(): store the empresa's WhatsApp (normalized) and start
-- new empresa accounts 'pending' — they only reach 'active' once
-- verificarCodigoAtivacao (ativacao-whatsapp.functions.ts) confirms the OTP.
-- Cliente signups are unchanged (still skipped entirely).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_whatsapp TEXT;
BEGIN
  IF NEW.raw_user_meta_data->>'account_type' = 'cliente' THEN
    RETURN NEW;
  END IF;

  v_whatsapp := regexp_replace(coalesce(NEW.raw_user_meta_data->>'whatsapp', ''), '\D', '', 'g');
  IF length(v_whatsapp) IN (10, 11) THEN
    v_whatsapp := '55' || v_whatsapp;
  END IF;

  INSERT INTO public.profiles (id, nome, loja, whatsapp, status)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'loja',
    NULLIF(v_whatsapp, ''),
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
