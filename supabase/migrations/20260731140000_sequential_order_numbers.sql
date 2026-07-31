-- Shared sequential order numbers: #BI-00000001, #BI-00000002, ...
-- Used by patient portal and admin portal (same Supabase DB).

create sequence if not exists public.order_number_seq start 1;

create or replace function public.generate_order_number()
returns text
language sql
volatile
as $$
  select '#BI-' || lpad(nextval('public.order_number_seq')::text, 8, '0');
$$;

alter table public.payments
  add column if not exists order_number text;

alter table public.medication_requests
  add column if not exists order_number text;

alter table public.shop_checkout_orders
  add column if not exists order_number text;

-- Backfill medication_requests first (canonical clinical order).
with numbered as (
  select id, row_number() over (order by created_at asc, id asc) as n
  from public.medication_requests
  where order_number is null
)
update public.medication_requests mr
set order_number = '#BI-' || lpad(numbered.n::text, 8, '0')
from numbered
where mr.id = numbered.id;

-- Sync linked payments from their medication_request.
update public.payments p
set order_number = mr.order_number
from public.medication_requests mr
where mr.payment_id = p.id
  and p.order_number is null
  and mr.order_number is not null;

-- Sync shop orders from payments via stripe_subscription_id.
update public.shop_checkout_orders sco
set order_number = p.order_number
from public.payments p
where p.stripe_subscription_id is not null
  and sco.stripe_subscription_id = p.stripe_subscription_id
  and sco.order_number is null
  and p.order_number is not null;

-- Remaining orphan payments (no medication_request yet / additional).
with numbered as (
  select id,
    (
      select coalesce(max(substring(order_number from 5)::bigint), 0)
      from (
        select order_number from public.medication_requests where order_number is not null
        union all
        select order_number from public.payments where order_number is not null
        union all
        select order_number from public.shop_checkout_orders where order_number is not null
      ) all_nums
    ) + row_number() over (order by created_at asc, id asc) as n
  from public.payments
  where order_number is null
)
update public.payments p
set order_number = '#BI-' || lpad(numbered.n::text, 8, '0')
from numbered
where p.id = numbered.id;

-- Remaining orphan shop orders.
with numbered as (
  select id,
    (
      select coalesce(max(substring(order_number from 5)::bigint), 0)
      from (
        select order_number from public.medication_requests where order_number is not null
        union all
        select order_number from public.payments where order_number is not null
        union all
        select order_number from public.shop_checkout_orders where order_number is not null
      ) all_nums
    ) + row_number() over (order by created_at asc, id asc) as n
  from public.shop_checkout_orders
  where order_number is null
)
update public.shop_checkout_orders sco
set order_number = '#BI-' || lpad(numbered.n::text, 8, '0')
from numbered
where sco.id = numbered.id;

-- Advance sequence past the highest assigned number.
select setval(
  'public.order_number_seq',
  greatest(
    1,
    coalesce(
      (
        select max(substring(order_number from 5)::bigint)
        from (
          select order_number from public.medication_requests where order_number is not null
          union all
          select order_number from public.payments where order_number is not null
          union all
          select order_number from public.shop_checkout_orders where order_number is not null
        ) all_nums
      ),
      1
    )
  ),
  true
);

create unique index if not exists payments_order_number_uidx
  on public.payments (order_number)
  where order_number is not null;

create unique index if not exists medication_requests_order_number_uidx
  on public.medication_requests (order_number)
  where order_number is not null;

create unique index if not exists shop_checkout_orders_order_number_uidx
  on public.shop_checkout_orders (order_number)
  where order_number is not null;

alter table public.payments
  alter column order_number set default public.generate_order_number();

alter table public.medication_requests
  alter column order_number set default public.generate_order_number();

alter table public.shop_checkout_orders
  alter column order_number set default public.generate_order_number();

-- Assign / share order_number when a payment creates a medication request.
create or replace function public.create_medication_order_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub              record;
  v_med              record;
  v_state            text;
  v_state_provider   uuid;
  v_default_provider uuid;
  v_provider         uuid;
  v_variant          uuid;
  v_kind             text;
  v_needs            boolean;
  v_status           text;
  v_req_id           uuid;
  v_order_number     text;
