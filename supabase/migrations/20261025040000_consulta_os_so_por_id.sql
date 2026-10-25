-- Consulta pública de OS (/consulta/:id) só pelo UUID da OS, o que o QR Code
-- e o link do WhatsApp levam. Pelo número sequencial, qualquer pessoa sem
-- login conseguia percorrer 1, 2, 3… e ver aparelho, defeito, diagnóstico e
-- valor das OS de todas as lojas (o número é único no sistema inteiro).
CREATE OR REPLACE FUNCTION public.consultar_os_publica(p_identificador text)
RETURNS TABLE(numero integer, status text, aparelho text, marca text, modelo text, defeito text, diagnostico text, valor numeric, created_at timestamp with time zone, loja text, whatsapp text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.numero, o.status, o.aparelho, o.marca, o.modelo,
    o.defeito, o.diagnostico, o.valor, o.created_at,
    p.loja, p.whatsapp
  FROM public.ordens_servico o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.id = p_identificador::uuid
  LIMIT 1;
END;
$$;
