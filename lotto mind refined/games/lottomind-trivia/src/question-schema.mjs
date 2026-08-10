export const DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);

export function validateQuestion(question, seenIds = new Set()) {
  const errors = [];
  if (!question || typeof question !== "object") return ["Question must be an object."];
  if (!/^[a-z0-9][a-z0-9-]{4,79}$/.test(String(question.id || ""))) errors.push("id must be a stable lowercase slug.");
  if (seenIds.has(question.id)) errors.push(`duplicate id: ${question.id}`);
  if (!String(question.category || "").trim()) errors.push("category is required.");
  if (!DIFFICULTIES.includes(question.difficulty)) errors.push("difficulty must be easy, medium, or hard.");
  if (!String(question.question || "").trim()) errors.push("question text is required.");
  if (!Array.isArray(question.choices) || question.choices.length !== 4 || question.choices.some((choice) => !String(choice || "").trim())) errors.push("exactly four non-empty choices are required.");
  if (!Number.isInteger(question.correctChoiceIndex) || question.correctChoiceIndex < 0 || question.correctChoiceIndex > 3) errors.push("correctChoiceIndex must be 0 through 3.");
  if (!String(question.explanation || "").trim()) errors.push("explanation is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(question.reviewedAt || ""))) errors.push("reviewedAt must use YYYY-MM-DD.");
  if (question.reviewStatus !== "approved") errors.push("reviewStatus must be approved for production play.");
  if (typeof question.active !== "boolean") errors.push("active must be boolean.");
  if (!Number.isInteger(question.version) || question.version < 1) errors.push("version must be a positive integer.");
  return errors;
}

export function validateQuestionBank(questions) {
  if (!Array.isArray(questions)) return { valid: false, errors: ["Question bank must be an array."], questions: [] };
  const seen = new Set();
  const errors = [];
  questions.forEach((question, index) => {
    const rowErrors = validateQuestion(question, seen);
    rowErrors.forEach((error) => errors.push(`Row ${index + 1}: ${error}`));
    if (question?.id) seen.add(question.id);
  });
  return { valid: errors.length === 0, errors, questions };
}

export function playableQuestions(questions) {
  return questions.filter((question) => question.active && question.reviewStatus === "approved" && validateQuestion(question).length === 0);
}
