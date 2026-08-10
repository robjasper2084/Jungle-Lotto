import { CATEGORIES } from "../src/config.mjs";
import { validateQuestion, validateQuestionBank } from "../src/question-schema.mjs";
import { questionService } from "../src/services.mjs";

const DRAFT_KEY = "lottomind.trivia-vault.authoring-draft.v1";
const rows = document.querySelector("#question-rows");
const summary = document.querySelector("#summary");
const status = document.querySelector("#status");
const search = document.querySelector("#search");
const categoryFilter = document.querySelector("#category-filter");
const difficultyFilter = document.querySelector("#difficulty-filter");
const dialog = document.querySelector("#question-dialog");
const previewDialog = document.querySelector("#preview-dialog");
const form = document.querySelector("#question-form");
const formErrors = document.querySelector("#form-errors");
const categorySelect = form.elements.category;
let questions = [];
let editingId = null;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; } };
const saveDraft = () => localStorage.setItem(DRAFT_KEY, JSON.stringify(questions));
const setStatus = (message) => { status.textContent = message; };

for (const category of CATEGORIES) {
  categoryFilter.add(new Option(category.label, category.id));
  categorySelect.add(new Option(category.label, category.id));
}

function filteredQuestions() {
  const term = search.value.trim().toLowerCase();
  return questions.filter((question) => (!term || [question.id, question.question, ...(question.tags || [])].join(" ").toLowerCase().includes(term)) && (!categoryFilter.value || question.category === categoryFilter.value) && (!difficultyFilter.value || question.difficulty === difficultyFilter.value));
}

function render() {
  const filtered = filteredQuestions();
  summary.innerHTML = `<span>${questions.length} total</span><span>${questions.filter((q) => q.active).length} active</span><span>${questions.filter((q) => q.reviewStatus === "approved").length} approved</span><span>${filtered.length} visible</span>`;
  rows.innerHTML = filtered.map((question) => `<tr class="${question.active ? "" : "inactive"}"><td><span class="status-pill ${question.reviewStatus}">${escapeHtml(question.reviewStatus)}</span></td><td><code>${escapeHtml(question.id)}</code></td><td>${escapeHtml(question.category)}</td><td>${escapeHtml(question.difficulty)}</td><td>${escapeHtml(question.question)}</td><td>${escapeHtml(question.editedBy || "unknown")}<br><small>${escapeHtml(question.editedAt || "")}</small></td><td><div class="row-actions"><button data-edit="${escapeHtml(question.id)}">Edit</button><button data-preview="${escapeHtml(question.id)}">Preview</button><button data-toggle="${escapeHtml(question.id)}">${question.active ? "Deactivate" : "Activate"}</button></div></td></tr>`).join("");
}

function questionFromForm() {
  return { id: form.elements.id.value.trim(), category: form.elements.category.value, difficulty: form.elements.difficulty.value, question: form.elements.question.value.trim(), choices: [0,1,2,3].map((index) => form.elements[`choice${index}`].value.trim()), correctChoiceIndex: Number(form.elements.correctChoiceIndex.value), explanation: form.elements.explanation.value.trim(), sourceName: form.elements.sourceName.value.trim(), sourceUrl: form.elements.sourceUrl.value.trim(), reviewedAt: form.elements.reviewedAt.value, reviewStatus: form.elements.reviewStatus.value, active: form.elements.active.value === "true", tags: form.elements.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean), version: Number(form.elements.version.value || 1), editedBy: form.elements.editedBy.value.trim(), editedAt: new Date().toISOString() };
}

function fillForm(question = {}) {
  editingId = question.id || null; form.reset();
  form.elements.id.value = question.id || ""; form.elements.category.value = question.category || CATEGORIES[0].id; form.elements.difficulty.value = question.difficulty || "easy"; form.elements.reviewStatus.value = question.reviewStatus || "draft"; form.elements.question.value = question.question || "";
  [0,1,2,3].forEach((index) => { form.elements[`choice${index}`].value = question.choices?.[index] || ""; });
  form.elements.correctChoiceIndex.value = question.correctChoiceIndex ?? 0; form.elements.active.value = String(question.active ?? false); form.elements.explanation.value = question.explanation || ""; form.elements.sourceName.value = question.sourceName || ""; form.elements.sourceUrl.value = question.sourceUrl || ""; form.elements.reviewedAt.value = question.reviewedAt || new Date().toISOString().slice(0,10); form.elements.tags.value = (question.tags || []).join(", "); form.elements.editedBy.value = question.editedBy || "Local editor"; form.elements.version.value = question.version || 1; formErrors.textContent = ""; dialog.showModal();
}

