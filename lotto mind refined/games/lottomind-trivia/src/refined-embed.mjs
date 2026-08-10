import { CATEGORIES, TRIVIA_CONFIG } from "./config.mjs";
import {
  answerIndexFromKey,
  calculateAnswerScore,
  canUnlockJackpot,
  dailyChallengeId,
  resultsFromAnswers,
  selectDailyQuestions,
  shuffleSeeded,
  survivalDifficulty,
} from "./engine.mjs";
import { leaderboardService, questionService, storageService, track } from "./services.mjs";

const TRIVIA_BRAND_ART = new URL("../../../assets/custom/higgsfield-arcade-tools/arcade-trivia.png", import.meta.url).href;
const BUILD_ID = "lottomind-refined-trivia-2026-08-09";
const BADGES = Object.freeze([
  { id: "first-vault", name: "First Vault Opened", mark: "V", test: ({ progress }) => progress.gamesPlayed >= 1 },
  { id: "perfect-ten", name: "Perfect Ten", mark: "10", test: ({ mode, result }) => mode === "quick" && result.correct === 10 },
  { id: "five-streak", name: "Five-Answer Streak", mark: "5", test: ({ result }) => result.longestStreak >= 5 },
  { id: "mystery-expert", name: "Mystery Expert", mark: "?", test: ({ mode, category, result }) => mode === "category" && category === "mystery-mix" && result.accuracy >= 80 },
  { id: "detroit-scholar", name: "Detroit Scholar", mark: "D", test: ({ mode, category, result }) => mode === "category" && category === "detroit-history-culture" && result.accuracy >= 80 },
  { id: "number-mind", name: "Number Mind", mark: "N", test: ({ mode, category, result }) => mode === "category" && category === "numbers-numerology" && result.accuracy >= 80 },
  { id: "survival-25", name: "Survival 25", mark: "25", test: ({ mode, result }) => mode === "survival" && result.correct >= 25 },
  { id: "daily-seven", name: "Seven-Day Daily Vault", mark: "7", test: ({ progress }) => consecutiveDayStreak(progress.dailyDates) >= 7 },
]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function categoryLabel(id) {
  return CATEGORIES.find((category) => category.id === id)?.label || id || "LottoMind Knowledge";
}

function consecutiveDayStreak(dates) {
  const unique = Array.from(new Set(dates || [])).sort().reverse();
  if (!unique.length) return 0;
  let streak = 1;
  for (let index = 1; index < unique.length; index += 1) {
    const newer = new Date(`${unique[index - 1]}T00:00:00Z`);
    const older = new Date(`${unique[index]}T00:00:00Z`);
    if ((newer - older) / 86400000 !== 1) break;
    streak += 1;
  }
  return streak;
}

function normalizeServerQuestion(question, index) {
  return {
    id: question.id,
    category: question.category || "lottomind-universe",
    difficulty: question.difficulty || (index < 2 ? "easy" : index < 4 ? "medium" : "hard"),
    question: question.question || question.q,
    choices: question.choices || question.options || [],
    correctChoiceIndex: Number.isInteger(question.correctChoiceIndex) ? question.correctChoiceIndex : null,
    explanation: question.explanation || question.note || "The verified Trivia Vault service reviewed this answer.",
    sourceName: question.sourceName || "LottoMind verified daily challenge",
    sourceUrl: question.sourceUrl || "",
    active: true,
    reviewStatus: "approved",
  };
}

export function mountRefinedTriviaVault(root, options = {}) {
  if (!(root instanceof Element)) throw new Error("Trivia Vault mount target is unavailable.");

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
    countdownId: null,
    startedAt: 0,
    result: null,
    newRecord: false,
    newBadges: [],
    leaderboardBoard: "daily",
    settings: storageService.getSettings(),
    progress: storageService.getProgress(),
    secure: { eligible: false, sessionId: "", challengeId: "", status: "score-only", error: "", award: 0, claim: null },
    destroyed: false,
  };

  root.classList.add("refined-trivia-vault");
  root.setAttribute("aria-live", "polite");

  function announce(message) {
    const region = root.querySelector("[data-tv-live]");
    if (!region) return;
    region.textContent = "";
    requestAnimationFrame(() => { if (region.isConnected) region.textContent = message; });
  }

  function stopTimer() {
    if (state.timerId) window.clearInterval(state.timerId);
    state.timerId = null;
  }

  function clearContinue() {
    if (state.continueId) window.clearTimeout(state.continueId);
    state.continueId = null;
  }

  function clearCountdown() {
    if (state.countdownId) window.clearInterval(state.countdownId);
    state.countdownId = null;
  }

  function shell(content) {
    return `<div class="tv-shell">
      <div class="tv-topbar">
        <div><span class="tv-kicker">LottoMind Arcade Original</span><strong>Trivia Vault</strong></div>
        <div class="tv-top-actions">
          <button type="button" data-tv-action="toggle-mute" aria-pressed="${state.settings.muted}">${state.settings.muted ? "Sound Off" : "Sound On"}</button>
          <button type="button" data-tv-action="settings" aria-expanded="false">Settings</button>
          <button type="button" data-tv-action="arcade">Arcade</button>
        </div>
      </div>
      <div data-tv-live class="tv-sr-only" aria-live="assertive"></div>
      ${content}
    </div>`;
  }

  function bestScore() {
    return Math.max(0, ...Object.values(state.progress.bestScores || {}).map(Number));
  }

  function updateDailyCountdown() {
    const target = root.querySelector("[data-tv-daily-reset]");
    if (!target) return;
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const remaining = next - now;
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    target.textContent = `${hours}h ${minutes}m ${seconds}s`;
  }

  function renderHome() {
    stopTimer();
    clearContinue();
    clearCountdown();
    state.view = "home";
    state.mode = null;
    const badges = Object.keys(state.progress.badges || {}).length;
    root.innerHTML = shell(`<section class="tv-home" aria-labelledby="tv-title">
      <article class="tv-hero">
        <div>
          <span class="tv-kicker">154 reviewed questions / 7 knowledge lanes</span>
          <h1 id="tv-title">Trivia<br>Vault</h1>
          <p>Choose a mode, answer with touch or keys 1-4, build streaks, and unlock local badges. Lottery outcomes remain random.</p>
          <div class="tv-actions"><button class="tv-primary" data-tv-mode="quick">Start Quick Play</button><button data-tv-view="boards">Local Boards</button><button data-tv-view="badges">Badge Vault</button></div>
        </div>
        <div class="tv-reactor" aria-hidden="true"><img src="${TRIVIA_BRAND_ART}" alt=""><i></i></div>
      </article>
      <div class="tv-stat-grid" aria-label="Local Trivia Vault progress">
        <div><span>Games</span><strong>${Number(state.progress.gamesPlayed || 0)}</strong></div>
        <div><span>Best score</span><strong>${bestScore().toLocaleString()}</strong></div>
        <div><span>Badges</span><strong>${badges}/${BADGES.length}</strong></div>
        <div><span>Wallet rules</span><strong>Server only</strong></div>
      </div>
      <section class="tv-panel">
        <div class="tv-section-head"><div><span class="tv-kicker">Choose a signal</span><h2>Game Modes</h2></div><span>Score play is always available</span></div>
        <div class="tv-mode-grid">
          ${Object.values(TRIVIA_CONFIG.modes).filter((mode) => mode.id !== "jackpot").map((mode) => `<button data-tv-mode="${mode.id}"><span>${mode.id === "daily" ? "5 verified questions" : mode.id === "survival" ? "3 lives" : mode.id === "category" ? "7 lanes" : "10 questions"}</span><strong>${mode.label}</strong><small>${mode.description}</small></button>`).join("")}
        </div>
      </section>
      <section class="tv-panel tv-daily-callout">
        <div><span class="tv-kicker">${dailyChallengeId()}</span><h2>Daily Vault</h2><p>Authenticated players can claim up to 20 promotional credits after server verification. Guests receive score and local progress only.</p><small>Next challenge in <b data-tv-daily-reset>--</b></small></div>
        <button class="tv-primary" data-tv-mode="daily">Enter Daily Vault</button>
      </section>
    </section>`);
    updateDailyCountdown();
    state.countdownId = window.setInterval(updateDailyCountdown, 1000);
    track("trivia_game_opened");
  }

  function renderCategorySelect() {
    state.view = "category-select";
    root.innerHTML = shell(`<section class="tv-panel">
      <div class="tv-section-head"><div><span class="tv-kicker">Category Run</span><h1>Choose a Knowledge Lane</h1><p>Ten questions from one reviewed category.</p></div><button data-tv-view="home">Back</button></div>
      <div class="tv-category-grid">${CATEGORIES.map((category) => `<button data-tv-category="${category.id}"><span>${escapeHtml(category.icon)}</span><strong>${escapeHtml(category.label)}</strong><small>Easy, medium, and hard signals</small></button>`).join("")}</div>
    </section>`);
  }

  function renderLoading(message = "Loading reviewed question signals...") {
    root.innerHTML = shell(`<section class="tv-loading" role="status"><span></span><h1>Opening Vault</h1><p>${escapeHtml(message)}</p></section>`);
  }

  async function secureDailyQuestions() {
    const service = await options.accountServicePromise?.();
    if (!service?.createTriviaSession) return null;
    try {
      const session = await service.createTriviaSession({ mode: "daily", buildId: BUILD_ID });
      if (!session?.sessionId || !Array.isArray(session.questions) || !session.questions.length) return null;
      state.secure = { eligible: true, sessionId: session.sessionId, challengeId: session.challengeId || dailyChallengeId(), status: "verified session", error: "", award: 0, claim: null };
      return session.questions.map(normalizeServerQuestion);
    } catch (error) {
      state.secure = { eligible: false, sessionId: "", challengeId: dailyChallengeId(), status: "score-only", error: error?.message || "Secure Daily service unavailable.", award: 0, claim: null };
      return null;
    }
  }

  async function loadModeQuestions(mode, category) {
    if (mode === "daily") {
      const secure = await secureDailyQuestions();
      if (secure) return secure;
      const pool = await questionService.all();
      return selectDailyQuestions(pool).questions;
    }
    const seed = `${mode}:${category || "mixed"}:${Date.now()}`;
    if (mode === "category") return shuffleSeeded(await questionService.category(category), seed).slice(0, TRIVIA_CONFIG.modes.category.questionCount);
    if (mode === "survival") return shuffleSeeded(await questionService.all(), seed);
    if (mode === "jackpot") return shuffleSeeded((await questionService.all()).filter((question) => question.difficulty === "hard"), seed).slice(0, 1);
    const pool = await questionService.all();
    const balanced = ["easy", "medium", "hard"].flatMap((difficulty) => shuffleSeeded(pool.filter((question) => question.difficulty === difficulty), `${seed}:${difficulty}`).slice(0, difficulty === "hard" ? 2 : 4));
    return shuffleSeeded(balanced, `${seed}:final`).slice(0, 10);
  }

  async function startMode(mode, category = null, carry = null) {
    if (mode === "category" && !category) { renderCategorySelect(); return; }
    renderLoading(mode === "daily" ? "Checking secure Daily Vault eligibility..." : undefined);
    state.secure = { eligible: false, sessionId: "", challengeId: "", status: "score-only", error: "", award: 0, claim: null };
    try {
      const questions = await loadModeQuestions(mode, category);
      if (!questions.length) throw new Error("No reviewed questions are available for this mode.");
      state.view = "playing";
      state.mode = mode;
      state.category = category;
      state.questions = questions;
      state.index = 0;
      state.score = carry?.score || 0;
      state.streak = carry?.streak || 0;
      state.lives = TRIVIA_CONFIG.modes[mode].lives || 3;
      state.answers = carry?.answers || [];
      state.feedback = null;
      state.locked = false;
      state.paused = false;
      state.usedQuestionIds = new Set();
      state.startedAt = Date.now();
      selectCurrentQuestion();
      renderQuestion();
      track("trivia_round_started", { mode, category });
    } catch (error) {
      renderError(error);
    }
  }

  function selectCurrentQuestion() {
    if (state.mode !== "survival") {
      state.question = state.questions[state.index] || null;
      return;
    }
    if (state.usedQuestionIds.size >= state.questions.length) state.usedQuestionIds.clear();
    const difficulty = survivalDifficulty(state.answers.filter((answer) => answer.correct).length);
    const available = state.questions.filter((question) => !state.usedQuestionIds.has(question.id));
    state.question = available.find((question) => question.difficulty === difficulty) || available[0] || null;
  }

  function progressPercent() {
    const count = TRIVIA_CONFIG.modes[state.mode].questionCount;
    return state.mode === "survival" ? Math.min(100, (state.answers.length % 10) * 10) : Math.round((state.index / Math.max(1, count)) * 100);
  }

  function renderQuestion() {
    if (!state.question) { finishRound(); return; }
    stopTimer();
    clearContinue();
    state.locked = false;
    state.feedback = null;
    state.paused = false;
    const mode = TRIVIA_CONFIG.modes[state.mode];
    const number = state.mode === "jackpot" ? "BONUS" : state.answers.length + 1;
    const total = mode.questionCount || "ENDLESS";
    root.innerHTML = shell(`<section class="tv-game" aria-label="${escapeHtml(mode.label)} game">
      <div class="tv-hud">
        <div><span>Mode</span><strong>${escapeHtml(mode.label)}</strong></div><div><span>Question</span><strong>${number} / ${total}</strong></div><div><span>Score</span><strong data-tv-score>${state.score.toLocaleString()}</strong></div><div><span>Streak</span><strong data-tv-streak>${state.streak}</strong></div><div><span>${state.mode === "survival" ? "Lives" : "Status"}</span><strong data-tv-status>${state.mode === "survival" ? `${state.lives} lives` : state.secure.status}</strong></div>
        <div class="tv-hud-actions"><button data-tv-action="pause" ${state.mode === "daily" ? "disabled" : ""} aria-label="Pause game">Pause</button><button data-tv-action="exit" aria-label="Exit round">Exit</button></div>
      </div>
      <div class="tv-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent()}"><i style="width:${progressPercent()}%"></i></div>
      <article class="tv-question" aria-labelledby="tv-question-heading">
        <div class="tv-question-meta"><div><span>${escapeHtml(categoryLabel(state.question.category))}</span><b>${escapeHtml(state.question.difficulty)}</b></div><div class="tv-timer" data-tv-timer role="timer" style="--timer:100%"><strong>${mode.seconds}</strong></div></div>
        <h1 id="tv-question-heading">${escapeHtml(state.question.question)}</h1>
        <div class="tv-answers" role="group" aria-label="Answer choices">${state.question.choices.map((choice, index) => `<button data-tv-answer="${index}"><span>${index + 1}</span><strong>${escapeHtml(choice)}</strong><small></small></button>`).join("")}</div>
      </article>
    </section>`);
    state.usedQuestionIds.add(state.question.id);
    state.questionStartedAt = performance.now();
    state.remainingMs = mode.seconds * 1000;
    startTimer();
    root.querySelector("[data-tv-answer]")?.focus({ preventScroll: true });
    announce(`${categoryLabel(state.question.category)}, ${state.question.difficulty}. Question ${number}. ${mode.seconds} seconds.`);
  }

  function startTimer() {
    stopTimer();
    let last = performance.now();
    state.timerId = window.setInterval(() => {
      if (state.paused || state.locked) { last = performance.now(); return; }
      const now = performance.now();
      state.remainingMs -= now - last;
      last = now;
      updateTimer();
      if (state.remainingMs <= 0) submitAnswer(-1, true);
    }, 100);
  }

  function updateTimer() {
    const timer = root.querySelector("[data-tv-timer]");
    if (!timer) return;
    const total = TRIVIA_CONFIG.modes[state.mode].seconds * 1000;
    const seconds = Math.max(0, Math.ceil(state.remainingMs / 1000));
    timer.style.setProperty("--timer", `${Math.max(0, (state.remainingMs / total) * 100)}%`);
    timer.querySelector("strong").textContent = seconds;
    timer.classList.toggle("is-warning", seconds <= 3);
  }

  async function submitAnswer(selectedIndex, timedOut = false) {
    if (state.locked || state.paused || !state.question) return;
    state.locked = true;
    stopTimer();
    root.querySelectorAll("[data-tv-answer]").forEach((button) => { button.disabled = true; });
    const elapsedMs = Math.max(0, Math.round(TRIVIA_CONFIG.modes[state.mode].seconds * 1000 - state.remainingMs));
    let correct = selectedIndex === state.question.correctChoiceIndex;
    let explanation = state.question.explanation;
    if (state.mode === "daily" && state.secure.eligible) {
      try {
        const service = await options.accountServicePromise?.();
        const response = await service.submitTriviaAnswer(state.secure.sessionId, { questionId: state.question.id, selectedIndex, sequence: state.index, elapsedMs });
        correct = Boolean(response.correct);
        if (Number.isInteger(response.correctIndex)) state.question.correctChoiceIndex = response.correctIndex;
        explanation = response.note || explanation;
      } catch (error) {
        state.secure.eligible = false;
        state.secure.status = "score-only";
        state.secure.error = error?.message || "Verified answer service interrupted.";
        correct = false;
      }
    }
    const nextStreak = correct ? state.streak + 1 : 0;
    const score = calculateAnswerScore({ correct, difficulty: state.question.difficulty, remainingMs: state.remainingMs, totalMs: TRIVIA_CONFIG.modes[state.mode].seconds * 1000, nextStreak });
    if (correct) { state.streak = nextStreak; state.score += score.total; }
    else { state.streak = 0; if (state.mode === "survival") state.lives -= 1; }
    state.answers.push({ questionId: state.question.id, category: state.question.category, difficulty: state.question.difficulty, selectedIndex, correct, timedOut, points: score.total, elapsedMs, streakAfter: state.streak });
    state.feedback = { selectedIndex, correct, timedOut, score, explanation };
    showFeedback();
    track("trivia_question_answered", { mode: state.mode, category: state.question.category, durationBucket: elapsedMs < 5000 ? "fast" : elapsedMs < 10000 ? "medium" : "slow" });
  }

  function showFeedback() {
    root.querySelectorAll("[data-tv-answer]").forEach((button) => {
      const index = Number(button.dataset.tvAnswer);
      if (state.question.correctChoiceIndex !== null && index === state.question.correctChoiceIndex) button.classList.add("is-correct");
      if (!state.feedback.correct && index === state.feedback.selectedIndex) button.classList.add("is-wrong");
      if (state.feedback.correct && index === state.feedback.selectedIndex) button.classList.add("is-correct");
    });
    root.querySelector("[data-tv-score]").textContent = state.score.toLocaleString();
    root.querySelector("[data-tv-streak]").textContent = state.streak;
    const panel = root.querySelector(".tv-question");
    panel.insertAdjacentHTML("beforeend", `<div class="tv-feedback ${state.feedback.correct ? "is-correct" : "is-wrong"}" role="status"><div><span>${state.feedback.correct ? "Signal locked" : state.feedback.timedOut ? "Time expired" : "Signal missed"}</span><h2>${state.feedback.correct ? `+${state.feedback.score.total} points` : "Review the answer"}</h2><p>${escapeHtml(state.feedback.explanation)}</p>${state.secure.error ? `<small>${escapeHtml(state.secure.error)} This run is now score-only.</small>` : ""}</div><button class="tv-primary" data-tv-action="continue">Continue</button></div>`);
    announce(`${state.feedback.correct ? "Correct" : state.feedback.timedOut ? "Time expired" : "Incorrect"}. ${state.feedback.explanation}`);
    if (state.settings.autoContinue) state.continueId = window.setTimeout(continueRound, TRIVIA_CONFIG.feedbackDelayMs);
    root.querySelector('[data-tv-action="continue"]')?.focus({ preventScroll: true });
  }

  function continueRound() {
    if (!state.locked || !state.feedback) return;
    clearContinue();
    const complete = state.mode === "survival" ? state.lives <= 0 : state.index + 1 >= TRIVIA_CONFIG.modes[state.mode].questionCount;
    if (complete) { finishRound(); return; }
    state.index += 1;
    selectCurrentQuestion();
    renderQuestion();
  }

  async function claimDailyReward() {
    if (state.mode !== "daily" || !state.secure.eligible || !state.secure.sessionId) return;
    state.secure.status = "claiming";
    try {
      const service = await options.accountServicePromise?.();
      const key = `${state.secure.challengeId}:${state.secure.sessionId}`;
      const claim = await service.claimTriviaReward(state.secure.sessionId, key);
      state.secure.claim = claim;
      state.secure.award = Number(claim?.reward?.amount || 0);
      state.secure.status = claim?.duplicate ? "already claimed" : "rewarded";
    } catch (error) {
      state.secure.eligible = false;
      state.secure.status = "score-only";
      state.secure.error = error?.message || "Reward claim could not be verified.";
    }
  }

  async function finishRound() {
    stopTimer();
    clearContinue();
    if (!state.answers.length) { renderHome(); return; }
    const result = resultsFromAnswers(state.answers, state.score);
    state.result = result;
    state.progress.gamesPlayed = Number(state.progress.gamesPlayed || 0) + 1;
    state.progress.bestScores ||= {};
    const previousBest = Number(state.progress.bestScores[state.mode] || 0);
    state.newRecord = state.score > previousBest;
    if (state.newRecord) state.progress.bestScores[state.mode] = state.score;
    if (state.mode === "survival") state.progress.bestSurvival = Math.max(state.progress.bestSurvival || 0, result.correct);
    if (state.mode === "daily") state.progress.dailyDates = Array.from(new Set([...(state.progress.dailyDates || []), new Date().toISOString().slice(0, 10)])).sort();
    state.progress.history = [{ id: `${state.mode}-${state.startedAt}`, mode: state.mode, category: state.category, score: state.score, accuracy: result.accuracy, streak: result.longestStreak, completedAt: new Date().toISOString() }, ...(state.progress.history || [])].slice(0, 50);
    state.newBadges = unlockBadges(result);
    storageService.saveProgress(state.progress);
    saveLocalBoard(result);
    if (state.mode === "daily" && state.secure.eligible) {
      renderLoading("Verifying Daily Vault reward...");
      await claimDailyReward();
    }
    state.view = "results";
    renderResults();
    track("trivia_round_completed", { mode: state.mode, category: state.category, scoreBucket: state.score >= 2000 ? "2000+" : state.score >= 1000 ? "1000-1999" : "0-999" });
  }

  function unlockBadges(result) {
    state.progress.badges ||= {};
    const unlocked = [];
    for (const badge of BADGES) {
      if (!state.progress.badges[badge.id] && badge.test({ mode: state.mode, category: state.category, result, progress: state.progress })) {
        state.progress.badges[badge.id] = { unlockedAt: new Date().toISOString() };
        unlocked.push(badge);
      }
    }
    return unlocked;
  }

  function saveLocalBoard(result) {
    const entry = { id: `${state.mode}-${state.startedAt}`, name: "Private local player", score: state.score, accuracy: result.accuracy, streak: result.longestStreak, hidden: true, createdAt: new Date().toISOString() };
    leaderboardService.saveLocal("allTime", entry);
    leaderboardService.saveLocal("weekly", entry);
    if (state.mode === "daily") leaderboardService.saveLocal("daily", entry);
    if (state.mode === "survival") leaderboardService.saveLocal("survival", entry);
  }

  function renderResults() {
    const result = state.result;
    const jackpot = canUnlockJackpot(state.mode, state.answers);
    const rewardTitle = state.secure.award ? `${state.secure.award} verified credits` : state.mode === "daily" ? "Score-only Daily run" : "Score and badge progress";
    const rewardCopy = state.secure.award ? "The authenticated reward service updated the promotional wallet." : state.secure.error ? state.secure.error : "No wallet value was simulated or changed by the browser game.";
    root.innerHTML = shell(`<section class="tv-results" aria-labelledby="tv-results-heading">
      <article class="tv-panel tv-result-hero"><span class="tv-kicker">Vault run complete</span><h1 id="tv-results-heading">${escapeHtml(TRIVIA_CONFIG.modes[state.mode].label)} Results</h1><div class="tv-result-score">${result.score.toLocaleString()}</div>${state.newRecord ? "<b class=\"tv-record\">New personal record</b>" : ""}
        <div class="tv-metrics"><div><span>Correct</span><strong>${result.correct}</strong></div><div><span>Accuracy</span><strong>${result.accuracy}%</strong></div><div><span>Fastest</span><strong>${(result.fastestAnswerMs / 1000).toFixed(1)}s</strong></div><div><span>Best streak</span><strong>${result.longestStreak}</strong></div><div><span>Credits</span><strong>${state.secure.award}</strong></div></div>
        <div class="tv-actions"><button class="tv-primary" data-tv-action="play-again">Play Again</button>${jackpot ? '<button class="tv-primary" data-tv-action="jackpot">Jackpot Round</button>' : ""}<button data-tv-view="home">Change Mode</button><button data-tv-action="share">Share</button></div>
      </article>
      <div class="tv-result-side">
        <section class="tv-panel"><span class="tv-kicker">Wallet-safe result</span><h2>${escapeHtml(rewardTitle)}</h2><p>${escapeHtml(rewardCopy)}</p></section>
        <section class="tv-panel"><h2>Category Performance</h2>${Object.entries(result.categoryPerformance).map(([category, value]) => `<div class="tv-category-result"><span>${escapeHtml(categoryLabel(category))}</span><b>${value.correct}/${value.total}</b></div>`).join("")}</section>
        <section class="tv-panel"><h2>${state.newBadges.length ? "Badges Unlocked" : "Badge Progress"}</h2>${(state.newBadges.length ? state.newBadges : BADGES.slice(0, 3)).map(badgeRow).join("")}</section>
      </div>
    </section>`);
  }

  function badgeRow(badge) {
    const unlocked = Boolean(state.progress.badges?.[badge.id]);
    return `<div class="tv-badge ${unlocked ? "is-unlocked" : ""}"><span>${badge.mark}</span><div><strong>${escapeHtml(badge.name)}</strong><small>${unlocked ? "Unlocked" : "In progress"}</small></div><b>${unlocked ? "OK" : "--"}</b></div>`;
  }

  function renderBadges() {
    state.view = "badges";
    root.innerHTML = shell(`<section class="tv-panel"><div class="tv-section-head"><div><span class="tv-kicker">Local progression</span><h1>Badge Vault</h1><p>Progress is saved on this device. No wallet data is stored here.</p></div><button data-tv-view="home">Back</button></div><div class="tv-badge-grid">${BADGES.map(badgeRow).join("")}</div></section>`);
  }

  function renderBoards(board = state.leaderboardBoard) {
    state.view = "boards";
    state.leaderboardBoard = board;
    const entries = leaderboardService.list(board);
    root.innerHTML = shell(`<section class="tv-panel"><div class="tv-section-head"><div><span class="tv-kicker">Private device board</span><h1>Local Leaderboards</h1><p>Only runs saved on this device appear. There are no invented global players or ranks.</p></div><button data-tv-view="home">Back</button></div><div class="tv-board-tabs">${[["daily", "Daily"], ["weekly", "Weekly"], ["allTime", "All Time"], ["survival", "Survival"]].map(([id, label]) => `<button data-tv-board="${id}" aria-pressed="${board === id}">${label}</button>`).join("")}</div>${entries.length ? `<div class="tv-table-wrap"><table><thead><tr><th>Rank</th><th>Player</th><th>Score</th><th>Accuracy</th><th>Streak</th></tr></thead><tbody>${entries.slice(0, 20).map((entry, index) => `<tr><td>${index + 1}</td><td>Private local player</td><td>${Number(entry.score).toLocaleString()}</td><td>${entry.accuracy}%</td><td>${entry.streak}</td></tr>`).join("")}</tbody></table></div>` : '<div class="tv-empty">Finish a matching round to create your first local entry.</div>'}</section>`);
  }

  function renderError(error) {
    stopTimer();
    clearContinue();
    state.view = "error";
    root.innerHTML = shell(`<section class="tv-panel tv-error" role="alert"><span class="tv-kicker">Signal interrupted</span><h1>Question Load Failed</h1><p>${escapeHtml(error?.message || "The Trivia Vault could not load this round.")}</p><div class="tv-actions"><button class="tv-primary" data-tv-action="retry">Try Again</button><button data-tv-view="home">Trivia Home</button></div></section>`);
  }

  function showOverlay(kind) {
    root.querySelector(".tv-overlay")?.remove();
    const isSettings = kind === "settings";
    root.querySelector(".tv-shell")?.insertAdjacentHTML("beforeend", `<div class="tv-overlay" role="dialog" aria-modal="true" aria-label="${isSettings ? "Trivia settings" : "Exit trivia round"}"><div>
      <span class="tv-kicker">${isSettings ? "Player settings" : "Leave this run?"}</span><h2>${isSettings ? "Trivia Controls" : "Progress for this run will stop"}</h2>
      ${isSettings ? `<label><input type="checkbox" data-tv-setting="autoContinue" ${state.settings.autoContinue ? "checked" : ""}> Auto-continue after feedback</label><label><input type="checkbox" data-tv-setting="reducedEffects" ${state.settings.reducedEffects ? "checked" : ""}> Reduce motion effects</label>` : ""}
      <div class="tv-actions"><button class="tv-primary" data-tv-action="close-overlay">${isSettings ? "Save" : "Keep Playing"}</button>${isSettings ? "" : '<button data-tv-action="confirm-exit">Exit Run</button>'}</div>
    </div></div>`);
    if (state.view === "playing" && !state.locked) state.paused = true;
    root.querySelector('.tv-overlay [data-tv-action="close-overlay"]')?.focus();
  }

  function closeOverlay() {
    root.querySelectorAll("[data-tv-setting]").forEach((input) => { state.settings[input.dataset.tvSetting] = input.checked; });
    storageService.saveSettings(state.settings);
    root.classList.toggle("tv-reduced-effects", Boolean(state.settings.reducedEffects));
    root.querySelector(".tv-overlay")?.remove();
    if (state.view === "playing" && !state.locked) state.paused = false;
  }

  function toggleMute() {
    state.settings.muted = !state.settings.muted;
    storageService.saveSettings(state.settings);
    const button = root.querySelector('[data-tv-action="toggle-mute"]');
    if (button) {
      button.textContent = state.settings.muted ? "Sound Off" : "Sound On";
      button.setAttribute("aria-pressed", String(state.settings.muted));
    }
  }

  function pauseGame() {
    if (state.view !== "playing" || state.mode === "daily" || state.locked) return;
    state.paused = !state.paused;
    root.querySelector(".tv-pause-card")?.remove();
    if (state.paused) root.querySelector(".tv-question")?.insertAdjacentHTML("beforeend", '<div class="tv-pause-card"><div><span class="tv-kicker">Timer held</span><h2>Game Paused</h2><button class="tv-primary" data-tv-action="pause">Resume</button></div></div>');
  }

  async function shareResult() {
    const text = `I scored ${state.result.score.toLocaleString()} in LottoMind Trivia Vault with ${state.result.accuracy}% accuracy.`;
    try {
      if (navigator.share) await navigator.share({ title: "LottoMind Trivia Vault", text });
      else await navigator.clipboard.writeText(text);
      announce("Result shared or copied.");
    } catch { announce("Share was cancelled or unavailable."); }
  }

  function onClick(event) {
    const mode = event.target.closest("[data-tv-mode]")?.dataset.tvMode;
    if (mode) { startMode(mode); return; }
    const category = event.target.closest("[data-tv-category]")?.dataset.tvCategory;
    if (category) { startMode("category", category); return; }
    const answer = event.target.closest("[data-tv-answer]")?.dataset.tvAnswer;
    if (answer !== undefined) { submitAnswer(Number(answer)); return; }
    const view = event.target.closest("[data-tv-view]")?.dataset.tvView;
    if (view) { if (view === "home") renderHome(); else if (view === "boards") renderBoards(); else if (view === "badges") renderBadges(); return; }
    const board = event.target.closest("[data-tv-board]")?.dataset.tvBoard;
    if (board) { renderBoards(board); return; }
    const action = event.target.closest("[data-tv-action]")?.dataset.tvAction;
    if (!action) return;
    if (action === "continue") continueRound();
    if (action === "pause") pauseGame();
    if (action === "exit") showOverlay("exit");
    if (action === "settings") showOverlay("settings");
    if (action === "close-overlay") closeOverlay();
    if (action === "confirm-exit") renderHome();
    if (action === "toggle-mute") toggleMute();
    if (action === "arcade") options.onRoute?.("arcade");
    if (action === "play-again") startMode(state.mode, state.category);
    if (action === "jackpot") startMode("jackpot", null, { score: state.score, streak: state.streak, answers: state.answers });
    if (action === "share") shareResult();
    if (action === "retry") startMode(state.mode || "quick", state.category);
  }

  function onKeydown(event) {
    if (state.destroyed || root.querySelector(".tv-overlay")) return;
    const answer = answerIndexFromKey(event.key);
    if (state.view === "playing" && answer !== null && !state.locked && !state.paused) { event.preventDefault(); submitAnswer(answer); }
    if (state.view === "playing" && event.key.toLowerCase() === "p") { event.preventDefault(); pauseGame(); }
    if (event.key.toLowerCase() === "m") { event.preventDefault(); toggleMute(); }
    if (state.view === "playing" && event.key === "Escape") { event.preventDefault(); showOverlay("exit"); }
  }

  function onVisibility() {
    if (document.hidden && state.view === "playing" && state.mode !== "daily" && !state.locked) pauseGame();
  }

  root.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("visibilitychange", onVisibility);
  root.classList.toggle("tv-reduced-effects", Boolean(state.settings.reducedEffects));
  renderHome();

  return {
    destroy() {
      state.destroyed = true;
      stopTimer();
      clearContinue();
      clearCountdown();
      root.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("visibilitychange", onVisibility);
      root.replaceChildren();
    },
  };
}
