import test from "node:test";
import assert from "node:assert/strict";
import { calculatePotentialDailyReward, rewardClaimIsUnique, sessionIsActive, TRIVIA_REWARD_POLICY } from "../src/trivia-security.mjs";
import { parseQuestionJson, productionQuestions, validateQuestionCollection } from "../src/question-validator.mjs";

function question(overrides = {}) {
  return {
    id: "test-question-01",
    category: "mystery-mix",
    difficulty: "easy",
    question: "Which answer completes this reviewed test question?",
    choices: ["First", "Second", "Third", "Fourth"],
    correctChoiceIndex: 0,
    explanation: "The first answer is correct for this validation fixture.",
    sourceName: "Editorial review",
    sourceUrl: "https://example.com/source",
    reviewedAt: "2026-08-05",
    reviewStatus: "approved",
    active: true,
    tags: ["fixture"],
    version: 1,
    lastEditedBy: "Test editor",
    lastEditedAt: "2026-08-05T12:00:00.000Z",
    ...overrides,
  };
}

test("daily reward policy caps a perfect completion at twenty credits", () => {
  assert.equal(calculatePotentialDailyReward({ completed: true, correct: 5, total: 5 }), 20);
  assert.equal(calculatePotentialDailyReward({ completed: true, correct: 4, total: 5 }), 10);
  assert.equal(calculatePotentialDailyReward({ completed: false, correct: 5, total: 5 }), 0);
  assert.equal(TRIVIA_REWARD_POLICY.dailyCreditCap, 20);
});

test("session expiration rejects future and expired timestamps", () => {
  const now = Date.parse("2026-08-05T12:30:00.000Z");
  assert.equal(sessionIsActive("2026-08-05T12:01:00.000Z", now), true);
  assert.equal(sessionIsActive("2026-08-05T11:59:59.000Z", now), false);
  assert.equal(sessionIsActive("2026-08-05T12:31:00.000Z", now), false);
});

test("duplicate reward idempotency keys are rejected", () => {
  const key = "trivia-daily-2026-08-05-account-17";
  assert.equal(rewardClaimIsUnique([], key), true);
  assert.equal(rewardClaimIsUnique([key], key), false);
  assert.equal(rewardClaimIsUnique([], "short"), false);
});

test("question import rejects malformed records and duplicate IDs", () => {
  const duplicate = validateQuestionCollection([question(), question()]);
  assert.equal(duplicate.valid, false);
  assert.match(duplicate.errors.join(" "), /Duplicate question ID/);
  const malformed = parseQuestionJson(JSON.stringify([question({ choices: ["Only one"] })]));
  assert.equal(malformed.valid, false);
  assert.match(malformed.errors.join(" "), /Exactly four/);
  assert.equal(parseQuestionJson("not json").valid, false);
});

test("only reviewed active questions are eligible for production export", () => {
  const items = [question(), question({ id: "draft-question-01", reviewStatus: "draft" }), question({ id: "inactive-question-01", active: false })];
  assert.deepEqual(productionQuestions(items).map(({ id }) => id), ["test-question-01"]);
});
