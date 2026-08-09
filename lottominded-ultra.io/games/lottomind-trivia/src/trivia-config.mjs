export const TRIVIA_CONFIG = Object.freeze({
  schemaVersion: 1,
  reviewedAt: "2026-08-05",
  quickPlayLength: 10,
  dailyVaultLength: 5,
  questionSeconds: 15,
  feedbackDelayMs: 2600,
  survivalLives: 3,
  survivalDifficultyStep: 5,
  jackpotUnlockCorrect: 8,
  scoring: Object.freeze({
    baseCorrect: 100,
    maxSpeedBonus: 50,
    difficultyMultiplier: Object.freeze({ easy: 1, medium: 1.25, hard: 1.5 }),
    streakMultiplier: Object.freeze([
      Object.freeze({ minimum: 8, multiplier: 1.5 }),
      Object.freeze({ minimum: 5, multiplier: 1.25 }),
      Object.freeze({ minimum: 3, multiplier: 1.1 }),
      Object.freeze({ minimum: 0, multiplier: 1 }),
    ]),
    jackpotBonus: 500,
  }),
  services: Object.freeze({
    secureSessions: false,
    creditRewards: false,
    leaderboards: false,
    profileBadges: false,
  }),
  demoNotice: "Secure Trivia services are not configured. Scores and guest badges stay on this device; no LottoCredits are issued.",
});

export const CATEGORY_LABELS = Object.freeze({
  "lottery-knowledge": "Lottery Knowledge",
  "numbers-numerology": "Numbers and Numerology",
  "ufo-unexplained": "UFO and Unexplained",
  "detroit-history-culture": "Detroit History and Culture",
  "music-pop-culture": "Music and Pop Culture",
  "lottomind-universe": "LottoMind Universe",
  "mystery-mix": "Mystery Mix",
});

export const MODE_LABELS = Object.freeze({
  quick: "Quick Play",
  daily: "Daily Vault Practice",
  survival: "Survival Mode",
  category: "Category Run",
});
