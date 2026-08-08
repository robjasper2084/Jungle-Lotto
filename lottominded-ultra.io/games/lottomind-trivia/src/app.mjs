import { BADGES, createInitialStats, createQuestionSet, dailyChallengeId, earnedBadges, recordAnswer, summarizeStats } from "./trivia-engine.mjs";
import { CATEGORY_LABELS, MODE_LABELS, TRIVIA_CONFIG } from "./trivia-config.mjs";
import { createTriviaAudio } from "./trivia-audio.mjs";
import { loadGuestProgress, saveGuestResult, serviceAvailability } from "./trivia-services.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const audio = createTriviaAudio();
const screens = new Map($$("[data-screen]").map((screen) => [screen.dataset.screen, screen]));
const liveRegion = $("[data-live-region]");
const feedback = $("[data-feedback]");
const pauseDialog = $("[data-pause-dialog]");
const exitDialog = $("[data-exit-dialog]");
const categoryDialog = $("[data-category-dialog]");
const available = serviceAvailability();

let feedbackTimeout = 0;
let countdownInterval = 0;
let game = null;

function announce(message) {
  liveRegion.textContent = "";
  requestAnimationFrame(() => { liveRegion.textContent = message; });
}

function showScreen(name) {
  screens.forEach((screen, key) => {
    const active = key === name;
    screen.hidden = !active;
    screen.classList.toggle("is-active", active);
  });
  const target = screens.get(name);
  target?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  target?.querySelector("h1, h2, button, a")?.focus({ preventScroll: true });
}

function setServiceState() {
  $("[data-service-state]").textContent = available.reason;
  $("[data-leaderboard-status]").textContent = available.leaderboards
    ? "Verified leaderboard connection is ready. Select a period to load rankings."
    : "Secure leaderboards are not configured in this static build. No names, ranks, or community activity are invented. Your personal records remain available on this device.";
}

function formatCountdown() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const remaining = Math.max(0, next - now);
  const hours = String(Math.floor(remaining / 3600000)).padStart(2, "0");
  const minutes = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  $("[data-daily-countdown]").textContent = `Next local-day display in ${hours}:${minutes}:${seconds}`;
}

function randomSeed(prefix) {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return `${prefix}:${values[0]}:${values[1]}`;
}

function startGame(mode, category = "") {
  clearTimeout(feedbackTimeout);
  const questions = createQuestionSet({ mode, category, seed: randomSeed(mode) });
  game = {
    mode,
    category,
    questions,
    index: 0,
    stats: createInitialStats(mode),
    locked: false,
    paused: false,
    timerId: 0,
    startedAt: 0,
    remainingMs: TRIVIA_CONFIG.questionSeconds * 1000,
    jackpotPlayed: false,
    currentIsJackpot: false,
  };
  $("[data-mode-label]").textContent = MODE_LABELS[mode];
  $("[data-lives-wrap]").hidden = mode !== "survival";
  feedback.hidden = true;
  showScreen("play");
  renderQuestion();
  announce(`${MODE_LABELS[mode]} started. Question one.`);
}

function currentQuestion() {
  return game?.questions[game.index] || null;
}

function refillSurvival() {
  const answered = new Set(game.stats.answers.map((answer) => answer.questionId));
  const next = createQuestionSet({ mode: "survival", seed: randomSeed("survival-refill") })
    .filter((question) => !answered.has(question.id));
  game.questions.push(...(next.length ? next : createQuestionSet({ mode: "survival", seed: randomSeed("survival-cycle") })));
}

function unlockJackpotRound() {
  if (game.mode !== "quick" || game.jackpotPlayed || game.stats.correct < TRIVIA_CONFIG.jackpotUnlockCorrect) return false;
  const answered = new Set(game.stats.answers.map((answer) => answer.questionId));
  const jackpot = createQuestionSet({ mode: "survival", seed: randomSeed("jackpot") })
    .find((question) => question.difficulty === "hard" && !answered.has(question.id));
  if (!jackpot) return false;
  game.questions.push(jackpot);
  game.jackpotPlayed = true;
  game.currentIsJackpot = true;
  audio.vault();
  screens.get("play").classList.add("is-jackpot-round");
  announce("Jackpot Round unlocked. One difficult bonus question.");
  return true;
}

