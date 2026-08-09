import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateQuestionBank } from "../src/question-schema.mjs";

const root = new URL("../data/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));

test("starter bank contains at least 150 reviewed questions and 20 per category", async () => {
  assert.ok(manifest.totalQuestions >= 150); assert.equal(manifest.categories.length, 7);
  for (const category of manifest.categories) {
    const questions = JSON.parse(await readFile(new URL(`categories/${category.file}`, root), "utf8"));
    assert.ok(questions.length >= 20, category.id);
    const validation = validateQuestionBank(questions); assert.equal(validation.valid, true, validation.errors.join("\n"));
  }
});

test("correct answer positions are globally balanced", async () => {
  const positions = [0, 0, 0, 0];
  for (const category of manifest.categories) {
    const questions = JSON.parse(await readFile(new URL(`categories/${category.file}`, root), "utf8"));
    questions.forEach((question) => positions[question.correctChoiceIndex] += 1);
  }
  assert.ok(Math.max(...positions) - Math.min(...positions) <= 1, positions.join(","));
});

test("malformed imports fail validation", () => {
  const malformed = [{ id: "bad", category: "mystery-mix", difficulty: "impossible", question: "", choices: ["one"], correctChoiceIndex: 9, explanation: "", reviewedAt: "today", reviewStatus: "draft", active: true, version: 0 }];
  const result = validateQuestionBank(malformed); assert.equal(result.valid, false); assert.ok(result.errors.length >= 6);
});
