import { CATEGORIES, TRIVIA_CONFIG } from "./config.mjs";
import {
  answerIndexFromKey,
  calculateAnswerScore,
  canUnlockJackpot,
  dailyChallengeId,
  isSessionExpired,
  makeDemoSession,
  resultsFromAnswers,
  selectDailyQuestions,
  shuffleSeeded,
  survivalDifficulty,
} from "./engine.mjs";
import { accountService, leaderboardService, questionService, storageService, track } from "./services.mjs";

const root = document.querySelector("#game-root");
const liveRegion = document.querySelector("#live-region");
const muteButton = document.querySelector("#mute-button");
const settingsButton = document.querySelector("#settings-button");
const settingsDialog = document.querySelector("#settings-dialog");
const exitDialog = document.querySelector("#exit-dialog");
const reducedEffectsInput = document.querySelector("#reduced-effects");
const vibrationInput = document.querySelector("#vibration-enabled");
const autoContinueInput = document.querySelector("#auto-continue");

const state = {
  view: "home",
  mode: null,
  category: null,
  questions: [],
  question: null,
  usedQuestionIds: new Set(),
  index: 0,
  score: 0,
  streak: 0,
  lives: 3,
  answers: [],
  feedback: null,
  locked: false,
  paused: false,
  remainingMs: 0,
  questionStartedAt: 0,
  timerId: null,
  continueId: null,
  session: null,
  startedAt: 0,
  result: null,
  newRecord: false,
  newBadges: [],
  leaderboardBoard: "daily",
  settings: storageService.getSettings(),
  progress: storageService.getProgress(),
  account: { authenticated: false },
};