function showPreview(question) {
  document.querySelector("#preview-content").innerHTML = `<p>${escapeHtml(question.category)} · ${escapeHtml(question.difficulty)}</p><h2>${escapeHtml(question.question)}</h2>${question.choices.map((choice,index) => `<div class="choice ${index === question.correctChoiceIndex ? "correct" : ""}">${index + 1}. ${escapeHtml(choice)} ${index === question.correctChoiceIndex ? "✓" : ""}</div>`).join("")}<p><strong>Explanation:</strong> ${escapeHtml(question.explanation)}</p>`;
  previewDialog.showModal();
}

function parseCsv(text) {
  const records = []; let row = []; let field = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index += 1; row.push(field); if (row.some((cell) => cell.trim())) records.push(row); row = []; field = ""; }
    else field += char;
  }
  row.push(field); if (row.some((cell) => cell.trim())) records.push(row);
  const headers = records.shift()?.map((header) => header.trim()) || [];
  return records.map((values) => Object.fromEntries(headers.map((header,index) => [header, values[index] || ""]))).map((item) => ({ ...item, choices: item.choices ? JSON.parse(item.choices) : [item.choice0,item.choice1,item.choice2,item.choice3], correctChoiceIndex: Number(item.correctChoiceIndex), active: String(item.active).toLowerCase() === "true", version: Number(item.version || 1), tags: String(item.tags || "").split("|").filter(Boolean) }));
}

async function importFile(file) {
  const text = await file.text(); let imported;
  try { imported = file.name.toLowerCase().endsWith(".csv") ? parseCsv(text) : JSON.parse(text); } catch (error) { throw new Error(`Invalid ${file.name.toLowerCase().endsWith(".csv") ? "CSV" : "JSON"}: ${error.message}`); }
  const validation = validateQuestionBank(imported);
  if (!validation.valid) throw new Error(validation.errors.slice(0, 6).join(" "));
  const currentIds = new Set(questions.map((question) => question.id));
  const duplicates = imported.filter((question) => currentIds.has(question.id)).map((question) => question.id);
  if (duplicates.length) throw new Error(`Duplicate IDs already exist: ${duplicates.slice(0, 8).join(", ")}`);
  questions.push(...imported.map((question) => ({ ...question, editedAt: new Date().toISOString(), editedBy: question.editedBy || "Imported locally" }))); saveDraft(); render(); setStatus(`Imported ${imported.length} validated questions into the local draft.`);
}

function exportBackup() {
  const blob = new Blob([`${JSON.stringify(questions, null, 2)}\n`], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `lottomind-trivia-backup-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); setStatus("Exported a complete local backup.");
}

document.querySelector("#add-question").addEventListener("click", () => fillForm());
document.querySelector("#import-button").addEventListener("click", () => document.querySelector("#import-file").click());
document.querySelector("#export-button").addEventListener("click", exportBackup);
document.querySelector("#import-file").addEventListener("change", async (event) => { try { await importFile(event.target.files[0]); } catch (error) { setStatus(error.message); } event.target.value = ""; });
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
document.querySelector("#close-preview").addEventListener("click", () => previewDialog.close());
document.querySelector("#preview-question").addEventListener("click", () => showPreview(questionFromForm()));
[search, categoryFilter, difficultyFilter].forEach((input) => input.addEventListener("input", render));

rows.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit]"); const preview = event.target.closest("[data-preview]"); const toggle = event.target.closest("[data-toggle]");
  if (edit) fillForm(questions.find((question) => question.id === edit.dataset.edit));
  if (preview) showPreview(questions.find((question) => question.id === preview.dataset.preview));
  if (toggle) { const question = questions.find((item) => item.id === toggle.dataset.toggle); question.active = !question.active; question.editedAt = new Date().toISOString(); question.editedBy ||= "Local editor"; saveDraft(); render(); }
});

form.addEventListener("submit", (event) => {
  event.preventDefault(); const next = questionFromForm(); const seen = new Set(questions.filter((question) => question.id !== editingId).map((question) => question.id)); const errors = validateQuestion(next, seen);
  if (errors.length) { formErrors.textContent = errors.join(" "); return; }
  const existing = questions.findIndex((question) => question.id === editingId); if (existing >= 0) questions[existing] = next; else questions.push(next); saveDraft(); render(); dialog.close(); setStatus(`Saved ${next.id} to the local authoring draft.`);
});

async function init() {
  const draft = readDraft(); questions = Array.isArray(draft) ? draft : await questionService.all(); saveDraft(); render(); setStatus(Array.isArray(draft) ? "Loaded local authoring draft." : "Loaded reviewed repository question bank.");
}
init().catch((error) => setStatus(`Question manager failed to load: ${error.message}`));
