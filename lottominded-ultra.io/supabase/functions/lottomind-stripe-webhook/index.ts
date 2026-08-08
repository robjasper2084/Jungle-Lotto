import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import Stripe from "npm:stripe@18.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

const entitlementCatalog: Record<string, string[]> = {
  gold: ["beat2lotto", "dream_oracle", "number_radar", "saved_wallet", "history_vault", "arcade_complete"],
  ultra: ["beat2lotto", "dream_oracle", "number_radar", "saved_wallet", "history_vault", "arcade_complete", "premium_vault", "studio_exports", "advanced_reports", "monthly_digital_pack"],
  guardian_bundle: ["guardian_bundle", "beat2lotto", "dream_oracle", "number_radar", "saved_wallet", "history_vault", "arcade_complete", "premium_vault", "studio_exports", "advanced_reports"],
};

const recurringCredits: Record<string, number> = { gold: 250, ultra: 750 };
const oneTimeCredits: Record<string, number> = { guardian_bundle: 150 };

function admin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function stripeStatus(value: unknown) {
  const status = String(value || "incomplete");
  if (["trialing", "active", "past_due", "paused", "canceled", "incomplete"].includes(status)) return status;
  return "incomplete";
}

function unixTime(value: unknown) {
  const timestamp = Number(value || 0);
  return timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null;
}

function addUtcMonths(months: number) {
  const date = new Date();
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString();
}

async function userIdForCustomer(db: ReturnType<typeof admin>, customerId: string) {
  if (!customerId) return "";
  const { data, error } = await db.from("profiles").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  if (error) throw error;
  return data?.user_id || "";
}

