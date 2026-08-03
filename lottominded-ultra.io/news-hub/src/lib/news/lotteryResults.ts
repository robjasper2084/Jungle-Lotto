import { load } from "cheerio";

export interface LotteryDrawResult {
  game: "Powerball" | "Mega Millions";
  drawDate: string;
  numbers: number[];
  specialNumber: number;
  specialLabel: "Powerball" | "Mega Ball";
  multiplier?: string;
  sourceName: string;
  sourceUrl: string;
}

function toIsoDate(value: string): string {
  const date = new Date(`${value.trim()} 12:00:00 UTC`);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid lottery draw date: ${value}`);
  return date.toISOString().slice(0, 10);
}

function validateNumbers(numbers: number[], specialNumber: number, game: LotteryDrawResult["game"]): void {
  if (numbers.length !== 5 || numbers.some((number) => !Number.isInteger(number) || number < 1 || number > 70)) {
    throw new Error(`Invalid ${game} main numbers`);
  }
  if (!Number.isInteger(specialNumber) || specialNumber < 1 || specialNumber > 26) {
    throw new Error(`Invalid ${game} special number`);
  }
}

export function parsePowerballResult(html: string): LotteryDrawResult {
  const $ = load(html);
  const card = $("a.card").first();
  const drawDate = card.find(".card-title").first().text().trim();
  const numbers = card.find(".white-balls").map((_, element) => Number($(element).text().trim())).get();
  const specialNumber = Number(card.find(".powerball").first().text().trim());
  const multiplier = card.find(".multiplier").first().text().trim();

  if (!drawDate) throw new Error("Powerball result page did not include a draw date");
  validateNumbers(numbers, specialNumber, "Powerball");

  return {
    game: "Powerball",
    drawDate: toIsoDate(drawDate),
    numbers,
    specialNumber,
    specialLabel: "Powerball",
    multiplier: multiplier || undefined,
    sourceName: "Powerball",
    sourceUrl: "https://www.powerball.com/previous-results",
  };
}

export function parseMegaMillionsResult(html: string): LotteryDrawResult {
  const $ = load(html);
  const cells = $("table tr").filter((_, row) => /^\d{2}\/\d{2}\/\d{4}$/.test($(row).find("td").first().text().trim())).first().find("td");
  const drawDate = cells.eq(0).text().trim();
  const numbers = (cells.eq(1).text().match(/\d+/g) || []).map(Number);
  const specialNumber = Number(cells.eq(2).text().trim());

  if (!drawDate) throw new Error("Mega Millions result page did not include a draw date");
  validateNumbers(numbers, specialNumber, "Mega Millions");

  return {
    game: "Mega Millions",
    drawDate: toIsoDate(drawDate),
    numbers,
    specialNumber,
    specialLabel: "Mega Ball",
    sourceName: "Texas Lottery",
    sourceUrl: "https://www.texaslottery.com/export/sites/lottery/Games/Mega_Millions/Winning_Numbers/",
  };
}