const BADGES = Object.freeze([
  { id: "first-vault", name: "First Vault Opened", icon: "◇", test: ({ progress }) => progress.gamesPlayed >= 1 },
  { id: "perfect-ten", name: "Perfect Ten", icon: "10", test: ({ mode, result }) => mode === "quick" && result.correct === 10 },
  { id: "five-streak", name: "Five-Answer Streak", icon: "5", test: ({ result }) => result.longestStreak >= 5 },
  { id: "mystery-expert", name: "Mystery Expert", icon: "?", test: ({ mode, category, result }) => mode === "category" && category === "mystery-mix" && result.accuracy >= 80 },
  { id: "detroit-scholar", name: "Detroit Scholar", icon: "D", test: ({ mode, category, result }) => mode === "category" && category === "detroit-history-culture" && result.accuracy >= 80 },
  { id: "number-mind", name: "Number Mind", icon: "∞", test: ({ mode, category, result }) => mode === "category" && category === "numbers-numerology" && result.accuracy >= 80 },
  { id: "survival-25", name: "Survival 25", icon: "25", test: ({ mode, result }) => mode === "survival" && result.correct >= 25 },
  { id: "daily-seven", name: "Daily Vault Seven-Day Streak", icon: "7", test: ({ progress }) => consecutiveDayStreak(progress.dailyDates) >= 7 },
]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function categoryLabel(id) { return CATEGORIES.find((category) => category.id === id)?.label || id; }
function formatTime(ms) { return Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)}s` : "—"; }
function scoreBucket(score) { return score >= 2000 ? "2000+" : score >= 1000 ? "1000-1999" : score >= 500 ? "500-999" : "0-499"; }
function announce(message) { liveRegion.textContent = ""; requestAnimationFrame(() => { liveRegion.textContent = message; }); }

function toast(message) {
  document.querySelector(".toast")?.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.setAttribute("role", "status");
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 2800);
}

function applySettings() {
  document.documentElement.classList.toggle("reduced-effects", state.settings.reducedEffects);
  muteButton.setAttribute("aria-pressed", String(state.settings.muted));
  muteButton.textContent = state.settings.muted ? "Sound: Off" : "Sound: On";
  reducedEffectsInput.checked = state.settings.reducedEffects;
  vibrationInput.checked = state.settings.vibration;
  autoContinueInput.checked = state.settings.autoContinue;
}

let audioContext = null;
function sound(kind) {
  if (state.settings.muted) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const tones = { reveal: [330, .06], correct: [660, .14], incorrect: [140, .15], streak: [880, .12], warning: [210, .05], vault: [520, .22], results: [420, .18] };
    const [frequency, duration] = tones[kind] || tones.reveal;
    oscillator.frequency.value = frequency;
    oscillator.type = kind === "incorrect" ? "sawtooth" : "sine";
    gain.gain.setValueAtTime(state.settings.reducedEffects ? .025 : .05, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* audio is optional */ }
}

function vibrate(pattern) {
  if (state.settings.vibration && navigator.vibrate) navigator.vibrate(pattern);
}

function renderHome() {
  stopTimer(); clearContinue(); state.view = "home"; state.mode = null;
  const played = state.progress.gamesPlayed || 0;
  const badges = Object.keys(state.progress.badges || {}).length;
  const best = Math.max(0, ...Object.values(state.progress.bestScores || {}).map(Number));
  const dailyId = dailyChallengeId();
  root.innerHTML = `<section class="home-screen" aria-labelledby="vault-title">
    <div class="hero-terminal">
      <div>
        <span class="eyebrow">Knowledge reactor online</span>
        <h1 id="vault-title">Trivia<br>Vault</h1>
        <p>Test Your Knowledge. Unlock the Vault. Play as a guest—no sign-in wall, no wallet simulation, no lottery promises.</p>
        <div class="hero-actions"><button class="primary-button" data-mode="quick">Start Quick Play</button><button class="secondary-button" data-view="leaderboard">Local Boards</button><button class="secondary-button" data-view="badges">Badges</button></div>
      </div>
      <div class="reactor" role="img" aria-label="Trivia Vault reactor"><img src="../../assets/custom/studio/studio-brain-coin.webp" alt="" /></div>
    </div>
    <div class="status-strip" aria-label="Local game status">
      <div class="status-chip"><span>Games played</span><strong>${played}</strong></div>
      <div class="status-chip"><span>Best score</span><strong>${best.toLocaleString()}</strong></div>
      <div class="status-chip"><span>Badges</span><strong>${badges}/${BADGES.length}</strong></div>
      <div class="status-chip"><span>Secure credits</span><strong>Disabled</strong></div>
    </div>
    <section class="panel" aria-labelledby="mode-heading">
      <div class="section-heading"><div><span class="signal-label">Choose a signal</span><h2 id="mode-heading">Game Modes</h2><p>Every mode uses the same transparent scoring rules.</p></div><span class="signal-label">154 reviewed questions</span></div>
      <div class="mode-grid">${Object.values(TRIVIA_CONFIG.modes).filter((mode) => mode.id !== "jackpot").map((mode) => `<button class="mode-card" data-mode="${mode.id}"><span>${mode.id === "daily" ? "Once per UTC day" : mode.id === "survival" ? "Three lives" : mode.id === "category" ? "Seven lanes" : "10 questions"}</span><strong>${mode.label}</strong><small>${mode.description}</small></button>`).join("")}</div>
    </section>
    <section class="panel daily-panel" aria-labelledby="daily-heading"><div><span class="signal-label">${dailyId}</span><h2 id="daily-heading">Daily Vault</h2><p>Next shared demo challenge begins at <b id="daily-reset">calculating…</b>.</p><span class="demo-notice">Static demo: score only. Secure credits and global rankings are disabled.</span></div><button class="primary-button" data-mode="daily">Enter Daily Vault</button></section>
  </section>`;
  updateDailyCountdown();
  track("trivia_game_opened");
}

function updateDailyCountdown() {
  const target = document.querySelector("#daily-reset");
  if (!target) return;
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const ms = next - now;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  target.textContent = `${next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (${hours}h ${minutes}m)`;
}

function renderCategorySelect() {
  state.view = "category-select";
  root.innerHTML = `<section class="panel"><div class="section-heading"><div><span class="signal-label">Category Run</span><h1>Choose a Knowledge Lane</h1><p>Ten questions from one focused category.</p></div><button class="secondary-button" data-view="home">Back</button></div><div class="category-grid">${CATEGORIES.map((category) => `<button class="category-card" data-category="${category.id}"><span class="category-icon">${category.icon}</span><strong>${category.label}</strong><small>Balanced easy, medium, and hard signals.</small></button>`).join("")}</div></section>`;
}

function renderLoading(message = "Loading reviewed question signals…") {
  root.innerHTML = `<section class="loading-screen" role="status"><span class="loader"></span><h1>Opening Vault</h1><p>${escapeHtml(message)}</p></section>`;
}

async function loadModeQuestions(mode, category) {
  const seed = `${mode}:${category || "mixed"}:${Date.now()}`;
  if (mode === "category") return shuffleSeeded(await questionService.category(category), seed).slice(0, TRIVIA_CONFIG.modes.category.questionCount);
  if (mode === "daily") {
    const categoryIds = shuffleSeeded(CATEGORIES.map((item) => item.id), `${dailyChallengeId()}:categories`).slice(0, 5);
    const pool = await questionService.categories(categoryIds);
    return selectDailyQuestions(pool).questions;
  }
  if (mode === "survival") return shuffleSeeded(await questionService.all(), seed);
  if (mode === "jackpot") {
    const categoryIds = shuffleSeeded(CATEGORIES.map((item) => item.id), seed).slice(0, 2);
    const pool = (await questionService.categories(categoryIds)).filter((question) => question.difficulty === "hard");
    return shuffleSeeded(pool, seed).slice(0, 1);
  }
  const categoryIds = shuffleSeeded(CATEGORIES.map((item) => item.id), seed).slice(0, 4);
  const pool = await questionService.categories(categoryIds);
  const byDifficulty = ["easy", "medium", "hard"].flatMap((difficulty) => shuffleSeeded(pool.filter((question) => question.difficulty === difficulty), `${seed}:${difficulty}`).slice(0, difficulty === "hard" ? 2 : 4));
  return shuffleSeeded(byDifficulty, `${seed}:final`).slice(0, 10);
}

async function startMode(mode, category = null, options = {}) {
  if (mode === "category" && !category) { renderCategorySelect(); return; }
  renderLoading();
  track("trivia_mode_selected", { mode, category });
  try {
    const questions = await loadModeQuestions(mode, category);
    if (!questions.length) throw new Error("No reviewed questions are available for this mode.");
    state.view = "playing"; state.mode = mode; state.category = category; state.questions = questions;
    state.index = 0; state.score = options.carryScore || 0; state.streak = options.carryStreak || 0; state.lives = TRIVIA_CONFIG.modes[mode].lives || 3;
    state.answers = options.carryAnswers || []; state.feedback = null; state.locked = false; state.paused = false; state.usedQuestionIds = new Set(); state.startedAt = Date.now();
    state.session = makeDemoSession({ mode, questionIds: questions.map((question) => question.id) });
    selectCurrentQuestion();
    renderQuestion();
    track("trivia_round_started", { mode, category });
  } catch (error) { renderError(error); }
}

function selectCurrentQuestion() {
  if (state.mode !== "survival") {
    state.question = state.questions[state.index] || null;
    return;
  }
  if (state.usedQuestionIds.size >= state.questions.length) {
    state.usedQuestionIds.clear();
    state.questions = shuffleSeeded(state.questions, `survival-cycle:${state.answers.length}`);
  }
  const targetDifficulty = survivalDifficulty(state.answers.filter((answer) => answer.correct).length);
  const available = state.questions.filter((question) => !state.usedQuestionIds.has(question.id));
  state.question = available.find((question) => question.difficulty === targetDifficulty) || available[0] || null;
}

function progressPercent() {
  const count = TRIVIA_CONFIG.modes[state.mode].questionCount;
  if (state.mode === "survival") return Math.min(100, (state.answers.length % 10) * 10);
  return Math.round((state.index / Math.max(1, count)) * 100);
}

function renderQuestion() {
  if (!state.question) { finishRound(); return; }
  clearContinue(); stopTimer(); state.locked = false; state.feedback = null; state.paused = false;
  const mode = TRIVIA_CONFIG.modes[state.mode];
  const count = mode.questionCount || "∞";
  const questionNumber = state.mode === "jackpot" ? "BONUS" : state.answers.length + 1;
  root.innerHTML = `<section class="game-shell" aria-label="${mode.label} game">
    <div class="hud">
      <div class="hud-cell"><span>Mode</span><strong>${mode.label}</strong></div>
      <div class="hud-cell"><span>Question</span><strong>${questionNumber} / ${count}</strong></div>
      <div class="hud-cell"><span>Score</span><strong id="score-value">${state.score.toLocaleString()}</strong></div>
      <div class="hud-cell"><span>Streak</span><strong id="streak-value">${state.streak}</strong></div>
      <div class="hud-cell"><span>${state.mode === "survival" ? "Lives" : "Progress"}</span><strong id="mode-status-value">${state.mode === "survival" ? "♥".repeat(state.lives) : `${progressPercent()}%`}</strong></div>
      <div class="hud-actions"><button type="button" data-action="pause" aria-label="${state.mode === "daily" ? "Pause unavailable in Daily Vault" : "Pause game"}" ${state.mode === "daily" ? "disabled" : ""}>Ⅱ</button><button type="button" data-action="exit" aria-label="Exit round">×</button></div>
    </div>
    <div class="progress-track" role="progressbar" aria-label="Round progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent()}" style="--progress:${progressPercent()}%"><span></span></div>
    <article class="panel question-panel" aria-labelledby="question-heading">
      <div class="question-meta"><div><span>${escapeHtml(categoryLabel(state.question.category))}</span><span class="difficulty">${escapeHtml(state.question.difficulty)}</span></div><div class="timer-wrap" id="timer" role="timer" aria-label="${mode.seconds} seconds remaining" style="--timer:100%"><strong>${mode.seconds}</strong></div></div>
      <div class="question-copy"><h1 id="question-heading">${escapeHtml(state.question.question)}</h1></div>
      <div class="answers" role="group" aria-label="Answer choices">${state.question.choices.map((choice, index) => `<button class="answer-choice" data-answer="${index}" type="button"><span class="key" aria-hidden="true">${index + 1}</span><span class="answer-text">${escapeHtml(choice)}</span><span class="answer-state" aria-hidden="true"></span></button>`).join("")}</div>
    </article>
  </section>`;
  state.usedQuestionIds.add(state.question.id);
  window.scrollTo(0, 0);
  state.questionStartedAt = performance.now();
  state.remainingMs = mode.seconds * 1000;
  sound("reveal");
  startTimer();
  document.querySelector("[data-answer]")?.focus({ preventScroll: true });
  announce(`${categoryLabel(state.question.category)}, ${state.question.difficulty}. Question ${questionNumber}. ${mode.seconds} seconds.`);
}

function startTimer() {
  stopTimer();
  let last = performance.now();
  state.timerId = window.setInterval(() => {
    if (state.paused || state.locked) { last = performance.now(); return; }
    const now = performance.now(); state.remainingMs -= now - last; last = now;
    updateTimerDisplay();
    if (state.remainingMs <= 0) submitAnswer(null, true);
  }, 100);
}

function stopTimer() { if (state.timerId) clearInterval(state.timerId); state.timerId = null; }
function clearContinue() { if (state.continueId) clearTimeout(state.continueId); state.continueId = null; }

function updateTimerDisplay() {
  const timer = document.querySelector("#timer"); if (!timer) return;
  const total = TRIVIA_CONFIG.modes[state.mode].seconds * 1000;
  const seconds = Math.max(0, Math.ceil(state.remainingMs / 1000));
  timer.style.setProperty("--timer", `${Math.max(0, (state.remainingMs / total) * 100)}%`);
  timer.querySelector("strong").textContent = seconds;
  timer.setAttribute("aria-label", `${seconds} seconds remaining`);
  timer.classList.toggle("warning", seconds <= 3);
  if (seconds <= 3 && seconds > 0 && !timer.dataset.warned?.includes(String(seconds))) {
    timer.dataset.warned = `${timer.dataset.warned || ""}${seconds}`; sound("warning"); announce(`${seconds} seconds remaining.`);
  }
}

function submitAnswer(selectedIndex, timedOut = false) {
  if (state.locked || state.paused || !state.question) return;
  state.locked = true; stopTimer();
  const correct = selectedIndex === state.question.correctChoiceIndex;
  const elapsedMs = Math.max(0, TRIVIA_CONFIG.modes[state.mode].seconds * 1000 - state.remainingMs);
  const nextStreak = correct ? state.streak + 1 : 0;
  const score = calculateAnswerScore({ correct, difficulty: state.question.difficulty, remainingMs: state.remainingMs, totalMs: TRIVIA_CONFIG.modes[state.mode].seconds * 1000, nextStreak });
  if (correct) { state.streak = nextStreak; state.score += score.total; } else { state.streak = 0; if (state.mode === "survival") state.lives -= 1; }
  const answer = { questionId: state.question.id, category: state.question.category, difficulty: state.question.difficulty, selectedIndex, correct, timedOut, points: score.total, elapsedMs, streakAfter: state.streak };
  state.answers.push(answer);
  state.feedback = { selectedIndex, correct, timedOut, score };
  const scoreValue = document.querySelector("#score-value");
  const streakValue = document.querySelector("#streak-value");
  const modeStatusValue = document.querySelector("#mode-status-value");
  if (scoreValue) scoreValue.textContent = state.score.toLocaleString();
  if (streakValue) streakValue.textContent = state.streak;
  if (modeStatusValue && state.mode === "survival") modeStatusValue.textContent = "♥".repeat(state.lives) || "0";
  sound(correct ? (state.streak >= 3 ? "streak" : "correct") : "incorrect"); vibrate(correct ? 25 : [35, 35, 35]);
  showFeedback();
  track("trivia_question_answered", { mode: state.mode, category: state.question.category, durationBucket: elapsedMs < 5000 ? "fast" : elapsedMs < 10000 ? "medium" : "slow" });
}

function showFeedback() {
  document.querySelectorAll("[data-answer]").forEach((button) => {
    const index = Number(button.dataset.answer); button.disabled = true;
    if (index === state.question.correctChoiceIndex) { button.classList.add("correct"); button.querySelector(".answer-state").textContent = "Correct"; }
    if (!state.feedback.correct && index === state.feedback.selectedIndex) { button.classList.add("incorrect"); button.querySelector(".answer-state").textContent = "Selected"; }
  });
  const panel = document.querySelector(".question-panel");
  const source = state.question.sourceUrl ? `<a href="${escapeHtml(state.question.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(state.question.sourceName || "Source")}</a>` : escapeHtml(state.question.sourceName || "LottoMind editorial guide");
  panel.insertAdjacentHTML("beforeend", `<div class="feedback-panel ${state.feedback.correct ? "correct" : "incorrect"}" role="status"><span class="feedback-icon">${state.feedback.correct ? "✓" : state.feedback.timedOut ? "⌛" : "×"}</span><div><h2>${state.feedback.correct ? `Signal locked +${state.feedback.score.total}` : state.feedback.timedOut ? "Time expired" : "Signal missed"}</h2><p>${escapeHtml(state.question.explanation)}</p><small>Review source: ${source}</small></div><button class="primary-button" data-action="continue">Continue</button></div>`);
  announce(`${state.feedback.correct ? "Correct" : state.feedback.timedOut ? "Time expired" : "Incorrect"}. ${state.question.explanation} ${state.feedback.score.total} points earned.`);
  if (state.settings.autoContinue) state.continueId = setTimeout(continueRound, TRIVIA_CONFIG.feedbackDelayMs);
  document.querySelector('[data-action="continue"]')?.focus({ preventScroll: true });
}

