ALTER FUNCTION public.handle_os_item_stock() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_os_item_stock() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_os_item_stock() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_os_item_stock() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_os_item_stock() TO service_role;
