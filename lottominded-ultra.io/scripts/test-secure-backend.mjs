import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const migration = read("supabase/migrations/20260805_secure_account_ledger.sql");
const authorityMigration = read("supabase/migrations/20260805202103_secure_plan_catalog_and_entitlement_authority.sql");
const triviaMigration = read("supabase/migrations/20260809141838_secure_trivia_rewards.sql");
const triviaLockMigration = read("supabase/migrations/20260809173935_lock_trivia_tables.sql");
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

// The deployed account service keeps the established production wallet and
// membership tables until a separately planned data migration can move users.
assert.match(api, /from\("wallets"\)/);
assert.match(api, /from\("memberships"\)/);
assert.match(api, /from\("credit_transactions"\)/);
assert.match(api, /from\("collector_redemptions"\)/);
assert.doesNotMatch(api, /from\("credit_ledger"\)/);
assert.doesNotMatch(api, /from\("subscriptions"\)/);
assert.doesNotMatch(api, /from\("entitlements"\)/);
assert.match(api, /currentPlan:/);
assert.doesNotMatch(api, /rpc\("has_active_entitlement"/);
assert.doesNotMatch(api, /rpc\("redeem_collector_code"/);
assert.match(api, /REDEMPTION_NOT_OPEN/);
assert.match(api, /REWARD_VERIFICATION_REQUIRED/);
assert.match(api, /auth\.getUser\(token\)/);

for (const table of ["trivia_sessions", "trivia_answers", "trivia_reward_claims"]) {
  assert.match(triviaMigration, new RegExp(`create table if not exists public\\.${table}\\b`, "i"), `${table} table is missing`);
  assert.match(triviaMigration, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} RLS is missing`);
  assert.match(triviaMigration, new RegExp(`revoke all on public\\.${table} from anon, authenticated`, "i"), `${table} client access is not revoked`);
  assert.match(triviaLockMigration, new RegExp(`create policy ${table}_service_only[\\s\\S]+using \\(false\\)[\\s\\S]+with check \\(false\\)`, "i"), `${table} deny policy is missing`);
}
assert.match(triviaMigration, /grant execute on function public\.record_trivia_answer[\s\S]+to service_role/i);
assert.match(triviaMigration, /grant execute on function public\.award_trivia_credits[\s\S]+to service_role/i);
assert.match(triviaMigration, /unique \(user_id, challenge_id\)/i);
assert.match(api, /path === "\/trivia\/sessions"/);
assert.match(api, /record_trivia_answer/);
assert.match(api, /award_trivia_credits/);
assert.match(api, /hasClientRewardField\(input\)/);

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

console.log(`Secure backend contract passed: production wallet compatibility, ${tables.length} candidate RLS tables, server-authoritative trivia, and signed Stripe webhook.`);
