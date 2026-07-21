import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import Stripe from "npm:stripe@18.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const PRODUCTION_SITE_URL = "https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io";
const LOOKUP_KEY_PATTERN = /^[a-z0-9_]{1,80}$/;

const allowedOrigins = new Set([
  "http://127.0.0.1:8142",
  "http://localhost:8142",
  "https://robjasper2084.github.io",
]);

for (const value of (Deno.env.get("ALLOWED_ORIGINS") || "").split(",")) {
  const origin = value.trim().replace(/\/$/, "");
  if (/^https?:\/\/[^/]+$/i.test(origin)) allowedOrigins.add(origin);
}

const creditCosts: Record<string, number> = {
  dream_oracle: 1,
  number_radar: 1,
  ticket_scan: 2,
  studio_render: 3,
  beat2lotto_session: 1,
};

type JsonObject = Record<string, unknown>;

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-requested-with",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req: Request, responseBody: unknown, status = 200) {
  return new Response(JSON.stringify(responseBody), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function fail(req: Request, status: number, code: string, message: string) {
  return json(req, { error: { code, message } }, status);
}

async function readJson(req: Request): Promise<JsonObject | Response> {
  if (!req.body) return {};
  try {
    const value = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return fail(req, 400, "INVALID_JSON_BODY", "Send a JSON object as the request body.");
    }
    return value as JsonObject;
  } catch {
    return fail(req, 400, "INVALID_JSON_BODY", "The request body is not valid JSON.");
  }
}

