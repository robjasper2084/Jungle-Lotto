import { CATEGORY_LABELS, TRIVIA_CONFIG } from "./trivia-config.mjs";
import { publicQuestions } from "./questions.mjs";

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seedValue) {
  let state = hashText(seedValue) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(items, seed = `${Date.now()}-${Math.random()}`) {
  const random = seededRandom(seed);
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function dailyChallengeId(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `daily-${year}-${month}-${day}`;
}

function mixedDifficulty(questions) {
  const groups = Object.groupBy
    ? Object.groupBy(questions, (question) => question.difficulty)
    : questions.reduce((result, question) => {
        (result[question.difficulty] ||= []).push(question);
        return result;
      }, {});
  return ["easy", "medium", "hard"].flatMap((difficulty) => groups[difficulty] || []);
}

function survivalDifficultyOrder(questions, seed) {
  const pools = Object.fromEntries(
    ["easy", "medium", "hard"].map((difficulty) => [
      difficulty,
      shuffled(questions.filter((question) => question.difficulty === difficulty), `${seed}:${difficulty}`),
    ])
  );
  const ordered = [];
  while (Object.values(pools).some((pool) => pool.length)) {
    const stage = Math.min(2, Math.floor(ordered.length / TRIVIA_CONFIG.survivalDifficultyStep));
    const preferred = ["easy", "medium", "hard"][stage];
    const fallback = [preferred, "hard", "medium", "easy"].find((difficulty) => pools[difficulty].length);
    if (!fallback) break;
    ordered.push(pools[fallback].shift());
  }
  return ordered;
}

export function createQuestionSet({ mode = "quick", category = "", seed = "", date = new Date() } = {}) {
  const bank = publicQuestions();
  if (mode === "daily") {
    const challengeId = dailyChallengeId(date);
    const byCategory = Object.keys(CATEGORY_LABELS).map((categoryId) =>
      shuffled(bank.filter((question) => question.category === categoryId), `${challengeId}:${categoryId}`)[0]
    );
    return shuffled(byCategory.filter(Boolean), `${challengeId}:order`).slice(0, TRIVIA_CONFIG.dailyVaultLength);
  }
  if (mode === "category") {
    const selected = bank.filter((question) => question.category === category);
    return shuffled(mixedDifficulty(selected), seed || `${category}:${Date.now()}`).slice(0, TRIVIA_CONFIG.quickPlayLength);
  }
  if (mode === "survival") return survivalDifficultyOrder(bank, seed || `survival:${Date.now()}`);
  return shuffled(bank, seed || `quick:${Date.now()}`).slice(0, TRIVIA_CONFIG.quickPlayLength);
}

export function streakMultiplier(streak) {
  return TRIVIA_CONFIG.scoring.streakMultiplier.find((rule) => streak >= rule.minimum)?.multiplier || 1;
}

export function scoreAnswer({ correct, difficulty, remainingMs, totalMs, streak }) {
  if (!correct) return Object.freeze({ points: 0, speedBonus: 0, difficultyMultiplier: 1, streakMultiplier: 1 });
  const safeTotal = Math.max(1, Number(totalMs) || 1);
  const remainingRatio = Math.max(0, Math.min(1, (Number(remainingMs) || 0) / safeTotal));
  const speedBonus = Math.round(TRIVIA_CONFIG.scoring.maxSpeedBonus * remainingRatio);
  const difficultyMultiplier = TRIVIA_CONFIG.scoring.difficultyMultiplier[difficulty] || 1;
  const activeStreakMultiplier = streakMultiplier(streak);
  const points = Math.round((TRIVIA_CONFIG.scoring.baseCorrect + speedBonus) * difficultyMultiplier * activeStreakMultiplier);
  return Object.freeze({ points, speedBonus, difficultyMultiplier, streakMultiplier: activeStreakMultiplier });
}

export function createInitialStats(mode) {
  return {
    mode,
    score: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    longestStreak: 0,
    fastestAnswerMs: null,
    lives: mode === "survival" ? TRIVIA_CONFIG.survivalLives : null,
    categoryPerformance: {},
    answers: [],
  };
}

export function recordAnswer(stats, question, selectedChoiceIndex, answerMs, timedOut = false) {
  const correct = !timedOut && selectedChoiceIndex === question.correctChoiceIndex;
  const nextStreak = correct ? stats.streak + 1 : 0;
  const scoring = scoreAnswer({
    correct,
    difficulty: question.difficulty,
    remainingMs: Math.max(0, TRIVIA_CONFIG.questionSeconds * 1000 - answerMs),
    totalMs: TRIVIA_CONFIG.questionSeconds * 1000,
    streak: nextStreak,
  });
  const category = stats.categoryPerformance[question.category] || { correct: 0, total: 0 };
  return {
    ...stats,
    score: stats.score + scoring.points,
    correct: stats.correct + Number(correct),
    incorrect: stats.incorrect + Number(!correct),
    streak: nextStreak,
    longestStreak: Math.max(stats.longestStreak, nextStreak),
    fastestAnswerMs: correct
      ? Math.min(stats.fastestAnswerMs ?? Number.POSITIVE_INFINITY, answerMs)
      : stats.fastestAnswerMs,
    lives: stats.lives === null ? null : Math.max(0, stats.lives - Number(!correct)),
    categoryPerformance: {
      ...stats.categoryPerformance,
      [question.category]: { correct: category.correct + Number(correct), total: category.total + 1 },
    },
    answers: stats.answers.concat({
      questionId: question.id,
      selectedChoiceIndex,
      correct,
      timedOut,
      answerMs,
      points: scoring.points,
    }),
  };
}

export function summarizeStats(stats) {
  const total = stats.correct + stats.incorrect;
  return Object.freeze({
    ...stats,
    total,
    accuracy: total ? Math.round((stats.correct / total) * 100) : 0,
    fastestAnswerMs: Number.isFinite(stats.fastestAnswerMs) ? stats.fastestAnswerMs : null,
  });
}

export function earnedBadges(stats, history = {}) {
  const results = [];
  if ((history.gamesPlayed || 0) === 0) results.push("first-vault-opened");
  if (stats.correct === 10 && stats.incorrect === 0) results.push("perfect-ten");
  if (stats.longestStreak >= 5) results.push("five-answer-streak");
  if ((stats.categoryPerformance["mystery-mix"]?.correct || 0) >= 8) results.push("mystery-expert");
  if ((stats.categoryPerformance["detroit-history-culture"]?.correct || 0) >= 8) results.push("detroit-scholar");
  if ((stats.categoryPerformance["numbers-numerology"]?.correct || 0) >= 8) results.push("number-mind");
  if (stats.mode === "survival" && stats.correct >= 25) results.push("survival-25");
  if ((history.dailyStreak || 0) >= 7) results.push("daily-vault-seven-day-streak");
  return results;
}

export const BADGES = Object.freeze([
  ["first-vault-opened", "First Vault Opened"],
  ["perfect-ten", "Perfect Ten"],
  ["five-answer-streak", "Five-Answer Streak"],
  ["mystery-expert", "Mystery Expert"],
  ["detroit-scholar", "Detroit Scholar"],
  ["number-mind", "Number Mind"],
  ["survival-25", "Survival 25"],
  ["daily-vault-seven-day-streak", "Daily Vault Seven-Day Streak"],
].map(([id, label]) => Object.freeze({ id, label })));