function continueRound() {
  if (!state.locked || !state.feedback) return;
  clearContinue();
  const modeConfig = TRIVIA_CONFIG.modes[state.mode];
  const isDone = state.mode === "survival" ? state.lives <= 0 : state.index + 1 >= modeConfig.questionCount;
  if (isDone) { finishRound(); return; }
  state.index += 1; selectCurrentQuestion(); renderQuestion();
}

function finishRound() {
  stopTimer(); clearContinue();
  if (!state.answers.length) { renderHome(); return; }
  const result = resultsFromAnswers(state.answers, state.score);
  state.result = result;
  state.progress.gamesPlayed = (state.progress.gamesPlayed || 0) + 1;
  state.progress.bestScores ||= {};
  const previousBest = Number(state.progress.bestScores[state.mode] || 0);
  state.newRecord = state.score > previousBest;
  if (state.newRecord) state.progress.bestScores[state.mode] = state.score;
  if (state.mode === "survival") state.progress.bestSurvival = Math.max(state.progress.bestSurvival || 0, result.correct);
  if (state.mode === "daily") state.progress.dailyDates = Array.from(new Set([...(state.progress.dailyDates || []), new Date().toISOString().slice(0, 10)])).sort();
  state.progress.history = [{ id: `${state.mode}-${state.startedAt}`, mode: state.mode, category: state.category, score: state.score, accuracy: result.accuracy, streak: result.longestStreak, completedAt: new Date().toISOString() }, ...(state.progress.history || [])].slice(0, 50);
  state.newBadges = unlockBadges(result);
  storageService.saveProgress(state.progress);
  saveLocalLeaderboard(result);
  state.view = "results";
  renderResults(); window.scrollTo(0, 0); sound(state.newBadges.length ? "vault" : "results");
  track("trivia_round_completed", { mode: state.mode, category: state.category, scoreBucket: scoreBucket(state.score), durationBucket: Date.now() - state.startedAt < 90000 ? "short" : "long" });
}

