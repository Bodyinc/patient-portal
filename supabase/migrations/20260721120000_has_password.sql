CREATE OR REPLACE FUNCTION "public"."has_password"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT coalesce(u.encrypted_password, '') <> ''
  FROM auth.users u
  WHERE u.id = auth.uid();
$$;


ALTER FUNCTION "public"."has_password"() OWNER TO "postgres";


REVOKE ALL ON FUNCTION "public"."has_password"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_password"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_password"() TO "service_role";
