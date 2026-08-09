import test from "node:test";
import assert from "node:assert/strict";
import { TRIVIA_CONFIG } from "../src/config.mjs";
import {
  answerIndexFromKey,
  calculateAnswerScore,
  dailyChallengeId,
  isDuplicateRewardClaim,
  isSessionExpired,
  makeDemoSession,
  nextTimerRemaining,
  proposedDailyReward,
  resultsFromAnswers,
  rewardEligibility,
  selectDailyQuestions,
  streakMultiplier,
} from "../src/engine.mjs";

test("score calculation applies base, speed, difficulty, and streak", () => {
  assert.equal(calculateAnswerScore({ correct: true, difficulty: "easy", remainingMs: 15000, totalMs: 15000, nextStreak: 1 }).total, 150);
  assert.equal(calculateAnswerScore({ correct: true, difficulty: "medium", remainingMs: 7500, totalMs: 15000, nextStreak: 1 }).total, 156);
  assert.equal(calculateAnswerScore({ correct: false, difficulty: "hard", remainingMs: 15000, totalMs: 15000, nextStreak: 9 }).total, 0);
});

test("streak tiers use the configured thresholds", () => {
  assert.equal(streakMultiplier(2), 1); assert.equal(streakMultiplier(3), 1.1); assert.equal(streakMultiplier(5), 1.25); assert.equal(streakMultiplier(8), 1.5);
});

test("daily challenge selection is deterministic", () => {
  const questions = Array.from({ length: 30 }, (_, index) => ({ id: `question-${index}`, category: `category-${index % 7}`, active: true, reviewStatus: "approved" }));
  const date = new Date("2026-08-05T20:00:00Z");
  const first = selectDailyQuestions(questions, date).questions.map((question) => question.id);
  const second = selectDailyQuestions(questions, date).questions.map((question) => question.id);
  const next = selectDailyQuestions(questions, new Date("2026-08-06T20:00:00Z")).questions.map((question) => question.id);
  assert.deepEqual(first, second); assert.notDeepEqual(first, next); assert.equal(dailyChallengeId(date), "daily-2026-08-05");
});

test("secure rewards stay disabled and cap at twenty when enabled in a contract test", () => {
  const results = { accuracy: 100 };
  assert.equal(proposedDailyReward(results), 0);
  const enabled = { ...TRIVIA_CONFIG, featureFlags: { ...TRIVIA_CONFIG.featureFlags, authoritativeCredits: true } };
  assert.equal(proposedDailyReward(results, false, enabled), 20);
  assert.equal(proposedDailyReward(results, true, enabled), 0);
});

test("guest and unverified sessions cannot receive rewards", () => {
  assert.equal(rewardEligibility({ authenticated: false, serverValidated: true, featureEnabled: true }).reason, "guest");
  assert.equal(rewardEligibility({ authenticated: true, serverValidated: false, featureEnabled: true }).reason, "unverified");
  assert.equal(rewardEligibility({ authenticated: true, serverValidated: true, featureEnabled: false }).reason, "disabled");
  assert.equal(rewardEligibility({ authenticated: true, serverValidated: true, featureEnabled: true, claimedToday: 20 }).reason, "cap-reached");
});

test("duplicate claims are detected by idempotency key or account challenge", () => {
  const claims = [{ idempotencyKey: "key-1", userId: "u1", challengeId: "d1" }];
  assert.equal(isDuplicateRewardClaim(claims, { idempotencyKey: "key-1", userId: "u2", challengeId: "d2" }), true);
  assert.equal(isDuplicateRewardClaim(claims, { idempotencyKey: "key-2", userId: "u1", challengeId: "d1" }), true);
  assert.equal(isDuplicateRewardClaim(claims, { idempotencyKey: "key-3", userId: "u1", challengeId: "d2" }), false);
});

test("session expiration is enforced", () => {
  const session = makeDemoSession({ mode: "quick", questionIds: ["a"], now: 1000, ttlMs: 500 });
  assert.equal(isSessionExpired(session, 1499), false); assert.equal(isSessionExpired(session, 1500), true); assert.equal(session.rewardEligible, false);
});

test("keyboard shortcuts map only keys one through four", () => {
  assert.deepEqual(["1", "2", "3", "4"].map(answerIndexFromKey), [0, 1, 2, 3]);
  assert.equal(answerIndexFromKey("5"), null); assert.equal(answerIndexFromKey("Enter"), null);
});

test("timer holds while paused or locked and never becomes negative", () => {
  assert.equal(nextTimerRemaining(1000, 250), 750); assert.equal(nextTimerRemaining(1000, 250, { paused: true }), 1000); assert.equal(nextTimerRemaining(100, 250), 0);
});

test("result calculations preserve category metrics", () => {
  const result = resultsFromAnswers([{ correct: true, category: "a", elapsedMs: 700, streakAfter: 1 }, { correct: false, category: "a", elapsedMs: 1200, streakAfter: 0 }, { correct: true, category: "b", elapsedMs: 900, streakAfter: 1 }], 420);
  assert.deepEqual({ score: result.score, correct: result.correct, incorrect: result.incorrect, accuracy: result.accuracy, fastest: result.fastestAnswerMs }, { score: 420, correct: 2, incorrect: 1, accuracy: 67, fastest: 700 });
  assert.deepEqual(result.categoryPerformance.a, { correct: 1, total: 2 });
});
