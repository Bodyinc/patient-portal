-- Atomic promo redemption counter. Replaces a read-then-write in application code that could
-- lose concurrent increments (two redemptions reading the same count and both writing +1),
-- letting a capped code over-redeem. A single UPDATE ... = col + 1 is atomic per row.

create or replace function public.increment_promo_redemption(p_promo_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update promo_codes
  set times_redeemed = coalesce(times_redeemed, 0) + 1
  where id = p_promo_id
  returning times_redeemed;
$$;

grant execute on function public.increment_promo_redemption(uuid) to service_role;
