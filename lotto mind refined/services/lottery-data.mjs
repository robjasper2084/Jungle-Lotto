const SNAPSHOT_SCHEMA_VERSION = 1;
const DEFAULT_FRESHNESS_THRESHOLD_MS = 60 * 60 * 1000;

export const LOTTERY_RULES = Object.freeze({
  powerball: Object.freeze({
    id: "powerball",
    displayName: "Powerball",
    jurisdiction: "US",
    version: "us-powerball-2015-10-07",
    effectiveFrom: "2015-10-07",
    mainCount: 5,
    mainMin: 1,
    mainMax: 69,
    specialName: "Powerball",
    specialMin: 1,
    specialMax: 26,
    sourceName: "Powerball",
    sourceUrl: "https://www.powerball.com/",
    verificationUrl: "https://www.powerball.com/previous-results",
  }),
  "mega-millions": Object.freeze({
    id: "mega-millions",
    displayName: "Mega Millions",
    jurisdiction: "US",
    version: "us-mega-millions-2025-04-08",
    effectiveFrom: "2025-04-08",
    mainCount: 5,
    mainMin: 1,
    mainMax: 70,
    specialName: "Mega Ball",
    specialMin: 1,
    specialMax: 24,
    sourceName: "Mega Millions",
    sourceUrl: "https://www.megamillions.com/how-to-play",
    verificationUrl: "https://www.megamillions.com/Winning-Numbers.aspx",
  }),
  "ny-numbers": Object.freeze({
    id: "ny-numbers",
    displayName: "New York Numbers",
    jurisdiction: "NY",
    version: "ny-numbers-reviewed-2026-08-19",
    verifiedOn: "2026-08-19",
    digitCount: 3,
    digitMin: 0,
    digitMax: 9,
    sourceName: "New York Lottery",
    sourceUrl: "https://nylottery.ny.gov/draw-game/?game=numbers",
    verificationUrl: "https://nylottery.ny.gov/draw-game/?game=numbers",
  }),
  "ny-win-4": Object.freeze({
    id: "ny-win-4",
    displayName: "New York Win 4",
    jurisdiction: "NY",
    version: "ny-win-4-reviewed-2026-08-19",
    verifiedOn: "2026-08-19",
    digitCount: 4,
    digitMin: 0,
    digitMax: 9,
    sourceName: "New York Lottery",
    sourceUrl: "https://nylottery.ny.gov/draw-game/?game=win4",
    verificationUrl: "https://nylottery.ny.gov/draw-game/?game=win4",
  }),
});

export const OFFICIAL_VERIFICATION_DESTINATIONS = Object.freeze([
  Object.freeze({ name: "Powerball", url: LOTTERY_RULES.powerball.verificationUrl }),
  Object.freeze({ name: "Mega Millions", url: LOTTERY_RULES["mega-millions"].verificationUrl }),
  Object.freeze({ name: "New York Lottery", url: "https://nylottery.ny.gov/" }),
]);

