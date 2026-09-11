"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const systems = require("../core.js");

test("digit parsing preserves leading zeroes and rejects ambiguous tokens", () => {
  const result = systems.parseDigitInput("038\n194 12 abc 8426", { lengths: [3, 4] });
  assert.deepEqual(result.entries, ["038", "194", "8426"]);
  assert.deepEqual(result.rejected, ["12", "abc"]);
});

test("mirror and V-Trac mappings use the documented families", () => {
  assert.equal(systems.mirror("0123456789"), "5678901234");
  assert.deepEqual("842".split("").map(systems.vtrac), [4, 5, 3]);
  assert.deepEqual(systems.digitsForVtrac(1), [0, 5]);
  assert.deepEqual(systems.digitsForVtrac(5), [4, 9]);
});

test("date math matches the August 19 2026 acceptance example", () => {
  const result = systems.dateMath("2026-08-19");
  assert.equal(result.dayRoot, 1);
  assert.equal(result.monthRoot, 8);
  assert.equal(result.monthDayTotal, 27);
  assert.equal(result.monthDayTail, 7);
  assert.equal(result.fullDateRoot, 1);
  assert.deepEqual(result.seedDigits, [1, 8, 7, 1]);
});

test("monthly playlist is deterministic and returns exact list sizes", () => {
  const input = { month: 8, year: 2026, history: "038\n194\n842\n339\n173\n804\n268\n715\n049\n622" };
  const first = systems.monthlyPlaylist(input);
  const second = systems.monthlyPlaylist(input);
  assert.deepEqual(first, second);
  assert.equal(first.singles.length, 20);
  assert.equal(first.doubles.length, 12);
  assert.equal(first.triples.length, 4);
});

test("pair clusters disclose selected and backup lanes", () => {
  const three = systems.pairCluster3({ history: "038\n194\n842\n339\n173\n804" });
  const four = systems.pairCluster4({ history: "0382\n1940\n8426\n3391\n1738\n8042", cap: 20 });
  assert.equal(three.selected.length, 3);
  assert.equal(three.backups.length, 2);
  assert.ok(three.rows.every((row) => Number.isFinite(row.score)));
  assert.ok(four.wheel.length <= 20);
  assert.equal(four.creditCost, 0);
});

test("daily rundown returns exactly ten unique labeled plays", () => {
  const result = systems.easyDailyRundown("038");
  assert.equal(result.picks.length, 10);
  assert.equal(new Set(result.picks.map((item) => item.pick)).size, 10);
  assert.ok(result.picks.every((item) => item.pick.length === 3 && item.formula));
});

test("Top 10 generator produces required singles and double lanes", () => {
  const result = systems.top10Generator({ digits: "194", history: "038\n194\n842\n339" });
  assert.equal(result.top5.length, 5);
  assert.equal(result.singles.length, 10);
  assert.equal(result.mainDoubles.length, 10);
  assert.equal(result.sisterDoubles.length, 10);
});

test("digit wheel honors unique order, multiplicity, base counts, and caps", () => {
  const pick3 = systems.digitWheeler({ digits: "329069", length: 3, cap: 200 });
  const pick4 = systems.digitWheeler({ digits: "329069", length: 4, cap: 200 });
  assert.deepEqual(pick3.uniqueDigits, ["3", "2", "9", "0", "6"]);
  assert.deepEqual(pick3.repeatedDigits, ["9"]);
  assert.equal(pick3.baseCombinationCount, 10);
  assert.equal(pick4.baseCombinationCount, 5);
  assert.ok(pick3.combinations.some((pick) => pick.split("9").length - 1 === 2));
  const capped = systems.digitWheeler({ digits: "0123456789", length: 3, straight: true, cap: 12 });
  assert.equal(capped.combinations.length, 12);
  assert.equal(capped.capped, true);
});

test("V-Trac predictor maps 842 to V4-V5-V3 and caps its family", () => {
  const result = systems.vtracPredictor({ digits: "842", length: 3, cap: 5 });
  assert.deepEqual(result.vtrac, ["V4", "V5", "V3"]);
  assert.equal(result.candidates.length, 5);
  assert.ok(result.candidateCount >= result.candidates.length);
});
