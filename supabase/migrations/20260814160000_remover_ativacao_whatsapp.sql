-- Removes the WhatsApp OTP activation gate added in 20260812060000: the
-- platform's system WhatsApp instance (paired from /admin) kept dropping its
-- connection, which left every new empresa signup stuck "pending" and unable
-- to log in (enviarCodigoAtivacao fails whenever that instance isn't
-- "conectado"). Empresa accounts activate immediately again, same as before
-- that migration. Área do Cliente signups were never gated by this and stay
-- unaffected.

ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'active';

-- Unblock companies already stuck pending from the outage.
UPDATE public.profiles SET status = 'active' WHERE status = 'pending';

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
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
