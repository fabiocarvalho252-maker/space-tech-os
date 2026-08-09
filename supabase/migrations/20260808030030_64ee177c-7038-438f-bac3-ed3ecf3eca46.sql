REVOKE ALL ON FUNCTION public.handle_new_user_payment_methods() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_payment_methods() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user_payment_methods() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_payment_methods() TO service_role;