begin
  if NEW.status is distinct from 'succeeded' or NEW.stripe_subscription_id is null then
    return NEW;
  end if;

  if NEW.stripe_invoice_id is not null and exists (
    select 1 from public.medication_requests where stripe_invoice_id = NEW.stripe_invoice_id
  ) then
    return NEW;
  end if;

  select id, user_id, session_id, package_id, medicine_id
    into v_sub
    from public.subscriptions
    where stripe_subscription_id = NEW.stripe_subscription_id
    order by created_at desc
    limit 1;
  if v_sub.id is null or v_sub.medicine_id is null then
    return NEW;
  end if;

  select name, requires_consultation, requires_followup
    into v_med
    from public.medicines
    where id = v_sub.medicine_id;
  if not found then
    return NEW;
  end if;

  if exists (select 1 from public.medication_requests where subscription_id = v_sub.id) then
    v_kind := 'followup';
    v_needs := coalesce(v_med.requires_followup, false);
  else
    v_kind := 'initial';
    v_needs := coalesce(v_med.requires_consultation, false);
  end if;
  v_status := case when v_needs then 'pending_review' else 'approved' end;

  if v_sub.user_id is not null then
    select state_code into v_state from public.profiles where id = v_sub.user_id;
  end if;
  if v_state is null and v_sub.session_id is not null then
    select state_code into v_state from public.intake_sessions where id = v_sub.session_id;
  end if;

  if v_state is not null then
    select pr.id into v_state_provider
      from public.providers pr
      where pr.is_active
        and upper(v_state) = any (select upper(x) from unnest(pr.license_states) x)
      limit 1;
  end if;

  select id into v_default_provider from public.providers where is_default and is_active limit 1;

  if not v_needs then
    v_provider := v_default_provider;
  elsif v_state_provider is not null then
    v_provider := null;
  else
    v_provider := v_default_provider;
  end if;

  if v_sub.package_id is not null then
    select variant_id into v_variant from public.packages where id = v_sub.package_id;
  end if;

  -- Prefer shop order number (assigned at create), then payment, else generate once.
  select sco.order_number into v_order_number
    from public.shop_checkout_orders sco
    where sco.stripe_subscription_id = NEW.stripe_subscription_id
      and sco.order_number is not null
    order by sco.created_at desc
    limit 1;

  v_order_number := coalesce(v_order_number, NEW.order_number, public.generate_order_number());

  if NEW.order_number is distinct from v_order_number then
    update public.payments
      set order_number = v_order_number
      where id = NEW.id;
  end if;

  update public.shop_checkout_orders
    set order_number = v_order_number
    where stripe_subscription_id = NEW.stripe_subscription_id
      and (order_number is null or order_number is distinct from v_order_number);

  insert into public.medication_requests
    (user_id, session_id, subscription_id, payment_id, stripe_invoice_id,
     medicine_id, variant_id, package_id, provider_id, kind, status, requires_consultation,
     order_number)
  values
    (v_sub.user_id, v_sub.session_id, v_sub.id, NEW.id, NEW.stripe_invoice_id,
     v_sub.medicine_id, v_variant, v_sub.package_id, v_provider, v_kind, v_status, v_needs,
     v_order_number)
  on conflict (stripe_invoice_id) where stripe_invoice_id is not null do nothing
  returning id into v_req_id;

  if v_req_id is null then
    return NEW;
  end if;

  insert into public.medication_request_events (request_id, status, actor_role)
    values (v_req_id, 'payment_completed', 'system');
  if v_provider is not null then
    insert into public.medication_request_events (request_id, status, actor_role)
      values (v_req_id, 'provider_assigned', 'system');
  end if;
  insert into public.medication_request_events (request_id, status, actor_role)
    values (v_req_id, v_status, 'system');

  if v_status = 'approved' then
    insert into public.prescriptions
      (request_id, user_id, provider_id, medicine_id, variant_id, package_id, medicine_name, status)
    values
      (v_req_id, v_sub.user_id, v_provider, v_sub.medicine_id, v_variant, v_sub.package_id, v_med.name, 'generated');
    update public.medication_requests set status = 'prescribed', updated_at = now() where id = v_req_id;
    insert into public.medication_request_events (request_id, status, actor_role)
      values (v_req_id, 'prescribed', 'system');
  end if;

  return NEW;
exception when others then
  raise warning 'create_medication_order_on_payment failed: %', sqlerrm;
  return NEW;
end;
$$;
