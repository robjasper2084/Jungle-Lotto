export const TRIVIA_REWARD_POLICY = Object.freeze({
  completionCredits: 5,
  accuracyBonusCredits: 5,
  perfectBonusCredits: 10,
  dailyCreditCap: 20,
  accuracyThreshold: 0.8,
  sessionTtlMs: 30 * 60 * 1000,
});

export function calculatePotentialDailyReward({ completed, correct, total }) {
  if (!completed || !Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) return 0;
  let reward = TRIVIA_REWARD_POLICY.completionCredits;
  if (correct / total >= TRIVIA_REWARD_POLICY.accuracyThreshold) reward += TRIVIA_REWARD_POLICY.accuracyBonusCredits;
  if (correct === total) reward += TRIVIA_REWARD_POLICY.perfectBonusCredits;
  return Math.min(TRIVIA_REWARD_POLICY.dailyCreditCap, reward);
}

export function sessionIsActive(startedAt, now = Date.now()) {
  const started = new Date(startedAt).getTime();
  const current = new Date(now).getTime();
  return Number.isFinite(started) && Number.isFinite(current) && current >= started && current - started <= TRIVIA_REWARD_POLICY.sessionTtlMs;
}

export function rewardClaimIsUnique(existingIdempotencyKeys, idempotencyKey) {
  if (!Array.isArray(existingIdempotencyKeys) || typeof idempotencyKey !== "string" || idempotencyKey.length < 16) return false;
  return !existingIdempotencyKeys.includes(idempotencyKey);
}
