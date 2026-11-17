-- Shop purchases do not include an intake session. Onboarding does, because the
-- questionnaire is finished before payment. A shop order that still needs a
-- consultation stays at payment_completed until that purchase's intake form is
-- submitted, then the app opens it for provider claim.
-- Follow-ups and orders that do not need a consultation are unchanged.

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
  v_await_intake     boolean;
begin
  if NEW.status is distinct from 'succeeded' or NEW.stripe_subscription_id is null then
    return NEW;
  end if;

  if NEW.stripe_invoice_id is null then
    return NEW;
  end if;

  if exists (
    select 1 from public.medication_requests where stripe_invoice_id = NEW.stripe_invoice_id
  ) then
    return NEW;
  end if;

  select id, user_id, session_id, package_id, medicine_id, checkout_group_id
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

  v_await_intake := false;
  if v_kind = 'initial' and v_needs and v_sub.session_id is null then
    if exists (
      select 1
      from public.shop_checkout_orders sco
      where sco.stripe_subscription_id = NEW.stripe_subscription_id
    ) then
      v_await_intake := true;
    elsif v_sub.checkout_group_id is not null then
      if exists (
        select 1
        from public.subscriptions p
        join public.shop_checkout_orders sco
          on sco.stripe_subscription_id = p.stripe_subscription_id
        where p.id = v_sub.checkout_group_id
          and p.session_id is null
      ) then
        v_await_intake := true;
      end if;
    end if;
  end if;

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

  if v_await_intake then
    v_status := 'payment_completed';
    v_provider := null;
  end if;

  if v_sub.package_id is not null then
    select variant_id into v_variant from public.packages where id = v_sub.package_id;
  end if;

  insert into public.medication_requests
    (user_id, session_id, subscription_id, payment_id, stripe_invoice_id,
     medicine_id, variant_id, package_id, provider_id, kind, status, requires_consultation)
  values
    (v_sub.user_id, v_sub.session_id, v_sub.id, NEW.id, NEW.stripe_invoice_id,
     v_sub.medicine_id, v_variant, v_sub.package_id, v_provider, v_kind, v_status, v_needs)
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
  if v_status is distinct from 'payment_completed' then
    insert into public.medication_request_events (request_id, status, actor_role)
      values (v_req_id, v_status, 'system');
  end if;

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

-- Pull shop consultation orders that nobody has acted on back out of the claim
-- queue until this purchase's intake form is submitted. A provider or admin
-- event means the case is already in progress and is left as-is.
with shop_primary as (
  select s.id
  from public.subscriptions s
  join public.shop_checkout_orders sco
    on sco.stripe_subscription_id = s.stripe_subscription_id
),
shop_family as (
  select id from shop_primary
  union
  select sib.id
  from shop_primary sp
  join public.subscriptions sib on sib.checkout_group_id = sp.id
),
awaiting as (
  select f.id
  from shop_family f
  join public.subscriptions s on s.id = f.id
  where not exists (
    select 1
    from public.patient_consultations pc
    where pc.subscription_id = case
        when s.is_checkout_primary then s.id
        else coalesce(s.checkout_group_id, s.id)
      end
      and (
        pc.form_submitted is true
        or nullif(btrim(pc.form_submission_id), '') is not null
      )
  )
)
update public.medication_requests mr
set
  status = 'payment_completed',
  provider_id = null,
  session_id = null,
  updated_at = now()
from awaiting a
where mr.subscription_id = a.id
  and mr.kind = 'initial'
  and mr.requires_consultation
  and mr.decision_at is null
  and mr.status in ('pending_review', 'payment_completed')
  and not exists (
    select 1
    from public.medication_request_events e
    where e.request_id = mr.id
      and e.actor_role is distinct from 'system'
  );

with shop_primary as (
  select s.id
  from public.subscriptions s
  join public.shop_checkout_orders sco
    on sco.stripe_subscription_id = s.stripe_subscription_id
),
shop_family as (
  select id from shop_primary
  union
  select sib.id
  from shop_primary sp
  join public.subscriptions sib on sib.checkout_group_id = sp.id
),
awaiting as (
  select f.id
  from shop_family f
  join public.subscriptions s on s.id = f.id
  where not exists (
    select 1
    from public.patient_consultations pc
    where pc.subscription_id = case
        when s.is_checkout_primary then s.id
        else coalesce(s.checkout_group_id, s.id)
      end
      and (
        pc.form_submitted is true
        or nullif(btrim(pc.form_submission_id), '') is not null
      )
  )
)
update public.subscriptions s
set session_id = null
from awaiting a
where s.id = a.id
  and s.session_id is not null
  and exists (
    select 1
    from public.medication_requests mr
    where mr.subscription_id = s.id
      and mr.kind = 'initial'
      and mr.requires_consultation
      and mr.provider_id is null
      and mr.decision_at is null
      and mr.status = 'payment_completed'
      and not exists (
        select 1
        from public.medication_request_events e
        where e.request_id = mr.id
          and e.actor_role is distinct from 'system'
      )
  );
