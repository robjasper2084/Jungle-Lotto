import { TRIVIA_CONFIG } from "./trivia-config.mjs";

const GUEST_KEY = "lmTriviaGuestProgressV1";
const DEFAULT_PROGRESS = Object.freeze({
  gamesPlayed: 0,
  dailyStreak: 0,
  lastDailyDate: "",
  bestScores: {},
  survivalBest: 0,
  badges: [],
  hiddenProfile: true,
});

function runtime() {
  const value = globalThis.LottoMindTriviaRuntime;
  if (!value || typeof value !== "object") return {};
  return value;
}

function environmentAllowsWrites() {
  const environment = globalThis.LottoMindEnvironment;
  if (!environment) return true;
  return environment.isProduction === true || environment.allowAccountWrites === true;
}

export function serviceAvailability() {
  const value = runtime();
  const secureSessions = TRIVIA_CONFIG.services.secureSessions === true
    && value.secureSessions === true
    && typeof value.apiBaseUrl === "string"
    && environmentAllowsWrites();
  return Object.freeze({
    secureSessions,
    creditRewards: secureSessions && TRIVIA_CONFIG.services.creditRewards === true && value.creditRewards === true,
    leaderboards: secureSessions && TRIVIA_CONFIG.services.leaderboards === true && value.leaderboards === true,
    profileBadges: secureSessions && TRIVIA_CONFIG.services.profileBadges === true && value.profileBadges === true,
    reason: secureSessions ? "Secure Trivia services connected." : TRIVIA_CONFIG.demoNotice,
  });
}

async function request(path, options = {}) {
  const available = serviceAvailability();
  if (!available.secureSessions) throw new Error("Secure Trivia services are not configured.");
  const base = new URL(runtime().apiBaseUrl, globalThis.location?.href || "https://invalid.local");
  const response = await fetch(new URL(path.replace(/^\//, ""), `${base.href.replace(/\/$/, "")}/`), {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Trivia service returned ${response.status}.`);
  return body;
}

export const secureTriviaService = Object.freeze({
  startSession(payload) {
    return request("trivia/sessions", { method: "POST", body: JSON.stringify(payload) });
  },
  submitAnswer(sessionId, payload) {
    return request(`trivia/sessions/${encodeURIComponent(sessionId)}/answers`, { method: "POST", body: JSON.stringify(payload) });
  },
  finalizeSession(sessionId, idempotencyKey) {
    return request(`trivia/sessions/${encodeURIComponent(sessionId)}/finalize`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: "{}",
    });
  },
  leaderboard(period, cursor = "") {
    const query = new URLSearchParams({ period });
    if (cursor) query.set("cursor", cursor);
    return request(`trivia/leaderboards?${query}`);
  },
});

export function loadGuestProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(GUEST_KEY) || "{}");
    return {
      ...DEFAULT_PROGRESS,
      ...stored,
      bestScores: { ...DEFAULT_PROGRESS.bestScores, ...(stored.bestScores || {}) },
      badges: Array.isArray(stored.badges) ? stored.badges.filter((value) => typeof value === "string") : [],
    };
  } catch {
    return { ...DEFAULT_PROGRESS, bestScores: {}, badges: [] };
  }
}

function consecutiveDate(previous, current) {
  if (!previous) return false;
  const previousDate = new Date(`${previous}T12:00:00Z`);
  const currentDate = new Date(`${current}T12:00:00Z`);
  return Math.round((currentDate - previousDate) / 86400000) === 1;
}

export function saveGuestResult({ mode, score, correct, badges = [], dailyDate = "" }) {
  const progress = loadGuestProgress();
  const best = Number(progress.bestScores[mode] || 0);
  const next = {
    ...progress,
    gamesPlayed: progress.gamesPlayed + 1,
    bestScores: { ...progress.bestScores, [mode]: Math.max(best, score) },
    survivalBest: mode === "survival" ? Math.max(progress.survivalBest, correct) : progress.survivalBest,
    badges: [...new Set(progress.badges.concat(badges))],
  };
  if (mode === "daily" && dailyDate && progress.lastDailyDate !== dailyDate) {
    next.dailyStreak = consecutiveDate(progress.lastDailyDate, dailyDate) ? progress.dailyStreak + 1 : 1;
    next.lastDailyDate = dailyDate;
  }
  localStorage.setItem(GUEST_KEY, JSON.stringify(next));
  return Object.freeze({ progress: next, isRecord: score > best });
}

const blockedWords = ["slur", "hateword", "admin"];

export function sanitizeDisplayName(value) {
  const compact = String(value || "Player").replace(/[^\p{L}\p{N} ._'-]/gu, "").trim().slice(0, 24) || "Player";
  const lowered = compact.toLowerCase();
  return blockedWords.some((word) => lowered.includes(word)) ? "Player" : compact;
}
