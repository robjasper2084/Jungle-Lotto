import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_LABELS, TRIVIA_CONFIG } from "../src/trivia-config.mjs";
import { QUESTIONS, publicQuestions } from "../src/questions.mjs";
import {
  createInitialStats,
  createQuestionSet,
  dailyChallengeId,
  recordAnswer,
  scoreAnswer,
  summarizeStats,
} from "../src/trivia-engine.mjs";

test("question bank meets production schema and review requirements", () => {
  assert.equal(QUESTIONS.length, 154);
  assert.equal(publicQuestions().length, 154);
  assert.equal(new Set(QUESTIONS.map((question) => question.id)).size, 154);
  for (const question of QUESTIONS) {
    assert.ok(CATEGORY_LABELS[question.category]);
    assert.ok(["easy", "medium", "hard"].includes(question.difficulty));
    assert.equal(question.choices.length, 4);
    assert.ok(question.choices.every((choice) => choice.trim().length > 0));
    assert.ok(Number.isInteger(question.correctChoiceIndex));
    assert.ok(question.correctChoiceIndex >= 0 && question.correctChoiceIndex <= 3);
    assert.ok(question.explanation.trim().length > 0);
    assert.equal(question.reviewStatus, "approved");
    assert.equal(question.active, true);
    assert.match(question.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(question.version, 1);
  }
});

test("each category has at least twenty questions", () => {
  for (const category of Object.keys(CATEGORY_LABELS)) {
    assert.ok(QUESTIONS.filter((question) => question.category === category).length >= 20, category);
  }
});

test("correct answer positions are balanced", () => {
  const counts = [0, 0, 0, 0];
  QUESTIONS.forEach((question) => { counts[question.correctChoiceIndex] += 1; });
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, counts.join(","));
});

test("quick play returns ten unique mixed questions", () => {
  const set = createQuestionSet({ mode: "quick", seed: "test-quick" });
  assert.equal(set.length, TRIVIA_CONFIG.quickPlayLength);
  assert.equal(new Set(set.map((question) => question.id)).size, set.length);
  assert.ok(new Set(set.map((question) => question.category)).size > 1);
});

test("daily practice selection is deterministic by UTC challenge ID", () => {
  const date = new Date("2026-08-05T17:30:00Z");
  const first = createQuestionSet({ mode: "daily", date }).map((question) => question.id);
  const second = createQuestionSet({ mode: "daily", date }).map((question) => question.id);
  assert.equal(dailyChallengeId(date), "daily-2026-08-05");
  assert.deepEqual(first, second);
  assert.equal(first.length, TRIVIA_CONFIG.dailyVaultLength);
});

test("score uses speed, difficulty, and active streak multipliers", () => {
  const result = scoreAnswer({ correct: true, difficulty: "hard", remainingMs: 7500, totalMs: 15000, streak: 5 });
  assert.equal(result.speedBonus, 25);
  assert.equal(result.difficultyMultiplier, 1.5);
  assert.equal(result.streakMultiplier, 1.25);
  assert.equal(result.points, 234);
  assert.equal(scoreAnswer({ correct: false, difficulty: "hard", remainingMs: 15000, totalMs: 15000, streak: 9 }).points, 0);
});

test("answer recording updates lives, streaks, and summary without credits", () => {
  const question = QUESTIONS[0];
  const start = createInitialStats("survival");
  const correct = recordAnswer(start, question, question.correctChoiceIndex, 2000);
  const wrong = recordAnswer(correct, QUESTIONS[1], -1, 15000, true);
  const summary = summarizeStats(wrong);
  assert.equal(summary.correct, 1);
  assert.equal(summary.incorrect, 1);
  assert.equal(summary.accuracy, 50);
  assert.equal(summary.lives, 2);
  assert.equal("credits" in summary, false);
});
