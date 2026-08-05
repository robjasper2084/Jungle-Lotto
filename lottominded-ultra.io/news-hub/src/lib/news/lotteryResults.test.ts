import assert from "node:assert/strict";
import test from "node:test";
import { parseMegaMillionsResult, parsePowerballResult } from "./lotteryResults";

test("parses the newest Powerball result from the official result card", () => {
  const result = parsePowerballResult(`
    <a class="card">
      <h5 class="card-title">Sat, Aug 1, 2026</h5>
      <div class="white-balls">6</div><div class="white-balls">17</div>
      <div class="white-balls">27</div><div class="white-balls">48</div><div class="white-balls">50</div>
      <div class="powerball">5</div><span class="multiplier">3x</span>
    </a>`);

  assert.deepEqual(result.numbers, [6, 17, 27, 48, 50]);
  assert.equal(result.specialNumber, 5);
  assert.equal(result.drawDate, "2026-08-01");
  assert.equal(result.multiplier, "3x");
});

test("parses the newest Mega Millions result from an official state lottery table", () => {
  const result = parseMegaMillionsResult(`
    <table><tr><th>Draw Date</th><th>Winning Numbers</th><th>Mega Ball</th></tr>
    <tr><td>07/31/2026</td><td>4 - 18 - 26 - 43 - 51</td><td>4</td></tr></table>`);

  assert.deepEqual(result.numbers, [4, 18, 26, 43, 51]);
  assert.equal(result.specialNumber, 4);
  assert.equal(result.drawDate, "2026-07-31");
});

test("rejects incomplete result markup instead of inventing numbers", () => {
  assert.throws(() => parsePowerballResult("<main>No result</main>"), /did not include a draw date/);
  assert.throws(() => parseMegaMillionsResult("<table></table>"), /did not include a draw date/);
});