async function planFor(db: ReturnType<typeof admin>, lookupKey: string, priceId = "") {
  let query = db.from("plan_catalog").select("lookup_key,plan_code,stripe_price_id");
  query = lookupKey ? query.eq("lookup_key", lookupKey) : query.eq("stripe_price_id", priceId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

async function syncEntitlements(
  db: ReturnType<typeof admin>,
  userId: string,
  planCode: string,
  sourceType: "subscription" | "order",
  sourceId: string,
  active: boolean,
  endsAt: string | null,
) {
  const codes = entitlementCatalog[planCode] || [];
  for (const entitlementCode of codes) {
    const { error } = await db.from("entitlements").upsert({
      user_id: userId,
      entitlement_code: entitlementCode,
      active,
      source_type: sourceType,
      source_id: sourceId,
      ends_at: endsAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,entitlement_code,source_type,source_id" });
    if (error) throw error;
  }
}

async function appendCredits(
  db: ReturnType<typeof admin>,
  userId: string,
  amount: number,
  reason: string,
  sourceId: string,
  idempotencyKey: string,
) {
  if (!amount) return;
  const { error } = await db.from("credit_ledger").insert({
    user_id: userId,
    amount_delta: amount,
    reason,
    source_id: sourceId,
    idempotency_key: idempotencyKey,
  });
  if (error && error.code !== "23505") throw error;
}

async function handleCheckoutCompleted(db: ReturnType<typeof admin>, event: Stripe.Event) {
  const session = event.data.object as Record<string, any>;
  const userId = String(session.metadata?.user_id || session.client_reference_id || "");
  const lookupKey = String(session.metadata?.lookup_key || "");
  if (!userId || !lookupKey) throw new Error("Checkout session is missing LottoMind account metadata.");
  const plan = await planFor(db, lookupKey);
  if (!plan) throw new Error(`Unknown checkout plan: ${lookupKey}`);

  const orderStatus = session.payment_status === "paid" ? "paid" : "open";
  const { error: orderError } = await db.from("orders").upsert({
    user_id: userId,
    provider: "stripe",
    provider_order_id: session.id,
    payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    plan_code: plan.plan_code,
    status: orderStatus,
    amount_total: session.amount_total,
    currency: session.currency,
    metadata: { lookupKey, stripeEventId: event.id },
    updated_at: new Date().toISOString(),
  }, { onConflict: "provider_order_id" });
  if (orderError) throw orderError;

  if (session.mode === "payment" && session.payment_status === "paid") {
    const endsAt = plan.plan_code === "guardian_bundle"
      ? addUtcMonths(3)
      : null;
    await syncEntitlements(db, userId, plan.plan_code, "order", session.id, true, endsAt);
    await appendCredits(db, userId, oneTimeCredits[plan.plan_code] || 0, "order_credit_grant", session.id, `stripe:${event.id}:credits`);
  }
}

async function handleSubscription(db: ReturnType<typeof admin>, event: Stripe.Event) {
  const subscription = event.data.object as Record<string, any>;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || "";
  const userId = String(subscription.metadata?.user_id || await userIdForCustomer(db, customerId));
  const lookupKey = String(subscription.metadata?.lookup_key || "");
  const priceId = String(subscription.items?.data?.[0]?.price?.id || "");
  if (!userId) throw new Error("Stripe subscription is not linked to a LottoMind account.");
  const plan = await planFor(db, lookupKey, priceId);
  if (!plan) throw new Error("Stripe subscription price is not in the LottoMind plan catalog.");
  const status = event.type === "customer.subscription.deleted" ? "canceled" : stripeStatus(subscription.status);
  const active = ["active", "trialing"].includes(status);
  const period = subscription.items?.data?.[0];
  const startsAt = unixTime(subscription.current_period_start || period?.current_period_start);
  const endsAt = unixTime(subscription.current_period_end || period?.current_period_end);
  const eventCreatedAt = unixTime(event.created);

  const { data: existing, error: existingError } = await db
    .from("subscriptions")
    .select("provider_event_created_at")
    .eq("provider_subscription_id", subscription.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.provider_event_created_at && eventCreatedAt && existing.provider_event_created_at > eventCreatedAt) return;

  const { error } = await db.from("subscriptions").upsert({
    user_id: userId,
    provider: "stripe",
    provider_customer_id: customerId,
    provider_subscription_id: subscription.id,
    plan_code: plan.plan_code,
    status,
    current_period_start: startsAt,
    current_period_end: endsAt,
    provider_event_created_at: eventCreatedAt,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    metadata: { lookupKey: plan.lookup_key, stripeEventId: event.id },
    updated_at: new Date().toISOString(),
  }, { onConflict: "provider_subscription_id" });
  if (error) throw error;
  await syncEntitlements(db, userId, plan.plan_code, "subscription", subscription.id, active, endsAt);
}

async function handleInvoicePaid(db: ReturnType<typeof admin>, event: Stripe.Event) {
  const invoice = event.data.object as Record<string, any>;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || "";
  const userId = await userIdForCustomer(db, customerId);
  const priceId = String(invoice.lines?.data?.[0]?.price?.id || invoice.lines?.data?.[0]?.pricing?.price_details?.price || "");
  if (!userId || !priceId) throw new Error("Paid invoice is not linked to a LottoMind account plan.");
  const plan = await planFor(db, "", priceId);
  if (!plan) throw new Error("Paid invoice price is not in the LottoMind plan catalog.");
  await appendCredits(db, userId, recurringCredits[plan.plan_code] || 0, "subscription_cycle_credit", invoice.id, `stripe:${event.id}:credits`);
}

async function handleEvent(event: Stripe.Event) {
  const db = admin();
  if (event.type === "checkout.session.completed") return handleCheckoutCompleted(db, event);
  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    return handleSubscription(db, event);
  }
  if (event.type === "invoice.paid") return handleInvoicePaid(db, event);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_SERVICE_ROLE_KEY) {
    return response({ error: "Webhook service is not configured" }, 503);
  }

  const signature = req.headers.get("stripe-signature") || "";
  const rawBody = await req.text();
  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
    await handleEvent(event);
    return response({ received: true });
  } catch (error) {
    console.error(error);
    return response({ error: "Webhook signature or event processing failed" }, 400);
  }
});
