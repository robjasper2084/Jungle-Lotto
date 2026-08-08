import { CATEGORY_LABELS } from "./trivia-config.mjs";

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const REVIEW_STATUSES = new Set(["draft", "review", "approved", "rejected"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text(value)) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function validateQuestion(question, existingIds = new Set()) {
  const errors = [];
  const id = text(question?.id);
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(id)) errors.push("ID must use 3-80 lowercase letters, numbers, or hyphens.");
  if (existingIds.has(id)) errors.push(`Duplicate question ID: ${id}.`);
  if (!Object.hasOwn(CATEGORY_LABELS, question?.category)) errors.push("Choose a supported category.");
  if (!DIFFICULTIES.has(question?.difficulty)) errors.push("Difficulty must be easy, medium, or hard.");
  if (text(question?.question).length < 10) errors.push("Question text must contain at least 10 characters.");
  if (!Array.isArray(question?.choices) || question.choices.length !== 4) {
    errors.push("Exactly four answer choices are required.");
  } else {
    const choices = question.choices.map(text);
    if (choices.some((choice) => !choice)) errors.push("Answer choices cannot be empty.");
    if (new Set(choices.map((choice) => choice.toLowerCase())).size !== 4) errors.push("Answer choices must be unique.");
  }
  if (!Number.isInteger(question?.correctChoiceIndex) || question.correctChoiceIndex < 0 || question.correctChoiceIndex > 3) {
    errors.push("Correct choice index must be an integer from 0 through 3.");
  }
  if (text(question?.explanation).length < 10) errors.push("Explanation must contain at least 10 characters.");
  if (question?.sourceUrl && !/^https?:\/\//i.test(text(question.sourceUrl))) errors.push("Source URL must use HTTP or HTTPS.");
  if (!validDate(question?.reviewedAt)) errors.push("Reviewed date must use YYYY-MM-DD.");
  if (!REVIEW_STATUSES.has(question?.reviewStatus)) errors.push("Review status is invalid.");
  if (question?.reviewStatus === "approved" && !text(question?.lastEditedBy)) errors.push("Approved questions require a last editor.");
  if (!text(question?.lastEditedAt) || Number.isNaN(Date.parse(question.lastEditedAt))) errors.push("A valid edit timestamp is required.");
  if (question?.active !== true && question?.active !== false) errors.push("Active must be true or false.");
  if (!Number.isInteger(question?.version) || question.version < 1) errors.push("Version must be a positive integer.");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateQuestionCollection(input) {
  if (!Array.isArray(input)) return Object.freeze({ valid: false, errors: Object.freeze(["Question import must be a JSON array."]), questions: Object.freeze([]) });
  const seen = new Set();
  const errors = [];
  input.forEach((question, index) => {
    const result = validateQuestion(question, seen);
    result.errors.forEach((error) => errors.push(`Row ${index + 1}: ${error}`));
    if (question?.id) seen.add(String(question.id).trim());
  });
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), questions: Object.freeze(input.slice()) });
}

export function parseQuestionJson(source) {
  try {
    return validateQuestionCollection(JSON.parse(String(source || "")));
  } catch {
    return Object.freeze({ valid: false, errors: Object.freeze(["The selected file is not valid JSON."]), questions: Object.freeze([]) });
  }
}

export function productionQuestions(input) {
  return input.filter((question) => question.active === true && question.reviewStatus === "approved");
}