function advanceQuestion() {
  clearTimeout(feedbackTimeout);
  feedback.hidden = true;
  screens.get("play").classList.remove("has-feedback");
  game.index += 1;
  if (game.mode === "survival" && game.stats.lives <= 0) return finishGame();
  if (game.index >= game.questions.length) {
    if (unlockJackpotRound()) return renderQuestion();
    if (game.mode === "survival") refillSurvival();
    else return finishGame();
  }
  game.currentIsJackpot = game.mode === "quick" && game.jackpotPlayed && game.index === game.questions.length - 1;
  renderQuestion();
}

function renderQuestion() {
  const question = currentQuestion();
  if (!question) return finishGame();
  game.locked = false;
  game.paused = false;
  game.remainingMs = TRIVIA_CONFIG.questionSeconds * 1000;
  $("[data-category]").textContent = question.categoryLabel;
  $("[data-difficulty]").textContent = question.difficulty;
  $("[data-jackpot-label]").hidden = !game.currentIsJackpot;
  $("[data-question-text]").textContent = question.question;
  const totalLabel = game.mode === "survival" ? `${game.index + 1}` : `${game.index + 1} / ${game.questions.length}`;
  $("[data-question-number]").textContent = game.currentIsJackpot ? "Jackpot" : totalLabel;
  $("[data-score]").textContent = game.stats.score.toLocaleString();
  $("[data-streak]").textContent = String(game.stats.streak);
  $("[data-lives]").textContent = String(game.stats.lives ?? "");
  const progressTotal = game.mode === "survival" ? Math.max(1, game.index + 1) : game.questions.length;
  $("[data-progress-bar]").style.transform = `scaleX(${Math.min(1, (game.index + 1) / progressTotal)})`;

  const choices = $("[data-choices]");
  choices.replaceChildren(...question.choices.map((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vault-choice";
    button.dataset.choiceIndex = String(index);
    button.setAttribute("aria-label", `${index + 1}. ${choice}`);
    const key = document.createElement("b");
    key.textContent = String(index + 1);
    key.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = choice;
    button.append(key, label);
    return button;
  }));
  startTimer();
  choices.querySelector("button")?.focus({ preventScroll: true });
}

function updateTimer() {
  if (!game || game.locked || game.paused) return;
  game.remainingMs = Math.max(0, game.remainingMs - (performance.now() - game.startedAt));
  game.startedAt = performance.now();
  const ratio = game.remainingMs / (TRIVIA_CONFIG.questionSeconds * 1000);
  $("[data-timer-text]").textContent = (game.remainingMs / 1000).toFixed(1);
  $("[data-timer-bar]").style.transform = `scaleX(${ratio})`;
  $(".vault-timer").classList.toggle("is-low", ratio <= 0.25);
  if (game.remainingMs <= 0) chooseAnswer(-1, true);
}

function startTimer() {
  clearInterval(game.timerId);
  game.startedAt = performance.now();
  updateTimer();
  game.timerId = setInterval(updateTimer, 100);
}

function stopTimer() {
  if (!game) return;
  clearInterval(game.timerId);
  game.timerId = 0;
}

function applyJackpotBonus(stats, correct) {
  if (!game.currentIsJackpot || !correct) return stats;
  const answers = stats.answers.slice();
  const last = answers.at(-1);
  answers[answers.length - 1] = { ...last, points: last.points + TRIVIA_CONFIG.scoring.jackpotBonus };
  return { ...stats, score: stats.score + TRIVIA_CONFIG.scoring.jackpotBonus, answers };
}

function chooseAnswer(selectedChoiceIndex, timedOut = false) {
  if (!game || game.locked || game.paused) return;
  game.locked = true;
  stopTimer();
  const question = currentQuestion();
  const answerMs = Math.round(TRIVIA_CONFIG.questionSeconds * 1000 - game.remainingMs);
  const correct = !timedOut && selectedChoiceIndex === question.correctChoiceIndex;
  game.stats = applyJackpotBonus(recordAnswer(game.stats, question, selectedChoiceIndex, answerMs, timedOut), correct);
  const lastAnswer = game.stats.answers.at(-1);

  $$(".vault-choice").forEach((button, index) => {
    button.disabled = true;
    if (index === question.correctChoiceIndex) button.classList.add("is-correct");
    if (!correct && index === selectedChoiceIndex) button.classList.add("is-incorrect");
  });
  $("[data-score]").textContent = game.stats.score.toLocaleString();
  $("[data-streak]").textContent = String(game.stats.streak);
  $("[data-lives]").textContent = String(game.stats.lives ?? "");

  feedback.classList.toggle("is-correct", correct);
  feedback.classList.toggle("is-incorrect", !correct);
  $("[data-feedback-signal]").textContent = timedOut ? "Time expired" : "Signal analyzed";
  $("[data-feedback-title]").textContent = correct ? "Correct signal" : timedOut ? "Signal timed out" : "Signal missed";
  $("[data-feedback-explanation]").textContent = question.explanation;
  $("[data-feedback-points]").textContent = `+${lastAnswer.points}`;
  const source = $("[data-feedback-source]");
  source.replaceChildren();
  if (question.sourceName && question.sourceUrl) {
    const link = document.createElement("a");
    link.href = question.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `Source: ${question.sourceName}`;
    source.append(link);
  }
  feedback.hidden = false;
  screens.get("play").classList.add("has-feedback");
  correct ? audio.correct() : audio.incorrect();
  announce(`${$("[data-feedback-title]").textContent}. ${question.explanation} ${lastAnswer.points} points earned.`);
  $("[data-continue]").focus({ preventScroll: true });
  feedbackTimeout = setTimeout(advanceQuestion, TRIVIA_CONFIG.feedbackDelayMs);
}

