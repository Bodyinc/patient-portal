// Standalone: runs the same order-creation logic as the webhook, directly against the DB, for
// every subscription that has a medicine but no order yet. Proves the logic + unblocks testing.
//   Run from the patient-portal folder:  node scripts/backfill-orders.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(f, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env(.local)");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function patientState(sub) {
  if (sub.user_id) {
    const { data } = await db.from("profiles").select("state_code").eq("id", sub.user_id).maybeSingle();
    if (data?.state_code) return data.state_code;
  }
  if (sub.session_id) {
    const { data } = await db.from("intake_sessions").select("state_code").eq("id", sub.session_id).maybeSingle();
    if (data?.state_code) return data.state_code;
  }
  return null;
}

async function assignProvider(state) {
  if (!state) return null;
  const { data } = await db.from("providers").select("id").eq("is_active", true).contains("license_states", [state.toUpperCase()]);
  return data && data.length ? data[0].id : null;
}

const { data: subs, error: subErr } = await db
  .from("subscriptions")
  .select("id, user_id, session_id, package_id, medicine_id, stripe_subscription_id, created_at")
  .not("medicine_id", "is", null)
  .order("created_at", { ascending: false });
if (subErr) {
  console.error("subscriptions query failed:", subErr);
  process.exit(1);
}
console.log(`Found ${subs.length} subscriptions with a medicine.`);

let created = 0;
for (const sub of subs) {
  const { data: existing } = await db.from("medication_requests").select("id").eq("subscription_id", sub.id).limit(1);
  if (existing && existing.length) {
    console.log(`- sub ${sub.id} already has an order, skipping`);
    continue;
  }

  const { data: medicine } = await db
    .from("medicines")
    .select("name, requires_consultation, requires_followup")
    .eq("id", sub.medicine_id)
    .maybeSingle();
  if (!medicine) {
    console.log(`- sub ${sub.id} medicine ${sub.medicine_id} NOT FOUND, skipping`);
    continue;
  }

  let variantId = null;
  if (sub.package_id) {
    const { data: pkg } = await db.from("packages").select("variant_id").eq("id", sub.package_id).maybeSingle();
    variantId = pkg?.variant_id ?? null;
  }

  const providerId = await assignProvider(await patientState(sub));
  const status = medicine.requires_consultation ? "pending_review" : "approved";

  const { data: order, error } = await db
    .from("medication_requests")
    .insert({
      user_id: sub.user_id,
      session_id: sub.session_id,
      subscription_id: sub.id,
      medicine_id: sub.medicine_id,
      variant_id: variantId,
      package_id: sub.package_id,
      provider_id: providerId,
      kind: "initial",
      status,
      requires_consultation: !!medicine.requires_consultation,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`- sub ${sub.id} INSERT FAILED:`, error);
    continue;
  }

  const events = [{ status: "payment_completed" }];
  if (providerId) events.push({ status: "provider_assigned" });
  events.push({ status });
  await db.from("medication_request_events").insert(
    events.map((e) => ({ request_id: order.id, status: e.status, actor_role: "system" })),
  );

  created++;
  console.log(`+ CREATED order ${order.id} for sub ${sub.id} status=${status} provider=${providerId ?? "none"}`);
}

console.log(`\nDone. Created ${created} order(s).`);
