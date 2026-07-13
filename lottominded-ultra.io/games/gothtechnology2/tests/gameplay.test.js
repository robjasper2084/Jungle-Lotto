import assert from "node:assert/strict";
import test from "node:test";
import { attackIntentFromActions, resolveCancelAttack } from "../src/gameplay/commands.js";
import { registerAttackHit, sliceAttackForHit } from "../src/gameplay/hits.js";
import { resolveRoundOutcome } from "../src/gameplay/rounds.js";

test("double KO and tied timeout are neutral draws", () => {
  assert.deepEqual(resolveRoundOutcome(0, 0, 32), { draw: true, winnerIndex: null, reason: "double_KO" });
  assert.deepEqual(resolveRoundOutcome(500, 500, 0), { draw: true, winnerIndex: null, reason: "timeout" });
});

test("non-tied rounds select the correct winner", () => {
  assert.equal(resolveRoundOutcome(0, 250, 12).winnerIndex, 1);
  assert.equal(resolveRoundOutcome(700, 400, 0).winnerIndex, 0);
  assert.equal(resolveRoundOutcome(700, 400, 12), null);
});

test("combo inputs and cancel chains reach configured combo attacks", () => {
  assert.equal(attackIntentFromActions({ lightPunch: true, heavyPunch: true, grounded: true }), "combo1");
  assert.equal(attackIntentFromActions({ lightPunch: true, lightKick: true, grounded: true }), "combo2");
  assert.equal(resolveCancelAttack("lightPunch", "heavyPunch"), "combo1");
  assert.equal(resolveCancelAttack("combo1", "heavyKick"), "combo2");
});

test("multi-hit registration honors count and interval", () => {
  const state = {};
  const attack = { active: [0.1, 0.5], multiHit: 3, hitInterval: 0.08 };
  assert.deepEqual(registerAttackHit(state, "target", attack, 0.1), { hitIndex: 1, maxHits: 3 });
  assert.equal(registerAttackHit(state, "target", attack, 0.14), null);
  assert.deepEqual(registerAttackHit(state, "target", attack, 0.18), { hitIndex: 2, maxHits: 3 });
  assert.deepEqual(registerAttackHit(state, "target", attack, 0.26), { hitIndex: 3, maxHits: 3 });
  assert.equal(registerAttackHit(state, "target", attack, 0.4), null);
});

test("multi-hit slices preserve configured total damage", () => {
  const attack = { damage: 245, chip: 42, meter: 18, knockback: 510, multiHit: 3 };
  const slices = [1, 2, 3].map((hitIndex) => sliceAttackForHit(attack, hitIndex));
  assert.equal(slices.reduce((sum, slice) => sum + slice.damage, 0), 245);
  assert.equal(slices.reduce((sum, slice) => sum + slice.chip, 0), 42);
  assert.equal(slices.reduce((sum, slice) => sum + slice.meter, 0), 18);
  assert.equal(slices.reduce((sum, slice) => sum + slice.knockback, 0), 510);
});