function pauseGame(dialog = pauseDialog) {
  if (!game || game.locked || game.paused) return;
  updateTimer();
  stopTimer();
  game.paused = true;
  dialog.showModal();
}

function resumeGame() {
  if (!game || game.locked || !game.paused) return;
  game.paused = false;
  startTimer();
  announce("Game resumed.");
}

function finishGame() {
  stopTimer();
  clearTimeout(feedbackTimeout);
  screens.get("play").classList.remove("has-feedback", "is-jackpot-round");
  feedback.hidden = true;
  const summary = summarizeStats(game.stats);
  const before = loadGuestProgress();
  const badges = earnedBadges(summary, before);
  const dailyDate = game.mode === "daily" ? dailyChallengeId(new Date()).replace("daily-", "") : "";
  const saved = saveGuestResult({ mode: game.mode, score: summary.score, correct: summary.correct, badges, dailyDate });

  $("[data-result-score]").textContent = summary.score.toLocaleString();
  $("[data-result-correct]").textContent = String(summary.correct);
  $("[data-result-incorrect]").textContent = String(summary.incorrect);
  $("[data-result-accuracy]").textContent = `${summary.accuracy}%`;
  $("[data-result-fastest]").textContent = summary.fastestAnswerMs === null ? "--" : `${(summary.fastestAnswerMs / 1000).toFixed(2)} sec`;
  $("[data-result-streak]").textContent = String(summary.longestStreak);
  $("[data-result-credits]").textContent = available.creditRewards ? "Pending authoritative server result" : "Not enabled";
  $("[data-record-message]").textContent = saved.isRecord ? "New personal record stored on this device." : "Run stored in your local guest record.";

  const categoryResults = $("[data-category-results]");
  categoryResults.replaceChildren(...Object.entries(summary.categoryPerformance).map(([category, result]) => {
    const row = document.createElement("div");
    row.className = "vault-category-row";
    const name = document.createElement("span");
    name.textContent = CATEGORY_LABELS[category];
    const score = document.createElement("strong");
    score.textContent = `${result.correct}/${result.total}`;
    row.append(name, score);
    return row;
  }));

  const badgeResults = $("[data-badge-results]");
  const badgeLabels = new Map(BADGES.map((badge) => [badge.id, badge.label]));
  const unlocked = badges.length ? badges : ["No new badge this run"];
  badgeResults.replaceChildren(...unlocked.map((badgeId) => {
    const chip = document.createElement("span");
    chip.className = "vault-badge-chip";
    chip.textContent = badgeLabels.get(badgeId) || badgeId;
    return chip;
  }));
  showScreen("results");
  announce(`Run complete. Final score ${summary.score}. Accuracy ${summary.accuracy} percent.`);
}

function renderRecords() {
  const progress = loadGuestProgress();
  const labels = [
    ["Games played", progress.gamesPlayed],
    ["Quick best", progress.bestScores.quick || 0],
    ["Daily best", progress.bestScores.daily || 0],
    ["Survival answers", progress.survivalBest || 0],
    ["Category best", progress.bestScores.category || 0],
    ["Daily streak", progress.dailyStreak || 0],
    ["Badges", progress.badges.length],
    ["Profile", "Private guest"],
  ];
  $("[data-record-grid]").replaceChildren(...labels.map(([label, value]) => {
    const article = document.createElement("article");
    const title = document.createElement("span");
    title.textContent = label;
    const output = document.createElement("strong");
    output.textContent = String(value);
    article.append(title, output);
    return article;
  }));
  const badgeLabels = new Map(BADGES.map((badge) => [badge.id, badge.label]));
  const earned = progress.badges.length ? progress.badges : ["No badges earned yet"];
  $("[data-earned-badges]").replaceChildren(...earned.map((badgeId) => {
    const chip = document.createElement("span");
    chip.className = "vault-badge-chip";
    chip.textContent = badgeLabels.get(badgeId) || badgeId;
    return chip;
  }));
  showScreen("records");
}

