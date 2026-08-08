import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { QUESTIONS } from "../games/lottomind-trivia/src/questions.mjs";
import { validateQuestionCollection } from "../games/lottomind-trivia/src/question-validator.mjs";

const args = process.argv.slice(2);
const command = args.shift() || "help";

function option(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] || fallback : fallback;
}

function flag(name) {
  return args.includes(`--${name}`);
}

function print(value) {
  process.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`);
}

function matches(question) {
  const query = option("query").toLowerCase();
  const category = option("category");
  const difficulty = option("difficulty");
  const status = option("status");
  if (category && question.category !== category) return false;
  if (difficulty && question.difficulty !== difficulty) return false;
  if (status && question.reviewStatus !== status) return false;
  if (!query) return true;
  return [question.id, question.question, question.explanation, ...(question.tags || [])]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

async function loadCollection(file) {
  const source = JSON.parse(await readFile(resolve(file), "utf8"));
  const result = validateQuestionCollection(source);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  return result.questions;
}

async function writeCollection(file, questions) {
  const result = validateQuestionCollection(questions);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  await writeFile(resolve(file), `${JSON.stringify(questions, null, 2)}\n`, "utf8");
  print(`Wrote ${questions.length} validated questions to ${resolve(file)}.`);
}

async function main() {
  if (command === "list" || command === "search") {
    const results = QUESTIONS.filter(matches).map(({ id, category, difficulty, reviewStatus, active, question }) => ({ id, category, difficulty, reviewStatus, active, question }));
    print(results);
    return;
  }
  if (command === "preview") {
    const id = option("id") || args[0];
    const question = QUESTIONS.find((entry) => entry.id === id);
    if (!question) throw new Error(`Question not found: ${id || "(missing id)"}`);
    print(question);
    return;
  }
  if (command === "validate" || command === "import") {
    const input = option("input") || args[0];
    if (!input) throw new Error("Provide --input <questions.json>.");
    const questions = await loadCollection(input);
    if (command === "import") {
      const output = option("output");
      if (!output) throw new Error("Import requires --output <validated-questions.json>; the source bank is never overwritten automatically.");
      await writeCollection(output, questions);
    } else print(`Validated ${questions.length} questions from ${resolve(input)}.`);
    return;
  }
  if (command === "export") {
    const output = option("output");
    if (!output) throw new Error("Export requires --output <questions.json>.");
    const questions = flag("approved-only")
      ? QUESTIONS.filter(({ active, reviewStatus }) => active && reviewStatus === "approved")
      : QUESTIONS;
    await writeCollection(output, questions);
    return;
  }
  if (command === "upsert") {
    const input = option("input");
    const output = option("output");
    if (!input || !output) throw new Error("Upsert requires --input <question.json> and --output <updated-bank.json>.");
    const candidate = JSON.parse(await readFile(resolve(input), "utf8"));
    const incoming = Array.isArray(candidate) ? candidate : [candidate];
    const byId = new Map(QUESTIONS.map((question) => [question.id, question]));
    incoming.forEach((question) => byId.set(question.id, question));
    await writeCollection(output, [...byId.values()]);
    return;
  }
  print([
    "LottoMind Trivia question workflow (local editorial use only)",
    "  npm run trivia:questions -- list [--query text] [--category id] [--difficulty level] [--status status]",
    "  npm run trivia:questions -- preview --id question-id",
    "  npm run trivia:questions -- validate --input questions.json",
    "  npm run trivia:questions -- import --input questions.json --output validated-questions.json",
    "  npm run trivia:questions -- export --output questions.json [--approved-only]",
    "  npm run trivia:questions -- upsert --input question.json --output updated-bank.json",
    "",
    "The command never edits the production question module automatically.",
  ].join("\n"));
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