function unlockBadges(result) {
  state.progress.badges ||= {}; const unlocked = [];
  for (const badge of BADGES) {
    if (!state.progress.badges[badge.id] && badge.test({ mode: state.mode, category: state.category, result, progress: state.progress })) {
      state.progress.badges[badge.id] = { unlockedAt: new Date().toISOString() }; unlocked.push(badge); track("trivia_badge_unlocked", { mode: state.mode });
    }
  }
  return unlocked;
}

function consecutiveDayStreak(dates) {
  const unique = Array.from(new Set(dates || [])).sort().reverse(); if (!unique.length) return 0;
  let streak = 1;
  for (let index = 1; index < unique.length; index += 1) {
    const newer = new Date(`${unique[index - 1]}T00:00:00Z`); const older = new Date(`${unique[index]}T00:00:00Z`);
    if ((newer - older) / 86400000 === 1) streak += 1; else break;
  }
  return streak;
}

function sanitizeDisplayName(value) {
  const blocked = /(?:fuck|shit|bitch|nigg|cunt|slut)/i;
  const clean = String(value || "Local Player").replace(/[^a-z0-9 _.-]/gi, "").trim().slice(0, 24);
  return !clean || blocked.test(clean) ? "Local Player" : clean;
}

function saveLocalLeaderboard(result) {
  const entry = { id: `${state.mode}-${state.startedAt}`, name: sanitizeDisplayName(state.progress.displayName), avatar: "M", score: state.score, accuracy: result.accuracy, streak: result.longestStreak, completionMs: Date.now() - state.startedAt, hidden: Boolean(state.progress.hideProfile), createdAt: new Date().toISOString() };
  leaderboardService.saveLocal("allTime", entry);
  if (state.mode === "daily") leaderboardService.saveLocal("daily", entry);
  if (state.mode === "survival") leaderboardService.saveLocal("survival", entry);
  leaderboardService.saveLocal("weekly", entry);
}

