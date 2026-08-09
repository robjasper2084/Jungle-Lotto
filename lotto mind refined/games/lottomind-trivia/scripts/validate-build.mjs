import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateQuestionBank } from "../src/question-schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "data", "manifest.json"), "utf8"));
const ids = new Set();
const positions = [0, 0, 0, 0];
let total = 0;
for (const category of manifest.categories) {
  const raw = await readFile(path.join(root, "data", "categories", category.file), "utf8");
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== category.sha256) throw new Error(`Hash mismatch for ${category.file}`);
  const questions = JSON.parse(raw);
  const validation = validateQuestionBank(questions);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  if (questions.length < 20) throw new Error(`${category.id} has fewer than 20 questions.`);
  for (const question of questions) {
    if (ids.has(question.id)) throw new Error(`Duplicate ID ${question.id}`);
    ids.add(question.id); positions[question.correctChoiceIndex] += 1;
    if (!question.sourceName && ["lottery-knowledge", "numbers-numerology", "ufo-unexplained", "detroit-history-culture", "music-pop-culture", "mystery-mix"].includes(question.category)) throw new Error(`Missing source metadata: ${question.id}`);
  }
  total += questions.length;
}
if (total !== manifest.totalQuestions || total < 150) throw new Error(`Question count mismatch: ${total}`);
if (Math.max(...positions) - Math.min(...positions) > 1) throw new Error(`Correct-answer positions are not balanced: ${positions.join(",")}`);
for (const required of ["index.html", "styles.css", "src/app.mjs", "admin/index.html", "README.md", "ROLLBACK.md"]) {
  await readFile(path.join(root, required), "utf8");
}
const publicApp = await readFile(path.join(root, "src", "app.mjs"), "utf8");
if (/setCredits|credits.*localStorage|localStorage.*credits/i.test(publicApp)) throw new Error("Public trivia app appears to mutate local wallet credits.");
if (/\bTODO\b/.test(publicApp)) throw new Error("Unfinished TODO found in public app.");
console.log(`Validated ${total} questions; correct positions ${positions.join("/")}; public reward writes disabled.`);
