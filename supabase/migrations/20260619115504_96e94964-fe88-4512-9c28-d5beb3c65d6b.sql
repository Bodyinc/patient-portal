
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_portal(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_portal(uuid) TO authenticated;
