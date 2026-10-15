# Patient Portal

Next.js App Router patient portal with Supabase auth (cookie-based SSR), shadcn/ui, and Tailwind CSS v4.

## Stack

- **Framework:** Next.js 16 (App Router)
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
- `BREVO_API_KEY` (preferred; REST API key `xkeysib-…` for transactional email)
- `BREVO_SMTP_LOGIN` / `BREVO_SMTP_KEY` / `EMAIL_FROM` (SMTP fallback; login is `…@smtp-brevo.com`, not the relay host)
- `CRON_SECRET` (Bearer token for `/api/cron/reminders`)
- `ADMIN_NOTIFY_EMAIL` (ops inbox for refund requests and failed payment alerts)
- `ADMIN_APP_URL` (optional; deep links in provider case-assigned emails)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (Web Push; generate with `npx web-push generate-vapid-keys`)
- `VAPID_SUBJECT` (optional; `mailto:` contact for push, defaults to `mailto:ithelp@bodyinc.com`)
- `QUICKBLOX_API_URL` (default `https://api-bodyinc.quickblox.com`)
- `QUICKBLOX_CLIENT_APP_URL` (default `https://client-bodyinc.quickblox.com`)
- `QUICKBLOX_PROVIDER_EMAIL` / `QUICKBLOX_PROVIDER_PASSWORD` (provider admin used to place the patient with a clinician)
- `QUICKBLOX_PROVIDER_ID` (optional numeric QuickBlox provider id; otherwise taken from provider login)
- `QUICKBLOX_API_KEY` (optional API bearer token; can replace provider login if `QUICKBLOX_PROVIDER_ID` is also set)
- `QUICKBLOX_USER_SECRET` (server-only secret used to generate the patient's QuickBlox password)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
