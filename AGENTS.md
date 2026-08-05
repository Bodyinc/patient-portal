# Patient Portal

Next.js App Router patient portal with Supabase auth (cookie-based SSR), shadcn/ui, and Tailwind CSS v4.

## Stack

- **Framework:** Next.js 15 (App Router)
- **Auth/Data:** Supabase (`@supabase/ssr`)
- **UI:** shadcn/ui + Tailwind v4
- **State:** TanStack React Query (client-side data fetching)

## Development

```bash
npm install
npm run dev
```

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, required for signup)
- `NEXT_PUBLIC_APP_URL` (patient portal base URL for email links)
- `BREVO_SMTP_LOGIN` / `BREVO_SMTP_KEY` / `EMAIL_FROM` (transactional email via Brevo SMTP)
- `CRON_SECRET` (Bearer token for `/api/cron/reminders`)
- `ADMIN_NOTIFY_EMAIL` (ops inbox for refund requests and failed payment alerts)
- `ADMIN_APP_URL` (optional; deep links in provider case-assigned emails)
