import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseMegaMillionsResult, parsePowerballResult } from "../src/lib/news/lotteryResults";

const SOURCES = {
  powerball: "https://www.powerball.com/previous-results",
  megaMillions: "https://www.texaslottery.com/export/sites/lottery/Games/Mega_Millions/Winning_Numbers/",
};

async function getPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; LottoMindNewsHub/1.0; +https://robjasper2084.github.io/Jungle-Lotto/)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Official lottery source failed (${response.status}): ${url}`);
  return response.text();
}

const [powerballHtml, megaMillionsHtml] = await Promise.all([
  getPage(SOURCES.powerball),
  getPage(SOURCES.megaMillions),
]);

const payload = {
  verifiedAt: new Date().toISOString(),
  results: [parsePowerballResult(powerballHtml), parseMegaMillionsResult(megaMillionsHtml)],
};

const output = resolve(process.cwd(), "src", "data", "latestLotteryResults.json");
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Refreshed ${payload.results.length} verified lottery draw results.`);
