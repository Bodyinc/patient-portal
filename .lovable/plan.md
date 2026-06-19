# Patient Portal Auth Plan

Build email/password login + signup for `patient.bodyinc.com`, sharing one Supabase project with the provider and admin portals. Enforce a single role per user — a provider or admin trying to use the patient portal sees a clear error and is blocked.

## 1. Shared Supabase model (one-time, future-proof)

Single source of truth for "which portal does this user belong to" — already partly in place (`user_roles`, `app_role` enum, `has_role`, `get_user_portal`).

Migration:
- Ensure `app_role` enum has values: `patient`, `provider`, `admin`.
- Enforce **one role per user**: add `UNIQUE(user_id)` on `public.user_roles` (drop the older `(user_id, role)` unique if present).
- Add `public.profiles` table:
  - `id uuid PK references auth.users on delete cascade`
  - `full_name text not null`
  - `phone text`
  - `dob date`
  - `created_at`, `updated_at` (+ trigger)
  - GRANTs for `authenticated` + `service_role`; RLS so a user can only select/update their own row.
- Trigger `on_auth_user_created` → inserts a `profiles` row from `raw_user_meta_data` (full_name, phone, dob). Role is **NOT** auto-assigned here — each portal assigns its own role explicitly after signup so the same trigger works for all three apps.
- SECURITY DEFINER helper `public.get_my_role()` returning `app_role | null` for the calling user. Used by all three portals.

Result: provider and admin portals (already built) keep working; the patient portal plugs into the same tables.

## 2. Patient portal routes

- `src/routes/auth.tsx` — tabs for Login / Signup (public route).
- `src/routes/forgot-password.tsx` — request reset email.
- `src/routes/reset-password.tsx` — public route; reads `type=recovery` from URL hash, calls `supabase.auth.updateUser({ password })`.
- `src/routes/_authenticated/route.tsx` — integration-managed protected layout (redirects to `/auth`).
- `src/routes/_authenticated/index.tsx` — placeholder patient dashboard ("Welcome, {name}") so the gate has somewhere to land. Replace the current `src/routes/index.tsx` placeholder with a simple marketing landing + "Login / Sign up" CTA.

Auth state listener wired once in `src/routes/__root.tsx` per the stack rules.

## 3. Role enforcement (the core requirement)

The patient portal must reject any account whose role is not `patient`. Two checkpoints:

**A. Signup flow** (`signup` form):
1. Call a server function `signUpPatient({ email, password, fullName, phone, dob })`.
2. Server fn uses the admin client to look up an existing user by email:
   - If user exists AND has a role → return `{ error: "An account with this email already exists on the {role} portal. Please sign in there." }`. No account modification.
   - If user exists with no role (edge case) → assign `patient` role, return success, ask them to sign in.
   - If user does not exist → `supabase.auth.admin.createUser` (or standard `signUp`) with metadata, then insert `user_roles(user_id, 'patient')` in the same handler. Profile row is created by the trigger.
3. Frontend then signs the user in with the entered password.

**B. Login flow** (`login` form):
1. `supabase.auth.signInWithPassword`.
2. Immediately call `get_my_role()` (single round trip).
3. If role !== `'patient'`: `supabase.auth.signOut()` and show:  
   `"This email is registered on the {role} portal. Please sign in at {role}.bodyinc.com — you cannot use the patient portal."`
4. If role is null: assign `patient` (covers users created outside the flow) — or sign out + show "Account not provisioned" depending on what you prefer; default = assign patient.
5. Otherwise navigate to `/`.

The provider and admin portals do the same check with their own role string. Because `user_roles` is `UNIQUE(user_id)`, no user can ever hold two roles.

## 4. Signup form fields (validated with zod)

Email, password (min 8), full name (required), phone (optional, E.164-ish regex), date of birth (date input, must be in the past). Trim + max-length all strings. Client + server validation.

## 5. Password reset

- Forgot page: `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`.
- Reset page: detect recovery session, prompt for new password, `updateUser({ password })`, then redirect to `/auth`.
- Recommend (separately) running `email_domain--scaffold_auth_email_templates` so reset emails are branded; not blocking.

## 6. Build error to fix first

The async build failure surfaced only the rolldown wrapper, not the underlying cause. First step in build mode will be to re-run `bun run build:dev` to capture the real error (likely a stale import after route scaffolding) and fix it before shipping the auth UI.

## Technical details

- Server functions live in `src/lib/patient-auth.functions.ts` (client-safe path). Admin client (`@/integrations/supabase/client.server`) is imported **inside** the handler with `await import(...)` to keep service-role out of the client bundle.
- New server fn `signUpPatient` is **unauthenticated** but rate-limit-friendly: it does email lookup → conditional create → role insert in one handler, and never returns sensitive fields.
- `get_my_role` server fn uses `requireSupabaseAuth` middleware so it runs as the user; `attachSupabaseAuth` is already wired in `src/start.ts` per integration defaults (verify, append if missing).
- Reusable cross-portal hook `usePortalGuard('patient')` wraps the post-login role check so the provider/admin repos can drop in the same logic with one string change.
- No edge functions; all logic in TanStack server functions.

## Out of scope (call out, don't build)

- Branded auth email templates (suggest after).
- Social login (Google/Apple) — easy to add later via the lovable broker.
- Patient dashboard features beyond a welcome placeholder.
