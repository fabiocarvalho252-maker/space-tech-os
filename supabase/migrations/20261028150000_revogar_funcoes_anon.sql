-- Fecha funções SECURITY DEFINER que estavam executáveis sem login (anon)
-- via /rest/v1/rpc. Rodam ignorando o RLS, então:
--
-- * whatsapp_cliente_unico / whatsapp_regra_automacao: só usadas por
--   triggers (também SECURITY DEFINER, rodam como o dono) e pelo servidor
--   com service role. Ninguém do navegador precisa delas — anon chamava
--   com qualquer p_empresa e descobria se um telefone era cliente / tinha
--   opt-out.
-- * garantir_templates_padrao: o app chama logado; sem sessão
--   (auth.uid() NULL) a checagem de permissão era pulada e anon conseguia
--   semear modelos em qualquer empresa.

REVOKE ALL ON FUNCTION public.whatsapp_cliente_unico(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_cliente_unico(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.whatsapp_regra_automacao(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_regra_automacao(UUID, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.garantir_templates_padrao(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garantir_templates_padrao(UUID) TO authenticated, service_role;