function bearer(req: Request) {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

function admin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anon(accessToken = "") {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function currentUser(req: Request) {
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await anon(token).auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function authenticatedUser(req: Request) {
  const user = await currentUser(req);
  return user || fail(req, 401, "AUTH_REQUIRED", "Sign in is required.");
}

async function snapshot(user: { id: string; email?: string | null } | null) {
  if (!user) {
    return {
      authenticated: false,
      user: null,
      wallet: { balance: 0 },
      memberships: [],
      collector: { redeemed: false, complimentaryUntil: null },
    };
  }

  const db = admin();
  const [profileResult, walletResult, membershipsResult, collectorResult] = await Promise.all([
    db.from("profiles").select("display_name,stripe_customer_id").eq("user_id", user.id).maybeSingle(),
    db.from("wallets").select("balance,updated_at").eq("user_id", user.id).maybeSingle(),
    db.from("memberships").select("plan_code,status,current_period_end,stripe_price_id").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("collector_redemptions").select("redeemed_at,complimentary_until").eq("user_id", user.id).order("redeemed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email || null,
      displayName: profileResult.data?.display_name || "LottoMind Member",
    },
    wallet: {
      balance: Number(walletResult.data?.balance || 0),
      updatedAt: walletResult.data?.updated_at || null,
    },
    memberships: (membershipsResult.data || []).map((entry) => ({
      planCode: entry.plan_code,
      status: entry.status,
      currentPeriodEnd: entry.current_period_end,
      stripePriceId: entry.stripe_price_id,
    })),
    collector: {
      redeemed: Boolean(collectorResult.data),
      redeemedAt: collectorResult.data?.redeemed_at || null,
      complimentaryUntil: collectorResult.data?.complimentary_until || null,
    },
  };
}

function safeReturnUrl(req: Request) {
  const configured = (Deno.env.get("PUBLIC_SITE_URL") || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const origin = req.headers.get("origin") || "";
  try {
    const referrer = new URL(req.headers.get("referer") || "");
    if (allowedOrigins.has(referrer.origin)) {
      if (referrer.hostname === "robjasper2084.github.io") return PRODUCTION_SITE_URL;
      return referrer.origin;
    }
  } catch {
    // Use the validated origin or production fallback below.
  }
  if (allowedOrigins.has(origin) && origin !== "https://robjasper2084.github.io") return origin;
  return PRODUCTION_SITE_URL;
}

function stripeMode() {
  if (STRIPE_SECRET_KEY.startsWith("sk_test_")) return "test";
  if (STRIPE_SECRET_KEY.startsWith("sk_live_")) return "live";
  return "disabled";
}

function validStripeUrl(value: unknown, expectedHost: string) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === expectedHost ? url.href : "";
  } catch {
    return "";
  }
}

async function billingConfig(req: Request) {
  const { data, error } = await admin().from("plan_catalog")
    .select("lookup_key,plan_code,price_type,amount_cents,currency,available,stripe_price_id")
    .order("amount_cents", { ascending: true });
  if (error) throw error;
  const mode = stripeMode();
  const enabled = Boolean(mode !== "disabled" && data?.some((plan) => plan.available && plan.stripe_price_id));
  return json(req, {
    enabled,
    mode,
    message: enabled ? "Secure Stripe checkout is ready." : "Secure checkout is temporarily unavailable. No payment can be submitted.",
    plans: (data || []).map((plan) => ({
      lookupKey: plan.lookup_key,
      planCode: plan.plan_code,
      priceType: plan.price_type,
      amountCents: plan.amount_cents,
      currency: plan.currency,
      available: Boolean(enabled && plan.available && plan.stripe_price_id),
    })),
  });
}

async function checkout(req: Request) {
  const auth = await authenticatedUser(req);
  if (auth instanceof Response) return auth;
  if (stripeMode() === "disabled") {
    return fail(req, 503, "STRIPE_NOT_CONFIGURED", "Stripe checkout is staged but its server secret is not configured.");
  }
  const input = await readJson(req);
  if (input instanceof Response) return input;
  const lookupKey = typeof input.lookupKey === "string" ? input.lookupKey.trim() : "";
  if (!LOOKUP_KEY_PATTERN.test(lookupKey)) {
    return fail(req, 400, "INVALID_LOOKUP_KEY", "Choose a valid membership plan before checkout.");
  }

  const db = admin();
  const { data: plan, error } = await db.from("plan_catalog").select("*").eq("lookup_key", lookupKey).eq("available", true).maybeSingle();
  if (error) throw error;
  if (!plan?.stripe_price_id) return fail(req, 404, "PLAN_UNAVAILABLE", "That plan is not available.");

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const { data: profile, error: profileError } = await db.from("profiles").select("stripe_customer_id").eq("user_id", auth.id).maybeSingle();
  if (profileError) throw profileError;
  let customerId = profile?.stripe_customer_id || "";
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: auth.email || undefined,
      metadata: { supabase_user_id: auth.id },
    });
    customerId = customer.id;
    const { error: updateError } = await db.from("profiles")
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq("user_id", auth.id);
    if (updateError) throw updateError;
  }

  const root = safeReturnUrl(req);
  const page = `${root}/memberships.html`;
  const params: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: plan.price_type === "recurring" ? "subscription" : "payment",
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    client_reference_id: auth.id,
    metadata: { user_id: auth.id, lookup_key: lookupKey },
    success_url: `${page}?checkout=success#membership-plans`,
    cancel_url: `${page}?checkout=cancelled#membership-plans`,
    allow_promotion_codes: true,
  };
  if (plan.price_type === "recurring") {
    params.subscription_data = { metadata: { user_id: auth.id, lookup_key: lookupKey } };
  }
  if (lookupKey === "guardian_bundle_once") {
    params.shipping_address_collection = { allowed_countries: ["US", "CA"] };
  }

  const session = await stripe.checkout.sessions.create(params);
  const url = validStripeUrl(session.url, "checkout.stripe.com");
  if (!url) return fail(req, 502, "INVALID_STRIPE_RESPONSE", "Stripe did not return a valid checkout link. No checkout was opened.");
  return json(req, { url });
}

async function portal(req: Request) {
  const auth = await authenticatedUser(req);
  if (auth instanceof Response) return auth;
  if (stripeMode() === "disabled") return fail(req, 503, "STRIPE_NOT_CONFIGURED", "Stripe billing is not configured.");
  const { data: profile, error } = await admin().from("profiles").select("stripe_customer_id").eq("user_id", auth.id).maybeSingle();
  if (error) throw error;
  if (!profile?.stripe_customer_id) return fail(req, 404, "NO_BILLING_ACCOUNT", "No Stripe billing account exists for this member yet.");
  const root = safeReturnUrl(req);
  const page = `${root}/memberships.html`;
  const session = await new Stripe(STRIPE_SECRET_KEY).billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${page}#membership-plans`,
  });
  const url = validStripeUrl(session.url, "billing.stripe.com");
  if (!url) return fail(req, 502, "INVALID_STRIPE_RESPONSE", "Stripe did not return a valid billing portal link.");
  return json(req, { url });
}

