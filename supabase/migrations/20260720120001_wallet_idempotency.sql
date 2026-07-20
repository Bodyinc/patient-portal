-- Idempotency for admin wallet adjustments. A double-submit previously created a second Stripe
-- balance transaction AND a duplicate ledger row. The client now sends a stable request_id per
-- submit, used both as the Stripe idempotency key and as a unique ledger key here.

alter table public.wallet_transactions
  add column if not exists idempotency_key text;

create unique index if not exists wallet_transactions_idempotency_key_uidx
  on public.wallet_transactions (idempotency_key)
  where idempotency_key is not null;
