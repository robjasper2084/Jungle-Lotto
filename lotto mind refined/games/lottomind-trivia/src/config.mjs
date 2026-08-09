export const TRIVIA_CONFIG = Object.freeze({
  scoring: Object.freeze({
    baseCorrect: 100,
    maxSpeedBonus: 50,
    difficultyMultipliers: Object.freeze({ easy: 1, medium: 1.25, hard: 1.5 }),
    streakMultipliers: Object.freeze([{ at: 8, value: 1.5 }, { at: 5, value: 1.25 }, { at: 3, value: 1.1 }]),
  }),
  modes: Object.freeze({
    quick: Object.freeze({ id: "quick", label: "Quick Play", questionCount: 10, seconds: 15, description: "Ten fast questions across the Vault." }),
    daily: Object.freeze({ id: "daily", label: "Daily Vault", questionCount: 5, seconds: 20, description: "The same five-question demo challenge for every player today." }),
    survival: Object.freeze({ id: "survival", label: "Survival", questionCount: null, seconds: 15, lives: 3, description: "Three misses end the run. Difficulty rises every five correct." }),
    category: Object.freeze({ id: "category", label: "Category Run", questionCount: 10, seconds: 15, description: "Master one knowledge lane." }),
    jackpot: Object.freeze({ id: "jackpot", label: "Jackpot Round", questionCount: 1, seconds: 12, description: "One hard bonus question unlocked by eight Quick Play answers." }),
  }),
  feedbackDelayMs: 3200,
  dailyCreditProposal: Object.freeze({ completion: 5, accuracy80: 5, perfect: 10, dailyCap: 20 }),
  featureFlags: Object.freeze({
    authoritativeCredits: false,
    serverDailySelection: false,
    remoteLeaderboards: false,
    profileBadgeSync: false,
  }),
  storageKeys: Object.freeze({
    progress: "lottomind.trivia-vault.progress.v1",
    settings: "lottomind.trivia-vault.settings.v1",
    leaderboards: "lottomind.trivia-vault.local-leaderboards.v1",
  }),
  sessionTtlMs: 30 * 60 * 1000,
});

export const CATEGORIES = Object.freeze([
  { id: "lottery-knowledge", label: "Lottery Knowledge", icon: "◉" },
  { id: "numbers-numerology", label: "Numbers & Numerology", icon: "∞" },
  { id: "ufo-unexplained", label: "UFO & Unexplained", icon: "◇" },
  { id: "detroit-history-culture", label: "Detroit History & Culture", icon: "D" },
  { id: "music-pop-culture", label: "Music & Pop Culture", icon: "♫" },
  { id: "lottomind-universe", label: "LottoMind Universe", icon: "M" },
  { id: "mystery-mix", label: "Mystery Mix", icon: "?" },
]);