async function route(req: Request) {
  const path = new URL(req.url).pathname.replace(/^\/lottomind-api/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });

  if (req.method === "POST" && path === "/auth/register") {
    const input = await readJson(req);
    if (input instanceof Response) return input;
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    const displayName = String(input.displayName || input.display_name || "").trim().slice(0, 80);
    if (!email || password.length < 8) return fail(req, 400, "INVALID_REGISTRATION", "Enter a valid email and a password of at least 8 characters.");
    const { data, error } = await anon().auth.signUp({ email, password, options: { data: { display_name: displayName } } });
    if (error) return fail(req, 400, "REGISTRATION_FAILED", error.message);
    return json(req, {
      session: data.session,
      snapshot: await snapshot(data.session ? data.user : null),
      verificationRequired: !data.session,
    }, 201);
  }

  if (req.method === "POST" && path === "/auth/login") {
    const input = await readJson(req);
    if (input instanceof Response) return input;
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    if (!email || !password) return fail(req, 400, "INVALID_LOGIN_REQUEST", "Enter both email and password.");
    const { data, error } = await anon().auth.signInWithPassword({ email, password });
    if (error) return fail(req, 401, "LOGIN_FAILED", "The email or password was not accepted.");
    return json(req, { session: data.session, snapshot: await snapshot(data.user) });
  }

  if (req.method === "POST" && path === "/auth/logout") {
    const token = bearer(req);
    if (token) await anon(token).auth.signOut({ scope: "local" });
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method === "GET" && path === "/account/snapshot") return json(req, await snapshot(await currentUser(req)));
  if (req.method === "GET" && path === "/billing/config") return billingConfig(req);
  if (req.method === "POST" && path === "/billing/checkout") return checkout(req);
  if (req.method === "POST" && path === "/billing/portal") return portal(req);

  if (req.method === "POST" && path === "/analytics") {
    const user = await currentUser(req);
    const input = await readJson(req);
    if (input instanceof Response) return input;
    const event = typeof input.event === "string" ? input.event.trim().slice(0, 120) : "";
    if (user && event) await admin().from("analytics_events").insert({ user_id: user.id, event_name: event, metadata: input.metadata || {} });
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method === "POST" && path === "/credits/spend") {
    const auth = await authenticatedUser(req);
    if (auth instanceof Response) return auth;
    const input = await readJson(req);
    if (input instanceof Response) return input;
    const action = String(input.action || "");
    const amount = creditCosts[action];
    if (!amount) return fail(req, 400, "UNKNOWN_CREDIT_ACTION", "That credit action is not configured.");
    const { data, error } = await admin().rpc("spend_credits", {
      p_user_id: auth.id,
      p_amount: amount,
      p_reason: action,
      p_idempotency_key: String(input.idempotencyKey || ""),
      p_metadata: input.context || {},
    });
    if (error) return fail(req, /insufficient/i.test(error.message) ? 409 : 400, "CREDIT_SPEND_FAILED", error.message);
    return json(req, data);
  }

  if (req.method === "POST" && path === "/credits/refund") {
    const auth = await authenticatedUser(req);
    if (auth instanceof Response) return auth;
    const input = await readJson(req);
    if (input instanceof Response) return input;
    const transactionId = String(input.transactionId || "").trim();
    if (!transactionId) return fail(req, 400, "INVALID_TRANSACTION", "Choose a valid credit transaction to refund.");
    const { data, error } = await admin().rpc("refund_credits", {
      p_user_id: auth.id,
      p_transaction_id: transactionId,
      p_idempotency_key: String(input.idempotencyKey || ""),
    });
    if (error) return fail(req, 400, "CREDIT_REFUND_FAILED", error.message);
    return json(req, data);
  }

  if (req.method === "POST" && path === "/redemption/claim") {
    const auth = await authenticatedUser(req);
    if (auth instanceof Response) return auth;
    return fail(req, 503, "REDEMPTION_NOT_OPEN", "Collector code redemption is secured and will open when production codes are loaded.");
  }

  if (req.method === "GET" && path === "/entitlements/beat2lotto") {
    const auth = await authenticatedUser(req);
    if (auth instanceof Response) return auth;
    const state = await snapshot(auth);
    const active = state.memberships.some((entry: { status: string; planCode: string }) => entry.status === "active" && ["gold", "ultra", "vault", "guardian_bundle"].includes(entry.planCode));
    return json(req, {
      entitled: active,
      tier: active ? state.memberships.find((entry: { status: string }) => entry.status === "active")?.planCode : "free",
    });
  }

  return fail(req, 404, "NOT_FOUND", "That LottoMind service route does not exist.");
}

Deno.serve(async (req) => {
  try {
    return await route(req);
  } catch (error) {
    console.error(error);
    return fail(req, 500, "INTERNAL_ERROR", "The LottoMind service encountered an error. Try again shortly.");
  }
});