function text(value, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function finiteInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function isoDateTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function normalizedNumberList(value) {
  if (!Array.isArray(value) || value.length > 10) return [];
  const numbers = value.map(finiteInteger);
  return numbers.some((number) => number === null) ? [] : numbers;
}

function validDrawDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function safeOfficialUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function validateNumbers(record, rule) {
  if (!rule) return false;
  if (rule.digitCount) {
    return record.numbers.length === rule.digitCount
      && record.numbers.every((number) => number >= rule.digitMin && number <= rule.digitMax);
  }
  const mainValid = record.numbers.length === rule.mainCount
    && new Set(record.numbers).size === record.numbers.length
    && record.numbers.every((number) => number >= rule.mainMin && number <= rule.mainMax);
  const specialValid = rule.specialMax
    ? Number.isInteger(record.special) && record.special >= rule.specialMin && record.special <= rule.specialMax
    : record.special === null;
  return mainValid && specialValid;
}

export function normalizeLotteryRecord(input, { now = Date.now() } = {}) {
  const gameId = text(input?.gameId, 80);
  const rule = LOTTERY_RULES[gameId];
  const retrievedAt = isoDateTime(input?.retrievedAt);
  const sourceUrl = safeOfficialUrl(input?.sourceUrl);
  const verificationUrl = safeOfficialUrl(input?.verificationUrl || sourceUrl);
  const currencyInput = text(input?.currency, 8).toUpperCase();
  const rawJackpot = input?.jackpot;
  const jackpot = rawJackpot === undefined || rawJackpot === null || rawJackpot === ""
    ? null
    : (Number.isFinite(Number(rawJackpot)) ? Number(rawJackpot) : null);
  const record = {
    id: text(input?.id, 120),
    jurisdiction: text(input?.jurisdiction || input?.stateCode, 24).toUpperCase(),
    gameId,
    displayName: text(input?.displayName || input?.gameName, 100),
    drawDate: text(input?.drawDate, 20),
    drawTime: text(input?.drawTime, 20),
    displayTimezone: text(input?.displayTimezone, 80),
    numbers: normalizedNumberList(input?.numbers),
    special: input?.special === undefined || input?.special === null ? null : finiteInteger(input.special),
    specialName: text(input?.specialName || rule?.specialName, 40),
    multiplier: input?.multiplier === undefined || input?.multiplier === null ? null : finiteInteger(input.multiplier),
    jackpot,
    currency: /^[A-Z]{3}$/.test(currencyInput) ? currencyInput : "",
    sourceName: text(input?.sourceName, 100),
    sourceUrl,
    verificationUrl,
    retrievedAt,
    verificationStatus: text(input?.verificationStatus, 24).toLowerCase(),
    dataVersion: text(input?.dataVersion, 60),
    gameRuleVersion: text(input?.gameRuleVersion, 80),
  };
  const retrievedTime = retrievedAt ? new Date(retrievedAt).getTime() : 0;
  const threshold = Number.isFinite(Number(input?.freshnessThresholdMs))
    ? Math.max(60_000, Number(input.freshnessThresholdMs))
    : DEFAULT_FRESHNESS_THRESHOLD_MS;
  const retrievalAge = retrievedTime ? now - retrievedTime : Number.POSITIVE_INFINITY;
  record.freshnessStatus = retrievalAge >= -300_000 && retrievalAge <= threshold ? "fresh" : "stale";
  const jackpotValid = record.jackpot === null
    || (record.jackpot >= 0 && /^[A-Z]{3}$/.test(record.currency));
  record.valid = Boolean(
    record.id
    && record.jurisdiction === rule?.jurisdiction
    && record.displayName
    && validDrawDate(record.drawDate)
    && record.displayTimezone
    && record.sourceName
    && record.sourceUrl
    && record.verificationUrl
    && record.retrievedAt
    && record.verificationStatus === "verified"
    && record.dataVersion
    && jackpotValid
    && rule
    && record.gameRuleVersion === rule.version
    && validateNumbers(record, rule)
  );
  return Object.freeze(record);
}

export function unavailableLotterySnapshot(reason = "Verified lottery data is not configured.") {
  return Object.freeze({
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    status: "unavailable",
    reason: text(reason, 240) || "Verified lottery data is unavailable.",
    retrievedAt: "",
    records: Object.freeze([]),
    sources: OFFICIAL_VERIFICATION_DESTINATIONS,
  });
}

export function buildLotterySnapshot(payload, options = {}) {
  const rawRecords = Array.isArray(payload?.records) ? payload.records : [];
  const records = rawRecords
    .map((record) => normalizeLotteryRecord(record, options))
    .filter((record) => record.valid);
  if (!records.length) {
    return unavailableLotterySnapshot(payload?.reason || "No verified lottery records are available.");
  }
  const hasStaleRecord = records.some((record) => record.freshnessStatus !== "fresh");
  return Object.freeze({
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    status: hasStaleRecord ? "stale" : "ready",
    reason: hasStaleRecord ? "The latest provider response is older than its freshness threshold." : "",
    retrievedAt: records.map((record) => record.retrievedAt).sort().at(-1) || "",
    records: Object.freeze(records),
    sources: OFFICIAL_VERIFICATION_DESTINATIONS,
  });
}

function approvedEndpoint(endpoint, allowedOrigins) {
  try {
    const url = new URL(endpoint, typeof window !== "undefined" ? window.location.href : undefined);
    const localHttp = url.protocol === "http:" && /^(?:127\.0\.0\.1|localhost)$/i.test(url.hostname);
    if (url.protocol !== "https:" && !localHttp) return null;
    if (!allowedOrigins.includes(url.origin)) return null;
    return url;
  } catch {
    return null;
  }
}

export async function loadLotterySnapshot({
  endpoint = "",
  allowedOrigins = [],
  fetchImpl = globalThis.fetch,
  timeoutMs = 6000,
  now = Date.now(),
} = {}) {
  if (!endpoint) return unavailableLotterySnapshot();
  const url = approvedEndpoint(endpoint, allowedOrigins);
  if (!url) return unavailableLotterySnapshot("The configured lottery provider origin is not approved.");
  if (typeof fetchImpl !== "function") return unavailableLotterySnapshot("Lottery data cannot be requested in this browser.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    const response = await fetchImpl(url.href, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) return unavailableLotterySnapshot(`Verified lottery data is unavailable (${response.status}).`);
    return buildLotterySnapshot(await response.json(), { now });
  } catch (error) {
    return unavailableLotterySnapshot(error?.name === "AbortError"
      ? "The verified lottery data request timed out."
      : "The verified lottery data provider could not be reached.");
  } finally {
    clearTimeout(timeout);
  }
}
