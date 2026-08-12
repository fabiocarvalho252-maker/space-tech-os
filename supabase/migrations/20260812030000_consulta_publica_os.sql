-- The public "consulta" page (src/routes/consulta.$osId.tsx) — what the OS
-- printout's "QR Code Área do Cliente" links to — has never actually worked
-- for a real customer: every RLS policy on ordens_servico is `TO
-- authenticated`, so the anon-key query the page runs always came back
-- empty and rendered "Ordem de Serviço não encontrada", no matter how valid
-- the id/número was.
--
-- Rather than adding a broad anon SELECT policy on ordens_servico (which,
-- combined with the page's `select("*", ...)`, would leak
-- senha_dispositivo/padrao_desbloqueio and every other column to anyone who
-- guesses a link), this exposes a SECURITY DEFINER function that returns
-- only the fields the public page actually renders. The id half of the
-- lookup is an unguessable UUID (what the QR code encodes); the numero half
-- is a small sequential integer the page also accepts, same guessability
-- trade-off the feature already had before this fix.
--
-- Also fixes a second, independent bug in the same page: its join selected
-- profiles.telefone_contato, a column that has never existed on profiles
-- (the real phone column is `whatsapp`) — so even an authenticated caller
-- with full RLS access would have hit a "column does not exist" error from
-- PostgREST. Returned here as `whatsapp` to match the real column.
CREATE OR REPLACE FUNCTION public.consultar_os_publica(p_identificador TEXT)
RETURNS TABLE (
  numero INTEGER,
  status TEXT,
  aparelho TEXT,
  marca TEXT,
  modelo TEXT,
  defeito TEXT,
  diagnostico TEXT,
  valor NUMERIC,
  created_at TIMESTAMPTZ,
  loja TEXT,
  whatsapp TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_uuid BOOLEAN;
BEGIN
  v_is_uuid := p_identificador ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF NOT v_is_uuid AND p_identificador !~ '^[0-9]+$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.numero, o.status, o.aparelho, o.marca, o.modelo,
    o.defeito, o.diagnostico, o.valor, o.created_at,
    p.loja, p.whatsapp
  FROM public.ordens_servico o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE (v_is_uuid AND o.id = p_identificador::uuid)
     OR (NOT v_is_uuid AND o.numero = p_identificador::integer)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consultar_os_publica(TEXT) TO anon, authenticated;
