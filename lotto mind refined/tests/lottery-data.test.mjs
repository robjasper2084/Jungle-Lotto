import assert from "node:assert/strict";
import test from "node:test";
import {
  LOTTERY_RULES,
  buildLotterySnapshot,
  loadLotterySnapshot,
  normalizeLotteryRecord,
} from "../services/lottery-data.mjs";

const NOW = Date.parse("2026-08-19T16:00:00.000Z");

function powerballRecord(overrides = {}) {
  return {
    id: "powerball-2026-08-17",
    jurisdiction: "US",
    gameId: "powerball",
    displayName: "Powerball",
    drawDate: "2026-08-17",
    drawTime: "22:59:00",
    displayTimezone: "America/New_York",
    numbers: [4, 17, 23, 52, 68],
    special: 11,
    specialName: "Powerball",
    multiplier: 2,
    jackpot: 120000000,
    currency: "USD",
    sourceName: "Powerball",
    sourceUrl: "https://www.powerball.com/",
    verificationUrl: "https://www.powerball.com/previous-results",
    retrievedAt: "2026-08-19T15:30:00.000Z",
    verificationStatus: "verified",
    dataVersion: "provider-v1",
    gameRuleVersion: LOTTERY_RULES.powerball.version,
    ...overrides,
  };
}

test("normalizes a complete verified record", () => {
  const record = normalizeLotteryRecord(powerballRecord(), { now: NOW });
  assert.equal(record.valid, true);
  assert.equal(record.freshnessStatus, "fresh");
  assert.deepEqual(record.numbers, [4, 17, 23, 52, 68]);
});

test("rejects a record using the wrong rule version", () => {
  const record = normalizeLotteryRecord(powerballRecord({ gameRuleVersion: "legacy" }), { now: NOW });
  assert.equal(record.valid, false);
});

test("rejects duplicate main numbers and invalid special balls", () => {
  assert.equal(normalizeLotteryRecord(powerballRecord({ numbers: [4, 4, 23, 52, 68] }), { now: NOW }).valid, false);
  assert.equal(normalizeLotteryRecord(powerballRecord({ special: 27 }), { now: NOW }).valid, false);
});

test("rejects malformed number arrays and mismatched jurisdictions", () => {
  assert.equal(normalizeLotteryRecord(powerballRecord({ numbers: [4, 17, "bad", 23, 52, 68] }), { now: NOW }).valid, false);
  assert.equal(normalizeLotteryRecord(powerballRecord({ jurisdiction: "NY" }), { now: NOW }).valid, false);
});

test("rejects impossible calendar draw dates", () => {
  assert.equal(normalizeLotteryRecord(powerballRecord({ drawDate: "2026-02-31" }), { now: NOW }).valid, false);
});

test("marks old retrievals stale without relabeling them fresh", () => {
  const snapshot = buildLotterySnapshot({
    records: [powerballRecord({ retrievedAt: "2026-08-19T12:00:00.000Z" })],
  }, { now: NOW });
  assert.equal(snapshot.status, "stale");
  assert.equal(snapshot.records[0].freshnessStatus, "stale");
});

test("marks implausible future retrievals stale", () => {
  const snapshot = buildLotterySnapshot({
    records: [powerballRecord({ retrievedAt: "2026-08-20T16:00:00.000Z" })],
  }, { now: NOW });
  assert.equal(snapshot.status, "stale");
  assert.equal(snapshot.records[0].freshnessStatus, "stale");
});

test("rejects invalid jackpot currency metadata", () => {
  assert.equal(normalizeLotteryRecord(powerballRecord({ currency: "NOTUSD" }), { now: NOW }).valid, false);
  assert.equal(normalizeLotteryRecord(powerballRecord({ jackpot: -1 }), { now: NOW }).valid, false);
});

test("treats an omitted jackpot as unavailable instead of zero", () => {
  const record = normalizeLotteryRecord(powerballRecord({ jackpot: "", currency: "" }), { now: NOW });
  assert.equal(record.valid, true);
  assert.equal(record.jackpot, null);
});

test("returns unavailable when no verified record survives validation", () => {
  const snapshot = buildLotterySnapshot({ records: [powerballRecord({ verificationStatus: "unverified" })] }, { now: NOW });
  assert.equal(snapshot.status, "unavailable");
  assert.deepEqual(snapshot.records, []);
});

test("does not call fetch when a provider is not configured", async () => {
  let called = false;
  const snapshot = await loadLotterySnapshot({
    fetchImpl: async () => { called = true; },
    now: NOW,
  });
  assert.equal(called, false);
  assert.equal(snapshot.status, "unavailable");
});

test("rejects an unapproved provider origin", async () => {
  let called = false;
  const snapshot = await loadLotterySnapshot({
    endpoint: "https://attacker.example/results",
    allowedOrigins: ["https://lotto.example"],
    fetchImpl: async () => { called = true; },
    now: NOW,
  });
  assert.equal(called, false);
  assert.equal(snapshot.status, "unavailable");
  assert.match(snapshot.reason, /not approved/i);
});

test("loads a valid snapshot only from an approved origin", async () => {
  const snapshot = await loadLotterySnapshot({
    endpoint: "https://api.example/results",
    allowedOrigins: ["https://api.example"],
    fetchImpl: async () => ({ ok: true, json: async () => ({ records: [powerballRecord()] }) }),
    now: NOW,
  });
  assert.equal(snapshot.status, "ready");
  assert.equal(snapshot.records.length, 1);
});