function renderResults() {
  const result = state.result;
  const jackpot = canUnlockJackpot(state.mode, state.answers);
  root.innerHTML = `<section class="results-grid" aria-labelledby="results-heading">
    <div class="panel result-hero"><span class="eyebrow">Vault run complete</span><h1 id="results-heading">${escapeHtml(TRIVIA_CONFIG.modes[state.mode].label)} Results</h1><div class="result-score">${result.score.toLocaleString()}</div>${state.newRecord ? '<span class="record-badge">New personal record</span>' : ""}
      <div class="metric-grid"><div class="metric"><span>Correct</span><strong>${result.correct}</strong></div><div class="metric"><span>Incorrect</span><strong>${result.incorrect}</strong></div><div class="metric"><span>Accuracy</span><strong>${result.accuracy}%</strong></div><div class="metric"><span>Fastest</span><strong>${formatTime(result.fastestAnswerMs)}</strong></div><div class="metric"><span>Longest streak</span><strong>${result.longestStreak}</strong></div><div class="metric"><span>Credits earned</span><strong>0</strong></div></div>
      <div class="hero-actions" style="justify-content:center;margin-top:22px"><button class="primary-button" data-action="play-again">Play Again</button>${jackpot ? '<button class="primary-button" data-action="jackpot">Enter Jackpot Round</button>' : ""}<button class="secondary-button" data-view="home">Change Mode</button><button class="secondary-button" data-action="share">Share Result</button><a class="secondary-button" href="../../arcade/">Return to Arcade</a></div>
    </div>
    <div class="side-stack">
      <section class="panel reward-status"><span class="signal-label">Wallet-safe build</span><h2>Secure Credits Disabled</h2><strong>No wallet balance was changed.</strong><p>The existing backend has no trivia-session or trivia-reward contract. This game awards score and local badge progress only.</p>${state.mode === "daily" ? '<p>Additional Daily attempts remain score-only. No claim was created.</p>' : ""}</section>
      <section class="panel"><h2>Category Performance</h2><div class="category-results">${Object.entries(result.categoryPerformance).map(([category, value]) => `<div class="category-result"><span>${escapeHtml(categoryLabel(category))}</span><b>${value.correct}/${value.total}</b></div>`).join("")}</div></section>
      <section class="panel"><h2>${state.newBadges.length ? "Badges Unlocked" : "Badge Progress"}</h2><div class="badge-list">${(state.newBadges.length ? state.newBadges : BADGES.slice(0, 3)).map((badge) => badgeRow(badge)).join("")}</div></section>
      <section class="panel account-note"><h2>${state.account.authenticated ? "Local progress saved" : "Playing as Guest"}</h2><p>${state.account.authenticated ? "Profile badge sync is disabled until a secure trivia profile endpoint exists." : "Your non-monetary score and badges stay on this device. Sign-in can enable synced profiles when the secure trivia service is connected."}</p></section>
    </div>
  </section>`;
}

