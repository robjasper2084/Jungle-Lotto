import { TRIVIA_CONFIG } from "./config.mjs";

export function hashString(input) {
  let hash = 2166136261;
  for (const char of String(input)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed) {
  let state = hashString(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleSeeded(items, seed) {
  const result = [...items];
  const random = seededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function streakMultiplier(streak, config = TRIVIA_CONFIG) {
  return config.scoring.streakMultipliers.find((tier) => streak >= tier.at)?.value || 1;
}

export function calculateAnswerScore({ correct, difficulty, remainingMs, totalMs, nextStreak }, config = TRIVIA_CONFIG) {
  if (!correct) return { total: 0, base: 0, speedBonus: 0, difficultyMultiplier: 1, streakMultiplier: 1 };
  const remainingRatio = Math.max(0, Math.min(1, Number(remainingMs) / Math.max(1, Number(totalMs))));
  const speedBonus = Math.round(config.scoring.maxSpeedBonus * remainingRatio);
  const difficultyMultiplier = config.scoring.difficultyMultipliers[difficulty] || 1;
  const streak = streakMultiplier(nextStreak, config);
  const base = config.scoring.baseCorrect;
  return { total: Math.round((base + speedBonus) * difficultyMultiplier * streak), base, speedBonus, difficultyMultiplier, streakMultiplier: streak };
}

export function resultsFromAnswers(answers, score = 0) {
  const correct = answers.filter((answer) => answer.correct).length;
  const incorrect = answers.length - correct;
  const categoryPerformance = answers.reduce((result, answer) => {
    const current = result[answer.category] || { correct: 0, total: 0 };
    current.total += 1;
    if (answer.correct) current.correct += 1;
    result[answer.category] = current;
    return result;
  }, {});
  return {
    score,
    correct,
    incorrect,
    accuracy: answers.length ? Math.round((correct / answers.length) * 100) : 0,
    fastestAnswerMs: answers.length ? Math.min(...answers.map((answer) => answer.elapsedMs)) : 0,
    longestStreak: answers.reduce((max, answer) => Math.max(max, answer.streakAfter || 0), 0),
    categoryPerformance,
  };
}

export function dailyChallengeId(date = new Date()) {
  return `daily-${date.toISOString().slice(0, 10)}`;
}

export function selectDailyQuestions(questions, date = new Date(), count = 5, seedSalt = "static-demo-not-reward-eligible") {
  const challengeId = dailyChallengeId(date);
  const active = questions.filter((question) => question.active && question.reviewStatus === "approved");
  const shuffled = shuffleSeeded(active, `${seedSalt}:${challengeId}`);
  const selected = [];
  const categories = new Set();
  for (const question of shuffled) {
    if (selected.length >= count) break;
    if (!categories.has(question.category) || active.length - selected.length < count) {
      selected.push(question);
      categories.add(question.category);
    }
  }
  for (const question of shuffled) if (selected.length < count && !selected.includes(question)) selected.push(question);
  return { challengeId, questions: selected.slice(0, count) };
}

export function makeDemoSession({ mode, questionIds, now = Date.now(), ttlMs = TRIVIA_CONFIG.sessionTtlMs }) {
  return { id: `demo_${hashString(`${mode}:${questionIds.join(":")}:${now}`).toString(36)}`, mode, questionIds: [...questionIds], createdAt: now, expiresAt: now + ttlMs, rewardEligible: false };
}

export function isSessionExpired(session, now = Date.now()) {
  return !session || !Number.isFinite(session.expiresAt) || now >= session.expiresAt;
}

export function proposedDailyReward(results, alreadyClaimed = false, config = TRIVIA_CONFIG) {
  if (!config.featureFlags.authoritativeCredits || alreadyClaimed) return 0;
  let reward = config.dailyCreditProposal.completion;
  if (results.accuracy >= 80) reward += config.dailyCreditProposal.accuracy80;
  if (results.accuracy === 100) reward += config.dailyCreditProposal.perfect;
  return Math.min(config.dailyCreditProposal.dailyCap, reward);
}

export function answerIndexFromKey(key) {
  return /^[1-4]$/.test(String(key)) ? Number(key) - 1 : null;
}

export function nextTimerRemaining(remainingMs, elapsedMs, { paused = false, locked = false } = {}) {
  if (paused || locked) return Math.max(0, remainingMs);
  return Math.max(0, remainingMs - Math.max(0, elapsedMs));
}

export function rewardEligibility({ authenticated, serverValidated, featureEnabled, alreadyClaimed, claimedToday = 0, dailyCap = 20 }) {
  if (!featureEnabled) return { eligible: false, reason: "disabled", remainingCap: 0 };
  if (!authenticated) return { eligible: false, reason: "guest", remainingCap: 0 };
  if (!serverValidated) return { eligible: false, reason: "unverified", remainingCap: 0 };
  if (alreadyClaimed) return { eligible: false, reason: "duplicate", remainingCap: Math.max(0, dailyCap - claimedToday) };
  return { eligible: claimedToday < dailyCap, reason: claimedToday < dailyCap ? "eligible" : "cap-reached", remainingCap: Math.max(0, dailyCap - claimedToday) };
}

export function isDuplicateRewardClaim(existingClaims, candidate) {
  return existingClaims.some((claim) => claim.idempotencyKey === candidate.idempotencyKey || (claim.userId === candidate.userId && claim.challengeId === candidate.challengeId));
}

export function survivalDifficulty(correctCount) {
  if (correctCount >= 10) return "hard";
  if (correctCount >= 5) return "medium";
  return "easy";
}

export function canUnlockJackpot(mode, answers) {
  return mode === "quick" && answers.filter((answer) => answer.correct).length >= 8;
}
