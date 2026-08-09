import { CATEGORIES, TRIVIA_CONFIG } from "./config.mjs";
import { playableQuestions, validateQuestionBank } from "./question-schema.mjs";

const memoryCache = new Map();

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`Question data unavailable (${response.status}).`);
  return response.json();
}

export const questionService = Object.freeze({
  async manifest(signal) {
    if (memoryCache.has("manifest")) return memoryCache.get("manifest");
    const manifest = await fetchJson(new URL("../data/manifest.json", import.meta.url), signal);
    memoryCache.set("manifest", manifest);
    return manifest;
  },
  async category(categoryId, signal) {
    if (memoryCache.has(categoryId)) return memoryCache.get(categoryId);
    const manifest = await this.manifest(signal);
    const entry = manifest.categories.find((category) => category.id === categoryId);
    if (!entry) throw new Error(`Unknown category: ${categoryId}`);
    const data = await fetchJson(new URL(`../data/categories/${entry.file}`, import.meta.url), signal);
    const validation = validateQuestionBank(data);
    if (!validation.valid) throw new Error(`Question validation failed: ${validation.errors[0]}`);
    const playable = playableQuestions(data);
    memoryCache.set(categoryId, playable);
    return playable;
  },
  async categories(categoryIds, signal) {
    const batches = await Promise.all(categoryIds.map((id) => this.category(id, signal)));
    return batches.flat();
  },
  async all(signal) { return this.categories(CATEGORIES.map((category) => category.id), signal); },
});

export const storageService = Object.freeze({
  read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
  },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
  getSettings() { return { muted: true, reducedEffects: false, vibration: false, autoContinue: true, ...this.read(TRIVIA_CONFIG.storageKeys.settings, {}) }; },
  saveSettings(value) { return this.write(TRIVIA_CONFIG.storageKeys.settings, value); },
  getProgress() {
    return { gamesPlayed: 0, bestScores: {}, bestSurvival: 0, dailyDates: [], badges: {}, history: [], displayName: "Local Player", hideProfile: true, ...this.read(TRIVIA_CONFIG.storageKeys.progress, {}) };
  },
  saveProgress(value) { return this.write(TRIVIA_CONFIG.storageKeys.progress, value); },
  getLeaderboards() { return { daily: [], weekly: [], allTime: [], survival: [], ...this.read(TRIVIA_CONFIG.storageKeys.leaderboards, {}) }; },
  saveLeaderboards(value) { return this.write(TRIVIA_CONFIG.storageKeys.leaderboards, value); },
});

export const accountService = Object.freeze({
  isConfigured() { return Boolean(window.LottoMindAccountService?.isConfigured?.()); },
  async session() {
    if (!window.LottoMindAccountService?.getSession) return { authenticated: false, reason: "Account service not configured." };
    try { return await window.LottoMindAccountService.getSession(); } catch { return { authenticated: false, reason: "Account service unavailable." }; }
  },
});

export const rewardService = Object.freeze({
  enabled: TRIVIA_CONFIG.featureFlags.authoritativeCredits,
  async createSession() { throw Object.assign(new Error("Secure trivia rewards are disabled in this static build."), { code: "TRIVIA_REWARDS_DISABLED" }); },
  async submitAnswer() { throw Object.assign(new Error("Secure trivia rewards are disabled in this static build."), { code: "TRIVIA_REWARDS_DISABLED" }); },
  async claim() { throw Object.assign(new Error("Secure trivia rewards are disabled in this static build."), { code: "TRIVIA_REWARDS_DISABLED" }); },
});

export const leaderboardService = Object.freeze({
  enabled: TRIVIA_CONFIG.featureFlags.remoteLeaderboards,
  list(board) { return storageService.getLeaderboards()[board] || []; },
  saveLocal(board, entry) {
    const boards = storageService.getLeaderboards();
    boards[board] = [entry, ...(boards[board] || []).filter((item) => item.id !== entry.id)].sort((a, b) => b.score - a.score).slice(0, 50);
    storageService.saveLeaderboards(boards);
    return boards[board];
  },
});

export function track(event, metadata = {}) {
  const safe = { mode: metadata.mode, scoreBucket: metadata.scoreBucket, durationBucket: metadata.durationBucket, category: metadata.category };
  Object.keys(safe).forEach((key) => safe[key] === undefined && delete safe[key]);
  if (window.LottoMindAccountService?.analytics) window.LottoMindAccountService.analytics(event, safe);
  window.dispatchEvent(new CustomEvent("lottomind:analytics", { detail: { event, metadata: safe } }));
}