function badgeRow(badge) {
  const unlocked = Boolean(state.progress.badges?.[badge.id]);
  return `<div class="badge-row ${unlocked ? "unlocked" : ""}"><span class="badge-mark">${badge.icon}</span><div><strong>${badge.name}</strong><small>${unlocked ? "Unlocked" : "In progress"}</small></div><span>${unlocked ? "✓" : "○"}</span></div>`;
}

function renderBadges() {
  state.view = "badges";
  root.innerHTML = `<section class="panel"><div class="section-heading"><div><span class="signal-label">Local progression</span><h1>Badge Vault</h1><p>Guest progress is saved on this device. No wallet data is stored here.</p></div><button class="secondary-button" data-view="home">Back</button></div><div class="badge-list">${BADGES.map(badgeRow).join("")}</div></section>`;
}

function renderLeaderboard(board = state.leaderboardBoard) {
  state.view = "leaderboard"; state.leaderboardBoard = board;
  const entries = leaderboardService.list(board);
  root.innerHTML = `<section class="panel"><div class="section-heading"><div><span class="signal-label">Private local preview</span><h1>Leaderboards</h1><p>Only runs on this device appear. There are no invented global players or ranks.</p></div><button class="secondary-button" data-view="home">Back</button></div><div class="leaderboard-tabs" role="tablist">${[["daily","Daily"],["weekly","Weekly"],["allTime","All Time"],["survival","Survival"]].map(([id,label]) => `<button role="tab" aria-selected="${board === id}" data-board="${id}">${label}</button>`).join("")}</div>${entries.length ? `<div style="overflow:auto"><table class="leaderboard-table"><thead><tr><th>Rank</th><th>Player</th><th>Score</th><th>Accuracy</th><th>Streak</th></tr></thead><tbody>${entries.slice(0, 20).map((entry,index) => `<tr><td>${index + 1}</td><td>${entry.hidden ? "Private local player" : escapeHtml(entry.name)}</td><td>${Number(entry.score).toLocaleString()}</td><td>${entry.accuracy}%</td><td>${entry.streak}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-state">Finish a matching round to create your first local entry.</div>'}</section>`;
}

function renderError(error) {
  stopTimer(); clearContinue(); state.view = "error";
  root.innerHTML = `<section class="error-screen" role="alert"><span class="eyebrow">Signal interrupted</span><h1>Question Load Failed</h1><p>${escapeHtml(error?.message || "The Trivia Vault could not load this session.")}</p><div class="button-row"><button class="primary-button" data-action="retry">Try Again</button><button class="secondary-button" data-view="home">Return Home</button></div><small>Your completed scores were not erased.</small></section>`;
}

function pauseGame(force = null) {
  if (state.view !== "playing" || state.mode === "daily" || state.locked) return;
  state.paused = force === null ? !state.paused : force;
  document.querySelector(".paused-overlay")?.remove();
  if (state.paused) {
    document.querySelector(".question-panel")?.insertAdjacentHTML("beforeend", '<div class="paused-overlay"><div><span class="eyebrow">Timer held</span><h2>Game Paused</h2><button class="primary-button" data-action="pause">Resume</button></div></div>');
    announce("Game paused.");
  } else { announce("Game resumed."); }
}

function openExitDialog() {
  if (exitDialog.open) return;
  exitDialog.dataset.resumeTimer = String(state.view === "playing" && !state.locked && !state.paused);
  exitDialog.dataset.resumeFeedback = String(state.view === "playing" && state.locked && Boolean(state.feedback) && state.settings.autoContinue);
  stopTimer();
  clearContinue();
  exitDialog.showModal();
}

async function shareResult() {
  const text = `I scored ${state.result.score.toLocaleString()} in LottoMind Trivia Vault (${state.result.accuracy}% accuracy). No answers shared.`;
  try {
    if (navigator.share) await navigator.share({ title: "LottoMind Trivia Vault", text });
    else { await navigator.clipboard.writeText(text); toast("Result copied to clipboard"); }
    track("trivia_share_clicked", { mode: state.mode, scoreBucket: scoreBucket(state.result.score) });
  } catch (error) { if (error.name !== "AbortError") toast("Share is unavailable. Your score is still saved."); }
}

root.addEventListener("click", (event) => {
  const modeTarget = event.target.closest("[data-mode]"); if (modeTarget) { startMode(modeTarget.dataset.mode); return; }
  const categoryTarget = event.target.closest("[data-category]"); if (categoryTarget) { startMode("category", categoryTarget.dataset.category); return; }
  const answerTarget = event.target.closest("[data-answer]"); if (answerTarget) { submitAnswer(Number(answerTarget.dataset.answer)); return; }
  const viewTarget = event.target.closest("[data-view]"); if (viewTarget) {
    const view = viewTarget.dataset.view; if (view === "home") renderHome(); else if (view === "badges") renderBadges(); else if (view === "leaderboard") renderLeaderboard(); return;
  }
  const boardTarget = event.target.closest("[data-board]"); if (boardTarget) { renderLeaderboard(boardTarget.dataset.board); return; }
  const actionTarget = event.target.closest("[data-action]"); if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  if (action === "continue") continueRound();
  if (action === "pause") pauseGame();
  if (action === "exit") openExitDialog();
  if (action === "play-again") startMode(state.mode, state.category);
  if (action === "jackpot") startMode("jackpot", null, { carryScore: state.score, carryStreak: state.streak, carryAnswers: state.answers });
  if (action === "share") shareResult();
  if (action === "retry") startMode(state.mode || "quick", state.category);
});

muteButton.addEventListener("click", async () => {
  state.settings.muted = !state.settings.muted; storageService.saveSettings(state.settings); applySettings();
  if (!state.settings.muted) { try { audioContext ||= new AudioContext(); await audioContext.resume(); sound("reveal"); } catch {} }
});

settingsButton.addEventListener("click", () => { settingsButton.setAttribute("aria-expanded", "true"); settingsDialog.showModal(); });
settingsDialog.addEventListener("close", () => {
  state.settings.reducedEffects = reducedEffectsInput.checked; state.settings.vibration = vibrationInput.checked; state.settings.autoContinue = autoContinueInput.checked;
  storageService.saveSettings(state.settings); applySettings(); settingsButton.setAttribute("aria-expanded", "false");
});

exitDialog.addEventListener("close", () => {
  if (exitDialog.returnValue === "exit") {
    track("trivia_round_abandoned", { mode: state.mode, category: state.category }); renderHome();
  } else if (exitDialog.dataset.resumeTimer === "true") {
    startTimer();
  } else if (exitDialog.dataset.resumeFeedback === "true") {
    state.continueId = setTimeout(continueRound, TRIVIA_CONFIG.feedbackDelayMs);
  }
  delete exitDialog.dataset.resumeTimer;
  delete exitDialog.dataset.resumeFeedback;
});
exitDialog.addEventListener("cancel", (event) => event.preventDefault());

document.addEventListener("keydown", (event) => {
  if (settingsDialog.open || exitDialog.open) return;
  const answerIndex = answerIndexFromKey(event.key);
  if (state.view === "playing" && answerIndex !== null && !state.locked && !state.paused) { event.preventDefault(); submitAnswer(answerIndex); }
  if (state.view === "playing" && event.key.toLowerCase() === "p") { event.preventDefault(); pauseGame(); }
  if (event.key.toLowerCase() === "m") { event.preventDefault(); muteButton.click(); }
  if (state.view === "playing" && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); openExitDialog(); }
});

document.addEventListener("visibilitychange", () => {
  document.body.classList.toggle("page-hidden", document.hidden);
  if (document.hidden && state.view === "playing" && state.mode !== "daily" && !state.locked) pauseGame(true);
});

window.addEventListener("offline", () => toast("Network lost. The loaded round remains playable."));
window.addEventListener("online", () => toast("Network restored."));
window.addEventListener("beforeunload", () => { if (state.view === "playing" && state.answers.length) track("trivia_round_abandoned", { mode: state.mode, category: state.category }); });

async function init() {
  applySettings();
  renderHome();
  document.body.classList.remove("booting");
  state.account = await accountService.session();
  if (isSessionExpired(state.session)) state.session = null;
  setInterval(updateDailyCountdown, 30000);
}

init().catch(renderError);
