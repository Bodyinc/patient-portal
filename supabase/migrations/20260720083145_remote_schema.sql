


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'provider',
    'patient'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."bmi_band" AS ENUM (
    'underweight',
    'normal',
    'overweight',
    'obese'
);


ALTER TYPE "public"."bmi_band" OWNER TO "postgres";


CREATE TYPE "public"."eligibility_result" AS ENUM (
    'eligible',
    'ineligible',
    'needs_review'
);


ALTER TYPE "public"."eligibility_result" OWNER TO "postgres";


CREATE TYPE "public"."intake_session_status" AS ENUM (
    'in_progress',
    'payment_pending',
    'completed',
    'abandoned'
);


ALTER TYPE "public"."intake_session_status" OWNER TO "postgres";


CREATE TYPE "public"."medication_relationship" AS ENUM (
    'incompatible',
    'restricted'
);


ALTER TYPE "public"."medication_relationship" OWNER TO "postgres";


CREATE TYPE "public"."medicine_status" AS ENUM (
    'active',
    'inactive',
    'draft'
);


ALTER TYPE "public"."medicine_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."q_question_type" AS ENUM (
    'text',
    'number',
    'yes_no',
    'single_choice',
    'multi_choice'
);


ALTER TYPE "public"."q_question_type" OWNER TO "postgres";


CREATE TYPE "public"."question_type" AS ENUM (
    'short_text',
    'mcq_single',
    'mcq_multi'
);


ALTER TYPE "public"."question_type" OWNER TO "postgres";


CREATE TYPE "public"."sex_type" AS ENUM (
    'female',
    'male',
    'other'
);


ALTER TYPE "public"."sex_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_other_most_popular"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_most_popular THEN
    UPDATE public.packages
      SET is_most_popular = false
      WHERE medicine_id = NEW.medicine_id
        AND id <> NEW.id
        AND is_most_popular = true;
  END IF;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."clear_other_most_popular"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_max_packages_per_medicine"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE cnt integer;
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    SELECT count(*) INTO cnt
    FROM public.packages
    WHERE variant_id = NEW.variant_id AND id <> NEW.id;
  ELSE
    SELECT count(*) INTO cnt
    FROM public.packages
    WHERE medicine_id = NEW.medicine_id AND variant_id IS NULL AND id <> NEW.id;
  END IF;
  IF cnt >= 2 THEN
    RAISE EXCEPTION 'A medicine or variant can have at most 2 packages'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."enforce_max_packages_per_medicine"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_portal"("_user_id" "uuid") RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_portal"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("_user_id" "uuid") RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;


