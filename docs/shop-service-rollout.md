# Shop Service Rollout (Vercel + Supabase)

## Environment variables

- `SHOP_SERVICE_MODE=legacy` for safety baseline.
- `SHOP_SERVICE_MODE=dual` for parity observation with mismatch logs.
- `SHOP_SERVICE_MODE=service` for full service-path reads.

Set this in Vercel per environment:

- Preview: start with `dual`
- Production: start with `legacy`, then move to `dual`, then `service`

## Progressive rollout steps

1. Deploy with `SHOP_SERVICE_MODE=legacy` in production and verify `/api/shop/categories` + `/api/shop/catalog` respond.
2. Flip production to `SHOP_SERVICE_MODE=dual`.
3. Observe logs for:
   - `[shop-service][dual][categories] mismatch`
   - `[shop-service][dual][catalog] mismatch`
4. If mismatch remains zero over agreed monitoring window, flip to `SHOP_SERVICE_MODE=service`.

## Observability

- Every service endpoint emits `correlationId`, `mode`, and `durationMs` logs.
- Catalog logs include `page` and `categorySlug` to diagnose query hotspots.

## Notes

- Supabase service-role key remains server-side only.
- Frontend shop reads now flow through `/api/shop/*` endpoints.
