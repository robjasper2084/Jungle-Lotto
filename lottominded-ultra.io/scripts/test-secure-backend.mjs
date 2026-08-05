import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const migration = read("supabase/migrations/20260805_secure_account_ledger.sql");
const authorityMigration = read("supabase/migrations/20260805202103_secure_plan_catalog_and_entitlement_authority.sql");
const api = read("supabase/functions/lottomind-api/index.ts");
const webhook = read("supabase/functions/lottomind-stripe-webhook/index.ts");
const config = read("supabase/config.toml");
const accountService = read("assets/js/lottomind-account-service.js");
const envExample = read("supabase/functions/.env.example");

const tables = [
  "profiles",
  "subscriptions",
  "entitlements",
  "credit_ledger",
  "collector_codes",
  "game_reward_events",
  "orders",
  "downloads",
];

for (const table of tables) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}\\b`, "i"), `${table} table is missing`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} RLS is missing`);
}

for (const field of ["entry_id", "user_id", "amount_delta", "reason", "source_id", "idempotency_key", "created_at"]) {
  assert.match(migration, new RegExp(`\\b${field}\\b`, "i"), `credit ledger field ${field} is missing`);
}

assert.match(migration, /unique \(user_id, idempotency_key\)/i);
assert.match(migration, /before update or delete on public\.credit_ledger/i);
assert.match(migration, /append-only; add a compensating entry instead/i);
assert.doesNotMatch(migration, /policy[\s\S]{0,120}credit_ledger[\s\S]{0,80}for (insert|update|delete)/i);
assert.match(migration, /grant execute on function public\.spend_credits[\s\S]+to service_role/i);
assert.match(migration, /revoke all on function public\.spend_credits[\s\S]+from public, anon, authenticated/i);
assert.match(migration, /pg_advisory_xact_lock/i);
assert.match(authorityMigration, /guardian_bundle_once[\s\S]+2995[\s\S]+false/i);
assert.match(authorityMigration, /gold_monthly[\s\S]+499[\s\S]+false/i);
assert.match(authorityMigration, /ultra_monthly[\s\S]+999[\s\S]+false/i);
assert.match(authorityMigration, /create or replace function public\.has_active_entitlement/i);
assert.match(authorityMigration, /grant execute on function public\.has_active_entitlement\(uuid, text\) to service_role/i);
assert.match(authorityMigration, /alter publication supabase_realtime add table public\.credit_ledger/i);

assert.doesNotMatch(api, /from\("wallets"\)/);
assert.doesNotMatch(api, /from\("memberships"\)/);
assert.match(api, /rpc\("credit_balance_for_user"/);
assert.match(api, /from\("credit_ledger"\)/);
assert.match(api, /from\("subscriptions"\)/);
assert.match(api, /from\("entitlements"\)/);
assert.match(api, /from\("downloads"\)/);
assert.match(api, /currentPlan:/);
assert.match(api, /rpc\("has_active_entitlement"/);
assert.match(api, /rpc\("redeem_collector_code"/);
assert.match(api, /REWARD_VERIFICATION_REQUIRED/);
assert.match(api, /auth\.getUser\(token\)/);

assert.match(webhook, /stripe\.webhooks\.constructEventAsync\(/);
assert.match(webhook, /req\.text\(\)/);
assert.match(webhook, /STRIPE_WEBHOOK_SECRET/);
assert.match(webhook, /checkout\.session\.completed/);
assert.match(webhook, /customer\.subscription\.updated/);
assert.match(webhook, /invoice\.paid/);
assert.match(webhook, /`stripe:\$\{event\.id\}:credits`/);
assert.match(webhook, /addUtcMonths\(3\)/);
assert.match(webhook, /provider_event_created_at/);
assert.match(webhook, /existing\.provider_event_created_at > eventCreatedAt/);
assert.match(config, /\[functions\.lottomind-stripe-webhook\][\s\S]*verify_jwt = false/);

assert.match(accountService, /idempotencyKey: createIdempotencyKey\("collector-redemption"\)/);
assert.match(accountService, /checkEntitlement:/);
assert.match(accountService, /getCurrentPlan:/);
assert.match(accountService, /getDownloads:/);
assert.match(envExample, /^STRIPE_WEBHOOK_SECRET=$/m);
for (const line of envExample.trim().split(/\r?\n/)) assert.match(line, /^[A-Z0-9_]+=$/, `environment example contains a value: ${line}`);

console.log(`Secure backend contract passed: ${tables.length} RLS tables, append-only ledger, authenticated API, and signed Stripe webhook.`);