ALTER FUNCTION "public"."get_user_role"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, dob, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'dob', '')::date,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email
    WHERE public.profiles.email IS DISTINCT FROM EXCLUDED.email;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."packages_recompute_from_price"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.variant_id IS NOT NULL THEN
      PERFORM public.recompute_variant_from_price(OLD.variant_id);
    END IF;
    PERFORM public.recompute_medicine_from_price(OLD.medicine_id);
    RETURN OLD;
  END IF;
  IF NEW.variant_id IS NOT NULL THEN
    PERFORM public.recompute_variant_from_price(NEW.variant_id);
  END IF;
  PERFORM public.recompute_medicine_from_price(NEW.medicine_id);
  IF TG_OP = 'UPDATE' THEN
    IF OLD.medicine_id <> NEW.medicine_id THEN
      PERFORM public.recompute_medicine_from_price(OLD.medicine_id);
    END IF;
    IF OLD.variant_id IS DISTINCT FROM NEW.variant_id AND OLD.variant_id IS NOT NULL THEN
      PERFORM public.recompute_variant_from_price(OLD.variant_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."packages_recompute_from_price"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_medicine_from_price"("p_medicine_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.medicines
  SET from_price_cents = (
    SELECT MIN(round(p.price / GREATEST(p.duration_months, 1) * 100)::int)
    FROM public.packages p
    LEFT JOIN public.medicine_variants v ON v.id = p.variant_id
    WHERE p.medicine_id = p_medicine_id
      AND p.is_active = true
      AND (p.variant_id IS NULL OR v.is_active = true)
  )
  WHERE id = p_medicine_id;
END; $$;


ALTER FUNCTION "public"."recompute_medicine_from_price"("p_medicine_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_variant_from_price"("p_variant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.medicine_variants
  SET from_price_cents = (
    SELECT MIN(round(price / GREATEST(duration_months, 1) * 100)::int)
    FROM public.packages
    WHERE variant_id = p_variant_id AND is_active = true
  )
  WHERE id = p_variant_id;
END; $$;


ALTER FUNCTION "public"."recompute_variant_from_price"("p_variant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_medicine_is_active"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.is_active := (NEW.status = 'active');
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."sync_medicine_is_active"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_profile_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."variants_recompute_medicine_from_price"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_medicine_from_price(OLD.medicine_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_medicine_from_price(NEW.medicine_id);
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."variants_recompute_medicine_from_price"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid",
    "action" "text" NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "text",
    "before" "jsonb",
    "after" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reminder_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "period_key" "text" DEFAULT ''::"text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intake_session_categories" (
    "session_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intake_session_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intake_session_eligibility_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "medicine_id" "uuid" NOT NULL,
    "result" "public"."eligibility_result" NOT NULL,
    "reason" "text",
    "evaluated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intake_session_eligibility_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intake_session_medicines" (
    "session_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "medicine_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intake_session_medicines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intake_session_questionnaire_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "medicine_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "answer_text" "text",
    "answer_number" numeric,
    "answer_boolean" boolean,
    "answer_option_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intake_session_questionnaire_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intake_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_token" "text" NOT NULL,
    "state_code" "text",
    "sex" "public"."sex_type",
    "dob" "date",
    "height_cm" numeric(6,2),
    "weight_kg" numeric(6,2),
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "selected_plan_id" "uuid",
    "status" "public"."intake_session_status" DEFAULT 'in_progress'::"public"."intake_session_status" NOT NULL,
    "claimed_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text"
);


ALTER TABLE "public"."intake_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medication_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "tagline" "text",
    "description" "text",
    "icon" "text",
    "eligibility_rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."medication_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medication_category_medicines" (
    "category_id" "uuid" NOT NULL,
    "medicine_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."medication_category_medicines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medication_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "medicine_a_id" "uuid" NOT NULL,
    "medicine_b_id" "uuid" NOT NULL,
    "relationship" "public"."medication_relationship" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "medication_relationships_check" CHECK (("medicine_a_id" <> "medicine_b_id"))
);


ALTER TABLE "public"."medication_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medicine_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "medicine_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "from_price_cents" integer,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_product_id" "text"
);


ALTER TABLE "public"."medicine_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medicines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "short_description" "text" NOT NULL,
    "long_description" "text",
    "image_url" "text",
    "status" "public"."medicine_status" DEFAULT 'draft'::"public"."medicine_status" NOT NULL,
    "important_info" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notice_text" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requires_questionnaire" boolean DEFAULT false NOT NULL,
    "stripe_product_id" "text",
    "from_price_cents" integer
);


ALTER TABLE "public"."medicines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "medicine_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "duration_months" integer NOT NULL,
    "original_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "is_most_popular" boolean DEFAULT false NOT NULL,
    "features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "clinical_note" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_price_id" "text",
    "variant_id" "uuid",
    CONSTRAINT "packages_duration_months_check" CHECK (("duration_months" >= 1))
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "user_id" "uuid",
    "plan_id" "uuid",
    "stripe_payment_intent_id" "text",
    "stripe_customer_id" "text",
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "raw_event" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_subscription_id" "text",
    "stripe_invoice_id" "text"
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "dob" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text" NOT NULL,
    "avatar_url" "text",
    "state_code" "text",
    "sex" "public"."sex_type",
    "street_address" "text",
    "city" "text",
    "postal_code" "text",
    "country" "text",
    "stripe_customer_id" "text",
    "referral_code" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promo_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "stripe_coupon_id" "text",
    "stripe_promotion_code_id" "text",
    "discount_type" "text" NOT NULL,
    "percent_off" numeric(5,2),
    "amount_off_cents" integer,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "duration" "text" DEFAULT 'once'::"text" NOT NULL,
    "duration_in_months" integer,
    "max_redemptions" integer,
    "redeem_by" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "times_redeemed" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auto_apply" boolean DEFAULT false NOT NULL,
    CONSTRAINT "promo_codes_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percent'::"text", 'amount'::"text"]))),
    CONSTRAINT "promo_codes_duration_check" CHECK (("duration" = ANY (ARRAY['once'::"text", 'repeating'::"text", 'forever'::"text"])))
);


ALTER TABLE "public"."promo_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."providers" (
    "id" "uuid" NOT NULL,
    "bio" "text",
    "credentials" "text",
    "specialty" "text",
    "npi" "text",
    "dea" "text",
    "license_number" "text",
    "license_states" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "years_experience" integer,
    "languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "consultation_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "practice_states" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "country" "text" DEFAULT 'US'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."providers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."provider_directory" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "pr"."full_name",
    "pr"."email",
    "pr"."phone",
    "pr"."avatar_url",
    "p"."specialty",
    "p"."credentials",
    "p"."is_active",
    "p"."created_at"
   FROM ("public"."providers" "p"
     JOIN "public"."profiles" "pr" ON (("pr"."id" = "p"."id")));


ALTER VIEW "public"."provider_directory" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_medicines" AS
 SELECT "id",
    "name",
    "short_description",
    "long_description",
    "image_url",
    "from_price_cents",
    "important_info",
    "notice_text",
    "sort_order"
   FROM "public"."medicines"
  WHERE ("status" = 'active'::"public"."medicine_status")
  ORDER BY "sort_order", "created_at";


ALTER VIEW "public"."public_medicines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questionnaire_medicines" (
    "questionnaire_id" "uuid" NOT NULL,
    "medicine_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."questionnaire_medicines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questionnaire_question_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "value" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_disqualifying" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."questionnaire_question_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questionnaire_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "questionnaire_id" "uuid" NOT NULL,
    "prompt" "text" NOT NULL,
    "description" "text",
    "question_type" "public"."q_question_type" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "disqualify_rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."questionnaire_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questionnaires" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."questionnaires" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referrer_user_id" "uuid" NOT NULL,
    "referred_user_id" "uuid",
    "code" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reward_cents" integer DEFAULT 5000 NOT NULL,
    "stripe_balance_txn_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "converted_at" timestamp with time zone
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "payment_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "amount_cents" integer NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_note" "text",
    "stripe_refund_id" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "refund_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."refund_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_checkout_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shop_checkout_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_checkout_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "medicine_id" "uuid" NOT NULL,
    "package_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "image_url" "text",
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "line_total" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shop_checkout_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_checkout_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "medicine_id" "uuid" NOT NULL,
    "selected_package_id" "uuid",
    "selected_plan_code" "text" NOT NULL,
    "payment_method_code" "text" NOT NULL,
    "promo_code" "text",
    "promo_savings" numeric(10,2) DEFAULT 0 NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "shipping" numeric(10,2) DEFAULT 0 NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pending_payment'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_subscription_id" "text",
    "stripe_invoice_id" "text",
    "stripe_payment_intent_id" "text",
    "consultation" numeric DEFAULT 0 NOT NULL,
    CONSTRAINT "shop_checkout_orders_payment_method_code_check" CHECK (("payment_method_code" = ANY (ARRAY['card'::"text", 'alt'::"text", 'new'::"text"]))),
    CONSTRAINT "shop_checkout_orders_selected_plan_code_check" CHECK (("selected_plan_code" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text"]))),
    CONSTRAINT "shop_checkout_orders_status_check" CHECK (("status" = ANY (ARRAY['pending_payment'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."shop_checkout_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_cancellation_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "stripe_subscription_id" "text" NOT NULL,
    "reasons" "text"[] NOT NULL,
    "other_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_cancellation_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_id" "uuid",
    "stripe_subscription_id" "text" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_price_id" "text",
    "package_id" "uuid",
    "medicine_id" "uuid",
    "status" "text" DEFAULT 'incomplete'::"text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "type" "text" NOT NULL,
    "description" "text",
    "referral_id" "uuid",
    "stripe_invoice_id" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_activity_log"
    ADD CONSTRAINT "admin_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_reminders"
    ADD CONSTRAINT "email_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_reminders"
    ADD CONSTRAINT "email_reminders_reminder_type_target_id_period_key_key" UNIQUE ("reminder_type", "target_id", "period_key");



ALTER TABLE ONLY "public"."intake_session_categories"
    ADD CONSTRAINT "intake_session_categories_pkey" PRIMARY KEY ("session_id", "category_id");



ALTER TABLE ONLY "public"."intake_session_eligibility_results"
    ADD CONSTRAINT "intake_session_eligibility_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intake_session_medicines"
    ADD CONSTRAINT "intake_session_medicines_pkey" PRIMARY KEY ("session_id", "category_id");



ALTER TABLE ONLY "public"."intake_session_questionnaire_responses"
    ADD CONSTRAINT "intake_session_questionnaire_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intake_sessions"
    ADD CONSTRAINT "intake_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intake_sessions"
    ADD CONSTRAINT "intake_sessions_session_token_key" UNIQUE ("session_token");



ALTER TABLE ONLY "public"."medication_categories"
    ADD CONSTRAINT "medication_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medication_categories"
    ADD CONSTRAINT "medication_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."medication_category_medicines"
    ADD CONSTRAINT "medication_category_medicines_pkey" PRIMARY KEY ("category_id", "medicine_id");



ALTER TABLE ONLY "public"."medication_relationships"
    ADD CONSTRAINT "medication_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medicine_variants"
    ADD CONSTRAINT "medicine_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medicines"
    ADD CONSTRAINT "medicines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_stripe_promotion_code_id_key" UNIQUE ("stripe_promotion_code_id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questionnaire_medicines"
    ADD CONSTRAINT "questionnaire_medicines_pkey" PRIMARY KEY ("questionnaire_id", "medicine_id");



ALTER TABLE ONLY "public"."questionnaire_question_options"
    ADD CONSTRAINT "questionnaire_question_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questionnaire_questions"
    ADD CONSTRAINT "questionnaire_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questionnaires"
    ADD CONSTRAINT "questionnaires_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referred_user_id_key" UNIQUE ("referred_user_id");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_checkout_events"
    ADD CONSTRAINT "shop_checkout_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_checkout_order_items"
    ADD CONSTRAINT "shop_checkout_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_checkout_orders"
    ADD CONSTRAINT "shop_checkout_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."subscription_cancellation_feedback"
    ADD CONSTRAINT "subscription_cancellation_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_activity_log_created" ON "public"."admin_activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_activity_log_entity" ON "public"."admin_activity_log" USING "btree" ("entity", "created_at" DESC);



CREATE INDEX "idx_cat_med_medicine" ON "public"."medication_category_medicines" USING "btree" ("medicine_id");



CREATE INDEX "idx_isqr_session" ON "public"."intake_session_questionnaire_responses" USING "btree" ("session_id");



CREATE INDEX "idx_payments_session" ON "public"."payments" USING "btree" ("session_id");



CREATE INDEX "idx_payments_stripe_subscription" ON "public"."payments" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE INDEX "idx_payments_user" ON "public"."payments" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_profiles_referral_code" ON "public"."profiles" USING "btree" ("referral_code") WHERE ("referral_code" IS NOT NULL);



CREATE INDEX "idx_qq_questionnaire" ON "public"."questionnaire_questions" USING "btree" ("questionnaire_id", "sort_order");



CREATE INDEX "idx_qqo_question" ON "public"."questionnaire_question_options" USING "btree" ("question_id", "sort_order");



CREATE INDEX "idx_referrals_referrer" ON "public"."referrals" USING "btree" ("referrer_user_id");



CREATE INDEX "idx_refund_requests_payment" ON "public"."refund_requests" USING "btree" ("payment_id");



CREATE INDEX "idx_refund_requests_status" ON "public"."refund_requests" USING "btree" ("status");



CREATE INDEX "idx_refund_requests_user" ON "public"."refund_requests" USING "btree" ("user_id");



CREATE INDEX "idx_shop_checkout_events_order_id" ON "public"."shop_checkout_events" USING "btree" ("order_id", "created_at" DESC);



CREATE INDEX "idx_shop_checkout_order_items_order_id" ON "public"."shop_checkout_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_shop_checkout_orders_user_id" ON "public"."shop_checkout_orders" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_subscription_cancellation_feedback_subscription_id" ON "public"."subscription_cancellation_feedback" USING "btree" ("subscription_id");



CREATE INDEX "idx_subscription_cancellation_feedback_user_id" ON "public"."subscription_cancellation_feedback" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_subscriptions_session" ON "public"."subscriptions" USING "btree" ("session_id");



CREATE INDEX "idx_subscriptions_user" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_wallet_txn_invoice_debit" ON "public"."wallet_transactions" USING "btree" ("user_id", "stripe_invoice_id", "type") WHERE ("stripe_invoice_id" IS NOT NULL);



CREATE INDEX "idx_wallet_txn_user" ON "public"."wallet_transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "medication_relationships_pair_uidx" ON "public"."medication_relationships" USING "btree" (LEAST("medicine_a_id", "medicine_b_id"), GREATEST("medicine_a_id", "medicine_b_id"));



CREATE INDEX "medicine_variants_medicine_id_idx" ON "public"."medicine_variants" USING "btree" ("medicine_id", "sort_order");



CREATE INDEX "medicines_from_price_idx" ON "public"."medicines" USING "btree" ("from_price_cents");



CREATE INDEX "packages_medicine_id_idx" ON "public"."packages" USING "btree" ("medicine_id");



CREATE INDEX "packages_variant_id_idx" ON "public"."packages" USING "btree" ("variant_id");



CREATE INDEX "providers_is_active_idx" ON "public"."providers" USING "btree" ("is_active");



CREATE INDEX "providers_specialty_idx" ON "public"."providers" USING "btree" ("lower"("specialty"));



CREATE UNIQUE INDEX "uidx_payments_stripe_invoice" ON "public"."payments" USING "btree" ("stripe_invoice_id") WHERE ("stripe_invoice_id" IS NOT NULL);



CREATE UNIQUE INDEX "uidx_refund_requests_open" ON "public"."refund_requests" USING "btree" ("payment_id") WHERE ("status" = 'pending'::"text");



CREATE OR REPLACE TRIGGER "clear_other_most_popular_trg" AFTER INSERT OR UPDATE OF "is_most_popular", "medicine_id" ON "public"."packages" FOR EACH ROW EXECUTE FUNCTION "public"."clear_other_most_popular"();



CREATE OR REPLACE TRIGGER "enforce_max_packages_per_medicine_trg" BEFORE INSERT OR UPDATE OF "medicine_id", "variant_id" ON "public"."packages" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_max_packages_per_medicine"();



CREATE OR REPLACE TRIGGER "packages_recompute_from_price_trg" AFTER INSERT OR DELETE OR UPDATE ON "public"."packages" FOR EACH ROW EXECUTE FUNCTION "public"."packages_recompute_from_price"();



CREATE OR REPLACE TRIGGER "sync_medicine_is_active_trg" BEFORE INSERT OR UPDATE ON "public"."medicines" FOR EACH ROW EXECUTE FUNCTION "public"."sync_medicine_is_active"();



CREATE OR REPLACE TRIGGER "trg_intake_sessions_updated" BEFORE UPDATE ON "public"."intake_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_medication_categories_updated" BEFORE UPDATE ON "public"."medication_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_medication_relationships_updated" BEFORE UPDATE ON "public"."medication_relationships" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_payments_updated" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_promo_codes_updated" BEFORE UPDATE ON "public"."promo_codes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_questionnaire_questions_updated" BEFORE UPDATE ON "public"."questionnaire_questions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_questionnaires_updated" BEFORE UPDATE ON "public"."questionnaires" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_refund_requests_updated" BEFORE UPDATE ON "public"."refund_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_subscriptions_updated" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_medicine_variants_updated_at" BEFORE UPDATE ON "public"."medicine_variants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_medicines_updated_at" BEFORE UPDATE ON "public"."medicines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_packages_updated_at" BEFORE UPDATE ON "public"."packages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_providers_updated_at" BEFORE UPDATE ON "public"."providers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_shop_checkout_orders_updated_at" BEFORE UPDATE ON "public"."shop_checkout_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "variants_recompute_medicine_from_price_trg" AFTER INSERT OR DELETE OR UPDATE OF "is_active", "medicine_id" ON "public"."medicine_variants" FOR EACH ROW EXECUTE FUNCTION "public"."variants_recompute_medicine_from_price"();



ALTER TABLE ONLY "public"."admin_activity_log"
    ADD CONSTRAINT "admin_activity_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intake_session_categories"
    ADD CONSTRAINT "intake_session_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."medication_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_session_categories"
    ADD CONSTRAINT "intake_session_categories_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_session_eligibility_results"
    ADD CONSTRAINT "intake_session_eligibility_results_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_session_eligibility_results"
    ADD CONSTRAINT "intake_session_eligibility_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_session_medicines"
    ADD CONSTRAINT "intake_session_medicines_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."medication_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_session_medicines"
    ADD CONSTRAINT "intake_session_medicines_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_session_medicines"
    ADD CONSTRAINT "intake_session_medicines_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_session_questionnaire_responses"
    ADD CONSTRAINT "intake_session_questionnaire_responses_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_session_questionnaire_responses"
    ADD CONSTRAINT "intake_session_questionnaire_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questionnaire_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_session_questionnaire_responses"
    ADD CONSTRAINT "intake_session_questionnaire_responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_sessions"
    ADD CONSTRAINT "intake_sessions_claimed_by_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intake_sessions"
    ADD CONSTRAINT "intake_sessions_selected_plan_id_fkey" FOREIGN KEY ("selected_plan_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."medication_category_medicines"
    ADD CONSTRAINT "medication_category_medicines_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."medication_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medication_category_medicines"
    ADD CONSTRAINT "medication_category_medicines_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medication_relationships"
    ADD CONSTRAINT "medication_relationships_medicine_a_id_fkey" FOREIGN KEY ("medicine_a_id") REFERENCES "public"."medicines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medication_relationships"
    ADD CONSTRAINT "medication_relationships_medicine_b_id_fkey" FOREIGN KEY ("medicine_b_id") REFERENCES "public"."medicines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medicine_variants"
    ADD CONSTRAINT "medicine_variants_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."medicine_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questionnaire_medicines"
    ADD CONSTRAINT "questionnaire_medicines_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questionnaire_medicines"
    ADD CONSTRAINT "questionnaire_medicines_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "public"."questionnaires"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questionnaire_question_options"
    ADD CONSTRAINT "questionnaire_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questionnaire_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questionnaire_questions"
    ADD CONSTRAINT "questionnaire_questions_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "public"."questionnaires"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shop_checkout_events"
    ADD CONSTRAINT "shop_checkout_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."shop_checkout_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_checkout_order_items"
    ADD CONSTRAINT "shop_checkout_order_items_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id");



ALTER TABLE ONLY "public"."shop_checkout_order_items"
    ADD CONSTRAINT "shop_checkout_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."shop_checkout_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_checkout_order_items"
    ADD CONSTRAINT "shop_checkout_order_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shop_checkout_orders"
    ADD CONSTRAINT "shop_checkout_orders_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id");



ALTER TABLE ONLY "public"."shop_checkout_orders"
    ADD CONSTRAINT "shop_checkout_orders_selected_package_id_fkey" FOREIGN KEY ("selected_package_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shop_checkout_orders"
    ADD CONSTRAINT "shop_checkout_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_cancellation_feedback"
    ADD CONSTRAINT "subscription_cancellation_feedback_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_cancellation_feedback"
    ADD CONSTRAINT "subscription_cancellation_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete medicines" ON "public"."medicines" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can delete packages" ON "public"."packages" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can insert medicines" ON "public"."medicines" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can insert packages" ON "public"."packages" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update medicines" ON "public"."medicines" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update packages" ON "public"."packages" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins manage all profiles" ON "public"."profiles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins manage all providers" ON "public"."providers" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins manage variants" ON "public"."medicine_variants" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Anyone can view active medicines" ON "public"."medicines" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "Anyone can view active packages" ON "public"."packages" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "Authenticated can view all medicines" ON "public"."medicines" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view all packages" ON "public"."packages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Providers update own record" ON "public"."providers" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Providers view own record" ON "public"."providers" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Public read active variants" ON "public"."medicine_variants" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."medicines" "m"
  WHERE (("m"."id" = "medicine_variants"."medicine_id") AND ("m"."status" = 'active'::"public"."medicine_status"))))));



CREATE POLICY "Users can insert own cancellation feedback" ON "public"."subscription_cancellation_feedback" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own cancellation feedback" ON "public"."subscription_cancellation_feedback" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users insert own shop checkout events" ON "public"."shop_checkout_events" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."shop_checkout_orders" "o"
  WHERE (("o"."id" = "shop_checkout_events"."order_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users insert own shop checkout order items" ON "public"."shop_checkout_order_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."shop_checkout_orders" "o"
  WHERE (("o"."id" = "shop_checkout_order_items"."order_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users insert own shop checkout orders" ON "public"."shop_checkout_orders" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Users view own shop checkout events" ON "public"."shop_checkout_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."shop_checkout_orders" "o"
  WHERE (("o"."id" = "shop_checkout_events"."order_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users view own shop checkout order items" ON "public"."shop_checkout_order_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."shop_checkout_orders" "o"
  WHERE (("o"."id" = "shop_checkout_order_items"."order_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users view own shop checkout orders" ON "public"."shop_checkout_orders" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."admin_activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cat_med admin write" ON "public"."medication_category_medicines" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "cat_med read" ON "public"."medication_category_medicines" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "categories admin delete" ON "public"."medication_categories" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "categories admin update" ON "public"."medication_categories" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "categories admin write" ON "public"."medication_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "categories readable" ON "public"."medication_categories" FOR SELECT TO "authenticated", "anon" USING (("is_active" OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



ALTER TABLE "public"."email_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intake_session_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intake_session_eligibility_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intake_session_medicines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intake_session_questionnaire_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intake_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "isc admin delete" ON "public"."intake_session_categories" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "isc admin read" ON "public"."intake_session_categories" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "isc insert" ON "public"."intake_session_categories" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "iser admin read" ON "public"."intake_session_eligibility_results" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "iser insert" ON "public"."intake_session_eligibility_results" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "ism admin delete" ON "public"."intake_session_medicines" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "ism admin read" ON "public"."intake_session_medicines" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "ism insert" ON "public"."intake_session_medicines" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "isqr admin read" ON "public"."intake_session_questionnaire_responses" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "isqr insert" ON "public"."intake_session_questionnaire_responses" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



ALTER TABLE "public"."medication_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medication_category_medicines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medication_relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medicine_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medicines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments admin or owner read" ON "public"."payments" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promo codes admin read" ON "public"."promo_codes" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "promo codes admin write" ON "public"."promo_codes" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."providers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "q admin write" ON "public"."questionnaires" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "q read" ON "public"."questionnaires" FOR SELECT TO "authenticated", "anon" USING (("is_active" OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "qm admin write" ON "public"."questionnaire_medicines" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "qm read" ON "public"."questionnaire_medicines" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "qq admin write" ON "public"."questionnaire_questions" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "qq read" ON "public"."questionnaire_questions" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "qqo admin write" ON "public"."questionnaire_question_options" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "qqo read" ON "public"."questionnaire_question_options" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."questionnaire_medicines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questionnaire_question_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questionnaire_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questionnaires" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refund requests admin or owner read" ON "public"."refund_requests" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "refund requests admin update" ON "public"."refund_requests" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "refund requests owner insert" ON "public"."refund_requests" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."refund_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rel admin write" ON "public"."medication_relationships" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "rel read" ON "public"."medication_relationships" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "session admin or owner read" ON "public"."intake_sessions" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("claimed_by_user_id" = "auth"."uid"())));



CREATE POLICY "session admin update" ON "public"."intake_sessions" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "session insert" ON "public"."intake_sessions" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



ALTER TABLE "public"."shop_checkout_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_checkout_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_checkout_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stripe events admin read" ON "public"."stripe_events" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."stripe_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_cancellation_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions admin or owner read" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users read own role" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."clear_other_most_popular"() TO "anon";
GRANT ALL ON FUNCTION "public"."clear_other_most_popular"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_other_most_popular"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_max_packages_per_medicine"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_max_packages_per_medicine"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_max_packages_per_medicine"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_portal"("_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_portal"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_portal"("_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_portal"("_user_id" "uuid") TO "anon";



REVOKE ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."packages_recompute_from_price"() TO "anon";
GRANT ALL ON FUNCTION "public"."packages_recompute_from_price"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."packages_recompute_from_price"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_medicine_from_price"("p_medicine_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_medicine_from_price"("p_medicine_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_medicine_from_price"("p_medicine_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_variant_from_price"("p_variant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_variant_from_price"("p_variant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_variant_from_price"("p_variant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_medicine_is_active"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_medicine_is_active"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_medicine_is_active"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."variants_recompute_medicine_from_price"() TO "anon";
GRANT ALL ON FUNCTION "public"."variants_recompute_medicine_from_price"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."variants_recompute_medicine_from_price"() TO "service_role";


















GRANT ALL ON TABLE "public"."admin_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."email_reminders" TO "anon";
GRANT ALL ON TABLE "public"."email_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."email_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."intake_session_categories" TO "anon";
GRANT ALL ON TABLE "public"."intake_session_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."intake_session_categories" TO "service_role";



GRANT ALL ON TABLE "public"."intake_session_eligibility_results" TO "anon";
GRANT ALL ON TABLE "public"."intake_session_eligibility_results" TO "authenticated";
GRANT ALL ON TABLE "public"."intake_session_eligibility_results" TO "service_role";



GRANT ALL ON TABLE "public"."intake_session_medicines" TO "anon";
GRANT ALL ON TABLE "public"."intake_session_medicines" TO "authenticated";
GRANT ALL ON TABLE "public"."intake_session_medicines" TO "service_role";



GRANT ALL ON TABLE "public"."intake_session_questionnaire_responses" TO "anon";
GRANT ALL ON TABLE "public"."intake_session_questionnaire_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."intake_session_questionnaire_responses" TO "service_role";



GRANT ALL ON TABLE "public"."intake_sessions" TO "anon";
GRANT ALL ON TABLE "public"."intake_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."intake_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."medication_categories" TO "anon";
GRANT ALL ON TABLE "public"."medication_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."medication_categories" TO "service_role";



GRANT ALL ON TABLE "public"."medication_category_medicines" TO "anon";
GRANT ALL ON TABLE "public"."medication_category_medicines" TO "authenticated";
GRANT ALL ON TABLE "public"."medication_category_medicines" TO "service_role";



GRANT ALL ON TABLE "public"."medication_relationships" TO "anon";
GRANT ALL ON TABLE "public"."medication_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."medication_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."medicine_variants" TO "anon";
GRANT ALL ON TABLE "public"."medicine_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."medicine_variants" TO "service_role";



GRANT ALL ON TABLE "public"."medicines" TO "anon";
GRANT ALL ON TABLE "public"."medicines" TO "authenticated";
GRANT ALL ON TABLE "public"."medicines" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_codes" TO "service_role";



GRANT ALL ON TABLE "public"."providers" TO "anon";
GRANT ALL ON TABLE "public"."providers" TO "authenticated";
GRANT ALL ON TABLE "public"."providers" TO "service_role";



GRANT ALL ON TABLE "public"."provider_directory" TO "anon";
GRANT ALL ON TABLE "public"."provider_directory" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_directory" TO "service_role";



GRANT ALL ON TABLE "public"."public_medicines" TO "anon";
GRANT ALL ON TABLE "public"."public_medicines" TO "authenticated";
GRANT ALL ON TABLE "public"."public_medicines" TO "service_role";



GRANT ALL ON TABLE "public"."questionnaire_medicines" TO "anon";
GRANT ALL ON TABLE "public"."questionnaire_medicines" TO "authenticated";
GRANT ALL ON TABLE "public"."questionnaire_medicines" TO "service_role";



GRANT ALL ON TABLE "public"."questionnaire_question_options" TO "anon";
GRANT ALL ON TABLE "public"."questionnaire_question_options" TO "authenticated";
GRANT ALL ON TABLE "public"."questionnaire_question_options" TO "service_role";



GRANT ALL ON TABLE "public"."questionnaire_questions" TO "anon";
GRANT ALL ON TABLE "public"."questionnaire_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questionnaire_questions" TO "service_role";



GRANT ALL ON TABLE "public"."questionnaires" TO "anon";
GRANT ALL ON TABLE "public"."questionnaires" TO "authenticated";
GRANT ALL ON TABLE "public"."questionnaires" TO "service_role";



GRANT ALL ON TABLE "public"."referrals" TO "anon";
GRANT ALL ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";



GRANT ALL ON TABLE "public"."refund_requests" TO "anon";
GRANT ALL ON TABLE "public"."refund_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_requests" TO "service_role";



GRANT ALL ON TABLE "public"."shop_checkout_events" TO "anon";
GRANT ALL ON TABLE "public"."shop_checkout_events" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_checkout_events" TO "service_role";



GRANT ALL ON TABLE "public"."shop_checkout_order_items" TO "anon";
GRANT ALL ON TABLE "public"."shop_checkout_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_checkout_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."shop_checkout_orders" TO "anon";
GRANT ALL ON TABLE "public"."shop_checkout_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_checkout_orders" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_events" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_cancellation_feedback" TO "anon";
GRANT ALL ON TABLE "public"."subscription_cancellation_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_cancellation_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

drop policy "isc insert" on "public"."intake_session_categories";

drop policy "iser insert" on "public"."intake_session_eligibility_results";

drop policy "ism insert" on "public"."intake_session_medicines";

drop policy "isqr insert" on "public"."intake_session_questionnaire_responses";

drop policy "session insert" on "public"."intake_sessions";

drop policy "categories readable" on "public"."medication_categories";

drop policy "cat_med read" on "public"."medication_category_medicines";

drop policy "rel read" on "public"."medication_relationships";

drop policy "Public read active variants" on "public"."medicine_variants";

drop policy "qm read" on "public"."questionnaire_medicines";

drop policy "qqo read" on "public"."questionnaire_question_options";

drop policy "qq read" on "public"."questionnaire_questions";

drop policy "q read" on "public"."questionnaires";


  create policy "isc insert"
  on "public"."intake_session_categories"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "iser insert"
  on "public"."intake_session_eligibility_results"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "ism insert"
  on "public"."intake_session_medicines"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "isqr insert"
  on "public"."intake_session_questionnaire_responses"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "session insert"
  on "public"."intake_sessions"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "categories readable"
  on "public"."medication_categories"
  as permissive
  for select
  to anon, authenticated
using ((is_active OR public.has_role(auth.uid(), 'admin'::public.app_role)));



  create policy "cat_med read"
  on "public"."medication_category_medicines"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "rel read"
  on "public"."medication_relationships"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Public read active variants"
  on "public"."medicine_variants"
  as permissive
  for select
  to anon, authenticated
using (((is_active = true) AND (EXISTS ( SELECT 1
   FROM public.medicines m
  WHERE ((m.id = medicine_variants.medicine_id) AND (m.status = 'active'::public.medicine_status))))));



  create policy "qm read"
  on "public"."questionnaire_medicines"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "qqo read"
  on "public"."questionnaire_question_options"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "qq read"
  on "public"."questionnaire_questions"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "q read"
  on "public"."questionnaires"
  as permissive
  for select
  to anon, authenticated
using ((is_active OR public.has_role(auth.uid(), 'admin'::public.app_role)));


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_email_update AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();


  create policy "Admins can delete medicine images"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'medicine-images'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));



  create policy "Admins can update medicine images"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'medicine-images'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));



  create policy "Admins can upload medicine images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'medicine-images'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));



  create policy "Anyone can view medicine images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'medicine-images'::text));



