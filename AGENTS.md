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