async function shareResult() {
  if (!game) return;
  const summary = summarizeStats(game.stats);
  const text = `I scored ${summary.score.toLocaleString()} in LottoMind Trivia Vault with ${summary.accuracy}% accuracy. Test your knowledge. Unlock the vault.`;
  try {
    if (navigator.share) await navigator.share({ title: "LottoMind Trivia Vault", text, url: location.href });
    else {
      await navigator.clipboard.writeText(`${text} ${location.href}`);
      announce("Share result copied. Daily answers were not included.");
    }
  } catch (error) {
    if (error?.name !== "AbortError") announce("Share was not available. Your result remains on screen.");
  }
}

function buildCategoryOptions() {
  const root = $("[data-category-options]");
  root.replaceChildren(...Object.entries(CATEGORY_LABELS).map(([id, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vault-category-option";
    button.dataset.category = id;
    button.innerHTML = `${label}<span>10 reviewed questions</span>`;
    return button;
  }));
}

$("[data-choices]").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-choice-index]");
  if (button) chooseAnswer(Number(button.dataset.choiceIndex));
});
$$('[data-start-mode]').forEach((button) => button.addEventListener("click", () => { audio.select(); startGame(button.dataset.startMode); }));
$("[data-open-category]").addEventListener("click", () => { audio.select(); categoryDialog.showModal(); });
$("[data-category-options]").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  categoryDialog.close();
  startGame("category", button.dataset.category);
});
$("[data-continue]").addEventListener("click", advanceQuestion);
$("[data-pause]").addEventListener("click", () => pauseGame());
$("[data-exit]").addEventListener("click", () => pauseGame(exitDialog));
pauseDialog.addEventListener("close", resumeGame);
exitDialog.addEventListener("close", () => {
  if (exitDialog.returnValue === "exit") {
    stopTimer();
    game = null;
    showScreen("launcher");
    announce("Run exited. No score was saved.");
  } else resumeGame();
});
$("[data-mute]").addEventListener("click", (event) => {
  const enabled = audio.setEnabled(!audio.enabled);
  event.currentTarget.setAttribute("aria-pressed", String(enabled));
  event.currentTarget.textContent = enabled ? "Sound on" : "Sound off";
  announce(enabled ? "Game sound enabled." : "Game sound muted.");
});
$("[data-play-again]").addEventListener("click", () => startGame(game.mode, game.category));
$("[data-change-mode]").addEventListener("click", () => showScreen("launcher"));
$("[data-share]").addEventListener("click", shareResult);
$("[data-open-records]").addEventListener("click", renderRecords);
$("[data-open-leaderboards]").addEventListener("click", () => showScreen("leaderboards"));
$$('[data-back-launcher]').forEach((button) => button.addEventListener("click", () => showScreen("launcher")));
$$('[data-board]').forEach((button) => button.addEventListener("click", () => {
  $$('[data-board]').forEach((tab) => tab.setAttribute("aria-selected", String(tab === button)));
  if (!available.leaderboards) {
    $("[data-leaderboard-status]").textContent = `${button.textContent} rankings require the secure Trivia service. No sample rankings are displayed.`;
  }
}));

document.addEventListener("keydown", (event) => {
  if (!game || screens.get("play").hidden || document.querySelector("dialog[open]")) return;
  if (/^[1-4]$/.test(event.key) && !game.locked && !game.paused) {
    event.preventDefault();
    chooseAnswer(Number(event.key) - 1);
  } else if (event.key.toLowerCase() === "p") {
    event.preventDefault();
    pauseGame();
  } else if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    $("[data-mute]").click();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game && !game.locked && !game.paused && !screens.get("play").hidden) pauseGame();
});

buildCategoryOptions();
setServiceState();
formatCountdown();
countdownInterval = setInterval(formatCountdown, 1000);
window.addEventListener("pagehide", () => { clearInterval(countdownInterval); stopTimer(); audio.stop(); }, { once: true });
