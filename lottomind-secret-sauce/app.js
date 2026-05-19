const APP_SLUG = "/lottomind-secret-sauce";
const BASE = (() => {
  const path = window.location.pathname;
  const slugIndex = path.indexOf(APP_SLUG);
  return slugIndex >= 0 ? path.slice(0, slugIndex + APP_SLUG.length) : APP_SLUG;
})();

const ASSETS = {
  logo: `${BASE}/assets/images/lottomind-brain-logo.2f28d70bc952673d95508151e29f46b1.png`,
  reset: `${BASE}/assets/images/frequency-vault-lottomind-bg.ed65bffe05847e5e6d732d8354acb5b1.png`,
  dream: `${BASE}/assets/images/dream-oracle-jungle-bg.a4c667c7a8153842972fe7cf8b06aa02.png`,
  heatmap: `${BASE}/assets/images/lottomind-live-logo-brain.7f7239556a4a3e4035517b0bac125303.png`,
  power: `${BASE}/assets/images/powertools-hero-bg.26c2f5fbc03f6f2f06a78067f283be94.png`,
  powerTools: `${BASE}/assets/images/powertools-ai-fixed-games.13c13b9fed4bd95d952df4aacd3078ba.png`,
  live: `${BASE}/assets/images/live-data-records-panel.404f88fa9201c5e14861577dc5bc8b97.png`,
  credit: `${BASE}/assets/images/lottomind-credit-coin-circle.c6ba4693cc71d242dd0f2ff47a19ee98.png`,
  mascot: `${BASE}/assets/images/lottomind-brain-logo.2f28d70bc952673d95508151e29f46b1.png`,
  sequence: `${BASE}/assets/images/sequence-engine-live-bg.7f7239556a4a3e4035517b0bac125303.png`,
  arcade: `${BASE}/assets/arcade/jungle-vault-bg-gold.3c093c0c95965d35cbb0eddee93904f6.png`,
  arcadeCoin: `${BASE}/assets/arcade/play-arcade-coin-button-transparent.34454e607e0af66d23931637bbd7a364.png`,
  music: `${BASE}/assets/images/dashboard-music-hub-bg.fd20530e40e09f38ef442fddd2f4a17c.png`,
  hot: `${BASE}/assets/images/strategy-hot-button.ed3ed607fe6f03236eadf0b34b330b37.png`,
  cold: `${BASE}/assets/images/strategy-cold-button.59a58d8b98e1302eeb6284ec5c86a9d7.png`,
  balanced: `${BASE}/assets/images/strategy-balanced-button.0b00547b9900f66b82bdaf63849aab4b.png`,
  psychic: `${BASE}/assets/images/ai-psychic-engine-circle.95310af8f2dc5491754f875ec150e785.png`,
  commandDeck: `${BASE}/assets/custom/generated-command-deck.webp`,
  studioBooth: `${BASE}/assets/custom/generated-command-deck.webp`,
  detroitHoodieClose: `${BASE}/assets/custom/detroit-hoodie-close.png`,
  detroitPoloClose: `${BASE}/assets/custom/detroit-polo-close.png`,
  detroitCapClose: `${BASE}/assets/custom/detroit-cap-close.png`,
  detroitCollection: `${BASE}/assets/custom/detroit-collection.png`,
  detroitPoloSmall: `${BASE}/assets/custom/detroit-polo-small.png`,
  detroitCapFront: `${BASE}/assets/custom/detroit-cap-front.png`,
  voiceCornerMic: `${BASE}/assets/custom/generated-lottomind-mic.webp`,
  searchMic: `${BASE}/assets/custom/generated-lottomind-mic.webp`,
  dreamOracleHost: `${BASE}/assets/custom/dream-oracle-host.png`,
};

const AUDIO = {
  reset: `${BASE}/audio/lottomind-frequency.mp3`,
  startup: `${BASE}/audio/lottomind-startup.mp3`,
  rain: `${BASE}/audio/LottoMind%20Rainfield.mp3`,
  lucky: `${BASE}/audio/lucky-frequency-sessions.mp3`,
  rain432: `${BASE}/audio/detroit-rain-432.mp3`,
  vault174: `${BASE}/audio/LottoMind%20Vault%20174.mp3`,
  digitalStatic: `${BASE}/audio/digital-static.mp3`,
  goldReset: `${BASE}/audio/miracle-gold-reset.mp3`,
  userFrequency: `${BASE}/audio/lottomind-frequency-user.mp3`,
  userRainfield: `${BASE}/audio/lottomind-rainfield-user.mp3`,
  userVault174: `${BASE}/audio/lottomind-vault-174-user.mp3`,
};

const TAB_INTROS = [AUDIO.digitalStatic, AUDIO.goldReset, AUDIO.userFrequency, AUDIO.userRainfield, AUDIO.userVault174];
const ROUTE_AUDIO_DURATION_MS = 5000;

const ROUTE_AUDIO_POOLS = {
  dashboard: [AUDIO.userFrequency, AUDIO.goldReset, AUDIO.startup],
  powertools: [AUDIO.digitalStatic, AUDIO.lucky, AUDIO.userFrequency],
  heatmap: [AUDIO.digitalStatic, AUDIO.rain432, AUDIO.userRainfield],
  dreams: [AUDIO.userRainfield, AUDIO.goldReset, AUDIO.rain],
  dreamOracle: [AUDIO.userRainfield, AUDIO.goldReset],
  reset: null,
  sequence: [AUDIO.userVault174, AUDIO.vault174, AUDIO.digitalStatic],
  history: [AUDIO.userVault174, AUDIO.startup],
  arcade: [AUDIO.digitalStatic, AUDIO.lucky],
  arcadeGame: [AUDIO.digitalStatic, AUDIO.lucky],
  game: [AUDIO.digitalStatic, AUDIO.lucky],
  music: [AUDIO.userFrequency, AUDIO.userVault174, AUDIO.goldReset],
  radioStation: [AUDIO.userFrequency, AUDIO.lucky],
  studio: [AUDIO.userFrequency, AUDIO.goldReset, AUDIO.digitalStatic],
  store: [AUDIO.goldReset, AUDIO.userFrequency],
  scanner: [AUDIO.digitalStatic, AUDIO.userRainfield],
};

const AUDIO_LIBRARY = [
  ["LottoMind Frequency", `${BASE}/audio/lottomind-frequency.mp3`, "Dashboard-to-reset frequency bed"],
  ["Digital Static", `${BASE}/audio/digital-static.mp3`, "Tab intro and scanner texture"],
  ["Miracle Gold Reset", `${BASE}/audio/miracle-gold-reset.mp3`, "Gold reset intro"],
  ["Lucky Frequency Sessions", `${BASE}/audio/lucky-frequency-sessions.mp3`, "Long-form focus session"],
  ["Detroit Rain 432", `${BASE}/audio/detroit-rain-432.mp3`, "432 Hz rainfield calm"],
  ["LottoMind Startup", `${BASE}/audio/lottomind-startup.mp3`, "Branded app intro"],
  ["LottoMind Rainfield", `${BASE}/audio/LottoMind%20Rainfield.mp3`, "Rain layer from the old media kit"],
  ["LottoMind Vault 174", `${BASE}/audio/LottoMind%20Vault%20174.mp3`, "Vault tone session"],
];

const STREAMING_LINKS = [
  ["Apple Music", "Connect the LottoMind Records label lane to Apple Music.", "apple", ASSETS.logo, "https://music.apple.com/"],
  ["YouTube", "Open videos, shorts, and branded dream reveals.", "youtube", ASSETS.power, "https://www.youtube.com/"],
  ["YouTube Music", "Route long-form reset sessions into a player lane.", "youtube-music", ASSETS.music, "https://music.youtube.com/"],
];

const VIDEO_LIBRARY = [
  ["Power Tools Dashboard", `${BASE}/videos/power-tools-dashboard-box.mp4`, ASSETS.power],
  ["Power Tools Button", `${BASE}/videos/power-tools-button-green-screen.mp4`, ASSETS.powerTools],
  ["Play Arcade Button", `${BASE}/videos/play-arcade-button-loop.mp4`, ASSETS.arcade],
  ["Merch Store Button", `${BASE}/videos/merch-store-button-loop.mp4`, ASSETS.credit],
];

const ROUTES = {
  dashboard: "",
  powertools: "powertools",
  reset: "meditation",
  dreamOracle: "dream-oracle",
  dreams: "dreams",
  heatmap: "heatmap",
  numberGenerator: "number-generator",
  dailyTools: "daily-tools",
  sequence: "sequence",
  history: "history",
  historyUi: "history-ui",
  live: "live-results",
  scanner: "scanner",
  wallet: "credits-wallet",
  store: "shop",
  profile: "profile",
  settings: "settings",
  arcade: "arcade",
  academy: "academy",
  lottoIntel: "lotto-intelligence",
  psychic: "psychic",
  dreamVideo: "dream-video",
  intelligenceLocker: "intelligence-locker",
  predictions: "predictions",
  jackpot: "jackpot",
  wheelBuilder: "wheel-builder",
  newsRadar: "news-radar",
  marketplace: "marketplace",
  proPlaybook: "pro-playbook",
  challenges: "challenges",
  game: "game",
  liveData: "live-data",
  ticketScanner: "ticket-scanner",
  viralStudio: "viral-studio",
  heatmapAnalytics: "heatmap-analytics",
  ai: "lottomind-ai",
  pickGames: "pick-games",
  studio: "studio",
  music: "music-hub",
  radioStation: "radio-station",
  horoscope: "horoscope",
  luckyWeather: "lucky-weather",
  storeLocator: "store-locator",
  creditStore: "credit-store",
  savedWallet: "saved-wallet",
  dailyFortune: "daily-fortune",
  luckProfile: "luck-profile",
  futureRead: "future-read",
  nameNumbers: "name-numbers",
  intelligence: "intelligence",
  nationwide: "nationwide-analysis",
  detailedReport: "detailed-report",
  records: "lottomind-records",
  historical: "lottomind-historical",
  gamesHub: "games-hub",
  arcadeGame: "arcade/game",
  achievements: "achievements",
  vip: "vip",
  community: "community",
  contests: "contests",
  cardGame: "card-game",
  ludo: "ludo",
  crossword: "crossword",
  wordSearch: "word-search",
  triviaPlay: "trivia-play",
  triviaRewards: "trivia-rewards",
  triviaRedeem: "trivia-redeem",
  usLottery: "us-lottery",
  energyMeter: "energy-meter",
  onboarding: "onboarding",
  splash: "splash",
  paywall: "paywall",
  thankYou: "thank-you",
  original: "original",
  notifications: "notifications",
  help: "help",
  policies: "policies",
};

const ROUTE_ALIASES = {
  "": "dashboard",
  "/": "dashboard",
  meditation: "reset",
  "dream-oracle": "dreams",
  "history-ui": "historyUi",
  "heatmap-analytics": "heatmapAnalytics",
  "number-generator": "numberGenerator",
  "daily-tools": "dailyTools",
  "live-results": "live",
  scanner: "scanner",
  "ticket-scanner": "ticketScanner",
  "viral-studio": "viralStudio",
  "credits-wallet": "wallet",
  "saved-wallet": "savedWallet",
  "credit-store": "creditStore",
  shop: "store",
  "music-hub": "music",
  "radio-station": "radioStation",
  "lottomind-ai": "ai",
  "lotto-intelligence": "lottoIntel",
  "pick-games": "pickGames",
  studio: "studio",
  "dream-video": "dreamVideo",
  "intelligence-locker": "intelligenceLocker",
  predictions: "predictions",
  "daily-lab": "dailyTools",
  jackpot: "jackpot",
  "wheel-builder": "wheelBuilder",
  "news-radar": "newsRadar",
  marketplace: "marketplace",
  "pro-playbook": "proPlaybook",
  challenges: "challenges",
  game: "game",
  horoscope: "horoscope",
  "lucky-weather": "luckyWeather",
  "store-locator": "storeLocator",
  "daily-fortune": "dailyFortune",
  "luck-profile": "luckProfile",
  "future-read": "futureRead",
  "name-numbers": "nameNumbers",
  intelligence: "intelligence",
  "nationwide-analysis": "nationwide",
  "detailed-report": "detailedReport",
  "lottomind-records": "records",
  "lottomind-historical": "historical",
  "games-hub": "gamesHub",
  "arcade/game": "arcadeGame",
  achievements: "achievements",
  vip: "vip",
  community: "community",
  contests: "contests",
  "card-game": "cardGame",
  ludo: "ludo",
  crossword: "crossword",
  "word-search": "wordSearch",
  "trivia-play": "triviaPlay",
  "trivia-rewards": "triviaRewards",
  "trivia-redeem": "triviaRedeem",
  "us-lottery": "usLottery",
  "energy-meter": "energyMeter",
  onboarding: "onboarding",
  splash: "splash",
  paywall: "paywall",
  "thank-you": "thankYou",
  original: "original",
  notifications: "notifications",
  help: "help",
  policies: "policies",
};

const TRIVIA_QUESTIONS = [
  {
    q: "What is the safest first move before saving a Dream Oracle pick?",
    options: ["Run the interpretation", "Clear the vault", "Mute every tab"],
    answer: 0,
    note: "Dream picks work best after the Oracle reads the symbols and creates the set.",
  },
  {
    q: "Which LottoMind lane compares hot, cold, and balance signals?",
    options: ["Signal Radar", "Merch Store", "Privacy Policy"],
    answer: 0,
    note: "Signal Radar is the quick scan lane for number movement.",
  },
  {
    q: "Where should saved numbers and dream readings live?",
    options: ["History Vault", "Search bar", "Mode switch"],
    answer: 0,
    note: "History Vault keeps saved sets, dream readings, and psychic readings together.",
  },
  {
    q: "What does LottoMind Radio connect back into?",
    options: ["Reset tones", "State taxes", "A scratch-off camera"],
    answer: 0,
    note: "Radio sessions can load frequency lanes into the Reset player.",
  },
  {
    q: "Which reminder matters before every play session?",
    options: ["Lottery outcomes are random", "More taps guarantee wins", "Only one number can repeat"],
    answer: 0,
    note: "LottoMind is entertainment and organization; lottery results are random.",
  },
];

const LOTTO_GAMES = [
  { id: "powerball", name: "Powerball", mainCount: 5, mainMax: 69, specialName: "Powerball", specialMax: 26 },
  { id: "mega-millions", name: "Mega Millions", mainCount: 5, mainMax: 70, specialName: "Mega Ball", specialMax: 24 },
  { id: "cash-5", name: "Cash 5", mainCount: 5, mainMax: 43 },
  { id: "pick-3", name: "Pick 3", mainCount: 3, mainMax: 9 },
  { id: "pick-4", name: "Pick 4", mainCount: 4, mainMax: 9 },
];

const DEMO_DRAWS = {
  powerball: [[4, 11, 23, 36, 58], [7, 18, 32, 45, 61], [3, 14, 29, 41, 67], [9, 22, 34, 55, 62], [11, 19, 27, 44, 69], [5, 17, 36, 50, 64], [2, 23, 31, 48, 58], [14, 28, 33, 45, 60]],
  "mega-millions": [[6, 16, 31, 42, 64], [9, 18, 25, 47, 70], [4, 21, 32, 55, 66], [12, 24, 39, 48, 63], [1, 16, 28, 42, 59], [8, 19, 31, 52, 65], [10, 22, 34, 47, 68], [6, 27, 38, 54, 70]],
  "cash-5": [[2, 8, 16, 23, 37], [5, 11, 18, 29, 42], [1, 9, 16, 24, 35], [7, 14, 21, 33, 40], [3, 12, 23, 30, 41], [6, 15, 18, 28, 39], [4, 10, 20, 31, 37], [8, 13, 22, 34, 43]],
  "pick-3": [[1, 7, 3], [8, 0, 4], [3, 3, 9], [2, 6, 8], [7, 1, 5], [0, 4, 9], [6, 2, 2], [9, 8, 1]],
  "pick-4": [[1, 7, 3, 8], [8, 0, 4, 2], [3, 3, 9, 6], [2, 6, 8, 1], [7, 1, 5, 0], [0, 4, 9, 7], [6, 2, 2, 5], [9, 8, 1, 3]],
};

const DREAM_SYMBOLS = [
  { term: "gold", number: 8, label: "gold", meaning: "value, clarity, and visible opportunity" },
  { term: "money", number: 7, label: "money", meaning: "resources, exchange, and timing" },
  { term: "water", number: 3, label: "water", meaning: "emotion, movement, and reset energy" },
  { term: "snake", number: 13, label: "snake", meaning: "transformation and alertness" },
  { term: "dog", number: 11, label: "dog", meaning: "loyalty and familiar patterns" },
  { term: "baby", number: 9, label: "baby", meaning: "new starts and fresh cycles" },
  { term: "car", number: 4, label: "car", meaning: "direction and momentum" },
  { term: "house", number: 6, label: "house", meaning: "security and home signal" },
  { term: "door", number: 12, label: "door", meaning: "choice point and threshold" },
  { term: "fire", number: 5, label: "fire", meaning: "fast action and heat" },
  { term: "moon", number: 18, label: "moon", meaning: "intuition and hidden cycles" },
  { term: "angel", number: 22, label: "angel", meaning: "protection and guidance" },
  { term: "bridge", number: 27, label: "bridge", meaning: "transition and connection" },
  { term: "stairs", number: 31, label: "stairs", meaning: "progress by steps" },
  { term: "flying", number: 33, label: "flying", meaning: "freedom and big-picture movement" },
  { term: "key", number: 14, label: "key", meaning: "unlocking a path" },
];

const LIVE_RESULT_RECORDS = [
  { id: "us-powerball", stateCode: "US", stateName: "Nationwide", gameId: "powerball", gameName: "Powerball", session: "evening", drawDate: "2026-04-22", numbers: [8, 12, 24, 41, 66], special: 15, jackpotMillions: 425 },
  { id: "us-mega", stateCode: "US", stateName: "Nationwide", gameId: "mega-millions", gameName: "Mega Millions", session: "evening", drawDate: "2026-04-21", numbers: [6, 16, 31, 42, 64], special: 11, jackpotMillions: 310 },
  { id: "ny-pick3-mid", stateCode: "NY", stateName: "New York", gameId: "pick-3", gameName: "Numbers", session: "midday", drawDate: "2026-04-24", numbers: [3, 3, 9] },
  { id: "ny-pick4-eve", stateCode: "NY", stateName: "New York", gameId: "pick-4", gameName: "Win 4", session: "evening", drawDate: "2026-04-23", numbers: [2, 7, 4, 1] },
  { id: "fl-pick3-mid", stateCode: "FL", stateName: "Florida", gameId: "pick-3", gameName: "Pick 3", session: "midday", drawDate: "2026-04-24", numbers: [1, 7, 3] },
  { id: "fl-pick4-eve", stateCode: "FL", stateName: "Florida", gameId: "pick-4", gameName: "Pick 4", session: "evening", drawDate: "2026-04-23", numbers: [8, 0, 4, 2] },
  { id: "tx-cash5", stateCode: "TX", stateName: "Texas", gameId: "cash-5", gameName: "Cash 5", session: "evening", drawDate: "2026-04-23", numbers: [2, 8, 16, 23, 37], jackpotMillions: 0.12 },
  { id: "ca-lotto", stateCode: "CA", stateName: "California", gameId: "cash-5", gameName: "State Lotto", session: "evening", drawDate: "2026-04-23", numbers: [5, 11, 18, 29, 42], jackpotMillions: 18 },
];

const WEATHER_SIGNALS = [
  { stateCode: "NY", name: "New York", condition: "Cloudy reset", temperature: 59, signal: "Neutral", numbers: [5, 19, 33] },
  { stateCode: "FL", name: "Florida", condition: "Warm evening storms", temperature: 82, signal: "Rising", numbers: [8, 12, 24] },
  { stateCode: "TX", name: "Texas", condition: "Dry heat", temperature: 78, signal: "Balanced", numbers: [7, 18, 31] },
  { stateCode: "CA", name: "California", condition: "Cool coastal air", temperature: 66, signal: "Cooling", numbers: [6, 16, 42] },
];

const MARKETPLACE_ITEMS = [
  ["Mind Credits", "Use credits for psychic reads, wheels, reports, and deep scans.", 100, "credits-pack"],
  ["LottoMind VIP", "Unlock premium paths and reduced credit friction.", 250, "vip"],
  ["Dream Video Studio", "Turn dream notes into storyboard-ready concepts.", 180, "dream-video"],
  ["Learning Library", "Wheel basics, matrix rules, Pick 3/Pick 4 education.", 60, "learning-library"],
];

const MERCH_ITEMS = [
  {
    title: "I Love Detroit Hoodie",
    copy: "Charcoal hoodie with embroidered Detroit skyline heart and LottoMind-ready streetwear energy.",
    price: "$64",
    type: "Clothing",
    art: ASSETS.detroitHoodieClose,
    className: "detroit-hoodie",
  },
  {
    title: "Detroit Polo",
    copy: "Navy polo with stitched I Love Detroit crest for a cleaner premium merch lane.",
    price: "$46",
    type: "Clothing",
    art: ASSETS.detroitPoloClose,
    className: "detroit-polo",
  },
  {
    title: "Detroit Logo Tee",
    copy: "Heather charcoal tee with the full embroidered Detroit mark.",
    price: "$34",
    type: "Clothing",
    art: ASSETS.detroitCollection,
    className: "detroit-tee",
  },
  {
    title: "I Love Detroit Cap",
    copy: "Navy structured cap with centered embroidered city-heart logo.",
    price: "$34",
    type: "Clothing",
    art: ASSETS.detroitCapFront,
    className: "detroit-cap",
  },
  {
    title: "Mini Crest Polo",
    copy: "Minimal chest-logo polo for a more subtle Detroit drop.",
    price: "$42",
    type: "Clothing",
    art: ASSETS.detroitPoloSmall,
    className: "detroit-polo-small",
  },
  {
    title: "Cap Closeup Drop",
    copy: "Close-detail merch preview for the embroidered cap logo.",
    price: "$34",
    type: "Official Drop",
    art: ASSETS.detroitCapClose,
    className: "detroit-cap-close",
  },
  {
    title: "LottoMind Coin Sticker Pack",
    copy: "Glossy coin, brain, and radar sticker set.",
    price: "$14",
    type: "Sticker Pack",
    art: ASSETS.logo,
    className: "stickers",
  },
  {
    title: "Power Tools Desk Mat",
    copy: "Wide command-deck mat for number work.",
    price: "$39",
    type: "Desk Gear",
    art: ASSETS.powerTools,
    className: "desk-mat",
  },
  {
    title: "Pick 3 / Pick 4 Playbook",
    copy: "Digital guide for daily digits, roots, mirrors, and box logic.",
    price: "$19",
    type: "E-Book",
    art: ASSETS.sequence,
    className: "ebook",
  },
  {
    title: "Dream Symbol Number Guide",
    copy: "E-book mapping dream images into LottoMind Oracle number lanes.",
    price: "$24",
    type: "E-Book",
    art: ASSETS.dream,
    className: "dream-guide",
  },
  {
    title: "Lotto Crossword Puzzle Pack",
    copy: "Printable LottoMind crossword and word puzzle bundle.",
    price: "$12",
    type: "Digital Game",
    art: ASSETS.arcadeCoin,
    className: "crossword-pack",
  },
];

const STORE_DIRECTORY = [
  { id: "ny-hudson-lucky", state: "NY", name: "Hudson Lucky Mart", address: "184 Hudson Ave, New York, NY", distance: 0.8, lat: 40.734, lng: -74.006, open: true, note: "Open until 10 PM", services: ["Powerball", "Mega Millions", "Scratchers", "Self-Check", "Prize Cashing"], numbers: [5, 19, 33] },
  { id: "ny-empire-ticket", state: "NY", name: "Empire Ticket Counter", address: "88 Canal St, New York, NY", distance: 1.4, lat: 40.716, lng: -73.997, open: true, note: "Self-check lane", services: ["Powerball", "Daily 3", "Daily 4", "Ticket Scanner"], numbers: [11, 27, 40] },
  { id: "fl-sunrise", state: "FL", name: "Sunrise Lotto Stop", address: "220 Sunrise Blvd, Fort Lauderdale, FL", distance: 1.2, lat: 26.137, lng: -80.13, open: true, note: "Storm-lane pickup", services: ["Powerball", "Mega Millions", "Scratchers", "Vending"], numbers: [8, 12, 24] },
  { id: "tx-lone-star", state: "TX", name: "Lone Star Ticket Hub", address: "401 Congress Ave, Austin, TX", distance: 2.4, lat: 30.266, lng: -97.743, open: false, note: "Dry heat balance", services: ["Powerball", "Daily 3", "Daily 4", "Prize Cashing"], numbers: [7, 18, 31] },
  { id: "ca-coastal", state: "CA", name: "Coastal Numbers Market", address: "500 Market St, San Francisco, CA", distance: 1.7, lat: 37.789, lng: -122.401, open: true, note: "Cooling trend", services: ["Mega Millions", "Scratchers", "Self-Check"], numbers: [6, 16, 42] },
  { id: "ga-peach", state: "GA", name: "Peach State Play Center", address: "75 Peachtree St, Atlanta, GA", distance: 1.1, lat: 33.754, lng: -84.389, open: true, note: "Warm evening lane", services: ["Powerball", "Mega Millions", "Vending", "Prize Cashing"], numbers: [4, 14, 28] },
  { id: "mi-motor", state: "MI", name: "Motor City Lucky Stop", address: "100 Woodward Ave, Detroit, MI", distance: 0.9, lat: 42.331, lng: -83.045, open: true, note: "Cloud reset lane", services: ["Powerball", "Daily 3", "Daily 4", "Scratchers", "Self-Check"], numbers: [9, 21, 36] },
  { id: "mi-riverfront", state: "MI", name: "Riverfront Jackpot Shop", address: "300 Atwater St, Detroit, MI", distance: 1.6, lat: 42.329, lng: -83.04, open: false, note: "Evening draw rush", services: ["Mega Millions", "Scratchers", "Prize Cashing"], numbers: [2, 17, 44] },
];

const STORE_FILTERS = ["Open Now", "Powerball", "Mega Millions", "Daily 3", "Daily 4", "Scratchers", "Self-Check", "Prize Cashing"];

const FEATURE_UNLOCKS = [
  { id: "premium-tip", title: "Premium Lotto Tip", cost: 100, route: "dailyFortune", window: "Permanent" },
  { id: "ai-number-set", title: "AI Number Set", cost: 250, route: "ai", window: "Permanent" },
  { id: "advanced-trivia", title: "Advanced Trivia Pack", cost: 500, route: "triviaPlay", window: "Permanent" },
  { id: "dream-bonus", title: "Dream Oracle Bonus Reading", cost: 750, route: "dreams", window: "Permanent" },
  { id: "analyzer-24", title: "Lotto Analyzer 24-hour Unlock", cost: 1000, route: "lottoIntel", window: "24 hours" },
  { id: "live-data-24", title: "Live Data 24-hour Unlock", cost: 1500, route: "liveData", window: "24 hours" },
  { id: "vip-insights", title: "VIP Lucky Insights", cost: 2000, route: "vip", window: "Permanent" },
];

const RADAR_POSITIONS = [
  [50, 14], [63, 18], [37, 18], [75, 26], [25, 26], [50, 30], [64, 34],
  [36, 34], [82, 42], [18, 42], [50, 46], [68, 52], [32, 52], [84, 60],
  [16, 60], [50, 64], [64, 68], [36, 68], [74, 76], [26, 76], [50, 82],
  [60, 88], [40, 88], [88, 72], [12, 72], [88, 28], [12, 28], [50, 50],
];

const ORACLE_STUDIO_GROUP = {
  title: "Oracle Studio",
  copy: "Reset, speak, interpret, radio, and save.",
  tools: [
    ["Reset Vault", "Tone wheel", "reset"],
    ["Dream Oracle", "Voice meaning", "dreams"],
    ["Radio Station", "Live audio", "radioStation"],
    ["Music Hub", "Audio deck", "music"],
    ["Sonic Studio", "Record booth", "studio"],
    ["Generate Dreams", "AI scenes", "dreamVideo"],
    ["Dream Video", "Storyboard", "dreamVideo"],
    ["Viral Studio", "Video loops", "viralStudio"],
    ["Psychic Engine", "Energy read", "psychic"],
    ["Daily Fortune", "Morning signal", "dailyFortune"],
    ["Name Numbers", "Name code", "nameNumbers"],
    ["Future Read", "Symbol forecast", "futureRead"],
  ],
};

const TOOL_GROUPS = [
  {
    title: "Main Lab",
    copy: "Analysis, live results, credits, records, stores, and saved picks.",
    tools: [
      ["Number Analyzer", "Trend lab", "numberGenerator"],
      ["Ticket Scanner", "Scan tickets", "scanner"],
      ["Live Vault Heatmap", "Radar map", "heatmap"],
      ["Pattern Scanner", "Signal lock", "sequence"],
      ["Smart Predictor", "AI insight", "ai"],
      ["Lotto Intelligence", "Deep report", "lottoIntel"],
      ["Energy Meter", "Signal score", "energyMeter"],
      ["Pick 3 / Pick 4", "Daily digits", "dailyTools"],
      ["Straight / Box", "Helper", "pickGames"],
      ["Mirror Numbers", "Flip pairs", "sequence"],
      ["Live Results", "Draw feed", "live"],
      ["Predictions", "Lock picks", "predictions"],
      ["Jackpot Reality", "Net view", "jackpot"],
      ["Wheel Builder", "Coverage", "wheelBuilder"],
      ["Credit Vault", "Balance", "wallet"],
      ["Marketplace", "Unlocks", "marketplace"],
      ["LottoMind Records", "Archive", "records"],
      ["Historical Lab", "Long view", "historical"],
      ["Store Locator", "Nearby play", "storeLocator"],
      ["History", "Saved runs", "history"],
    ],
  },
  {
    title: "Play + Learn",
    copy: "Arcade, challenges, and learning loops.",
    tools: [
      ["Arcade", "Reward games", "arcade"],
      ["Jackpot Run", "Play now", "arcadeGame"],
      ["Lotto Crossword", "Puzzle game", "crossword"],
      ["Word Search", "Symbol hunt", "wordSearch"],
      ["Academy", "Lessons", "academy"],
      ["Pro Playbook", "Strategy", "proPlaybook"],
      ["Achievements", "Missions", "achievements"],
      ["Challenges", "Daily tasks", "challenges"],
      ["Contests", "Prize board", "contests"],
      ["Onboarding", "Start path", "onboarding"],
      ["Paywall", "Premium gate", "paywall"],
      ["Trivia", "Earn credits", "triviaRewards"],
      ["Community", "Share runs", "community"],
      ["US Lottery", "State index", "usLottery"],
      ["Notifications", "Alerts", "notifications"],
      ["Help", "Support", "help"],
    ],
  },
];

const HOME_CAROUSEL = [
  ["Reset Studio", "Start with a calm signal before numbers.", "reset", ASSETS.reset],
  ["Dream Oracle", "Speak or type the dream and receive numbers.", "dreams", ASSETS.dream],
  ["Sonic Studio / Record Booth", "Record dream songs, lucky chants, and reset demos.", "studio", ASSETS.studioBooth],
  ["Music Store / Record Label", "Play LottoMind Records audio and reset sessions.", "music", ASSETS.music],
  ["Radio Station", "LottoMind Records live audio lane.", "radioStation", ASSETS.music],
  ["Generate Your Dreams", "Turn dreams into scenes, readings, and lucky reveal cards.", "dreamVideo", ASSETS.dream],
  ["Heatmap Radar", "Read hot, cold, and overdue movement.", "heatmap", ASSETS.heatmap],
  ["Arcade Deck", "Run Power Tools like mission cards.", "powertools", ASSETS.power],
  ["LottoMind Records", "Open saved reports, draw cards, and reading history.", "records", ASSETS.live],
  ["Marketplace Vault", "Credits, VIP tools, and branded unlocks.", "marketplace", ASSETS.credit],
  ["Video Studio", "Preview branded motion loops from the old app.", "dreamVideo", ASSETS.power],
  ["Contests", "Challenge board, rewards, and future entries.", "contests", ASSETS.arcade],
];

const QUICK_TOOLS = TOOL_GROUPS.flatMap((group) => group.tools);
const PLAY_LEARN_GROUP = TOOL_GROUPS.find((group) => group.title === "Play + Learn");
const POWER_TOOL_GROUPS = TOOL_GROUPS.filter((group) => group.title !== "Play + Learn");

const STORAGE = {
  history: "lottomind.oracle.real.history.v1",
  readings: "lottomind.oracle.real.dreams.v1",
  psychic: "lottomind.oracle.real.psychic.v1",
  credits: "lottomind.credit.balance.v1",
  settings: "lottomind.oracle.real.settings.v1",
  streams: "lottomind.oracle.real.streams.v1",
  stores: "lottomind.oracle.real.stores.v1",
  storeFavorites: "lottomind.oracle.real.storeFavorites.v1",
  unlocks: "lottomind.oracle.real.unlocks.v1",
  triviaHistory: "lottomind.oracle.real.triviaHistory.v1",
  crossword: "lottomind.oracle.real.crossword.v1",
  wordSearch: "lottomind.oracle.real.wordSearch.v1",
};

const DEFAULT_SETTINGS = {
  music: true,
  psychic: true,
  sound: true,
  motion: true,
  responsible: true,
};

const STATE_PINS = ["NY", "FL", "TX", "CA", "GA", "MI", "PA", "NJ", "OH", "IL"];

const state = {
  route: routeFromLocation(),
  gameId: localStorage.getItem("lottomind.oracle.real.game") || "powerball",
  strategy: localStorage.getItem("lottomind.oracle.real.strategy") || "balanced",
  selectedState: localStorage.getItem("lottomind.oracle.real.state") || "NY",
  viewMode: localStorage.getItem("lottomind.oracle.real.view") || "app",
  dreamText: "I dreamed I was flying over water and found a golden key near a moonlit bridge.",
  numberInput: "7 23 38 42 11",
  dailyInput: "194",
  nameInput: "LottoMind",
  barcodeInput: "",
  aiPrompt: "Build me a balanced set from my dream, weather, and radar.",
  currentSet: null,
  currentDream: null,
  currentPsychic: null,
  currentVideo: null,
  currentAi: null,
  currentNameNumbers: null,
  lastSequence: null,
  audioPlaying: false,
  volume: 0.18,
  tone: "528",
  duration: 300,
  timerRemaining: 300,
  timerRunning: false,
  scanResult: null,
  toast: "",
  muted: !getSettings().music,
  searchQuery: "",
  showUtilityMenu: false,
  showStatePicker: false,
  triviaIndex: 0,
  triviaScore: 0,
  triviaStreak: 0,
  triviaAnswered: null,
  triviaComplete: false,
  selectedMerchIndex: 0,
  merchCategory: "All",
  storeQuery: "",
  activeStoreFilters: [],
  selectedStoreId: "",
  userLocation: null,
  wordSearchMarks: loadJson("lottomind.oracle.real.wordSearch.v1", []),
  crosswordSolved: loadJson("lottomind.oracle.real.crossword.v1", { solved: false }).solved || false,
};

if (!LOTTO_GAMES.some((game) => game.id === state.gameId)) {
  state.gameId = "powerball";
  localStorage.setItem("lottomind.oracle.real.game", state.gameId);
}

let resetAudio = null;
let resetToneContext = null;
let resetToneOscillator = null;
let resetToneGain = null;
let routeAudio = null;
let routeAudioSrc = "";
let routeAudioRoute = "";
let routeAudioFadeId = null;
let routeAudioStopId = null;
let routeAudioPlayedRoute = "";
let timerId = null;
let toastId = null;

function getGame(gameId = state.gameId) {
  return LOTTO_GAMES.find((game) => game.id === gameId) || LOTTO_GAMES[0];
}

function hashSeed(value) {
  return String(value).split("").reduce((acc, char, index) => (acc + char.charCodeAt(0) * (index + 7)) % 2147483647, 97);
}

function seededRandom(seed) {
  let seedState = hashSeed(seed) || 1;
  return () => {
    seedState = (seedState * 48271) % 2147483647;
    return seedState / 2147483647;
  };
}

function uniqueSorted(numbers) {
  return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

function numberUniverse(game) {
  return Array.from({ length: game.mainMax + (game.mainMax === 9 ? 1 : 0) }, (_, index) => (game.mainMax === 9 ? index : index + 1));
}

function getDrawLog(gameId = state.gameId) {
  const dates = ["2026-04-20", "2026-04-17", "2026-04-14", "2026-04-10", "2026-04-07", "2026-04-03", "2026-03-31", "2026-03-27"];
  const game = getGame(gameId);
  const normalizedGameId = game.id;
  const draws = DEMO_DRAWS[normalizedGameId] || DEMO_DRAWS.powerball;
  return draws.map((numbers, index) => ({
    id: `${normalizedGameId}-${index}`,
    gameId: normalizedGameId,
    drawDate: dates[index] || "2026-03-01",
    numbers,
    special: game.specialMax ? ((index * 7 + 3) % game.specialMax) + 1 : undefined,
  }));
}

function getMatrixStats(gameId = state.gameId) {
  const game = getGame(gameId);
  const draws = getDrawLog(gameId);
  const counts = new Map();
  const lastSeen = new Map();
  draws.forEach((draw) => {
    draw.numbers.forEach((number) => {
      counts.set(number, (counts.get(number) || 0) + 1);
      if (!lastSeen.has(number) || draw.drawDate > lastSeen.get(number)) lastSeen.set(number, draw.drawDate);
    });
  });
  const maxCount = Math.max(1, ...Array.from(counts.values()));
  const rows = numberUniverse(game).map((number) => {
    const timesDrawn = counts.get(number) || 0;
    const heatScore = timesDrawn / maxCount;
    const badge = heatScore >= 0.8 ? "hot" : heatScore >= 0.45 ? "active" : timesDrawn > 0 ? "cooling" : "cold";
    return {
      number,
      timesDrawn,
      percent: draws.length ? Math.round((timesDrawn / draws.length) * 1000) / 10 : 0,
      lastDrawn: lastSeen.get(number) || null,
      badge,
      note: !lastSeen.get(number) ? "not seen" : badge === "hot" || badge === "active" ? "active" : "cooling",
    };
  });
  return { game, drawCount: draws.length, rows, trustScore: Math.min(98, 72 + draws.length * 3) };
}

function getHeatmap(gameId = state.gameId) {
  const report = getMatrixStats(gameId);
  const maxCount = Math.max(1, ...report.rows.map((row) => row.timesDrawn));
  return report.rows.map((row) => {
    const score = row.timesDrawn / maxCount;
    return {
      number: row.number,
      count: row.timesDrawn,
      score,
      label: score >= 0.8 ? "hot" : score >= 0.45 ? "active" : score > 0 ? "cool" : "cold",
    };
  });
}

function interpretDream(text, gameId = state.gameId) {
  const game = getGame(gameId);
  const lower = String(text || "").toLowerCase();
  const matches = DREAM_SYMBOLS.filter((symbol) => lower.includes(symbol.term));
  const rng = seededRandom(`${text}-${gameId}`);
  const base = matches.map((symbol) => ((symbol.number - 1) % game.mainMax) + (game.mainMax === 9 ? 0 : 1));
  while (base.length < game.mainCount) {
    base.push(game.mainMax === 9 ? Math.floor(rng() * 10) : Math.floor(rng() * game.mainMax) + 1);
  }
  let numbers = game.mainMax === 9 ? base.slice(0, game.mainCount) : uniqueSorted(base).slice(0, game.mainCount);
  while (numbers.length < game.mainCount) {
    const next = game.mainMax === 9 ? Math.floor(rng() * 10) : Math.floor(rng() * game.mainMax) + 1;
    if (game.mainMax === 9 || !numbers.includes(next)) numbers.push(next);
  }
  if (game.mainMax !== 9) numbers = uniqueSorted(numbers).slice(0, game.mainCount);
  const meanings = matches.map((symbol) => `${titleCase(symbol.label)}: ${symbol.meaning}`);
  const symbolNames = matches.map((symbol) => titleCase(symbol.label));
  const symbolDetails = matches.map((symbol) => ({
    label: titleCase(symbol.label),
    number: ((symbol.number - 1) % game.mainMax) + (game.mainMax === 9 ? 0 : 1),
    meaning: symbol.meaning,
    source: symbol.term,
  }));
  const heatSignals = getHeatmap(gameId).filter((cell) => cell.label === "hot" || cell.label === "active").slice(0, 3).map((cell) => cell.number);
  const wordCount = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  const dreamTone = matches.some((symbol) => ["gold", "angel", "key", "flying"].includes(symbol.label))
    ? "Opportunity"
    : matches.some((symbol) => ["water", "moon", "bridge"].includes(symbol.label))
      ? "Intuitive reset"
      : matches.some((symbol) => ["fire", "snake", "car"].includes(symbol.label))
        ? "Action signal"
        : "Open channel";
  const dreamLayer = dreamTone === "Opportunity"
    ? "The dream is leaning toward movement, openings, and useful timing. Treat bright objects, doors, keys, and flight as the lead lane."
    : dreamTone === "Intuitive reset"
      ? "The dream is leaning emotional and reflective. Water, moon, bridges, and travel signals point to a slower read before picking."
      : dreamTone === "Action signal"
        ? "The dream is pushing urgency. Fire, vehicles, snakes, or chase imagery should be balanced with one calmer radar number."
        : "The Oracle needs one or two sharper symbols, but the text still creates a usable seed from rhythm and word shape.";
  const summary = matches.length
    ? `This dream points to ${dreamTone.toLowerCase()}: ${symbolNames.slice(0, 4).join(", ")} are the strongest symbols in the reading.`
    : "This dream did not match a saved symbol directly, so the Oracle read the rhythm, imagery, and word pattern as an open signal.";
  const guidance = matches.length
    ? `Treat the dream as a symbolic prompt: keep the clearest symbol number, blend one radar number, then save before checking live results.`
    : `Add one or two concrete images from the dream, like water, a door, gold, a bridge, or a key, then run the Oracle again for a sharper meaning.`;
  const digitStream = numbers.map((number) => Math.abs(Number(number)) % 10);
  while (digitStream.length < 4) digitStream.push(Math.floor(rng() * 10));
  const pick3 = digitStream.slice(0, 3).join("");
  const pick4 = digitStream.slice(0, 4).join("");
  return {
    id: `dream_${Date.now()}`,
    title: matches.length ? "Dream meaning unlocked" : "Dream energy mapped",
    symbols: matches.map((symbol) => symbol.label),
    meanings,
    numbers,
    gameId,
    gameName: game.name,
    text,
    tone: dreamTone,
    summary,
    guidance,
    pick3,
    pick4,
    confidence: Math.min(96, 68 + matches.length * 7 + Math.floor(rng() * 10)),
    bestWindow: matches.some((symbol) => ["moon", "water", "dream"].includes(symbol.label)) ? "Evening" : "Midday",
    symbolDetails,
    heatSignals,
    dreamLayer,
    wordCount,
    numberLogic: [
      `${game.name}: ${game.mainCount} main numbers from a ${game.mainMax}-number field${game.specialName ? ` plus ${game.specialName}` : ""}.`,
      matches.length ? `Symbol seed: ${symbolDetails.map((symbol) => `${symbol.label}=${symbol.number}`).join(", ")}.` : "Symbol seed: open text rhythm because no saved symbol was matched.",
      `Radar blend: ${heatSignals.join(", ")} are active heatmap support numbers for comparison.`,
      `Daily bridge: Pick 3 ${pick3} / Pick 4 ${pick4} from the dream-number digit stream.`,
    ],
    actionSteps: [
      "Keep the clearest dream symbol as the anchor number.",
      "Compare the anchor against Heatmap Radar before saving.",
      "Use the Pick 3 / Pick 4 bridge only as a side lane, not the whole read.",
      "Save the reading if the symbols feel clear, then build a Dream Video storyboard if you want a visual version.",
    ],
    note: matches.length
      ? `Matched ${matches.map((symbol) => symbol.label).join(", ")} and blended them with ${game.name} rules.`
      : `No direct symbols found, so LottoMind used the dream text rhythm as a seed for ${game.name}.`,
    createdAt: new Date().toISOString(),
  };
}

function generateLottoSet(gameId = state.gameId, strategy = state.strategy, seedText = "") {
  const game = getGame(gameId);
  const heatmap = getHeatmap(gameId);
  const rng = seededRandom(`${gameId}-${strategy}-${seedText}-${Date.now()}`);
  const orderedHot = [...heatmap].sort((a, b) => b.count - a.count || a.number - b.number).map((cell) => cell.number);
  const orderedCold = [...heatmap].sort((a, b) => a.count - b.count || a.number - b.number).map((cell) => cell.number);
  const dreamNumbers = strategy === "dream" ? interpretDream(seedText || state.dreamText, gameId).numbers : [];
  const pool =
    strategy === "hot"
      ? orderedHot
      : strategy === "cold"
        ? orderedCold
        : strategy === "dream"
          ? dreamNumbers.concat(orderedHot)
          : orderedHot.slice(0, 12).concat(orderedCold.slice(0, 12), heatmap.map((cell) => cell.number));
  const picked = [];
  while (picked.length < game.mainCount) {
    const candidate = pool[Math.floor(rng() * pool.length)] ?? (game.mainMax === 9 ? Math.floor(rng() * 10) : Math.floor(rng() * game.mainMax) + 1);
    if (game.mainMax === 9 || !picked.includes(candidate)) picked.push(candidate);
  }
  const numbers = game.mainMax === 9 ? picked : uniqueSorted(picked);
  const special = game.specialMax ? Math.floor(rng() * game.specialMax) + 1 : undefined;
  return {
    id: `set_${Date.now()}_${Math.floor(rng() * 10000)}`,
    gameId,
    gameName: game.name,
    strategy,
    numbers,
    special,
    specialName: game.specialName,
    createdAt: new Date().toISOString(),
    note:
      strategy === "dream"
        ? "Dream Oracle blend using symbol mapping and recent hot signals."
        : strategy === "hot"
          ? "Prioritizes the most active numbers in the local sample."
          : strategy === "cold"
            ? "Prioritizes the cold watch sample."
            : strategy === "quick"
              ? "Fast seeded entertainment pick."
              : "Balanced blend of hot, cold, and neutral numbers.",
  };
}

function analyzeSequence(numbers, max = 70) {
  const clean = numbers.filter((number) => Number.isFinite(number));
  const sum = clean.reduce((acc, number) => acc + number, 0);
  const root = digitalRoot(sum);
  const odd = clean.filter((number) => number % 2 === 1).length;
  const even = clean.length - odd;
  const midpoint = Math.ceil(max / 2);
  const low = clean.filter((number) => number <= midpoint).length;
  const high = clean.length - low;
  const repeats = clean.filter((number, index) => clean.indexOf(number) !== index);
  const sorted = [...clean].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((number, index) => number - sorted[index]);
  const consecutivePairs = sorted.flatMap((number, index) => (sorted[index + 1] === number + 1 ? [`${number}-${number + 1}`] : []));
  const mirrorPairs = sorted.flatMap((number) => (sorted.includes(max + 1 - number) ? [`${number}/${max + 1 - number}`] : [])).filter((pair, index, list) => list.indexOf(pair) === index);
  const range = sorted.length > 1 ? sorted[sorted.length - 1] - sorted[0] : 0;
  const clusters = gaps.filter((gap) => gap <= 4).length;
  const spread = range >= Math.floor(max * 0.55) ? "Wide" : range >= Math.floor(max * 0.28) ? "Balanced" : "Tight";
  return {
    numbers: clean,
    sorted,
    sum,
    root,
    odd,
    even,
    high,
    low,
    repeats: Array.from(new Set(repeats)),
    gaps,
    range,
    clusters,
    spread,
    consecutivePairs,
    mirrorPairs,
    note: consecutivePairs.length > 0 ? "Consecutive pressure detected." : odd === even ? "Balanced odd/even structure." : "Asymmetric pattern with room for filtering.",
  };
}

function digitalRoot(value) {
  const safe = Math.abs(Number(value) || 0);
  return safe === 0 ? 0 : ((safe - 1) % 9) + 1;
}

function analyzeDailyDigits(input) {
  const digits = String(input || "").replace(/\D/g, "").split("").map(Number);
  const count = digits.length <= 3 ? 3 : 4;
  while (digits.length < count) digits.push(0);
  const sliced = digits.slice(0, count);
  const mirrors = sliced.map((digit) => (digit + 5) % 10);
  const vtrac = sliced.map((digit) => (digit % 5) + 1);
  const pairs = [];
  for (let i = 0; i < sliced.length - 1; i += 1) pairs.push(`${sliced[i]}${sliced[i + 1]}`);
  const boxedCount = factorial(count) / sliced.reduce((acc, digit) => acc * factorial(sliced.filter((item) => item === digit).length), 1);
  return {
    digits: sliced,
    mirrors,
    vtrac,
    pairs,
    boxedCount,
    sum: sliced.reduce((acc, digit) => acc + digit, 0),
    root: analyzeSequence(sliced, 9).root,
    repeatDigits: Array.from(new Set(sliced.filter((digit, index) => sliced.indexOf(digit) !== index))),
    sequence: analyzeSequence(sliced, 9),
  };
}

function factorial(value) {
  return value <= 1 ? 1 : value * factorial(value - 1);
}

function generatePsychicReading(input) {
  const prompt = (input.prompt || "general luck and number energy").trim();
  const game = input.game || "powerball";
  const seed = `${prompt}|${input.dreamText || ""}|${input.userName || ""}|${input.birthDate || ""}|${game}|${new Date().toISOString().slice(0, 10)}`;
  const rng = seededRandom(seed);
  const energyScore = Math.floor(rng() * 101);
  const luckCycle = energyScore >= 70 ? "Rising" : energyScore >= 40 ? "Neutral" : "Cooling";
  const luckyColors = ["Gold", "Amethyst", "Champagne", "Moonlit Silver", "Royal Purple", "Amber"];
  const playWindows = ["Morning reflection", "Midday reset", "Evening focus", "After a calm pause", "Before checking results"];
  const symbols = ["moon phase", "gold line", "quiet signal", "dream gate", "lucky mirror", "star path"];
  const gameConfig = getGame(game === "megaMillions" ? "mega-millions" : game === "pick3" ? "pick-3" : game === "pick4" ? "pick-4" : game);
  const suggestedNumbers = [];
  while (suggestedNumbers.length < 5) {
    const next = Math.floor(rng() * gameConfig.mainMax) + (gameConfig.mainMax === 9 ? 0 : 1);
    if (gameConfig.mainMax === 9 || !suggestedNumbers.includes(next)) suggestedNumbers.push(next);
  }
  return {
    id: `psychic_${Date.now()}`,
    title: `${luckCycle} ${luckyColors[Math.floor(rng() * luckyColors.length)]} Signal`,
    message: `A symbolic ${symbols[Math.floor(rng() * symbols.length)]} shows a ${luckCycle.toLowerCase()} luck cycle. Treat this as number inspiration, not certainty.`,
    luckCycle,
    energyScore,
    bestPlayWindow: playWindows[Math.floor(rng() * playWindows.length)],
    suggestedNumbers: uniqueSorted(suggestedNumbers),
    bonusNumber: gameConfig.specialMax ? Math.floor(rng() * gameConfig.specialMax) + 1 : undefined,
    pick3: Array.from({ length: 3 }, () => Math.floor(rng() * 10)).join(""),
    pick4: Array.from({ length: 4 }, () => Math.floor(rng() * 10)).join(""),
    explanation: "This reading blends your prompt, today's date, and optional dream text into a deterministic entertainment seed.",
    createdAt: new Date().toISOString(),
  };
}

function parseNumbers(value) {
  return String(value || "").split(/[\s,.-]+/).map((part) => Number(part.trim())).filter((number) => Number.isFinite(number));
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  if (!a || !b) return 999;
  return Math.round((new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / 86400000);
}

function getUnlocks() {
  return loadJson(STORAGE.unlocks, {});
}

function saveUnlock(id, title, cost = 0, hours = null) {
  const catalogItem = FEATURE_UNLOCKS.find((item) => item.id === id);
  if (title === "24h" || title === "permanent" || !title) {
    hours = title === "24h" ? 24 : hours;
    title = catalogItem?.title || id;
    cost = catalogItem?.cost || cost;
  }
  const unlocks = getUnlocks();
  unlocks[id] = {
    id,
    title,
    cost,
    unlockedAt: new Date().toISOString(),
    expiresAt: hours ? new Date(Date.now() + hours * 3600000).toISOString() : null,
  };
  saveJson(STORAGE.unlocks, unlocks);
  return unlocks[id];
}

function isUnlocked(id) {
  const unlock = getUnlocks()[id];
  if (!unlock) return false;
  if (unlock.expiresAt && Date.now() > new Date(unlock.expiresAt).getTime()) return false;
  return true;
}

function getTriviaProgress() {
  const progress = loadJson(STORAGE.triviaHistory, {
    totalCredits: getCredits(),
    dailyStreak: 0,
    weeklyStreak: 0,
    lastPlayedDate: "",
    history: [],
  });
  return { dailyStreak: 0, weeklyStreak: 0, history: [], ...progress, totalCredits: getCredits() };
}

function saveTriviaProgress(progress) {
  saveJson(STORAGE.triviaHistory, { ...progress, totalCredits: getCredits() });
}

function triviaDifficulty(index = state.triviaIndex) {
  return index < 2 ? "Easy" : index < 4 ? "Medium" : "Hard";
}

function triviaRewardFor(index = state.triviaIndex) {
  return triviaDifficulty(index) === "Hard" ? 50 : triviaDifficulty(index) === "Medium" ? 25 : 10;
}

function completeTriviaProgress() {
  const progress = getTriviaProgress();
  const today = todayKey();
  const gap = daysBetween(progress.lastPlayedDate, today);
  const dailyStreak = gap === 1 ? progress.dailyStreak + 1 : gap === 0 ? Math.max(1, progress.dailyStreak) : 1;
  const weeklyStreak = Math.min(7, Math.max(progress.weeklyStreak || 0, dailyStreak));
  let bonus = 0;
  if (dailyStreak > 0 && dailyStreak % 3 === 0) bonus += 50;
  if (dailyStreak > 0 && dailyStreak % 7 === 0) bonus += 200;
  if (bonus) setCredits(getCredits() + bonus);
  const next = {
    ...progress,
    dailyStreak,
    weeklyStreak,
    lastPlayedDate: today,
    history: [{ date: today, score: state.triviaScore, streak: state.triviaStreak, bonus }, ...(progress.history || [])].slice(0, 20),
  };
  saveTriviaProgress(next);
  return { ...next, bonus };
}

function storeFavorites() {
  return loadJson(STORAGE.storeFavorites, []);
}

function filteredStores() {
  const query = state.storeQuery.trim().toLowerCase();
  const filters = new Set(state.activeStoreFilters);
  return STORE_DIRECTORY
    .filter((store) => !query || `${store.name} ${store.address} ${store.state} ${store.services.join(" ")}`.toLowerCase().includes(query))
    .filter((store) => !filters.has("Open Now") || store.open)
    .filter((store) => [...filters].every((filter) => filter === "Open Now" || store.services.includes(filter)))
    .sort((a, b) => (a.state === state.selectedState ? -1 : 0) - (b.state === state.selectedState ? -1 : 0) || a.distance - b.distance);
}

function selectedStore(stores = filteredStores()) {
  return stores.find((store) => store.id === state.selectedStoreId) || stores[0] || STORE_DIRECTORY[0];
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...loadJson(STORAGE.settings, {}) };
}

function saveSet(set) {
  const history = loadJson(STORAGE.history, []);
  saveJson(STORAGE.history, [set, ...history.filter((item) => item.id !== set.id)].slice(0, 60));
  toast("Saved to History Vault");
}

function saveDream(reading) {
  const history = loadJson(STORAGE.readings, []);
  saveJson(STORAGE.readings, [reading, ...history.filter((item) => item.id !== reading.id)].slice(0, 50));
  toast("Dream Oracle reading saved");
}

function savePsychic(reading) {
  const history = loadJson(STORAGE.psychic, []);
  saveJson(STORAGE.psychic, [reading, ...history.filter((item) => item.id !== reading.id)].slice(0, 50));
}

function getCredits() {
  const raw = Number(localStorage.getItem(STORAGE.credits));
  return Number.isFinite(raw) ? raw : 220;
}

function setCredits(value) {
  localStorage.setItem(STORAGE.credits, String(Math.max(0, Math.round(value))));
}

function routeFromLocation() {
  const routeParam = new URLSearchParams(window.location.search).get("route");
  if (routeParam) {
    return ROUTE_ALIASES[routeParam] || Object.keys(ROUTES).find((key) => ROUTES[key] === routeParam) || "dashboard";
  }
  let path = window.location.pathname;
  if (path.startsWith(BASE)) path = path.slice(BASE.length);
  path = path.replace(/\/index\.html$/i, "").replace(/^index\.html$/i, "");
  path = path.replace(/^\/+|\/+$/g, "");
  return ROUTE_ALIASES[path] || Object.keys(ROUTES).find((key) => ROUTES[key] === path) || "dashboard";
}

function routeUrl(routeKey) {
  const path = ROUTES[routeKey] || "";
  return `${BASE}/${path}`.replace(/\/$/, "/");
}

function go(routeKey, replace = false) {
  const next = ROUTES[routeKey] !== undefined ? routeKey : "dashboard";
  stopRouteAudio();
  state.route = next;
  state.searchQuery = "";
  state.showUtilityMenu = false;
  state.showStatePicker = false;
  stopAudioIfNeeded();
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", routeUrl(next));
  render();
}

function routeIntroSrc(routeKey = state.route) {
  if (ROUTE_AUDIO_POOLS[routeKey] === null) return null;
  const pool = ROUTE_AUDIO_POOLS[routeKey]
    || (["numberGenerator", "dailyTools", "pickGames", "wheelBuilder", "predictions", "newsRadar", "lottoIntel", "ai", "intelligence", "energyMeter"].includes(routeKey) ? [AUDIO.lucky, AUDIO.digitalStatic, AUDIO.userFrequency] : null)
    || (["store", "marketplace", "wallet", "creditStore", "savedWallet", "vip"].includes(routeKey) ? [AUDIO.goldReset, AUDIO.userFrequency, AUDIO.startup] : null)
    || (["scanner", "ticketScanner", "viralStudio", "dreamVideo"].includes(routeKey) ? [AUDIO.digitalStatic, AUDIO.userRainfield, AUDIO.rain] : null)
    || TAB_INTROS;
  return pool[Math.floor(Math.random() * pool.length)] || null;
}

function fadeMedia(media, from, to, duration = 420, onDone) {
  if (!media) return;
  if (media === routeAudio) clearInterval(routeAudioFadeId);
  const steps = 12;
  let step = 0;
  media.volume = Math.max(0, Math.min(0.8, from));
  const fadeId = setInterval(() => {
    step += 1;
    const pct = Math.min(1, step / steps);
    media.volume = Math.max(0, Math.min(0.8, from + (to - from) * pct));
    if (pct >= 1) {
      clearInterval(fadeId);
      if (media === routeAudio) routeAudioFadeId = null;
      if (onDone) onDone();
    }
  }, Math.max(16, duration / steps));
  if (media === routeAudio) routeAudioFadeId = fadeId;
}

function stopRouteAudio() {
  if (!routeAudio) return;
  clearTimeout(routeAudioStopId);
  const audio = routeAudio;
  fadeMedia(audio, audio.volume || 0.04, 0, 320, () => {
    audio.pause();
    audio.currentTime = 0;
  });
}

function syncRouteAudio() {
  const settings = getSettings();
  state.muted = !settings.music;
  const src = state.muted || state.route === "reset" ? null : routeIntroSrc();
  if (!src) {
    stopRouteAudio();
    routeAudioSrc = "";
    routeAudioRoute = "";
    return;
  }
  if (routeAudioPlayedRoute === state.route && routeAudioRoute === state.route) return;
  if (!routeAudio || routeAudioRoute !== state.route || routeAudioSrc !== src) {
    if (routeAudio) {
      routeAudio.pause();
      routeAudio.currentTime = 0;
    }
    routeAudio = new Audio(src);
    routeAudio.loop = false;
    routeAudio.muted = state.muted;
    routeAudio.volume = 0;
    routeAudioSrc = src;
    routeAudioRoute = state.route;
  }
  if (routeAudio.paused) {
    routeAudioPlayedRoute = state.route;
    clearTimeout(routeAudioStopId);
    routeAudio.play().then(() => {
      fadeMedia(routeAudio, 0, Math.min(0.16, state.volume), 520);
      routeAudioStopId = setTimeout(() => stopRouteAudio(), ROUTE_AUDIO_DURATION_MS);
    }).catch(() => {});
  }
}

function titleCase(value) {
  return String(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function ballsHtml(numbers, special, specialName = "Bonus") {
  const main = numbers.map((number) => `<span class="lm-ball">${number}</span>`).join("");
  const bonus = special !== undefined ? `<span class="lm-ball special" title="${escapeHtml(specialName)}">${special}</span>` : "";
  return `<div class="lm-balls">${main}${bonus}</div>`;
}

function gamePills() {
  return `<div class="lm-pill-row">${LOTTO_GAMES.map((game) => `<button class="lm-pill ${state.gameId === game.id ? "active" : ""}" data-action="set-game" data-game="${game.id}">${game.name}</button>`).join("")}</div>`;
}

function strategyPills() {
  const strategies = [
    ["balanced", "Balanced", ASSETS.balanced],
    ["hot", "Hot", ASSETS.hot],
    ["cold", "Cold", ASSETS.cold],
    ["dream", "Dream", ASSETS.dream],
    ["quick", "Quick", ASSETS.power],
  ];
  return `<div class="strategy-pills">${strategies.map(([key, label, art]) => `
    <button class="strategy-pill ${state.strategy === key ? "active" : ""}" data-action="set-strategy" data-strategy="${key}" style="--pill-art:url('${art}')">
      <span>${label}</span>
      <small>${key === "balanced" ? "Best of both" : key === "hot" ? "Frequently drawn" : key === "cold" ? "Overdue numbers" : key === "dream" ? "Symbol seed" : "Fast pick"}</small>
    </button>
  `).join("")}</div>`;
}

const tabNotes = {
  Home: 261.63,
  Tools: 293.66,
  Radar: 329.63,
  Dream: 349.23,
  Reset: 392.00,
  Seq: 392.00,
  Vault: 440.00,
  Arcade: 523.25,
};

function playTabNote(frequency) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !Number.isFinite(frequency)) return;
    const audioCtx = new AudioContext();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.95);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 2);
    oscillator.addEventListener("ended", () => audioCtx.close?.().catch(() => {}));
  } catch (error) {
    // Web Audio may be unavailable in restricted browser modes; navigation should still work.
  }
}

function header() {
  return `<header class="real-header">
    <button class="round-icon menu-orb help-orb" data-action="menu" aria-label="Open help, settings, and policies"><span></span><em>HELP</em></button>
    <button class="brand-lockup" data-route="store" aria-label="Open LottoMind merch store">
      <img src="${ASSETS.logo}" alt="LottoMind logo" />
      <span>Lotto<span>Mind</span><sup>TM</sup></span>
      <i class="store-tab">Store</i>
      <i class="radio-tab" data-route="radioStation">Radio</i>
    </button>
    <button class="round-icon mic-orb art-mic-orb" data-action="voice-search" aria-label="Start voice input"><img src="${ASSETS.voiceCornerMic}" alt="" /><span class="mic-glyph" aria-hidden="true"></span><b>Voice</b></button>
    <div class="top-controls segmented-switch shell-switch" role="group" aria-label="Pinned state and shell view mode">
      <button class="pin-button meatball" data-action="cycle-state"><span>PIN</span><strong>${state.selectedState}</strong></button>
      <button class="mode-toggle meatball ${state.viewMode === "auto" ? "active" : ""}" data-action="set-view" data-view="auto"><span>Auto</span></button>
      <button class="mode-toggle meatball ${state.viewMode === "app" ? "active" : ""}" data-action="set-view" data-view="app"><span>App</span></button>
      <button class="mode-toggle meatball ${state.viewMode === "web" ? "active" : ""}" data-action="set-view" data-view="web"><span>Web</span></button>
    </div>
    <label class="search-pill">
      <span>AI Search</span>
      <input data-action="search" value="${escapeHtml(state.searchQuery)}" placeholder="Ask LottoMind AI for tools, dreams, numbers..." autocomplete="off" />
      <button class="mic-chip art-search-mic" type="button" data-action="voice-search" aria-label="Voice search"><img src="${ASSETS.searchMic}" alt="" /></button>
    </label>
    <div class="function-search-results" hidden></div>
    ${state.showStatePicker ? `<div class="state-picker">
      ${STATE_PINS.map((pin) => `<button class="${pin === state.selectedState ? "active" : ""}" data-action="select-state" data-state="${pin}"><span>${pin}</span><small>${pin === state.selectedState ? "Pinned" : "Select"}</small></button>`).join("")}
    </div>` : ""}
    ${state.showUtilityMenu ? `<div class="utility-menu">
      <div class="menu-title"><span>Help Center</span><strong>How to use LottoMind, settings, and policies</strong></div>
      <button data-route="help"><strong>How To Use</strong><small>Reset, Dream, Radar, Power Tools, Arcade</small></button>
      <button data-route="settings"><strong>Settings</strong><small>Sound, motion, voice, and app mode</small></button>
      <button data-route="notifications"><strong>Alerts</strong><small>Draw reminders and saved-state notices</small></button>
      <button data-route="policies"><strong>Privacy + Policies</strong><small>Terms, accessibility, responsible play</small></button>
    </div>` : ""}
  </header>`;
}

function bottomNav() {
  const items = [
    ["dashboard", "Home", "LM"],
    ["powertools", "Tools", "PT"],
    ["heatmap", "Radar", "RD"],
    ["dreams", "Dream", "DO"],
    ["reset", "Reset", "Hz"],
    ["sequence", "Seq", "SQ"],
    ["history", "Vault", "HV"],
    ["arcade", "Arcade", "AR"],
  ];
  return `<nav class="real-bottom-nav">${items.map(([route, label, icon]) => `
    <button class="${state.route === route ? "active" : ""}" data-route="${route}" data-tab-label="${label}">
      <span class="nav-glyph">${icon}</span>
      <small>${label}</small>
    </button>
  `).join("")}</nav>`;
}

function routeMeta(routeKey = state.route) {
  const map = {
    dashboard: ["Oracle Home", "Reset > Dream > Radar > Run"],
    powertools: ["Power Tools", "Arcade command deck"],
    heatmap: ["Heatmap", "Signal radar mission"],
    dreams: ["Dream Oracle", "Speak, read, save"],
    reset: ["Reset Vault", `${state.tone} Hz session`],
    sequence: ["Sequence", "Pattern engine"],
    history: ["History Vault", "Saved signals"],
    dailyTools: ["Daily 3 / 4", `${state.selectedState} digit lab`],
    numberGenerator: ["Generator", `${getGame().name} picks`],
    live: ["Live Results", `${state.selectedState} draw board`],
    scanner: ["Scanner", "Ticket scan lane"],
    wallet: ["Credit Vault", `${getCredits()} credits`],
    music: ["Music Store", "LottoMind Records label"],
    radioStation: ["Radio Station", "LottoMind Records live lane"],
    studio: ["Sonic Studio", "Recording booth"],
    dreamVideo: ["Video Studio", "Dream and promo loops"],
    viralStudio: ["Video Studio", "Branded motion kit"],
    records: ["History Vault", "Draw and saved archive"],
    marketplace: ["Marketplace", "Credits and unlocks"],
    arcade: ["Arcade", "Reward games"],
    crossword: ["Lotto Crossword", "Puzzle game"],
    wordSearch: ["Word Search", "Symbol hunt"],
    energyMeter: ["Energy Meter", "Signal score"],
    lottoIntel: ["Lotto Intelligence", "Deep analysis"],
    onboarding: ["Onboarding", "Start path"],
    paywall: ["Premium", "Unlock gate"],
    usLottery: ["US Lottery", "State index"],
    notifications: ["Alerts", "Notification center"],
    policies: ["Policies", "Privacy and responsible play"],
    store: ["Merch Store", "Official gear"],
  };
  return map[routeKey] || [titleCase(routeKey.replace(/([A-Z])/g, " $1")), "Oracle function"];
}

function missionHud() {
  const [title, subtitle] = routeMeta();
  const stage = ["dashboard", "reset", "dreams", "heatmap", "powertools"].indexOf(state.route);
  const progress = stage >= 0 ? ((stage + 1) / 5) * 100 : 68;
  return `<section class="mission-hud" aria-label="Current mission">
    <div class="hud-medal"><img src="${ASSETS.logo}" alt="" /></div>
    <div class="hud-copy">
      <span>${title}</span>
      <strong>${subtitle}</strong>
      <i><b style="width:${progress}%"></b></i>
    </div>
    <button class="hud-credit" data-route="wallet"><span>${getCredits()}</span><small>credits</small></button>
  </section>`;
}

function searchCatalog() {
  const entries = [];
  const add = (title, sub, route, tags = "") => {
    if (!route || ROUTES[route] === undefined) return;
    entries.push({ title, sub, route, tags });
  };
  [ORACLE_STUDIO_GROUP, ...TOOL_GROUPS].forEach((group) => group.tools.forEach(([title, sub, route]) => add(title, sub, route, `${group.title} ${group.copy}`)));
  HOME_CAROUSEL.forEach(([title, sub, route]) => add(title, sub, route, "dashboard oracle flow"));
  Object.keys(ROUTES).forEach((route) => {
    const [title, sub] = routeMeta(route);
    add(title, sub, route, route.replace(/([A-Z])/g, " $1"));
  });
  [
    ["Store Locator", "Nearby play locations and pinned state stores", "storeLocator", "retailer shop near me"],
    ["Lucky Weather", "Local weather report and weather-number cues", "luckyWeather", "forecast radar horoscope temperature"],
    ["Ticket Scanner", "Camera ticket scan and barcode reader", "scanner", "scan ticket barcode camera qr"],
    ["Barcode Scanner", "Camera ticket scan and barcode reader", "scanner", "scan ticket barcode camera qr"],
    ["Dream Journal", "Saved Dream Oracle readings", "dreams", "journal saved dream interpretation meaning"],
    ["Dream Oracle", "Speak, interpret, and generate lucky numbers", "dreams", "oracle studio mic record"],
    ["Music Store", "LottoMind Records, radio, Apple Music, YouTube", "music", "songs audio frequency record label"],
    ["Settings", "Music toggle, sound, motion, and policies", "settings", "set help menu controls"],
    ["Help", "Help, settings, and policies", "help", "support guide policy"],
  ].forEach((item) => add(...item));
  const seen = new Set();
  return entries.filter((item) => {
    const key = `${item.route}:${item.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function functionSearchResults(value, limit = 8) {
  const query = String(value || "").trim().toLowerCase();
  if (!query) return [];
  const terms = query.split(/\s+/).filter(Boolean);
  return searchCatalog()
    .map((item) => {
      const haystack = `${item.title} ${item.sub} ${item.route} ${item.tags}`.toLowerCase();
      let score = haystack.includes(query) ? 10 : 0;
      terms.forEach((term) => {
        if (item.title.toLowerCase().includes(term)) score += 6;
        if (item.route.toLowerCase().includes(term)) score += 4;
        if (haystack.includes(term)) score += 2;
      });
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}

function searchResultsHtml(value) {
  const results = functionSearchResults(value);
  if (!String(value || "").trim()) return "";
  if (!results.length) {
    return `<div class="search-empty"><strong>No function found</strong><small>Try scanner, dream, weather, store, music, radar, or settings.</small></div>`;
  }
  return results.map((item) => `<button class="function-result" data-route="${item.route}">
    <span>${escapeHtml(item.title)}</span>
    <small>${escapeHtml(item.sub)}</small>
    <b>${escapeHtml(routeMeta(item.route)[0])}</b>
  </button>`).join("");
}

function renderFunctionSearchResults(value = state.searchQuery) {
  const panel = document.querySelector(".function-search-results");
  if (!panel) return;
  const hasQuery = String(value || "").trim().length > 0;
  panel.hidden = !hasQuery;
  panel.classList.toggle("open", hasQuery);
  panel.innerHTML = searchResultsHtml(value);
}

function dashboardView() {
  const current = state.currentSet || generateLottoSet(state.gameId, state.strategy, "dashboard");
  return `<section class="screen dashboard-screen">
    <div class="oracle-hero panel art-panel" style="--panel-art:url('${ASSETS.dream}')">
      <div>
        <h1>Oracle Studio</h1>
        <p>Reset, dream, read the map, then run Power Tools with every old feature wired inside one branded app.</p>
        <div class="hero-actions">
          <button class="ghost-btn" data-route="reset">Reset Vault</button>
          <button class="primary-btn" data-route="dreams">Open Dream Oracle</button>
          <button class="ghost-btn" data-route="powertools">Power Tools</button>
          <button class="ghost-btn" data-route="studio">Sonic Studio</button>
        </div>
      </div>
      <img class="hero-mascot hero-emblem" src="${ASSETS.logo}" alt="LottoMind oracle emblem" />
    </div>

    <div class="carousel-panel panel">
      <div class="section-head movie-head">
        <div><h2>Oracle Flow</h2><p>Swipe through the main app functions.</p></div>
        <button class="tiny-btn" data-route="powertools">All Tools</button>
      </div>
      <div class="quest-steps oracle-flow-steps">
        ${HOME_CAROUSEL.map(([title, copy, route, art], index) => `
          <button class="quest-step oracle-flow-step" data-route="${route}" style="--quest-art:url('${art}')">
            ${index === 0 ? `<video class="oracle-flow-video" src="${BASE}/videos/oracle-flow-reset-new.mp4" muted loop autoplay playsinline preload="metadata"></video>` : ""}
            ${index === 1 ? `<video class="oracle-flow-video" src="${BASE}/videos/oracle-flow-dream-new.mp4" muted loop autoplay playsinline preload="metadata"></video>` : ""}
            ${index === 2 ? `<video class="oracle-flow-video" src="${BASE}/videos/oracle-flow-music-new.mp4" muted loop autoplay playsinline preload="metadata"></video>` : ""}
            <b>${String(index + 1).padStart(2, "0")}</b>
            <strong>${title}</strong>
            <small>${copy}</small>
          </button>
        `).join("")}
      </div>
    </div>

    <div class="panel strategy-panel home-strategy-panel">
      <div class="section-head"><div><h2>Strategy</h2><p>Choose a number lane before you generate.</p></div></div>
      ${strategyPills()}
      <button class="primary-btn full" data-action="generate-set">Generate ${getGame().name}</button>
      <div class="result-card compact">
        <span>${current.gameName} ${titleCase(current.strategy)}</span>
        ${ballsHtml(current.numbers, current.special, current.specialName)}
      </div>
    </div>

    <div class="live-strip panel">
      <div><h2>Live Results</h2><p>Next Draw in</p><strong>02:18:45</strong></div>
      ${ballsHtml([12, 28, 33, 44, 50])}
      <button class="chev-btn" data-route="live">View</button>
    </div>

    <div class="split-grid">
      <button class="action-tile" data-action="menu"><strong>LottoMind Academy</strong><span>Help, settings, policies, and privacy</span></button>
      <button class="action-tile" data-route="marketplace"><strong>Marketplace</strong><span>Credits, VIP tools, and unlocks</span></button>
    </div>

    <div class="panel home-merch-video">
      <img class="home-merch-product" src="${ASSETS.detroitCollection}" alt="" />
      <div>
        <span class="eyebrow">Official Merch Store</span>
        <h2>LottoMind Gear Drop</h2>
        <p>Shop branded gear, coin art, promo drops, and marketplace-ready merch lanes.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-route="store">Open Merch Store</button>
          <button class="ghost-btn" data-route="marketplace">Marketplace</button>
        </div>
      </div>
    </div>
  </section>`;
}

function circleTool(title, sub, route, index) {
  const arts = [ASSETS.commandDeck, ASSETS.powerTools, ASSETS.heatmap, ASSETS.live, ASSETS.reset, ASSETS.dream, ASSETS.arcade, ASSETS.credit, ASSETS.psychic, ASSETS.music];
  const routeArt = {
    arcade: ASSETS.arcade,
    arcadeGame: ASSETS.arcade,
    gamesHub: ASSETS.arcade,
    triviaPlay: ASSETS.arcadeCoin,
    triviaRewards: ASSETS.credit,
    crossword: ASSETS.sequence,
    wordSearch: ASSETS.dream,
    achievements: ASSETS.arcadeCoin,
    challenges: ASSETS.commandDeck,
    contests: ASSETS.arcade,
  };
  const video = title === "Number Analyzer"
    ? `<video class="circle-tool-video" src="${BASE}/videos/power-tools-dashboard-box.mp4" poster="${ASSETS.powerTools}" muted loop autoplay playsinline preload="metadata"></video>`
    : title === "Reset Vault"
      ? `<video class="circle-tool-video singer-video" src="${BASE}/videos/power-tools-button-green-screen.mp4" poster="${ASSETS.music}" muted loop autoplay playsinline preload="metadata"></video>`
      : "";
  return `<button class="circle-tool" data-route="${route}" style="--circle-art:url('${routeArt[route] || arts[index % arts.length]}')">
    ${video}
    <span>${title}</span>
    <small>${sub}</small>
  </button>`;
}

function powerToolsView() {
  const current = state.currentSet || generateLottoSet(state.gameId, state.strategy, "power-tools");
  return `<section class="screen power-screen">
    <div class="panel arcade-deck art-panel" style="--panel-art:url('${ASSETS.power}')">
      <div>
        <h1 class="game-title">Command Deck</h1>
        <p>Swipe tool medals, lock a state pin, then run the next analysis like a mission.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-action="run-power-analysis">Run Analysis</button>
          <button class="ghost-btn" data-route="numberGenerator">Number Generator</button>
          <button class="ghost-btn" data-route="history">History Vault</button>
          <button class="ghost-btn" data-route="radioStation">Radio Station</button>
          <button class="ghost-btn" data-route="marketplace">Marketplace</button>
        </div>
      </div>
      <div class="deck-coin command-crest"><img src="${ASSETS.logo}" alt="LottoMind logo" /><span>Power Tools</span></div>
    </div>

    <label class="search-pill slim ai-power-search"><span>Ask AI</span><input placeholder="Ask LottoMind about tools, draws, dreams, or number lanes..." /><button type="button" data-route="ai">AI News</button></label>

    ${gamePills()}

    <div class="stat-row">
      <div><strong>${getMatrixStats().trustScore}%</strong><span>Signal</span></div>
      <div><strong>${state.selectedState}</strong><span>Pin</span></div>
      <div><strong>${POWER_TOOL_GROUPS.flatMap((group) => group.tools).length}</strong><span>Tools</span></div>
    </div>

    ${POWER_TOOL_GROUPS.map((group, groupIndex) => `
      <div class="panel tool-bank">
        <div class="section-head">
          <div><h2>${group.title}</h2><p>${group.copy}</p></div>
          <span>${group.tools.length} tools</span>
        </div>
        <div class="circle-carousel tool-bento ${group.title === "Main Lab" ? "main-lab-bento" : ""}">
          ${group.tools.map(([title, sub, route], index) => circleTool(title, sub, route, groupIndex * 4 + index)).join("")}
        </div>
      </div>
    `).join("")}

    <div class="panel result-card mission-output-card video-backed">
      <video src="${BASE}/videos/power-tools-dashboard-box.mp4" muted loop autoplay playsinline preload="metadata"></video>
      <span>Current Mission Output</span>
      <h2>${current.gameName} ${titleCase(current.strategy)} Set</h2>
      ${ballsHtml(current.numbers, current.special, current.specialName)}
      <p>${current.note}</p>
      <div class="hero-actions">
        <button class="primary-btn" data-action="save-current-set">Save Set</button>
        <button class="ghost-btn" data-route="history">Open Vault</button>
      </div>
    </div>
  </section>`;
}

function resetView() {
  const tones = [
    ["174", "Deep Rest"],
    ["220", "Ground"],
    ["432", "Calm"],
    ["741", "Clear"],
    ["963", "Align"],
    ["396", "Release"],
    ["528", "Love Reset"],
    ["528", "Heart Field"],
  ];
  const pct = Math.round(state.volume * 100);
  const resetRecordsPanel = `<div class="panel record-label-panel compact reset-record-store reset-record-store-top">
      <div>
        <span class="eyebrow">LottoMind Records Label</span>
        <h2>Frequency Storefront</h2>
        <p>Preview tracks and load reset tones from this Reset-side music lane.</p>
      </div>
      <button class="primary-btn" data-route="music">Open Music Store</button>
    </div>`;
  return `<section class="screen reset-screen">
    ${resetRecordsPanel}
    <div class="panel tone-wheel art-panel" style="--panel-art:url('${ASSETS.reset}')">
      <div class="tone-top">
        <h1><span>Frequency</span> Reset</h1>
        <span class="pro-badge">PRO</span>
      </div>
      <div class="tone-chips">
        <button class="lm-pill active">Calm</button><button class="lm-pill">Focus</button><button class="lm-pill">Sleep</button>
      </div>
      <div class="wheel-orbit">
        ${tones.filter(([hz]) => hz !== state.tone).slice(0, 4).map(([hz, label], index) => `<button class="orbit-tone t${index + 1}" data-action="set-tone" data-tone="${hz}"><strong>${hz}</strong><small>${label}</small></button>`).join("")}
        <button class="center-tone" data-action="set-tone" data-tone="${state.tone}"><strong>${state.tone} Hz</strong><small>${tones.find(([hz]) => hz === state.tone)?.[1] || "Reset"}</small></button>
      </div>
      <div class="session-card">
        <div><strong>${formatTimer(state.timerRemaining)} Reset Session</strong><span>${pct}% volume</span></div>
        <div class="progress"><i style="width:${100 - (state.timerRemaining / state.duration) * 100}%"></i></div>
        <div class="ambient-generator">
          <button data-action="load-reset-session" data-tone="432"><span>Rain Generator</span><small>432 Hz rainfield</small></button>
          <button data-action="load-reset-session" data-tone="741"><span>White Noise</span><small>Clean static bed</small></button>
        </div>
        <div class="transport">
          <button data-action="volume-down">-</button>
          <button class="play-btn" data-action="toggle-reset-audio">${state.audioPlaying ? "Pause" : "Play"}</button>
          <button data-action="favorite-tone">Heart</button>
          <button data-action="volume-up">+</button>
        </div>
        <div class="duration-row">
          ${[180, 300, 600, 900, 1800, 3600].map((seconds) => `<button class="${state.duration === seconds ? "active" : ""}" data-action="set-duration" data-duration="${seconds}">${Math.round(seconds / 60)}m</button>`).join("")}
        </div>
      </div>
    </div>

    <div class="panel sound-session-panel">
      <div class="section-head"><div><h2>Sound Sessions</h2><p>Tap a circle to load a tone, then play.</p></div></div>
      <div class="sound-session-grid">
        ${tones.map(([hz, label], index) => `<button class="sound-card tone-pill ${state.tone === hz ? "active" : ""}" data-action="set-tone" data-tone="${hz}" style="--tone-art:url('${index % 2 ? ASSETS.logo : ASSETS.music}')"><span>${hz} Hz</span><strong>${label}</strong><small>${label === "Heart Field" ? "528 Hz box" : hz === "528" ? "Love frequency" : hz === "741" ? "Clear signal" : "Focus support"}</small></button>`).join("")}
      </div>
    </div>
  </section>`;
}

function localSignalPanel() {
  const weather = WEATHER_SIGNALS.find((item) => item.stateCode === state.selectedState) || WEATHER_SIGNALS[0];
  const stores = [
    { state: "NY", name: "Hudson Lucky Mart", distance: "0.8 mi", radar: "Cloud cover shifting neutral" },
    { state: "FL", name: "Sunrise Lotto Stop", distance: "1.2 mi", radar: "Storm band rising signal" },
    { state: "TX", name: "Lone Star Ticket Hub", distance: "2.4 mi", radar: "Dry heat balanced lane" },
    { state: "CA", name: "Coastal Numbers Market", distance: "1.7 mi", radar: "Marine layer cooling trend" },
  ];
  const store = stores.find((item) => item.state === state.selectedState) || stores[0];
  return `<div class="panel local-signal-panel">
    <div class="section-head"><div><h2>Local Weather Radar</h2><p>Weather report, store locator, and local number cues for ${state.selectedState}.</p></div><span>${weather.signal}</span></div>
    <div class="local-signal-grid">
      <button class="local-card weather-card" data-route="luckyWeather">
        <span>Weather Report</span><strong>${weather.temperature}F</strong><small>${weather.condition} in ${weather.name}</small>
      </button>
      <button class="local-card radar-card" data-route="heatmap">
        <span>Weather Radar</span>${ballsHtml(weather.numbers)}<small>${store.radar}</small>
      </button>
      <button class="local-card store-card-mini" data-route="storeLocator">
        <span>Store Locator</span><strong>${store.name}</strong><small>${store.distance} from pinned area</small>
      </button>
    </div>
  </div>`;
}

function dreamJournalPanel() {
  const entries = loadJson(STORAGE.readings, []);
  const preview = entries.length ? entries.slice(0, 4) : [
    { title: "No saved dreams yet", note: "Run Dream Oracle, then tap Save Dream Pick to build your journal.", numbers: [] },
  ];
  return `<div class="panel dream-journal-panel">
    <div class="section-head"><div><h2>Dream Journal</h2><p>Saved Dream Oracle readings and generated dream scenes.</p></div><span>${entries.length} saved</span></div>
    <div class="result-list padded">
      ${preview.map((entry) => `<div class="history-row journal-row">
        <strong>${escapeHtml(entry.title || "Dream Journal Entry")}</strong>
        ${entry.numbers?.length ? ballsHtml(entry.numbers) : ""}
        <small>${escapeHtml(entry.note || entry.summary || "Dream entry ready.")}</small>
      </div>`).join("")}
    </div>
    <div class="hero-actions padded">
      <button class="primary-btn" data-action="save-dream">Save Current Dream</button>
      <button class="ghost-btn" data-route="history">Open History Vault</button>
      <button class="ghost-btn" data-action="build-dream-video">Generate Your Dreams</button>
    </div>
  </div>`;
}

function dreamGeneratePanel() {
  const reading = interpretDream(state.dreamText, state.gameId);
  const cards = [
    ["Oracle Tone", reading.tone],
    ["Lucky Window", reading.numberLogic?.playWindow || "Evening"],
    ["Pick 3", reading.pick3],
    ["Pick 4", reading.pick4],
  ];
  return `<div class="panel oracle-function-panel dream-generate-panel">
    <div class="section-head"><div><h2>Generate Your Dreams</h2><p>Dream text becomes numbers, tone, and shareable reveal cards.</p></div><span>${cards.length} cards</span></div>
    <div class="tool-grid padded">${cards.map(([label, value]) => metricCard(label, value)).join("")}</div>
    <div class="hero-actions padded"><button class="primary-btn" data-action="build-dream-video">Generate Dreams</button><button class="ghost-btn" data-route="dreamVideo">Dream Video</button><button class="ghost-btn" data-route="history">History Vault</button></div>
  </div>`;
}

function todaysSnapshotPanel(title = "Today's Snapshot") {
  const weather = WEATHER_SIGNALS.find((item) => item.stateCode === state.selectedState) || WEATHER_SIGNALS[0];
  return `<div class="panel snapshot-panel radar-snapshot-panel">
    <div class="section-head"><div><h2>${title}</h2><p>Local cues before you pick.</p></div></div>
    <div class="snap-carousel small">
      ${[
        ["Weather", `${weather.temperature}F`, `${weather.condition} in ${weather.name}`],
        ["Horoscope", "Leo", "Daily focus lane"],
        ["Store Locator", "Near you", "Saved state pin"],
        ["Daily Fortune", "Ready", "One tap symbolic read"],
        ["Live Results", "Open", "Check latest draw cards"],
        ["Credits", getCredits(), "Vault balance"],
      ].map(([itemTitle, value, copy]) => `<button class="mini-tool meatball-tool" data-route="${itemTitle === "Weather" ? "luckyWeather" : itemTitle === "Horoscope" ? "horoscope" : itemTitle === "Live Results" ? "live" : itemTitle === "Credits" ? "wallet" : itemTitle === "Daily Fortune" ? "dailyFortune" : itemTitle === "Store Locator" ? "storeLocator" : "dashboard"}"><span>${itemTitle}</span><strong>${value}</strong><small>${copy}</small></button>`).join("")}
    </div>
  </div>`;
}

function storeRouteMapPanel(stores) {
  const points = [
    [18, 32],
    [58, 24],
    [78, 48],
    [36, 68],
    [68, 76],
    [24, 54],
  ];
  const routePath = points.slice(0, stores.length).map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ");
  return `<div class="panel locator-route-map">
    <div class="section-head"><div><h2>Route Map</h2><p>Tap any pin or route card for directions to a nearby play stop.</p></div><span>${stores.length} routes</span></div>
    <div class="route-map-stage" aria-label="LottoMind route map">
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <filter id="lm-route-glow"><feGaussianBlur stdDeviation="1.1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <path class="route-grid-line" d="M8 20 H92 M8 40 H92 M8 60 H92 M8 80 H92 M20 8 V92 M40 8 V92 M60 8 V92 M80 8 V92"></path>
        <path class="route-line" d="${routePath}" filter="url(#lm-route-glow)"></path>
      </svg>
      <span class="user-map-pin" style="--x:50%;--y:50%"><b>${state.selectedState}</b><small>You</small></span>
      ${stores.map((store, index) => {
        const [x, y] = points[index] || points[0];
        return `<a class="store-map-pin ${store.id === state.selectedStoreId ? "active" : ""}" style="--x:${x}%;--y:${y}%" href="https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}" target="_blank" rel="noopener" aria-label="Open directions to ${escapeHtml(store.name)}"><b>${index + 1}</b><small>${store.state}</small></a>`;
      }).join("")}
    </div>
    <div class="route-leg-list">
      ${stores.map((store, index) => `<a href="https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}" target="_blank" rel="noopener">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <strong>${store.name}</strong>
        <small>${store.distance} mi - ${store.note}</small>
        <b>Directions</b>
      </a>`).join("")}
    </div>
  </div>`;
}

function storeLocatorView() {
  const weather = WEATHER_SIGNALS.find((item) => item.stateCode === state.selectedState) || WEATHER_SIGNALS[0];
  const favorites = storeFavorites();
  const visible = filteredStores().slice(0, 6);
  const activeStore = selectedStore(visible);
  return `<section class="screen store-locator-screen">
    <div class="panel art-panel media-hero" style="--panel-art:url('${ASSETS.credit}')">
      <div>
        <span class="eyebrow">Store Finder</span>
        <h1>Local Play Map</h1>
        <p>Find saved demo retailers, local weather cues, and a quick radar path for ${state.selectedState}.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-action="cycle-state">Change State Pin</button>
          <button class="ghost-btn" data-route="luckyWeather">Weather Radar</button>
          <button class="ghost-btn" data-route="heatmap">Signal Radar</button>
        </div>
      </div>
      <button class="console-orb state-orb state-change-orb" data-action="cycle-state" aria-label="Change store locator state"><img src="${ASSETS.logo}" alt="" /><span>${state.selectedState}</span><small>Change State</small></button>
    </div>
    <div class="panel store-search-console">
      <label class="search-pill slim"><span>Find</span><input data-bind="storeQuery" value="${escapeHtml(state.storeQuery)}" placeholder="Search store, ZIP, city, service..." /><button data-action="search-stores">Go</button></label>
      <div class="store-filter-row">
        ${STORE_FILTERS.map((filter) => `<button class="${state.activeStoreFilters.includes(filter) ? "active" : ""}" data-action="toggle-store-filter" data-filter="${filter}">${filter}</button>`).join("")}
      </div>
      <div class="hero-actions padded">
        <button class="primary-btn" data-action="use-current-location">Use My Location</button>
        <button class="ghost-btn" data-action="sync-store-backend">Sync Places Backend</button>
        <button class="ghost-btn" data-route="history">Saved Routes</button>
      </div>
    </div>
    <div class="panel local-signal-panel">
      <div class="section-head"><div><h2>Weather + Store Cue</h2><p>${weather.condition} in ${weather.name}. Use light local context before you pick.</p></div><span>${weather.temperature}F</span></div>
      <div class="local-signal-grid">
        <button class="local-card weather-card" data-route="luckyWeather"><span>Weather Report</span><strong>${weather.signal}</strong><small>${weather.numbers.join(" / ")}</small></button>
        <button class="local-card radar-card" data-route="heatmap"><span>Radar</span>${ballsHtml(weather.numbers)}<small>Open hot/cold map</small></button>
        <button class="local-card store-card-mini" data-action="toggle-store-favorite" data-store="${activeStore.id}"><span>Selected Store</span><strong>${activeStore.name}</strong><small>${favorites.includes(activeStore.id) ? "Saved favorite" : "Tap star to save"}</small></button>
      </div>
    </div>
    ${storeRouteMapPanel(visible)}
    <div class="panel store-detail-inline">
      <div><span>${activeStore.state} ${activeStore.open ? "Open Now" : "Check Hours"}</span><h2>${activeStore.name}</h2><p>${activeStore.address}</p></div>
      <div class="store-service-row">${activeStore.services.map((service) => `<span>${service}</span>`).join("")}</div>
      ${ballsHtml(activeStore.numbers)}
      <div class="hero-actions padded">
        <a class="primary-btn" href="https://www.google.com/maps/dir/?api=1&destination=${activeStore.lat},${activeStore.lng}" target="_blank" rel="noopener">Open Route</a>
        <button class="ghost-btn" data-action="toggle-store-favorite" data-store="${activeStore.id}">${favorites.includes(activeStore.id) ? "Saved Favorite" : "Save Store"}</button>
        <button class="ghost-btn" data-route="numberGenerator">Generate For Store</button>
      </div>
    </div>
    <div class="panel store-map-panel">
      <div class="section-head"><div><h2>Nearby Store Cards</h2><p>Demo store finder with state-select routing and radar actions.</p></div><span>${visible.length} stores</span></div>
      <div class="store-grid">
        ${visible.map((store) => `<article class="store-card locator-card ${store.id === activeStore.id ? "active" : ""}">
          <span>${store.state} ${store.state === state.selectedState ? "Pinned" : "Select"} ${favorites.includes(store.id) ? "★" : ""}</span>
          <strong>${store.name}</strong>
          <small>${store.distance} mi - ${store.note}</small>
          <p>${store.address}</p>
          <div class="store-service-row">${store.services.slice(0, 4).map((service) => `<em>${service}</em>`).join("")}</div>
          ${ballsHtml(store.numbers)}
          <div class="store-links">
            <button data-action="select-store" data-store="${store.id}">Details</button>
            <button data-action="toggle-store-favorite" data-store="${store.id}">${favorites.includes(store.id) ? "Saved" : "Save"}</button>
            <button data-action="select-state" data-state="${store.state}">Pin ${store.state}</button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}" target="_blank" rel="noopener">Route</a>
          </div>
        </article>`).join("")}
      </div>
    </div>
  </section>`;
}

function luckyWeatherView() {
  const weather = WEATHER_SIGNALS.find((item) => item.stateCode === state.selectedState) || WEATHER_SIGNALS[0];
  return `<section class="screen weather-screen">
    <div class="panel art-panel media-hero" style="--panel-art:url('${ASSETS.heatmap}')">
      <div>
        <span class="eyebrow">Local Weather Radar</span>
        <h1>${weather.name} ${weather.temperature}F</h1>
        <p>${weather.condition}. ${weather.signal} weather cue with horoscope, radar, and store routes attached.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-route="heatmap">Open Radar</button>
          <button class="ghost-btn" data-route="horoscope">Horoscope</button>
          <button class="ghost-btn" data-route="storeLocator">Store Locator</button>
        </div>
      </div>
      <button class="console-orb state-orb" data-action="cycle-state"><img src="${ASSETS.logo}" alt="" /><span>${state.selectedState}</span></button>
    </div>
    <div class="panel result-card">
      <span>Weather number cue</span>
      <h2>${weather.signal} ${weather.condition}</h2>
      ${ballsHtml(weather.numbers)}
      <p>Use these only as entertainment cues, then verify movement on Signal Radar.</p>
    </div>
  </section>`;
}

function nameNumberReport(value = state.nameInput) {
  const clean = String(value || "LottoMind").toUpperCase().replace(/[^A-Z0-9 ]/g, "");
  const letters = clean.replace(/[^A-Z0-9]/g, "").split("");
  const values = letters.map((char) => (/\d/.test(char) ? Number(char) : ((char.charCodeAt(0) - 64 - 1) % 9) + 1));
  const sum = values.reduce((total, number) => total + number, 0);
  const root = digitalRoot(sum);
  const pick3 = [values[0] || root, values[Math.floor(values.length / 2)] || sum % 10, values.at(-1) || 7].map((n) => n % 10).join("");
  const pick4 = [root, sum % 10, (values[1] || 4) % 10, (values.at(-2) || 8) % 10].join("");
  const numbers = uniqueSorted([root, (sum % 43) || 1, ...values.map((n, index) => ((n * (index + 2)) % 43) || 1)]).slice(0, 5);
  return { clean, values, sum, root, pick3, pick4, numbers };
}

function nameNumbersView() {
  const report = state.currentNameNumbers || nameNumberReport();
  return `<section class="screen name-numbers-screen">
    <div class="panel art-panel media-hero" style="--panel-art:url('${ASSETS.dream}')">
      <div>
        <span class="eyebrow">Name Code</span>
        <h1>Name Numbers</h1>
        <p>Convert names, artist names, labels, and intentions into Pick 3, Pick 4, and LottoMind seed numbers.</p>
        <label class="field-label">Name or phrase <input data-bind="nameInput" value="${escapeHtml(state.nameInput)}" placeholder="Type a name..." /></label>
        <div class="hero-actions">
          <button class="primary-btn" data-action="analyze-name-numbers">Analyze Name</button>
          <button class="ghost-btn" data-route="dreams">Dream Oracle</button>
        </div>
      </div>
      <img class="deck-coin" src="${ASSETS.psychic}" alt="Name number coin" />
    </div>
    <div class="panel result-card name-code-card">
      <span>Name code unlocked</span>
      <h2>${escapeHtml(report.clean)}</h2>
      ${ballsHtml(report.numbers)}
      <div class="tool-grid padded">
        ${metricCard("Sum", report.sum)}
        ${metricCard("Root", report.root)}
        ${metricCard("Pick 3", report.pick3)}
        ${metricCard("Pick 4", report.pick4)}
      </div>
      <p>Letter lane: ${report.values.join(" - ") || "ready"}. Save the seed into Records or merge it with Dream Oracle.</p>
      <div class="hero-actions"><button class="primary-btn" data-action="save-current-set">Save Seed</button><button class="ghost-btn" data-route="sequence">Open Sequence</button></div>
    </div>
  </section>`;
}

function aiCoachView() {
  const report = state.currentAi || {
    title: "AI Coach Ready",
    copy: "Ask for a balanced set, radar summary, dream meaning, or next move.",
    numbers: (state.currentSet || generateLottoSet(state.gameId, state.strategy, "ai-ready")).numbers,
  };
  return `<section class="screen ai-screen">
    <div class="panel art-panel media-hero" style="--panel-art:url('${ASSETS.powerTools}')">
      <div>
        <span class="eyebrow">LottoMind AI</span>
        <h1>AI Coach Console</h1>
        <p>Smart picks, dream summaries, radar guidance, and quick navigation in one custom tool screen.</p>
        <textarea class="dream-input compact" data-bind="aiPrompt" placeholder="Ask LottoMind AI...">${escapeHtml(state.aiPrompt)}</textarea>
        <div class="hero-actions">
          <button class="primary-btn" data-action="run-ai-coach">Run AI Coach</button>
          <button class="ghost-btn" data-route="heatmap">Radar</button>
          <button class="ghost-btn" data-route="dreams">Dream Oracle</button>
        </div>
      </div>
      <img class="deck-coin" src="${ASSETS.psychic}" alt="LottoMind AI coin" />
    </div>
    <div class="panel result-card ai-result-card">
      <span>AI function output</span>
      <h2>${escapeHtml(report.title)}</h2>
      ${ballsHtml(report.numbers)}
      <p>${escapeHtml(report.copy)}</p>
      <div class="tool-grid padded">
        ${metricCard("Signal", `${getMatrixStats().trustScore}%`)}
        ${metricCard("Pinned", state.selectedState)}
        ${metricCard("Tone", `${state.tone} Hz`)}
        ${metricCard("Credits", getCredits())}
      </div>
    </div>
  </section>`;
}

function dreamsView() {
  const reading = state.currentDream;
  return `<section class="screen dreams-screen">
    ${!reading ? `<div class="panel empty-state dream-ready-spotlight dream-ready-top"><h2>Dream engine ready</h2><p>Tap the mic or type a dream, then run the full interpretation.</p></div>` : ""}
    <div class="panel dream-stage art-panel" style="--panel-art:url('${ASSETS.dream}')">
      <h1>Dream Oracle<sup>SM</sup> AI</h1>
      <p>Describe your dream. The Oracle detects symbols, explains meaning, and generates lucky numbers.</p>
      ${gamePills()}
      <button class="big-mic branded-mic dream-oracle-host-mic" data-action="start-dream-recording" aria-label="Record dream" style="--panel-art:url('${ASSETS.voiceCornerMic}')">
        <img class="dream-oracle-host-art" src="${ASSETS.voiceCornerMic}" alt="" />
        <span class="mic-mark"></span>
        <strong>Speak Dream</strong>
        <small>Tap to record</small>
      </button>
      <textarea class="dream-input" data-bind="dreamText" placeholder="Speak or type your dream...">${escapeHtml(state.dreamText)}</textarea>
      <div class="hero-actions">
        <button class="primary-btn" data-action="interpret-dream">Interpret Dream</button>
        <button class="ghost-btn" data-action="psychic-fusion">Psychic Fusion</button>
        <button class="ghost-btn" data-action="build-dream-video">Generate Your Dreams</button>
        <button class="ghost-btn" data-route="studio">Record Dream Song</button>
      </div>
    </div>

    ${dreamGeneratePanel()}

    <div class="panel tool-bank dream-oracle-tools">
      <div class="section-head">
        <div><h2>${ORACLE_STUDIO_GROUP.title}</h2><p>${ORACLE_STUDIO_GROUP.copy}</p></div>
        <span>${ORACLE_STUDIO_GROUP.tools.length} tools</span>
      </div>
      <div class="circle-carousel tool-bento dream-studio-bento">
        ${ORACLE_STUDIO_GROUP.tools.map(([title, sub, route], index) => circleTool(title, sub, route, index + 3)).join("")}
      </div>
    </div>

    <div class="panel oracle-info-panel">
      <div class="section-head"><div><h2>What The Oracle Reads</h2><p>Each interpretation is broken into practical lanes.</p></div><span>5 layers</span></div>
      <div class="dream-info-grid">
        ${[
          ["Symbols", "Finds dream images like water, gold, keys, doors, bridges, moon, fire, and flying."],
          ["Meaning", "Explains the emotional or action signal behind the strongest symbols."],
          ["Numbers", "Maps symbols into the selected game, then builds Pick 3 and Pick 4 bridges."],
          ["Radar Merge", "Compares the dream set with active heatmap support numbers."],
          ["Next Move", "Gives save, radar, video, and history actions so the reading keeps working."],
        ].map(([title, copy]) => `<div><strong>${title}</strong><p>${copy}</p></div>`).join("")}
      </div>
    </div>

    ${reading ? `<div class="panel result-card dream-reading-card">
      <span>${reading.title}</span>
      <h2>${reading.symbols.length ? reading.symbols.map(titleCase).join(", ") : "Seeded Dream Flow"}</h2>
      <p class="dream-summary">${escapeHtml(reading.summary || reading.note)}</p>
      <div class="dream-metrics">
        <div><strong>${reading.confidence || 72}%</strong><small>Meaning Match</small></div>
        <div><strong>${escapeHtml(reading.tone || "Oracle")}</strong><small>Dream Tone</small></div>
        <div><strong>${escapeHtml(reading.bestWindow || "Anytime")}</strong><small>Play Window</small></div>
      </div>
      <div class="dream-meaning-block">
        <div>
          <span>Lucky Numbers</span>
          ${ballsHtml(reading.numbers)}
        </div>
        <div>
          <span>Daily Digit Bridge</span>
          <div class="dream-digits"><b>${escapeHtml(reading.pick3 || "")}</b><b>${escapeHtml(reading.pick4 || "")}</b></div>
        </div>
      </div>
      <div class="meaning-list">${(reading.meanings.length ? reading.meanings : ["Dream rhythm: no saved symbol was detected, so the Oracle mapped tone, word shape, and timing into an entertainment seed."]).map((item) => `<div>${escapeHtml(item)}</div>`).join("")}</div>
      <div class="oracle-guidance"><strong>Oracle guidance</strong><p>${escapeHtml(reading.guidance || reading.note)}</p></div>
      <div class="dream-report-panel">
        <div class="section-head flush"><div><h2>Detailed Dream Report</h2><p>Symbol map, number logic, and next move.</p></div><span>${reading.wordCount || 0} words</span></div>
        <div class="dream-symbol-grid">
          ${(reading.symbolDetails?.length ? reading.symbolDetails : [{ label: "Open Seed", number: reading.numbers[0] || 0, meaning: "No saved symbol matched yet. Add concrete images like key, water, moon, door, gold, bridge, fire, or flying for a sharper read.", source: "text rhythm" }]).map((symbol) => `<article>
            <span>${escapeHtml(symbol.label)}</span>
            <strong>${escapeHtml(symbol.number)}</strong>
            <p>${escapeHtml(symbol.meaning)}</p>
            <small>source: ${escapeHtml(symbol.source)}</small>
          </article>`).join("")}
        </div>
        <div class="dream-detail-grid">
          <div>
            <span>Number Logic</span>
            ${(reading.numberLogic || [reading.note]).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
          </div>
          <div>
            <span>Interpretation Layer</span>
            <p>${escapeHtml(reading.dreamLayer || reading.summary || reading.note)}</p>
            <p>Heatmap support: ${(reading.heatSignals || []).join(", ") || "Run Heatmap Radar for support numbers."}</p>
          </div>
          <div>
            <span>Action Checklist</span>
            ${(reading.actionSteps || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
          </div>
        </div>
      </div>
      <div class="hero-actions">
        <button class="primary-btn" data-action="save-dream">Save Dream Pick</button>
        <button class="ghost-btn" data-action="build-dream-video">Build Dream Video</button>
        <button class="ghost-btn" data-route="studio">Record Dream Song</button>
        <button class="ghost-btn" data-route="heatmap">Open Radar</button>
        <button class="ghost-btn" data-route="history">Open History</button>
      </div>
    </div>` : ""}

    ${dreamJournalPanel()}

    ${localSignalPanel()}

    <div class="panel record-label-panel dream-record-label art-panel" style="--panel-art:url('${ASSETS.music}')">
      <div>
        <span class="eyebrow">LottoMind Records</span>
        <h2>Music Store</h2>
        <p>Prominent dream-lane audio store for reset sessions, radio intros, and dream video sound beds.</p>
      </div>
      <div class="hero-actions">
        <button class="primary-btn" data-route="music">Open Music Store</button>
        <button class="ghost-btn" data-route="radioStation">Radio Station</button>
        <button class="ghost-btn" data-route="studio">Sonic Studio</button>
        <button class="ghost-btn" data-route="dreamVideo">Dream Video</button>
      </div>
    </div>

    ${state.currentPsychic ? psychicResultCard(state.currentPsychic) : ""}
  </section>`;
}

function numberGeneratorView() {
  const current = state.currentSet || generateLottoSet(state.gameId, state.strategy, "number-generator");
  return `<section class="screen">
    <div class="panel art-panel" style="--panel-art:url('${ASSETS.powerTools}')">
      <h1>Number Generator</h1>
      <p>Old app generator logic ported into Oracle Studio controls.</p>
      ${gamePills()}
      ${strategyPills()}
      <button class="primary-btn full" data-action="generate-set">Generate ${getGame().name}</button>
    </div>
    <div class="panel result-card">
      <span>${current.gameName} ${titleCase(current.strategy)}</span>
      ${ballsHtml(current.numbers, current.special, current.specialName)}
      <p>${current.note}</p>
      <div class="hero-actions">
        <button class="primary-btn" data-action="save-current-set">Save Set</button>
        <button class="ghost-btn" data-action="lock-prediction">Lock Prediction</button>
        <button class="ghost-btn" data-route="radioStation">Radio Station</button>
      </div>
    </div>
    <div class="panel number-generator-tools">
      <div class="section-head">
        <div><h2>Generator Add-Ons</h2><p>Wheel coverage, signal scoring, and deep report tools stay one tap from the generator.</p></div>
        <span>3 tools</span>
      </div>
      <div class="circle-carousel">
        ${[
          ["Wheel Builder", "Coverage", "wheelBuilder"],
          ["Energy Meter", "Signal score", "energyMeter"],
          ["Lotto Intelligence", "Deep report", "lottoIntel"],
        ].map(([title, sub, route], index) => circleTool(title, sub, route, index + 2)).join("")}
      </div>
    </div>
    <div class="panel radio-mini">
      <div><span class="eyebrow">LottoMind Radio</span><h2>Frequency while you generate</h2><p>Open the dedicated radio lane for LottoMind Records tracks and reset audio.</p></div>
      <button class="primary-btn" data-route="radioStation">Open Radio</button>
    </div>
  </section>`;
}

function dailyToolsView() {
  const analysis = analyzeDailyDigits(state.dailyInput);
  return `<section class="screen">
    <div class="panel daily-lab">
      <div class="section-head">
        <div><span class="eyebrow">V2 State Power Tools</span><h1>Daily 3 / Daily 4</h1><p>State results, digit helpers, straight/box checks, mirrors, pairs, vtrac, and roots.</p></div>
        <button class="pin-button small" data-action="cycle-state"><span>STATE</span><strong>${state.selectedState}</strong></button>
      </div>
      <label class="field-label">Digits <input data-bind="dailyInput" value="${escapeHtml(state.dailyInput)}" maxlength="4" /></label>
      <div class="hero-actions">
        <button class="primary-btn" data-action="analyze-daily">Analyze Digits</button>
        <button class="ghost-btn" data-action="generate-daily">Generate Daily</button>
      </div>
    </div>
    <div class="tool-grid">
      ${metricCard("Digits", analysis.digits.join(""))}
      ${metricCard("Sum / Root", `${analysis.sum} / ${analysis.root}`)}
      ${metricCard("Mirrors", analysis.mirrors.join(""))}
      ${metricCard("Vtrac", analysis.vtrac.join("-"))}
      ${metricCard("Pairs", analysis.pairs.join(", "))}
      ${metricCard("Box Ways", `${analysis.boxedCount}-way box`)}
    </div>
    <div class="panel result-card">
      <span>Pattern read</span>
      <p>${analysis.sequence.note}</p>
      <p>Repeats: ${analysis.repeatDigits.length ? analysis.repeatDigits.join(", ") : "none"} | Odd ${analysis.sequence.odd} / Even ${analysis.sequence.even}</p>
    </div>
  </section>`;
}

function heatmapView() {
  const heatmap = getHeatmap();
  const stats = getMatrixStats();
  const hot = [...heatmap].sort((a, b) => b.count - a.count || a.number - b.number).slice(0, 8);
  const cold = [...heatmap].sort((a, b) => a.count - b.count || a.number - b.number).slice(0, 8);
  const active = heatmap.filter((cell) => cell.label === "active").slice(0, 8);
  const avgCount = heatmap.length ? Math.round((heatmap.reduce((sum, cell) => sum + cell.count, 0) / heatmap.length) * 10) / 10 : 0;
  const topSignal = hot[0] || heatmap[0] || { number: "-", count: 0 };
  const lowSignal = cold[0] || heatmap[0] || { number: "-", count: 0 };
  const trendRange = `${lowSignal.count}-${topSignal.count}`;
  return `<section class="screen heatmap-screen">
    <div class="panel art-panel heatmap-hero" style="--panel-art:url('${ASSETS.heatmap}')">
      <div>
        <span class="eyebrow">Mission 03</span>
        <h1>Signal Radar Map</h1>
        <p>${stats.game.name} - ${stats.drawCount} local demo draws - ${stats.trustScore}% signal confidence.</p>
      </div>
      <div class="radar-summary">
        <strong>${state.selectedState}</strong>
        <small>State pin</small>
        <em>${stats.trustScore}%</em>
      </div>
      ${gamePills()}
    </div>
    <div class="panel radar-controls">
      ${[
        ["Target Lock", "hot"],
        ["Cold Sweep", "cold"],
        ["Balance Lane", "balanced"],
        ["Save Set", "history"],
        ["Run Power Tools", "powertools"],
        ["Store Locator", "storeLocator"],
      ].map(([label, route]) => `<button class="control-chip" data-route="${route === "hot" || route === "cold" || route === "balanced" ? "heatmap" : route}"><span>${label}</span><small>${route === "hot" ? topSignal.number : route === "cold" ? lowSignal.number : route === "balanced" ? "mix" : "open"}</small></button>`).join("")}
    </div>
    ${todaysSnapshotPanel("Radar Snapshot")}
    <div class="panel quick-panel radar-quick-panel">
      <div class="section-head"><div><h2>Radar Tool Deck</h2><p>Old functions grouped under the Radar tab as swipeable Oracle buttons.</p></div><span>${QUICK_TOOLS.length} tools</span></div>
      <div class="circle-carousel">
        ${QUICK_TOOLS.map(([title, sub, route], index) => circleTool(title, sub, route, index)).join("")}
      </div>
    </div>
    <div class="panel radar-panel">
      <div class="radar-titlebar">
        <div><span>Live Board</span><strong>${stats.game.name} Signal Grid</strong></div>
        <button class="tiny-btn" data-action="generate-set">Generate from Radar</button>
      </div>
      <div class="radar-map ${heatmap.length > 36 ? "dense" : ""}">
        ${heatmap.map((cell, index) => radarDot(cell, index, heatmap.length)).join("")}
      </div>
      <div class="legend"><span class="hot"></span> Hot <span class="active"></span> Active <span class="cold"></span> Cold</div>
    </div>
    <div class="split-grid">
      <div class="panel"><h2>Hot Watch</h2>${ballsHtml(hot.map((cell) => cell.number))}</div>
      <div class="panel"><h2>Cold Watch</h2>${ballsHtml(cold.map((cell) => cell.number))}</div>
    </div>
    <div class="split-grid radar-second-column">
      <div class="panel news-radar-bridge">
        <div class="section-head flush"><div><h2>News Radar</h2><p>Rule changes, unclaimed prizes, jackpot movement, and draw alerts now live inside Radar.</p></div><span>Alerts</span></div>
        <div class="radar-news-grid">
          ${[
            { scope: "Matrix", title: "Rule Change Watch", action: "Check matrix-era alerts before using radar signals." },
            { scope: "Jackpot", title: "Movement Desk", action: "Review jackpot movement and saved-game draw timing." },
            { scope: "State", title: "Pinned Alerts", action: `Watch ${state.selectedState} delays, claims, and result notes.` },
          ].map((alert) => `<button class="news-chip" data-route="newsRadar"><span>${alert.scope}</span><strong>${alert.title}</strong><small>${alert.action}</small></button>`).join("")}
        </div>
      </div>
      ${localSignalPanel()}
    </div>
    <div class="panel trend-card">
      <div class="section-head flush"><div><h2>Trend Overview</h2><p>Draw-count bars, hot lane, cold lane, and balance cue.</p></div><span>${stats.drawCount} draws</span></div>
      <div class="trend-summary-grid">
        <div><span>Top signal</span><strong>${topSignal.number}</strong><small>${topSignal.count} hits</small></div>
        <div><span>Cold watch</span><strong>${lowSignal.number}</strong><small>${lowSignal.count} hits</small></div>
        <div><span>Avg draw count</span><strong>${avgCount}</strong><small>per number</small></div>
        <div><span>Range</span><strong>${trendRange}</strong><small>low to high</small></div>
      </div>
      <div class="trend-bars">${heatmap.map((cell) => `<span class="${cell.label}" style="--h:${Math.max(18, 18 + cell.count * 16)}px"><i>${cell.count}</i><b>${cell.number}</b></span>`).join("")}</div>
      <div class="trend-insights">
        <div><strong>Hot lane</strong><p>${hot.slice(0, 5).map((cell) => cell.number).join(", ")} are drawing above the local sample average.</p></div>
        <div><strong>Active middle</strong><p>${(active.length ? active : heatmap.slice(0, 5)).slice(0, 5).map((cell) => cell.number).join(", ")} are usable bridge numbers for balanced sets.</p></div>
        <div><strong>Cold lane</strong><p>${cold.slice(0, 5).map((cell) => cell.number).join(", ")} are overdue in this demo matrix and should be used lightly.</p></div>
      </div>
    </div>
    <div class="panel mission-brief">
      <h2>Recommended Move</h2>
      <p>Use one hot signal, one cold watch number, and a balanced middle number. Save the set before checking Live Results.</p>
      <div class="hero-actions">
        <button class="primary-btn" data-action="run-power-analysis">Build Radar Set</button>
        <button class="ghost-btn" data-route="live">Check Live Results</button>
      </div>
    </div>
  </section>`;
}

function radarDot(cell, index, total = 28) {
  const large = total > RADAR_POSITIONS.length;
  let x;
  let y;
  if (large) {
    const ring = index % 4;
    const step = Math.floor(index / 4);
    const perRing = Math.ceil(total / 4);
    const angle = (step / perRing) * Math.PI * 2 + ring * 0.34;
    const radius = 16 + ring * 10;
    x = 50 + Math.cos(angle) * radius;
    y = 50 + Math.sin(angle) * radius;
  } else {
    [x, y] = RADAR_POSITIONS[index % RADAR_POSITIONS.length];
  }
  return `<button class="radar-dot ${cell.label}" style="left:${x}%;top:${y}%">${cell.number}</button>`;
}

function sequenceView() {
  const numbers = parseNumbers(state.numberInput);
  const report = state.lastSequence || analyzeSequence(numbers, getGame().mainMax);
  const hot = getHeatmap().filter((cell) => cell.label === "hot" || cell.label === "active").slice(0, 6).map((cell) => cell.number);
  const radarSet = state.currentSet || generateLottoSet(state.gameId, "balanced", `sequence-${state.numberInput}`);
  const gapFocus = report.gaps.length ? Math.max(...report.gaps) : 0;
  const pairMap = report.sorted.slice(0, -1).map((number, index) => `${number}-${report.sorted[index + 1]}`).join(" | ") || "none";
  const rootLane = report.sorted.map((number) => ((number - 1) % 9) + 1).join(" / ") || "none";
  const skipLane = report.repeats.length ? `Watch repeats ${report.repeats.join(", ")}` : "No repeat pressure";
  return `<section class="screen">
    <div class="panel art-panel sequence-console" style="--panel-art:url('${ASSETS.sequence}')">
      <div>
        <span class="eyebrow">Sequence Engine</span>
        <h1>Pattern Control Room</h1>
        <p>Full number structure read: sum, digital root, gaps, mirrors, repeats, high/low balance, and radar merge.</p>
      </div>
      ${gamePills()}
      <label class="field-label">Number Stream <input data-bind="numberInput" value="${escapeHtml(state.numberInput)}" placeholder="7 23 38 42 11" /></label>
      <div class="hero-actions">
        <button class="primary-btn" data-action="analyze-sequence">Analyze Sequence</button>
        <button class="ghost-btn" data-action="generate-set">Build Set</button>
        <button class="ghost-btn" data-route="heatmap">Open Radar</button>
      </div>
    </div>
    <div class="sequence-metrics">
      ${metricCard("Sum", report.sum)}
      ${metricCard("Digital Root", report.root)}
      ${metricCard("Odd / Even", `${report.odd} / ${report.even}`)}
      ${metricCard("High / Low", `${report.high} / ${report.low}`)}
      ${metricCard("Spread", `${report.spread} ${report.range}`)}
      ${metricCard("Clusters", report.clusters)}
    </div>
    <div class="panel sequence-option-panel">
      <div class="section-head"><div><h2>Original Engine Options</h2><p>Smaller controls for the full old Sequence Engine logic.</p></div><span>8 lanes</span></div>
      <div class="sequence-option-grid">
        ${[
          ["Sum Target", report.sum, "analyze-sequence"],
          ["Root Lane", rootLane, "analyze-sequence"],
          ["Gap Focus", `${gapFocus} max`, "analyze-sequence"],
          ["Pair Map", pairMap, "analyze-sequence"],
          ["Mirror Watch", report.mirrorPairs.join(", ") || "none", "analyze-sequence"],
          ["Repeat Guard", skipLane, "analyze-sequence"],
          ["Hot Merge", hot.join(", ") || "loading", "run-power-analysis"],
          ["Radar Build", "balanced set", "generate-set"],
        ].map(([title, value, action]) => `<button class="sequence-option" data-action="${action}"><span>${title}</span><strong>${escapeHtml(String(value))}</strong></button>`).join("")}
      </div>
    </div>
    <div class="panel sequence-grid">
      <div class="section-head"><div><h2>Engine Readout</h2><p>Use these lanes to decide what to keep, skip, or rebalance.</p></div></div>
      <div class="tool-grid padded">
        ${metricCard("Ordered Ladder", report.sorted.join(" - ") || "none")}
        ${metricCard("Gap Map", report.gaps.join(" / ") || "none")}
        ${metricCard("Consecutive", report.consecutivePairs.join(", ") || "none")}
        ${metricCard("Mirror Watch", report.mirrorPairs.join(", ") || "none")}
        ${metricCard("Repeats", report.repeats.join(", ") || "none")}
        ${metricCard("Hot Merge", hot.join(", ") || "loading")}
      </div>
    </div>
    <div class="panel result-card">
      <span>Sequence recommendation</span>
      <h2>${report.note}</h2>
      <p>Blend one hot radar number, one cold watch number, and one number from the strongest gap lane. Save the result into LottoMind Records before checking live draws.</p>
      ${ballsHtml(radarSet.numbers, radarSet.special, radarSet.specialName)}
      <div class="hero-actions">
        <button class="primary-btn" data-action="save-current-set">Save to Records</button>
        <button class="ghost-btn" data-route="records">Open LottoMind Records</button>
      </div>
    </div>
  </section>`;
}

function historyView() {
  const sets = loadJson(STORAGE.history, []);
  const dreams = loadJson(STORAGE.readings, []);
  const psychic = loadJson(STORAGE.psychic, []);
  const liveVault = `<div class="panel vault-section live-vault-panel">
      <div class="vault-heading"><span>Live Vault</span><h2>Live Results Archive</h2></div>
      <p>Compact draw cards with state, session, date, jackpot context, and the saved route back to Live Vault.</p>
      <div class="live-vault-compact-grid">
        ${LIVE_RESULT_RECORDS.slice(0, 4).map((record) => `<button class="history-row live-vault-row compact" data-route="live">
          <span>${record.stateCode}</span>
          <strong>${record.gameName}</strong>
          ${ballsHtml(record.numbers, record.special)}
          <small>${record.drawDate} - ${record.session}${record.jackpotMillions ? ` - $${record.jackpotMillions}M` : ""}</small>
        </button>`).join("")}
      </div>
      <div class="hero-actions padded">
        <button class="primary-btn" data-route="live">Open Live Vault</button>
        <button class="ghost-btn" data-route="heatmap">Open Heatmap</button>
      </div>
    </div>`;
  return `<section class="screen">
    <div class="panel art-panel" style="--panel-art:url('${ASSETS.live}')">
      <h1>History Vault</h1>
      <p>Saved numbers, dream readings, predictions, and psychic fusion results.</p>
      <button class="ghost-btn" data-action="clear-history">Clear Vault</button>
    </div>
    <div class="panel vault-section"><div class="vault-heading"><span>Saved</span><h2>Saved Sets</h2></div>${sets.length ? sets.map(savedSetRow).join("") : `<p>No saved sets yet. Generate one from Dashboard or Power Tools.</p>`}</div>
    <div class="panel vault-section"><div class="vault-heading"><span>Oracle</span><h2>Dream Readings</h2></div>${dreams.length ? dreams.map((item) => `<div class="history-row"><strong>${escapeHtml(item.title)}</strong>${ballsHtml(item.numbers)}<small>${escapeHtml(item.note)}</small></div>`).join("") : `<p>No dream readings saved yet.</p>`}</div>
    <div class="panel vault-section"><div class="vault-heading"><span>AI</span><h2>Psychic History</h2></div>${psychic.length ? psychic.map((item) => `<div class="history-row"><strong>${escapeHtml(item.title)}</strong>${ballsHtml(item.suggestedNumbers, item.bonusNumber)}<small>${escapeHtml(item.message)}</small></div>`).join("") : `<p>No psychic readings saved yet.</p>`}</div>
    ${liveVault}
  </section>`;
}

function savedSetRow(item) {
  return `<div class="history-row">
    <strong>${item.gameName} - ${titleCase(item.strategy)}</strong>
    ${ballsHtml(item.numbers, item.special, item.specialName)}
    <small>${new Date(item.createdAt).toLocaleString()} - ${escapeHtml(item.note)}</small>
  </div>`;
}

function liveView() {
  const rows = LIVE_RESULT_RECORDS.filter((item) => item.stateCode === state.selectedState || item.stateCode === "US");
  return `<section class="screen">
    <div class="panel art-panel" style="--panel-art:url('${ASSETS.live}')">
      <h1>Live Results</h1>
      <p>State and national demo draw center. Pin ${state.selectedState} controls the local rows.</p>
      <button class="pin-button" data-action="cycle-state"><span>STATE</span><strong>${state.selectedState}</strong></button>
    </div>
    <div class="result-list">${rows.map((record) => `<div class="panel result-card live-row"><span>${record.stateName} - ${record.session}</span><h2>${record.gameName}</h2>${ballsHtml(record.numbers, record.special)}<p>${record.drawDate}${record.jackpotMillions ? ` - $${record.jackpotMillions}M` : ""}</p></div>`).join("")}</div>
  </section>`;
}

function scannerView() {
  const result = state.scanResult;
  return `<section class="screen">
    <div class="panel art-panel scanner-hero" style="--panel-art:url('${ASSETS.powerTools}')">
      <h1>Ticket Scanner</h1>
      <p>Camera capture, barcode entry, and scan simulation are wired into LottoMind Records.</p>
      <div class="scanner-frame">
        <span></span><span></span><span></span><span></span>
        <strong>${result ? "Ticket Readout Loaded" : "Camera Scan Lane"}</strong>
        <small>${result?.source || "Use the camera button, upload a ticket photo, or enter the barcode."}</small>
      </div>
      <label class="primary-btn file-btn">Open Camera / Upload
        <input class="file-input" type="file" accept="image/*" capture="environment" data-action="scan-ticket" />
      </label>
      <label class="field-label">Barcode / QR number <input data-bind="barcodeInput" value="${escapeHtml(state.barcodeInput)}" placeholder="Scan or type barcode..." /></label>
      <div class="hero-actions">
        <button class="primary-btn" data-action="scan-barcode">Scan Barcode</button>
        <button class="ghost-btn" data-action="simulate-scan">Run Scan Demo</button>
        <button class="ghost-btn" data-route="history">Records</button>
      </div>
    </div>
    <div class="panel result-card scanner-result">${result ? `<span>Scanner output</span><h2>${result.title}</h2>${ballsHtml(result.numbers, result.special)}<p>${result.note}</p><div class="tool-grid padded">${metricCard("Barcode", result.barcode || "image")}${metricCard("Status", result.status || "Needs verification")}${metricCard("Matched", result.matchedGame || getGame().name)}${metricCard("Confidence", `${result.confidence || 78}%`)}</div><div class="hero-actions"><button class="primary-btn" data-action="save-current-set">Save Scan</button><button class="ghost-btn" data-route="live">Check Results</button></div>` : `<p>No scan yet. Upload a ticket image, run the demo, or enter a barcode.</p>`}</div>
  </section>`;
}

function walletView() {
  const credits = getCredits();
  const unlocks = getUnlocks();
  return `<section class="screen">
    <div class="panel art-panel" style="--panel-art:url('${ASSETS.credit}')">
      <h1>Credit Vault</h1>
      <p>Credits power readings, reports, and premium experiments.</p>
      <div class="credit-balance">${credits}</div>
    </div>
    <div class="tool-grid">${FEATURE_UNLOCKS.map((item) => `<button class="store-card ${isUnlocked(item.id) ? "unlocked" : ""}" data-action="unlock-feature" data-unlock="${item.id}"><strong>${item.title}</strong><span>${item.window}</span><small>${isUnlocked(item.id) ? "Unlocked" : `${item.cost} credits`}</small></button>`).join("")}</div>
    <div class="panel result-card"><span>Unlocked Features</span><h2>${Object.values(unlocks).filter((item) => isUnlocked(item.id)).length} active</h2><p>Credits now unlock features instead of only subtracting from the wallet.</p></div>
  </section>`;
}

function musicHubView(isRadio = false) {
  return `<section class="screen media-screen">
    <div class="panel art-panel media-hero" style="--panel-art:url('${ASSETS.music}')">
      <div>
        <span class="eyebrow">${isRadio ? "LottoMind Radio" : "Music Hub"}</span>
        <h1>${isRadio ? "Radio Station" : "Music Store"}</h1>
        <p>${isRadio ? "A dedicated LottoMind Records radio lane for live focus audio, reset tracks, and branded station IDs." : "LottoMind Records label: imported frequency tracks, reset sessions, and branded audio loops connected back into Reset."}</p>
        <div class="hero-actions">
          <button class="primary-btn" data-route="reset">Open Reset Wheel</button>
          <button class="ghost-btn" data-route="music">Music Store</button>
          <button class="ghost-btn" data-route="studio">Sonic Studio</button>
          <button class="ghost-btn" data-route="dreamVideo">Open Video Studio</button>
        </div>
      </div>
      <img class="deck-coin" src="${ASSETS.logo}" alt="LottoMind frequency logo" />
    </div>
    <div class="panel radio-station-panel">
      <div>
        <span class="eyebrow">On Air</span>
        <h2>LottoMind Frequency Radio</h2>
        <p>Tap a station card below to preview, then load the tone into Reset when you are ready.</p>
      </div>
      <div class="radio-dial"><strong>LM</strong><span>FM 528</span></div>
    </div>
    ${isRadio ? "" : `<div class="panel record-label-panel compact">
      <div>
        <span class="eyebrow">LottoMind Records Label</span>
        <h2>Frequency Storefront</h2>
        <p>Use this as the music store lane: preview tracks here, then load a reset tone when you want to play.</p>
      </div>
      <button class="primary-btn" data-route="reset">Load Reset Player</button>
    </div>`}
    <div class="panel streaming-connect-panel">
      <div class="section-head">
        <div><h2>Connect Music Platforms</h2><p>Bring back Apple Music, YouTube, and YouTube Music as LottoMind Records connection lanes.</p></div>
        <span>${STREAMING_LINKS.length} lanes</span>
      </div>
      <div class="stream-connect-grid">
        ${STREAMING_LINKS.map(([title, copy, key, art, url]) => `<button class="stream-card stream-${key}" data-action="connect-stream" data-stream="${title}" data-url="${url}" style="--stream-art:url('${art}')">
          <span class="stream-record"></span>
          <strong>${title}</strong>
          <small>${copy}</small>
          <b>${loadJson(STORAGE.streams, []).includes(title) ? "Connected" : "Connect"}</b>
        </button>`).join("")}
      </div>
    </div>
    <div class="panel audio-deck">
      <div class="section-head"><div><h2>Imported Music</h2><p>Branded tracks and frequency sessions.</p></div><span>${AUDIO_LIBRARY.length} tracks</span></div>
      <div class="audio-list">
        ${AUDIO_LIBRARY.map(([title, src, copy], index) => `<article class="media-card record-track-card" style="--record-art:url('${[ASSETS.logo, ASSETS.music, ASSETS.reset, ASSETS.live][index % 4]}')">
          <span class="vinyl-record" aria-hidden="true"></span>
          <div class="track-copy"><strong>${title}</strong><small>${copy}</small></div>
          <audio controls preload="none" src="${src}"></audio>
          <button class="ghost-btn" data-action="load-reset-session" data-tone="${title.includes("174") ? "174" : title.includes("432") ? "432" : title.includes("Frequency") ? "528" : "396"}">Load in LottoMind Reset</button>
        </article>`).join("")}
      </div>
    </div>
    <div class="panel related-panel">
      <div class="section-head"><div><h2>Sound Routes</h2><p>Fast paths connected to the rest of the app.</p></div></div>
      <div class="sound-route-bento">
        ${[["Reset Wheel", "Tone player", "reset", ASSETS.reset], ["Radio Station", "Live audio", "radioStation", ASSETS.music], ["Sonic Studio", "Record booth", "studio", ASSETS.studioBooth], ["Dream Oracle", "Speak", "dreams", ASSETS.dream], ["Video Studio", "Loops", "dreamVideo", ASSETS.arcade], ["History Vault", "Archive", "history", ASSETS.live]].map(([title, sub, route, art], index) => `
          <button class="sound-route-card ${index === 0 ? "featured" : ""}" data-route="${route}" style="--route-art:url('${art}')">
            ${index === 0 ? `<video class="route-video-bg" src="${BASE}/videos/power-tools-button-green-screen.mp4" muted loop autoplay playsinline preload="metadata"></video>` : ""}
            <span>0${index + 1}</span>
            <strong>${title}</strong>
            <small>${sub}</small>
          </button>
        `).join("")}
      </div>
    </div>
  </section>`;
}

function buildDreamVideoPlan(text = state.dreamText) {
  const reading = state.currentDream || interpretDream(text, state.gameId);
  const symbols = reading.symbols.length ? reading.symbols.map(titleCase) : ["Signal", "Doorway", "Number Reveal"];
  const frames = [
    ["Opening Vision", symbols[0] || "Dream Signal", "Wide branded scene, soft gold/cyan glow, slow reveal."],
    ["Oracle Meaning", symbols[1] || "Symbol Bridge", reading.summary || reading.note],
    ["Lucky Number Reveal", reading.numbers.join(" - "), "Show the number set as glowing LottoMind tokens."],
    ["Save + Share", reading.pick3 || reading.pick4 || "Ready", "End card routes to Records and Power Tools."],
  ];
  return {
    title: "Dream Video Storyboard",
    tone: reading.tone || "Oracle",
    prompt: text,
    reading,
    frames,
    clips: VIDEO_LIBRARY.map(([title, src, poster], index) => ({ title, src, poster, use: frames[index % frames.length][0] })),
  };
}

function videoStudioView() {
  const storyboard = state.currentVideo || buildDreamVideoPlan(state.dreamText);
  return `<section class="screen media-screen">
    <div class="panel art-panel media-hero video-studio-hero" style="--panel-art:url('${ASSETS.dream}')">
      <div>
        <span class="eyebrow">Video Studio</span>
        <h1>Dream Video Studio</h1>
        <p>Record or type a dream, build a storyboard, then connect it to Dream Oracle, Records, and the branded motion kit.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-action="build-dream-video">Build Storyboard</button>
          <button class="ghost-btn" data-action="start-dream-recording">Mic Dream</button>
          <button class="ghost-btn" data-route="dreams">Dream Oracle</button>
          <button class="ghost-btn" data-route="settings">Settings</button>
        </div>
      </div>
      <img class="deck-coin" src="${ASSETS.psychic}" alt="LottoMind dream video coin" />
    </div>
    <div class="panel video-builder">
      <div class="section-head"><div><h2>Dream Prompt</h2><p>This text drives the storyboard and Oracle numbers.</p></div><span>${storyboard.tone}</span></div>
      <textarea class="dream-input compact" data-bind="dreamText" placeholder="Speak or type the dream...">${escapeHtml(state.dreamText)}</textarea>
      <div class="hero-actions">
        <button class="primary-btn" data-action="build-dream-video">Generate Scenes</button>
        <button class="ghost-btn" data-action="save-video-storyboard">Save Storyboard</button>
        <button class="ghost-btn" data-route="records">Open Records</button>
      </div>
    </div>
    <div class="panel storyboard-panel">
      <div class="section-head"><div><h2>${storyboard.title}</h2><p>Four scene cards built from the Dream Oracle interpretation.</p></div><span>${storyboard.reading.confidence || 72}% match</span></div>
      <div class="storyboard-grid">
        ${storyboard.frames.map(([title, value, copy], index) => `<article class="story-card" style="--story-art:url('${[ASSETS.dream, ASSETS.psychic, ASSETS.heatmap, ASSETS.live][index]}')">
          <span>Scene ${index + 1}</span>
          <strong>${escapeHtml(title)}</strong>
          <b>${escapeHtml(value)}</b>
          <p>${escapeHtml(copy)}</p>
        </article>`).join("")}
      </div>
    </div>
    <div class="video-grid">
      ${storyboard.clips.map(({ title, src, poster, use }) => `<article class="panel video-card studio-video-card">
        <video src="${src}" poster="${poster}" muted loop playsinline controls preload="none"></video>
        <div><strong>${title}</strong><small>${escapeHtml(use)} motion layer</small></div>
      </article>`).join("")}
    </div>
    <div class="panel result-card">
      <span>Dream Video Function</span>
      <h2>${escapeHtml(storyboard.reading.summary || storyboard.reading.note)}</h2>
      <p>Lucky reveal lane: ${storyboard.reading.numbers.join(", ")}. Save the storyboard, then open Records or Power Tools to keep working.</p>
      <div class="hero-actions">
        <button class="primary-btn" data-action="build-dream-video">Refresh Storyboard</button>
        <button class="ghost-btn" data-route="records">Open Records</button>
        <button class="ghost-btn" data-route="powertools">Power Tools</button>
      </div>
    </div>
  </section>`;
}

function futureReadView() {
  const reading = interpretDream(state.dreamText, state.gameId);
  const set = state.currentSet || generateLottoSet(state.gameId, "dream", state.dreamText || "future read");
  return `<section class="screen future-read-screen">
    <div class="panel art-panel oracle-function-panel future-read-hero" style="--panel-art:url('${ASSETS.dream}')">
      <span class="eyebrow">Symbol Forecast</span>
      <h1>Future Read Mode</h1>
      <p>A symbolic entertainment forecast from your dream text, state pin, current game, and LottoMind signal lanes.</p>
      <div class="hero-actions">
        <button class="primary-btn" data-action="interpret-dream">Refresh Reading</button>
        <button class="ghost-btn" data-route="dreams">Dream Oracle</button>
        <button class="ghost-btn" data-route="history">History Vault</button>
      </div>
    </div>
    <div class="panel result-card">
      <span>${escapeHtml(reading.tone || "Oracle")}</span>
      <h2>${escapeHtml(reading.title || "Future Signal")}</h2>
      <p>${escapeHtml(reading.summary || reading.note || "Read the symbols, then save only what feels useful.")}</p>
      ${ballsHtml(set.numbers, set.bonusNumber)}
      <div class="tool-grid padded">
        ${metricCard("Play Window", reading.numberLogic?.playWindow || "Evening")}
        ${metricCard("Pick 3", reading.pick3 || "Ready")}
        ${metricCard("Pick 4", reading.pick4 || "Ready")}
        ${metricCard("State", state.selectedState)}
      </div>
    </div>
  </section>`;
}

function sonicStudioView() {
  const reading = state.currentDream || interpretDream(state.dreamText, state.gameId);
  const current = state.currentSet || generateLottoSet(state.gameId, state.strategy, "sonic-studio");
  const melodyNumbers = reading?.numbers?.length ? reading.numbers : current.numbers;
  const beats = [
    ["Gold Street Oracle", "Detroit Soul", "84 BPM", "528 Hz inspired", "Free", ASSETS.studioBooth],
    ["Dream Oracle Velvet", "Dream R&B", "72 BPM", "432 Hz inspired", "100 LC", ASSETS.dream],
    ["Credit Lane Bounce", "Casino Bounce", "96 BPM", "777 Hz inspired", "Free", ASSETS.arcade],
    ["Vault Rainfield", "Frequency Vault Ambient", "60 BPM", "174 Hz inspired", "Free", ASSETS.music],
    ["Space Oracle Pad", "Space Oracle", "68 BPM", "963 Hz inspired", "150 LC", ASSETS.powerTools],
    ["Retro Prize Spark", "Retro Arcade", "112 BPM", "888 Hz inspired", "75 LC", ASSETS.commandDeck],
  ];
  return `<section class="screen sonic-studio-screen">
    <div class="panel art-panel sonic-studio-hero" style="--panel-art:url('${ASSETS.studioBooth}')">
      <div>
        <span class="eyebrow">LottoMind Sonic Studio</span>
        <h1>Recording Booth</h1>
        <p>Record dream songs, affirmations, lucky chants, spoken-word hooks, and frequency-inspired demos inside the LottoMind Records lane.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-action="start-dream-recording">Start Recording</button>
          <button class="ghost-btn" data-route="dreams">Start From Dream</button>
          <button class="ghost-btn" data-route="music">Open Records</button>
          <button class="ghost-btn" data-route="contests">Dream Song Challenge</button>
        </div>
      </div>
      <div class="studio-live-orb"><strong>528</strong><span>Hz inspired</span></div>
    </div>

    <div class="panel sonic-studio-console">
      <div class="section-head">
        <div><h2>Studio Workflow</h2><p>Four branded lanes keep the creative flow clear.</p></div>
        <span>Creative module</span>
      </div>
      <div class="studio-tab-row">
        ${["Beats", "Record", "Mix", "Library"].map((item, index) => `<div class="studio-tab ${index === 0 ? "active" : ""}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${item}</strong></div>`).join("")}
      </div>
    </div>

    <div class="panel sonic-studio-console">
      <div class="section-head">
        <div><h2>Beat Picker</h2><p>Premade LottoMind instrumentals for dream songs and Sonic Oracle soundscapes.</p></div>
        <span>${beats.length} beats</span>
      </div>
      <div class="studio-beat-grid">
        ${beats.map(([title, category, bpm, frequency, cost, art], index) => `<article class="studio-beat-card" style="--beat-art:url('${art}')">
          <span>${escapeHtml(category)}</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(bpm)} - ${escapeHtml(frequency)}</small>
          <b>${escapeHtml(cost)}</b>
          <button class="${index === 0 ? "primary-btn" : "ghost-btn"}" data-route="${index < 2 ? "dreams" : "music"}">${index === 0 ? "Use Beat" : "Preview"}</button>
        </article>`).join("")}
      </div>
    </div>

    <div class="studio-work-grid">
      <div class="panel studio-booth-card">
        <span class="eyebrow">Record</span>
        <h2>Vocal Booth</h2>
        <p>Use headphones, then record vocals, affirmations, hooks, or dream messages over a selected LottoMind beat.</p>
        <div class="studio-meter"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="studio-transport-row">
          <button class="primary-btn" data-route="dreams">Record Dream Song</button>
          <button class="ghost-btn" data-route="dreamVideo">Build Visual</button>
        </div>
      </div>
      <div class="panel studio-booth-card">
        <span class="eyebrow">Mix</span>
        <h2>Demo Console</h2>
        <p>Balance beat, vocal, echo preview, radio filter preview, and 528 glow settings before saving the demo.</p>
        <div class="studio-knob-grid">
          ${[["Vocal", "82%"], ["Beat", "70%"], ["Echo", "Preview"], ["Glow", "528"]].map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("")}
        </div>
      </div>
    </div>

    <div class="panel result-card sonic-melody-card">
      <span>Lucky Melody Seed</span>
      <h2>${melodyNumbers.join(" - ")}</h2>
      ${ballsHtml(melodyNumbers)}
      <p>Use these numbers as lyric inspiration or a short C-scale melody. Entertainment only; LottoMind does not guarantee winnings.</p>
      <div class="hero-actions">
        <button class="primary-btn" data-route="numberGenerator">Make Lucky Chant</button>
        <button class="ghost-btn" data-route="reset">Open Frequency Vault</button>
        <button class="ghost-btn" data-route="history">Save To Vault</button>
      </div>
    </div>

    <div class="panel studio-terms">
      <strong>Studio Terms</strong>
      <p>Only record over instrumentals you own, created yourself, or have permission to use. LottoMind included beats are for in-app creative entertainment unless otherwise licensed.</p>
    </div>
  </section>`;
}

function recordsView() {
  const saved = loadJson(STORAGE.history, []);
  const dreams = loadJson(STORAGE.readings, []);
  const psychic = loadJson(STORAGE.psychic, []);
  const rows = LIVE_RESULT_RECORDS.filter((item) => item.stateCode === state.selectedState || item.stateCode === "US");
  return `<section class="screen records-screen">
    <div class="panel art-panel media-hero" style="--panel-art:url('${ASSETS.live}')">
      <div>
        <span class="eyebrow">LottoMind Records</span>
        <h1>Records Vault</h1>
        <p>Live draw cards, saved sets, Dream Oracle readings, psychic reports, and historical lanes are collected here.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-route="live">Live Results</button>
          <button class="ghost-btn" data-route="history">Saved History</button>
        </div>
      </div>
      <img class="deck-coin" src="${ASSETS.heatmap}" alt="LottoMind records coin" />
    </div>
    <div class="tool-grid">
      ${metricCard("Draw Cards", rows.length)}
      ${metricCard("Saved Sets", saved.length)}
      ${metricCard("Dream Reads", dreams.length)}
      ${metricCard("Psychic Reports", psychic.length)}
    </div>
    <div class="panel records-board">
      <div class="section-head"><div><h2>Draw Record Cards</h2><p>State pin controls the local record lane.</p></div><span>${state.selectedState}</span></div>
      <div class="result-list padded">${rows.map((record) => `<div class="history-row record-card"><strong>${record.gameName} - ${record.stateName}</strong>${ballsHtml(record.numbers, record.special)}<small>${record.drawDate} - ${record.session}${record.jackpotMillions ? ` - $${record.jackpotMillions}M` : ""}</small></div>`).join("")}</div>
    </div>
    <div class="panel"><h2>Saved Sets</h2>${saved.length ? saved.map(savedSetRow).join("") : `<p>No saved sets yet. Run a generator and tap Save to Records.</p>`}</div>
    <div class="panel"><h2>Dream + Psychic Archive</h2>${dreams.concat(psychic).length ? dreams.map((item) => `<div class="history-row"><strong>${escapeHtml(item.title)}</strong>${ballsHtml(item.numbers)}<small>${escapeHtml(item.note)}</small></div>`).join("") + psychic.map((item) => `<div class="history-row"><strong>${escapeHtml(item.title)}</strong>${ballsHtml(item.suggestedNumbers, item.bonusNumber)}<small>${escapeHtml(item.message)}</small></div>`).join("") : `<p>No readings saved yet.</p>`}</div>
  </section>`;
}

function marketplaceView() {
  const unlocked = getUnlocks();
  return `<section class="screen marketplace-screen">
    <div class="panel art-panel media-hero" style="--panel-art:url('${ASSETS.credit}')">
      <div>
        <span class="eyebrow">Marketplace</span>
        <h1>Credit Marketplace</h1>
        <p>Credits, VIP unlocks, dream video tools, learning guides, and premium arcade rewards. Merch now has its own professional store.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-route="wallet">Credit Vault</button>
          <button class="ghost-btn" data-route="vip">VIP</button>
          <button class="ghost-btn" data-route="store">Merch Store</button>
        </div>
      </div>
      <img class="deck-coin" src="${ASSETS.credit}" alt="LottoMind credit coin" />
    </div>
    <div class="tool-grid">
      ${MARKETPLACE_ITEMS.map(([title, copy, cost, unlock]) => `<button class="store-card ${unlocked[unlock] ? "unlocked" : ""}" data-action="buy-item" data-cost="${cost}" data-unlock="${unlock}" data-title="${escapeHtml(title)}"><strong>${title}</strong><span>${copy}</span><small>${unlocked[unlock] ? "Unlocked" : `${cost} credits`}</small></button>`).join("")}
      ${FEATURE_UNLOCKS.map((item) => `<button class="store-card ${isUnlocked(item.id) ? "unlocked" : ""}" data-action="unlock-feature" data-unlock="${item.id}"><strong>${item.title}</strong><span>${item.window} - ${routeMeta(item.route)[0]}</span><small>${isUnlocked(item.id) ? "Unlocked" : `${item.cost} credits`}</small></button>`).join("")}
    </div>
    <div class="panel related-panel">
      <div class="section-head"><div><h2>Store Routes</h2><p>More old app functions connected here.</p></div></div>
      <div class="circle-carousel">
        ${[["Official Merch", "Shop", "store"], ["Credit Store", "Packs", "creditStore"], ["VIP", "Premium", "vip"], ["Achievements", "Rewards", "achievements"], ["Arcade", "Play", "arcade"]].map(([title, sub, route], index) => circleTool(title, sub, route, index + 4)).join("")}
      </div>
    </div>
  </section>`;
}

function merchStoreView() {
  const selected = MERCH_ITEMS[state.selectedMerchIndex] || MERCH_ITEMS[0];
  const categories = ["All", "Clothing", "E-Book", "Sticker Pack", "Desk Gear", "Digital Game", "Official Drop"];
  const filtered = MERCH_ITEMS.filter((item) => state.merchCategory === "All" || item.type === state.merchCategory);
  return `<section class="screen merch-screen">
    <div class="panel art-panel merch-hero" style="--panel-art:url('${ASSETS.detroitCollection}')">
      <img class="hero-bg-video merch-hero-image" src="${ASSETS.detroitCollection}" alt="" />
      <div>
        <span class="eyebrow">Official Merch Store</span>
        <h1 class="game-title merch-title">LottoMind Gear</h1>
        <p>A separate branded shop for apparel, stickers, desk gear, and promo drops. Credits and VIP tools stay in Marketplace.</p>
        <div class="store-badges">
          <span>Secure demo checkout</span>
          <span>Limited drops</span>
          <span>Brand vault</span>
        </div>
        <div class="hero-actions">
          <button class="primary-btn" data-route="marketplace">Credit Marketplace</button>
          <button class="ghost-btn" data-route="wallet">Wallet</button>
        </div>
      </div>
      <div class="merch-video-medallion"><img src="${ASSETS.detroitCapFront}" alt="" /></div>
    </div>
    <div class="panel shop-toolbar merch-shop-control">
      <div class="shop-toolbar-copy"><span>Shop Mode</span><strong>Detroit Merch Shelves</strong><small>${filtered.length} items in ${state.merchCategory}</small></div>
      <div class="store-badges compact merch-category-row">${categories.map((category) => `<button class="${state.merchCategory === category ? "active" : ""}" data-action="set-merch-category" data-category="${category}">${category === "E-Book" ? "E-Books" : category === "Digital Game" ? "Games" : category}</button>`).join("")}</div>
    </div>
    <div class="panel merch-feature-preview">
      <div class="product-media merch-item-art ${selected.className}" style="--product-art:url('${selected.art}')"></div>
      <div>
        <span>${escapeHtml(selected.type)}</span>
        <h2>${escapeHtml(selected.title)}</h2>
        <p>${escapeHtml(selected.copy)}</p>
        <div class="product-buy"><b>${escapeHtml(selected.price)}</b><button class="primary-btn" data-action="add-merch-demo" data-merch="${state.selectedMerchIndex}">Load Demo Checkout</button></div>
      </div>
    </div>
    <div class="merch-grid">
      ${filtered.map((item) => {
        const index = MERCH_ITEMS.indexOf(item);
        return `<article class="panel product-card ${index === state.selectedMerchIndex ? "active" : ""}">
        <div class="product-media merch-item-art ${item.className}" style="--product-art:url('${item.art}')"></div>
        <div>
          <span>${index === 0 ? "Featured Drop" : "Official Drop"}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.copy)}</p>
          <div class="product-buy"><b>${escapeHtml(item.price)}</b><button class="primary-btn" data-action="view-merch-item" data-merch="${index}">View Item</button></div>
        </div>
      </article>`;
      }).join("")}
    </div>
    <div class="panel merch-note">
      <h2>Professional Store Layout</h2>
      <p>Merch is now separated from credit purchases so the store can grow with product cards, media previews, and checkout-ready sections.</p>
    </div>
  </section>`;
}

function profileView() {
  return `<section class="screen">
    <div class="panel art-panel" style="--panel-art:url('${ASSETS.mascot}')">
      <h1>LottoMaster Profile</h1>
      <p>Your saved app state, credits, and streaks.</p>
      <div class="stat-row">
        <div><strong>${getCredits()}</strong><span>Credits</span></div>
        <div><strong>${loadJson(STORAGE.history, []).length}</strong><span>Saved</span></div>
        <div><strong>12</strong><span>Level</span></div>
      </div>
    </div>
    <div class="panel">${["My Picks", "Transaction History", "Membership", "Notifications", "Settings", "Help"].map((label) => `<button class="list-button" data-route="${label === "Settings" ? "settings" : label === "Notifications" ? "notifications" : label === "My Picks" ? "history" : "wallet"}">${label}<span>Open</span></button>`).join("")}</div>
  </section>`;
}

function settingsView() {
  const settings = getSettings();
  return `<section class="screen">
    <div class="panel settings-panel">
      <h1>App Settings</h1>
      <p>Feature switches are saved locally.</p>
      ${Object.entries(settings).map(([key, value]) => `<button class="list-button settings-toggle" data-action="toggle-setting" data-setting="${key}" aria-pressed="${value ? "true" : "false"}">
        <span class="setting-copy"><strong>${key === "music" ? "Tab Intro Music" : titleCase(key)}</strong><small>${key === "music" ? "5-second tab intros" : key === "responsible" ? "Responsible play reminders" : `${titleCase(key)} controls`}</small></span>
        <span class="switch-control ${value ? "on" : ""}"><i></i><b>${value ? "On" : "Off"}</b></span>
      </button>`).join("")}
    </div>
  </section>`;
}

function arcadeView() {
  const games = [
    ["Jackpot Jungle Chase", "Swing, slide, and outrun the Probability Beast.", "arcadeGame"],
    ["Lotto Crossword Puzzle", "Solve LottoMind clue lanes and number words.", "crossword"],
    ["Word Search Vault", "Find dream symbols, states, and lucky terms.", "wordSearch"],
    ["Trivia Rewards", "Answer and earn credits.", "triviaRewards"],
    ["Boss Rush", "Fight the Heatmap Guardian.", "arcadeGame"],
    ["Bonus Room", "Open a credit portal.", "arcadeGame"],
  ];
  const arcadeArt = [ASSETS.arcade, ASSETS.commandDeck, ASSETS.psychic, ASSETS.sequence, ASSETS.live, ASSETS.credit, ASSETS.heatmap, ASSETS.arcadeCoin];
  const activeArcadePanel = state.route === "crossword" ? crosswordGameView() : state.route === "wordSearch" ? wordSearchGameView() : state.route !== "arcade" ? miniGameView(routeMeta(state.route)[0]) : "";
  return `<section class="screen">
    <div class="panel art-panel" style="--panel-art:url('${ASSETS.arcade}')">
      <h1 class="game-title">LottoMind Arcade</h1>
      <p>Original games, rewards, and future Jackpot Run hooks.</p>
      <div class="hero-actions arcade-launch-actions"><button class="primary-btn" data-route="triviaPlay">Launch Trivia Game</button><button class="ghost-btn" data-route="triviaRewards">Rewards</button></div>
    </div>
    <div class="panel arcade-motion">
      <video src="${BASE}/videos/play-arcade-button-loop.mp4" muted loop autoplay playsinline preload="metadata"></video>
      <div><span>Arcade motion asset</span><strong>Play Arcade Button</strong><p>Moved out of Marketplace and into the Arcade tab.</p></div>
    </div>
    ${activeArcadePanel}
    <div class="panel arcade-game-panel">
      <div class="section-head"><div><h2>Game Select</h2><p>Scrollable arcade cards with clearer mission actions.</p></div><span>${games.length} games</span></div>
      <div class="arcade-game-grid">${games.map(([title, copy, route], index) => `
        <button class="arcade-game-card" data-route="${route}" style="--game-art:url('${arcadeArt[index % arcadeArt.length]}')">
          <span>Stage ${String(index + 1).padStart(2, "0")}</span>
          <strong>${title}</strong>
          <small>${copy}</small>
          <b>Play</b>
        </button>
      `).join("")}</div>
    </div>
    ${PLAY_LEARN_GROUP ? `<div class="panel tool-bank arcade-learn-bank">
      <div class="section-head"><div><h2>${PLAY_LEARN_GROUP.title}</h2><p>${PLAY_LEARN_GROUP.copy}</p></div><span>${PLAY_LEARN_GROUP.tools.length} tools</span></div>
      <div class="circle-carousel tool-bento">
        ${PLAY_LEARN_GROUP.tools.map(([title, sub, route], index) => circleTool(title, sub, route, index + 8)).join("")}
      </div>
    </div>` : ""}
    ${state.route === "arcade" ? miniGameView("Trivia Rewards") : ""}
    <div class="panel quest-board arcade-quest-board">
      <div class="section-head movie-head"><div><h2>Quest Board</h2><p>Arcade path from warmup to reward run.</p></div><span>4 steps</span></div>
      <div class="quest-steps">
        ${[
          ["1", "Pick Stage", "Choose a game lane", "triviaPlay", ASSETS.arcade],
          ["2", "Run", "Start the mission", "triviaPlay", ASSETS.arcadeCoin],
          ["3", "Score", "Earn credits", "triviaRewards", ASSETS.credit],
          ["4", "Vault", "Save the run", "history", ASSETS.live],
        ].map(([step, title, copy, route, art]) => `<button class="quest-step ${state.route === route ? "active" : ""}" data-route="${route}" style="--quest-art:url('${art}')"><b>${step}</b><strong>${title}</strong><small>${copy}</small></button>`).join("")}
      </div>
    </div>
  </section>`;
}

function miniGameView(title = "Jackpot Run MVP") {
  return `<div class="panel mini-game">
    <h2>${escapeHtml(title)}</h2>
    <p>Tap Run to score credits. This keeps the arcade route alive inside the new Oracle app.</p>
    <div class="runner-lane"><span></span><i></i><b></b></div>
    <button class="primary-btn full" data-action="play-mini-game">Run</button>
  </div>`;
}

function crosswordGameView() {
  const clues = [
    ["1 Across", "Saved picks and readings live here", "Vault"],
    ["2 Down", "Dream images become these", "Numbers"],
    ["3 Across", "Hot, cold, active signal map", "Radar"],
    ["4 Down", "Audio lane for reset focus", "Radio"],
  ];
  const letters = ["L", "O", "T", "T", "O", "", "M", "I", "N", "D", "R", "A", "D", "A", "R", "V", "A", "U", "L", "T", "", "P", "I", "C", "K"];
  const solved = state.crosswordSolved;
  return `<div class="panel puzzle-game crossword-game crossword-showcase">
    <div class="crossword-stage-head">
      <div>
        <span class="eyebrow">LottoMind Word Stage</span>
        <h2>Lotto Crossword</h2>
        <p>Fill LottoMind words from app clues, then lock the puzzle for credits.</p>
      </div>
      <span class="show-badge">${solved ? "Solved" : "Puzzle Game"}</span>
    </div>
    ${solved ? `<div class="puzzle-solved-banner"><strong>Crossword locked</strong><span>Answer validation complete. Credits were added once.</span></div>` : ""}
    <div class="crossword-show-grid">
      <div class="crossword-board" aria-label="LottoMind crossword board">
        ${Array.from({ length: 25 }, (_, index) => `<span class="${[0, 4, 6, 12, 18, 20, 24].includes(index) ? "block" : ""}">${letters[index] || ""}</span>`).join("")}
      </div>
      <div class="puzzle-clues">
        ${clues.map(([label, clue, answer]) => `<button data-action="check-crossword"><span>${label}</span><strong>${clue}</strong><small>${answer}</small></button>`).join("")}
      </div>
    </div>
    <div class="hero-actions padded"><button class="primary-btn" data-action="check-crossword">${solved ? "Puzzle Solved" : "Check Puzzle"}</button><button class="ghost-btn" data-route="wordSearch">Word Search</button></div>
  </div>`;
}

function wordSearchGameView() {
  const letters = "RADARLMVAULTDREAMORACLEPICKRESETWINMIND".slice(0, 36).split("");
  const words = ["RADAR", "VAULT", "DREAM", "ORACLE", "PICK", "RESET"];
  const marks = new Set(state.wordSearchMarks);
  const solved = loadJson(STORAGE.wordSearch, []).includes("SOLVED");
  return `<div class="panel puzzle-game word-search-game">
    <div class="section-head"><div><h2>Word Search Vault</h2><p>Find LottoMind feature words and earn arcade credits.</p></div><span>${words.length} words</span></div>
    ${solved ? `<div class="puzzle-solved-banner"><strong>Word vault solved</strong><span>Marked path saved locally.</span></div>` : ""}
    <div class="word-search-board" aria-label="LottoMind word search board">
      ${letters.map((letter, index) => `<button data-action="toggle-word-letter" data-index="${index}" class="${marks.has(index) || solved ? "active" : index % 5 === 0 ? "lit" : ""}">${letter}</button>`).join("")}
    </div>
    <div class="word-bank">
      ${words.map((word) => `<span class="${solved ? "found" : ""}">${word}</span>`).join("")}
    </div>
    <div class="hero-actions padded"><button class="primary-btn" data-action="check-word-search">${solved ? "Words Locked" : "Lock Words"}</button><button class="ghost-btn" data-route="crossword">Crossword</button></div>
  </div>`;
}

function triviaGameView() {
  const index = Math.min(state.triviaIndex, TRIVIA_QUESTIONS.length - 1);
  const question = TRIVIA_QUESTIONS[index];
  const answered = state.triviaAnswered;
  const progress = Math.round(((index + (answered ? 1 : 0)) / TRIVIA_QUESTIONS.length) * 100);
  const stored = getTriviaProgress();
  return `<section class="screen trivia-screen">
    <div class="panel art-panel trivia-hero trivia-show-hero" style="--panel-art:url('${ASSETS.commandDeck}')">
      <div>
        <span class="eyebrow">LottoMind Game Show</span>
        <h1>Trivia Rewards Live</h1>
        <p>Answer fast, build a streak, and turn arcade knowledge into credits under the LottoMind spotlight.</p>
        <div class="trivia-streak-strip"><span>Daily ${stored.dailyStreak}/7</span><span>Weekly ${stored.weeklyStreak}/7</span><span>${triviaDifficulty(index)} +${triviaRewardFor(index)}</span></div>
        <div class="hero-actions">
          <button class="primary-btn" data-action="restart-trivia">New Run</button>
          <button class="ghost-btn" data-route="arcade">Game Select</button>
        </div>
      </div>
      <div class="trivia-score-orb"><strong>${state.triviaScore}</strong><span>Score</span></div>
    </div>
    <div class="panel trivia-console trivia-game-show-console">
      <div class="trivia-status">
        <span>Question ${index + 1} / ${TRIVIA_QUESTIONS.length} · ${triviaDifficulty(index)}</span>
        <strong>${state.triviaStreak}x streak</strong>
      </div>
      <div class="trivia-progress"><i style="width:${progress}%"></i></div>
      <div class="trivia-stage-label"><span>Live Question Pod</span><b>${answered ? (answered.correct ? "Correct lock" : "Try next") : "Choose an answer"}</b></div>
      <h2>${escapeHtml(question.q)}</h2>
      <div class="trivia-options">
        ${question.options.map((option, optionIndex) => {
          const isPicked = answered?.selected === optionIndex;
          const isCorrect = answered && question.answer === optionIndex;
          const stateClass = answered ? (isCorrect ? "correct" : isPicked ? "wrong" : "muted") : "";
          return `<button class="trivia-option ${stateClass}" data-action="answer-trivia" data-answer="${optionIndex}">
            <span>${String.fromCharCode(65 + optionIndex)}</span>
            <strong>${escapeHtml(option)}</strong>
          </button>`;
        }).join("")}
      </div>
      ${answered ? `<div class="trivia-feedback ${answered.correct ? "is-correct" : "is-wrong"}">
        <strong>${answered.correct ? "Signal locked" : "Signal missed"}</strong>
        <p>${escapeHtml(question.note)}</p>
      </div>
      <button class="primary-btn full" data-action="${index >= TRIVIA_QUESTIONS.length - 1 ? "claim-trivia-reward" : "next-trivia"}">${index >= TRIVIA_QUESTIONS.length - 1 ? "Claim Reward" : "Next Question"}</button>` : ""}
    </div>
  </section>`;
}

function triviaRewardsView() {
  const reward = Math.max(25, Math.round(state.triviaScore / 12));
  const progress = getTriviaProgress();
  return `<section class="screen trivia-screen">
    <div class="panel art-panel trivia-hero reward-hero trivia-show-hero" style="--panel-art:url('${ASSETS.commandDeck}')">
      <div>
        <span class="eyebrow">Arcade Reward Vault</span>
        <h1>Winner's Credit Stage</h1>
        <p>Your trivia lane is live. Run another round, redeem credits, or protect your streak.</p>
        <div class="trivia-streak-strip"><span>Daily ${progress.dailyStreak}/7</span><span>Weekly ${progress.weeklyStreak}/7</span><span>${getCredits()} credits</span></div>
        <div class="hero-actions">
          <button class="primary-btn" data-route="triviaPlay">Play Trivia</button>
          <button class="ghost-btn" data-route="arcade">Arcade</button>
          <button class="ghost-btn" data-route="marketplace">Redeem Credits</button>
        </div>
      </div>
      <div class="trivia-score-orb"><strong>${reward}</strong><span>Credit lane</span></div>
    </div>
    <div class="panel trivia-console trivia-reward-panel trivia-game-show-console">
      <div class="section-head"><div><h2>Reward Summary</h2><p>Credits earned from correct answers, streaks, and completion.</p></div><span>${getCredits()} credits</span></div>
      <div class="trivia-reward-grid">
        <div><span>Run Score</span><strong>${state.triviaScore}</strong></div>
        <div><span>Best Streak</span><strong>${state.triviaStreak}x</strong></div>
        <div><span>Questions</span><strong>${TRIVIA_QUESTIONS.length}</strong></div>
        <div><span>Daily Streak</span><strong>${progress.dailyStreak}</strong></div>
        <div><span>Weekly Track</span><strong>${progress.weeklyStreak}/7</strong></div>
        <div><span>History</span><strong>${progress.history.length}</strong></div>
      </div>
      <div class="hero-actions padded"><button class="ghost-btn" data-action="watch-rewarded-ad">Reward Boost</button><button class="ghost-btn" data-action="use-streak-saver">Streak Saver</button><button class="ghost-btn" data-action="activate-credit-booster">Double Credits</button></div>
      <button class="primary-btn full" data-action="restart-trivia">Start New Trivia Run</button>
    </div>
  </section>`;
}

function triviaGameView() {
  const index = Math.min(state.triviaIndex, TRIVIA_QUESTIONS.length - 1);
  const question = TRIVIA_QUESTIONS[index];
  const answered = state.triviaAnswered;
  const stored = getTriviaProgress();
  const difficulty = triviaDifficulty(index);
  const reward = triviaRewardFor(index);
  const progress = Math.round(((index + (answered ? 1 : 0)) / TRIVIA_QUESTIONS.length) * 100);
  return `<section class="screen trivia-screen">
    <div class="panel art-panel trivia-hero trivia-show-hero" style="--panel-art:url('${ASSETS.commandDeck}')">
      <div>
        <span class="eyebrow">LottoMind Game Show</span>
        <h1>Trivia Rewards Live</h1>
        <p>Answer fast, build a streak, and turn arcade knowledge into Lotto Credits.</p>
        <div class="trivia-streak-strip"><span>Lotto Credits ${getCredits()}</span><span>Daily ${stored.dailyStreak}/7</span><span>Weekly ${stored.weeklyStreak}/7</span><span>${difficulty} +${reward}</span></div>
        <div class="hero-actions">
          <button class="primary-btn" data-action="restart-trivia">New Run</button>
          <button class="ghost-btn" data-route="arcade">Game Select</button>
          <button class="ghost-btn" data-route="triviaRewards">Redeem</button>
        </div>
      </div>
      <div class="trivia-score-orb"><strong>${state.triviaScore}</strong><span>Score</span></div>
    </div>
    <div class="panel trivia-console trivia-game-show-console">
      <div class="trivia-status">
        <span>Question ${index + 1} / ${TRIVIA_QUESTIONS.length} &middot; ${difficulty} &middot; +${reward} credits</span>
        <strong>${state.triviaStreak}x streak</strong>
      </div>
      <div class="trivia-progress"><i style="width:${progress}%"></i></div>
      <div class="trivia-stage-label"><span>Live Question Pod</span><b>${answered ? (answered.correct ? "Correct lock" : "Try next") : "Choose an answer"}</b></div>
      <h2>${escapeHtml(question.q)}</h2>
      <div class="trivia-options">
        ${question.options.map((option, optionIndex) => {
          const isPicked = answered?.selected === optionIndex;
          const isCorrect = answered && question.answer === optionIndex;
          const stateClass = answered ? (isCorrect ? "correct" : isPicked ? "wrong" : "muted") : "";
          return `<button class="trivia-option ${stateClass}" data-action="answer-trivia" data-answer="${optionIndex}">
            <span>${String.fromCharCode(65 + optionIndex)}</span>
            <strong>${escapeHtml(option)}</strong>
          </button>`;
        }).join("")}
      </div>
      ${answered ? `<div class="trivia-feedback ${answered.correct ? "is-correct" : "is-wrong"}">
        <strong>${answered.correct ? `Signal locked +${reward}` : "Signal missed"}</strong>
        <p>${escapeHtml(question.note)}</p>
      </div>
      <button class="primary-btn full" data-action="${index >= TRIVIA_QUESTIONS.length - 1 ? "claim-trivia-reward" : "next-trivia"}">${index >= TRIVIA_QUESTIONS.length - 1 ? "Claim Reward" : "Next Question"}</button>` : ""}
    </div>
  </section>`;
}

function triviaRewardsView() {
  const reward = Math.max(25, Math.round(state.triviaScore / 12));
  const progress = getTriviaProgress();
  const dailyPct = Math.min(100, Math.round((progress.dailyStreak / 7) * 100));
  const weeklyPct = Math.min(100, Math.round((progress.weeklyStreak / 7) * 100));
  return `<section class="screen trivia-screen">
    <div class="panel art-panel trivia-hero reward-hero trivia-show-hero" style="--panel-art:url('${ASSETS.commandDeck}')">
      <div>
        <span class="eyebrow">LottoMind Trivia Home</span>
        <h1>Lotto Credits</h1>
        <p>Play the daily challenge, stack streak bonuses, and spend credits on premium LottoMind unlocks.</p>
        <div class="trivia-streak-strip"><span>Daily ${progress.dailyStreak}/7</span><span>Weekly ${progress.weeklyStreak}/7</span><span>${getCredits()} credits</span></div>
        <div class="hero-actions">
          <button class="primary-btn" data-route="triviaPlay">Start Trivia</button>
          <button class="ghost-btn" data-route="arcade">Arcade</button>
          <button class="ghost-btn" data-route="marketplace">Redeem Credits</button>
        </div>
      </div>
      <div class="trivia-score-orb"><strong>${reward}</strong><span>Credit lane</span></div>
    </div>
    <div class="trivia-home-grid">
      <div class="panel streak-card">
        <span class="eyebrow">Daily Challenge</span>
        <h2>5 Questions</h2>
        <p>Easy, medium, and hard questions pay 10, 25, and 50 credits.</p>
        <button class="primary-btn full" data-action="restart-trivia">Start Trivia</button>
      </div>
      <div class="panel streak-card">
        <span class="eyebrow">Daily Streak</span>
        <h2>${progress.dailyStreak} days</h2>
        <div class="progress-rail"><i style="width:${dailyPct}%"></i></div>
        <p>3-day streak bonus: +50 credits.</p>
      </div>
      <div class="panel streak-card">
        <span class="eyebrow">Weekly Streak</span>
        <h2>${progress.weeklyStreak}/7</h2>
        <div class="progress-rail"><i style="width:${weeklyPct}%"></i></div>
        <p>7-day weekly bonus: +200 credits.</p>
      </div>
      <div class="panel streak-card">
        <span class="eyebrow">Leaderboard</span>
        <h2>Preview Lane</h2>
        <p>Local board tracks recent runs. Cloud ranking can plug in later.</p>
        <button class="ghost-btn full" data-route="community">Open Community</button>
      </div>
    </div>
    <div class="panel trivia-console trivia-reward-panel trivia-game-show-console">
      <div class="section-head"><div><h2>Reward Summary</h2><p>Credits earned from correct answers, streaks, and completion.</p></div><span>${getCredits()} credits</span></div>
      <div class="trivia-reward-grid">
        <div><span>Run Score</span><strong>${state.triviaScore}</strong></div>
        <div><span>Best Streak</span><strong>${state.triviaStreak}x</strong></div>
        <div><span>Questions</span><strong>${TRIVIA_QUESTIONS.length}</strong></div>
        <div><span>Daily Streak</span><strong>${progress.dailyStreak}</strong></div>
        <div><span>Weekly Track</span><strong>${progress.weeklyStreak}/7</strong></div>
        <div><span>History</span><strong>${progress.history.length}</strong></div>
      </div>
      <div class="hero-actions padded"><button class="ghost-btn" data-action="watch-rewarded-ad">Reward Boost</button><button class="ghost-btn" data-action="use-streak-saver">Streak Saver</button><button class="ghost-btn" data-action="activate-credit-booster">Double Credits</button></div>
      <button class="primary-btn full" data-action="restart-trivia">Start New Trivia Run</button>
    </div>
    <div class="panel">
      <div class="section-head"><div><h2>Redeem Credits</h2><p>Premium unlocks persist locally. 24-hour lanes expire automatically.</p></div><span>${FEATURE_UNLOCKS.length} unlocks</span></div>
      <div class="unlock-shop-grid">
        ${FEATURE_UNLOCKS.map((item) => `<button class="store-card ${isUnlocked(item.id) ? "unlocked" : ""}" data-action="unlock-feature" data-unlock="${item.id}">
          <strong>${item.title}</strong><span>${item.window}</span><small>${isUnlocked(item.id) ? "Unlocked" : `${item.cost} credits`}</small>
        </button>`).join("")}
      </div>
      <p class="tiny-note">LottoMind does not guarantee winnings. Trivia rewards and AI insights are for entertainment and education only.</p>
    </div>
  </section>`;
}

function psychicView() {
  const reading = state.currentPsychic;
  return `<section class="screen">
    <div class="panel art-panel" style="--panel-art:url('${ASSETS.psychic}')">
      <h1>AI Psychic Engine</h1>
      <p>Entertainment reading with suggested numbers, energy score, and play window.</p>
      <textarea class="dream-input compact" data-bind="dreamText">${escapeHtml(state.dreamText)}</textarea>
      <button class="primary-btn full" data-action="psychic-fusion">Generate Reading</button>
    </div>
    ${reading ? psychicResultCard(reading) : ""}
  </section>`;
}

function psychicResultCard(reading) {
  return `<div class="panel result-card psychic-card">
    <span>${reading.luckCycle} - ${reading.energyScore}% energy</span>
    <h2>${escapeHtml(reading.title)}</h2>
    <p>${escapeHtml(reading.message)}</p>
    ${ballsHtml(reading.suggestedNumbers, reading.bonusNumber)}
    <p>Pick 3: ${reading.pick3} | Pick 4: ${reading.pick4} | Best window: ${reading.bestPlayWindow}</p>
    <small>For entertainment only. Lottery outcomes are random.</small>
  </div>`;
}

const REAL_ROUTE_SCREENS = {
  vip: {
    eyebrow: "VIP Intelligence",
    title: "VIP Lucky Insights",
    copy: "A premium command room for saved unlocks, stronger AI prompts, and high-signal play notes.",
    unlock: "vip-insights",
    art: ASSETS.commandDeck,
    stats: [["Status", "Premium"], ["Cost", "2000"], ["Mode", "Insights"]],
    actions: [["Unlock VIP", "unlock-feature", "vip-insights"], ["Open AI Coach", "route", "ai"], ["Redeem Credits", "route", "triviaRewards"]],
  },
  community: {
    eyebrow: "LottoMind Social",
    title: "Community Board",
    copy: "Leaderboard preview, local streaks, saved challenge scores, and future community prompts.",
    art: ASSETS.arcade,
    stats: [["Leaderboard", "Local"], ["Streaks", getTriviaProgress().dailyStreak], ["Credits", getCredits()]],
    actions: [["Play Trivia", "route", "triviaPlay"], ["Open Contests", "route", "contests"], ["View Rewards", "route", "triviaRewards"]],
  },
  contests: {
    eyebrow: "Reward Events",
    title: "Contest Control",
    copy: "Daily challenge slots, jackpot reality drills, and future opt-in sweepstakes live here.",
    art: ASSETS.arcade,
    stats: [["Daily Run", "Ready"], ["Entries", loadJson(STORAGE.triviaHistory, { history: [] }).history.length], ["Rules", "Demo"]],
    actions: [["Start Daily", "route", "triviaPlay"], ["Leaderboard", "route", "community"], ["Rewards", "route", "triviaRewards"]],
  },
  achievements: {
    eyebrow: "Player Progress",
    title: "Achievements",
    copy: "Milestone badges for trivia streaks, puzzle solves, saved stores, and unlocked premium lanes.",
    art: ASSETS.arcadeCoin,
    stats: [["Trivia Runs", getTriviaProgress().history.length], ["Crossword", state.crosswordSolved ? "Solved" : "Open"], ["Stores", storeFavorites().length]],
    actions: [["Trivia Rewards", "route", "triviaRewards"], ["Crossword", "route", "crossword"], ["Favorites", "route", "storeLocator"]],
  },
  usLottery: {
    eyebrow: "National Lottery Desk",
    title: "US Lottery Map",
    copy: "State pins, retailer signals, game lanes, and official-link placeholders grouped by region.",
    art: ASSETS.radar,
    stats: [["Pinned", state.selectedState], ["States", STATE_PINS.length], ["Stores", STORE_DIRECTORY.length]],
    actions: [["Store Locator", "route", "storeLocator"], ["Live Results", "route", "live"], ["Signal Radar", "route", "heatmap"]],
  },
  notifications: {
    eyebrow: "Alert Console",
    title: "Notifications",
    copy: "Draw reminders, streak nudges, saved store notes, and unlock-expiry messages in one place.",
    art: ASSETS.live,
    stats: [["Draw Alert", "Ready"], ["Streak", getTriviaProgress().dailyStreak], ["Unlocks", Object.keys(getUnlocks()).length]],
    actions: [["Draw Alerts", "route", "live"], ["Trivia Streak", "route", "triviaRewards"], ["Settings", "route", "settings"]],
  },
  onboarding: {
    eyebrow: "Start Path",
    title: "LottoMind Onboarding",
    copy: "Reset your tone, speak a dream, check radar, save a run, then learn with trivia.",
    art: ASSETS.home,
    stats: [["Step 1", "Reset"], ["Step 2", "Dream"], ["Step 3", "Radar"]],
    actions: [["Begin Reset", "route", "reset"], ["Dream Oracle", "route", "dreams"], ["Power Tools", "route", "powertools"]],
  },
  splash: {
    eyebrow: "Launch Screen",
    title: "LottoMind Oracle",
    copy: "A branded app entry with direct paths to the real home, store locator, and arcade.",
    art: ASSETS.logo,
    stats: [["Build", "Web"], ["Mode", state.viewMode.toUpperCase()], ["Credits", getCredits()]],
    actions: [["Enter App", "route", "dashboard"], ["Store Locator", "route", "storeLocator"], ["Arcade", "route", "arcade"]],
  },
  thankYou: {
    eyebrow: "Checkout Complete",
    title: "Thank You",
    copy: "Demo checkout is confirmed locally. Real payments can be connected later without changing the flow.",
    art: ASSETS.credit,
    stats: [["Order", "Demo"], ["Credits", getCredits()], ["Vault", "Saved"]],
    actions: [["Open Merch", "route", "store"], ["Wallet", "route", "wallet"], ["Home", "route", "dashboard"]],
  },
  original: {
    eyebrow: "Legacy Mode",
    title: "Original LottoMind",
    copy: "A clean bridge back to the original feature lanes without dumping users into a generic tool page.",
    art: ASSETS.power,
    stats: [["Oracle", "Ready"], ["Arcade", "Ready"], ["Radar", "Ready"]],
    actions: [["Dream Oracle", "route", "dreams"], ["Power Tools", "route", "powertools"], ["History Vault", "route", "history"]],
  },
  help: {
    eyebrow: "How To Use",
    title: "Help Center",
    copy: "Learn the core flow: choose a game, generate a set, verify signals, save to vault, and play responsibly.",
    art: ASSETS.home,
    stats: [["Flow", "5 steps"], ["Privacy", "Local"], ["Support", "Demo"]],
    actions: [["Onboarding", "route", "onboarding"], ["Policies", "route", "policies"], ["Settings", "route", "settings"]],
  },
  policies: {
    eyebrow: "Policy Lane",
    title: "Privacy + Responsible Play",
    copy: "Location helps find stores, credits are demo rewards, and LottoMind does not guarantee winning numbers.",
    art: ASSETS.live,
    stats: [["Location", "Optional"], ["Credits", "Demo"], ["Data", "Local"]],
    actions: [["Help", "route", "help"], ["Settings", "route", "settings"], ["Home", "route", "dashboard"]],
  },
  paywall: {
    eyebrow: "Premium Gate",
    title: "Unlock LottoMind Pro",
    copy: "Use Lotto Credits now, then connect Stripe, Apple IAP, Android Billing, or subscriptions later.",
    art: ASSETS.credit,
    stats: [["Credits", getCredits()], ["VIP", isUnlocked("vip-insights") ? "Open" : "Locked"], ["Payments", "Placeholder"]],
    actions: [["Redeem Credits", "route", "triviaRewards"], ["VIP Unlock", "unlock-feature", "vip-insights"], ["Marketplace", "route", "marketplace"]],
  },
};

function routeActionButton([label, mode, value], index) {
  const cls = index === 0 ? "primary-btn" : "ghost-btn";
  if (mode === "route") return `<button class="${cls}" data-route="${value}">${label}</button>`;
  if (mode === "unlock-feature") return `<button class="${cls}" data-action="unlock-feature" data-unlock="${value}">${label}</button>`;
  return `<button class="${cls}" data-action="${mode}">${label}</button>`;
}

function lockedFeatureOverlay(config) {
  if (!config.unlock || isUnlocked(config.unlock)) return "";
  const unlock = FEATURE_UNLOCKS.find((item) => item.id === config.unlock);
  if (!unlock) return "";
  return `<div class="panel locked-feature-overlay">
    <span class="eyebrow">Premium feature locked</span>
    <h2>${unlock.title}</h2>
    <p>${unlock.window}. Unlock with Lotto Credits or use the subscription placeholder later.</p>
    <div class="hero-actions padded">
      <button class="primary-btn" data-action="unlock-feature" data-unlock="${unlock.id}">Unlock for ${unlock.cost}</button>
      <button class="ghost-btn" data-action="subscribe-pro">Subscribe</button>
      <button class="ghost-btn" data-route="triviaRewards">Earn Credits</button>
    </div>
  </div>`;
}

function realRouteView(routeKey) {
  const config = REAL_ROUTE_SCREENS[routeKey] || REAL_ROUTE_SCREENS.original;
  const routeUnlocked = !config.unlock || isUnlocked(config.unlock);
  return `<section class="screen feature-route-screen route-real-${routeKey}">
    <div class="panel art-panel feature-route-hero" style="--panel-art:url('${config.art}')">
      <div>
        <span class="eyebrow">${config.eyebrow}</span>
        <h1>${config.title}</h1>
        <p>${config.copy}</p>
        <div class="hero-actions">${config.actions.map(routeActionButton).join("")}</div>
      </div>
      <div class="feature-status-orb"><strong>${routeUnlocked ? "ON" : "LOCK"}</strong><span>${routeUnlocked ? "Ready" : "Credits"}</span></div>
    </div>
    ${lockedFeatureOverlay(config)}
    <div class="feature-route-grid">
      ${config.stats.map(([label, value]) => metricCard(label, value)).join("")}
    </div>
    <div class="panel related-panel">
      <div class="section-head"><div><h2>Connected Lanes</h2><p>This screen now points to real LottoMind routes instead of the generic tool fallback.</p></div><span>${routeUnlocked ? "Ready" : "Preview"}</span></div>
      <div class="sound-route-bento compact">
        ${["dashboard", "powertools", "storeLocator", "triviaRewards", "marketplace"].map((route, index) => {
          const [title, copy] = routeMeta(route);
          return `<button class="sound-route-card" data-route="${route}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${title}</strong><small>${copy}</small></button>`;
        }).join("")}
      </div>
    </div>
  </section>`;
}

function genericToolView(routeKey) {
  const labels = {
    ai: ["LottoMind AI", "Generate smart picks, run analysis, and save the result."],
    lottoIntel: ["Lotto Intelligence", "Deep analysis, report cards, and trend education."],
    pickGames: ["Pick Games", "Straight, box, mirror, and daily digit helpers."],
    studio: ["Sonic Studio", "Record dream songs, lucky chants, and frequency-inspired demos."],
    music: ["Music Hub", "Branded sound sessions and reset playlists."],
    dreamVideo: ["Dream Video Studio", "Create storyboard-ready dream visuals from the Oracle text."],
    horoscope: ["Horoscope", "Daily sign cue and symbolic number lane."],
    luckyWeather: ["Lucky Weather", "Weather-linked number cues by state."],
    storeLocator: ["Store Locator", "Pinned state retailer and play reminders."],
    store: ["Official Merch Store", "Gear, guides, and branded unlocks."],
    creditStore: ["Credit Store", "Buy local demo credits for premium tools."],
    dailyFortune: ["Daily Fortune Drop", "One daily psychic-style signal."],
    luckProfile: ["Luck Profile", "Your saved stats, streaks, and patterns."],
    futureRead: ["Future Read Mode", "A symbolic forecast seeded from your prompt."],
    nameNumbers: ["Name Numbers", "Convert names into number patterns."],
    intelligence: ["Intelligence Analysis", "Context-aware pattern and smart pick review."],
    intelligenceLocker: ["Intelligence Locker", "Saved AI analysis, guarded signals, and premium pattern notes."],
    predictions: ["Predictions", "Lock generated sets and grade them against demo draw results."],
    jackpot: ["Jackpot Reality", "Estimate cash, annuity, tax pressure, and safer budget context."],
    wheelBuilder: ["Wheel Builder", "Build small coverage wheels from your selected number pool."],
    newsRadar: ["News Radar", "Draw delay, matrix change, jackpot movement, and saved-game alerts."],
    marketplace: ["Marketplace", "Credits, VIP tools, creator unlocks, and LottoMind guides."],
    policies: ["Policies", "Privacy, terms, accessibility, and responsible play notes."],
    proPlaybook: ["Pro Playbook", "Strategy lessons, matrix notes, and responsible play education."],
    challenges: ["Challenges", "Daily tasks, streaks, arcade missions, and credit rewards."],
    game: ["Jackpot Run", "The arcade runner route with reward-game hooks."],
    nationwide: ["Nationwide Analysis", "State and national draw overview."],
    detailedReport: ["Detailed Report", "A saved analysis summary from the current game."],
    records: ["LottoMind Records", "Saved results and report cards."],
    historical: ["Historical Lab", "Longer-range sample review."],
    gamesHub: ["Games Hub", "All arcade and reward game routes."],
    achievements: ["Achievements", "Daily tasks and credit rewards."],
    vip: ["VIP", "Premium unlock and member perks."],
    community: ["Community", "Share saved sets and reading cards."],
    contests: ["Contests", "Challenge cards and future entries."],
    cardGame: ["Card Game", "Flip cards for number memory practice."],
    ludo: ["Ludo", "Board-game reward lane."],
    crossword: ["Crossword", "Word puzzle and number clues."],
    wordSearch: ["Word Search", "Find dream symbols and earn credits."],
    triviaPlay: ["Trivia Play", "Answer LottoMind questions."],
    triviaRewards: ["Trivia Rewards", "Redeem earned credits."],
    triviaRedeem: ["Trivia Redeem", "Use arcade rewards."],
    usLottery: ["US Lottery", "State draw index."],
    notifications: ["Alerts", "Saved-state and draw reminders."],
    help: ["Help", "Guide and support center."],
    liveData: ["Live Data", "Realtime-ready draw and jackpot lanes."],
    heatmapAnalytics: ["Heatmap Analytics", "Deeper hot/cold trend view."],
    savedWallet: ["Saved Wallet", "Saved sets and credits together."],
    ticketScanner: ["Ticket Scanner", "Ticket scan tools."],
    energyMeter: ["Energy Meter", "Signal score, frequency mood, and play-readiness gauge."],
    radioStation: ["Radio Station", "LottoMind Records live audio lane."],
    onboarding: ["Onboarding", "First-run path for setup, state pin, and feature tour."],
    splash: ["Splash", "Branded app launch surface."],
    paywall: ["Premium Gate", "VIP unlocks, credit packs, and premium routes."],
    thankYou: ["Thank You", "Purchase and signup confirmation surface."],
    original: ["Original App", "Legacy reference route kept connected."],
  };
  const [title, copy] = labels[routeKey] || ["LottoMind Tool", "This function is wired to the new Oracle app action system."];
  const set = generateLottoSet(state.gameId, routeKey.includes("fortune") || routeKey.includes("future") ? "dream" : state.strategy, routeKey);
  const extra = specialToolBody(routeKey, set);
  const related = relatedTools(routeKey);
  const extraFirst = routeKey === "energyMeter";
  return `<section class="screen">
    <div class="panel art-panel feature-console" style="--panel-art:url('${toolArt(routeKey)}')">
      <div>
        <span class="eyebrow">${title.includes("Tool") ? "Tool Console" : "Custom Screen"}</span>
        <h1>${title}</h1>
        <p>${copy}</p>
        <div class="hero-actions">
          <button class="primary-btn" data-action="generate-set">Run Function</button>
          <button class="ghost-btn" data-route="history">Open Vault</button>
        </div>
      </div>
      <button class="console-orb state-orb" data-action="cycle-state" aria-label="Select state pin"><img src="${ASSETS.logo}" alt="" /><span>${state.selectedState}</span></button>
    </div>
    ${extraFirst ? extra : ""}
    <div class="panel result-card">
      <span>Function output</span>
      ${ballsHtml(set.numbers, set.special, set.specialName)}
      <p>${set.note}</p>
    </div>
    ${extraFirst ? "" : extra}
    <div class="panel related-panel">
      <div class="section-head"><div><h2>Next Best Actions</h2><p>Logical buttons connected to this feature.</p></div></div>
      <div class="circle-carousel">${related.map(([label, sub, route], index) => circleTool(label, sub, route, index)).join("")}</div>
    </div>
  </section>`;
}

function toolArt(routeKey) {
  if (["music", "studio", "energyMeter", "reset"].includes(routeKey)) return ASSETS.music;
  if (["dreamVideo", "viralStudio", "psychic", "dailyFortune", "futureRead", "nameNumbers"].includes(routeKey)) return ASSETS.dream;
  if (["records", "historical", "liveData", "live", "newsRadar", "heatmapAnalytics", "lottoIntel", "intelligence"].includes(routeKey)) return ASSETS.live;
  if (["marketplace", "creditStore", "savedWallet", "store", "storeLocator", "paywall", "vip", "thankYou"].includes(routeKey)) return ASSETS.credit;
  if (["arcadeGame", "game", "gamesHub", "cardGame", "ludo", "crossword", "wordSearch", "triviaPlay", "triviaRewards", "triviaRedeem"].includes(routeKey)) return ASSETS.arcade;
  if (["sequence", "pickGames", "dailyTools", "numberGenerator", "predictions", "wheelBuilder"].includes(routeKey)) return ASSETS.sequence;
  if (["onboarding", "splash", "profile", "settings", "notifications", "help", "policies", "community", "contests", "usLottery", "original"].includes(routeKey)) return ASSETS.mascot;
  return ASSETS.powerTools;
}

function relatedTools(routeKey) {
  if (["dreamVideo", "studio", "psychic", "dailyFortune", "futureRead", "nameNumbers"].includes(routeKey)) {
    return [["Dream Oracle", "Interpret", "dreams"], ["Sonic Studio", "Record", "studio"], ["Reset Vault", "Focus", "reset"], ["History Vault", "Save", "history"], ["Power Tools", "Run", "powertools"]];
  }
  if (["jackpot", "wheelBuilder", "predictions", "newsRadar", "liveData", "records", "historical"].includes(routeKey)) {
    return [["Heatmap", "Radar", "heatmap"], ["Live Results", "Draws", "live"], ["Number Generator", "Build", "numberGenerator"], ["History Vault", "Save", "history"]];
  }
  if (["energyMeter", "music", "radioStation"].includes(routeKey)) {
    return [["Radio Station", "Listen", "radioStation"], ["Sonic Studio", "Record", "studio"], ["Reset Vault", "Tone", "reset"], ["Dream Oracle", "Speak", "dreams"], ["History Vault", "Save", "history"]];
  }
  if (["marketplace", "creditStore", "savedWallet", "vip"].includes(routeKey)) {
    return [["Credit Vault", "Balance", "wallet"], ["Store", "Gear", "store"], ["VIP", "Upgrade", "vip"], ["Profile", "Stats", "profile"]];
  }
  return [["Power Tools", "Command", "powertools"], ["Generator", "Numbers", "numberGenerator"], ["Heatmap", "Radar", "heatmap"], ["History Vault", "Saved", "history"]];
}

function specialToolBody(routeKey, set) {
  if (routeKey === "help") {
    return `<div class="panel help-center-panel">
      <div class="section-head"><div><h2>How To Use LottoMind</h2><p>Follow the web-app flow without hunting through tabs.</p></div><span>Guide</span></div>
      <div class="tool-grid padded">
        ${[
          ["1 Reset", "Open Reset Vault, pick a tone, and set your state pin."],
          ["2 Dream", "Use Dream Oracle to type or speak the clearest symbols."],
          ["3 Radar", "Check Heatmap for hot, cold, active, and news alerts."],
          ["4 Generate", "Use Number Generator or Power Tools to build a set."],
          ["5 Save", "Save sets, readings, and draw checks in History Vault."],
          ["6 Arcade", "Play Trivia, Lotto Crossword, and reward games for credits."],
        ].map(([title, copy]) => `<button class="store-card" data-route="${title.includes("Reset") ? "reset" : title.includes("Dream") ? "dreams" : title.includes("Radar") ? "heatmap" : title.includes("Generate") ? "numberGenerator" : title.includes("Save") ? "history" : "arcade"}"><strong>${title}</strong><span>${copy}</span></button>`).join("")}
      </div>
      <div class="hero-actions padded">
        <button class="primary-btn" data-route="settings">Settings</button>
        <button class="ghost-btn" data-route="policies">Privacy + Policies</button>
        <button class="ghost-btn" data-route="notifications">Alerts</button>
      </div>
    </div>`;
  }
  if (routeKey === "pickGames") {
    const digits = parseNumbers(state.dailyInput).join("").slice(0, 4).padEnd(3, "7");
    const combos = digits.split("");
    const straight = combos.join("");
    const box = uniqueSorted([
      Number(combos.join("")),
      Number([...combos].reverse().join("")),
      Number([combos[1], combos[0], combos[2], combos[3]].filter(Boolean).join("")),
    ].filter(Number.isFinite));
    const mirrors = combos.map((digit) => (Number(digit) + 5) % 10);
    return `<div class="panel pick-games-panel">
      <div class="section-head"><div><h2>Pick Games Helper</h2><p>Straight, box, mirror, root, and pair helpers for daily digits.</p></div><span>${state.selectedState}</span></div>
      <label class="field-label padded">Daily Digits <input data-bind="dailyInput" value="${escapeHtml(state.dailyInput)}" maxlength="4" /></label>
      <div class="tool-grid padded">
        ${metricCard("Straight", straight)}
        ${metricCard("Box", box.join(" / ") || straight)}
        ${metricCard("Mirror", mirrors.join(""))}
        ${metricCard("Root", digitalRoot(combos.map(Number).reduce((sum, digit) => sum + digit, 0)))}
      </div>
      <div class="hero-actions padded"><button class="primary-btn" data-action="generate-daily">Generate Daily</button><button class="ghost-btn" data-route="dailyTools">Daily 3 / 4 Lab</button></div>
    </div>`;
  }
  if (routeKey === "lottoIntel" || routeKey === "ai" || routeKey === "intelligence") {
    const stats = getMatrixStats();
    const sequence = analyzeSequence(set.numbers, getGame().mainMax);
    return `<div class="panel intel-panel">
      <div class="section-head"><div><h2>Lotto Intelligence Report</h2><p>Trend, sequence, confidence, and next action logic.</p></div><span>${stats.trustScore}% signal</span></div>
      <div class="tool-grid padded">
        ${metricCard("Sum", sequence.sum)}
        ${metricCard("Root", sequence.root)}
        ${metricCard("Odd / Even", sequence.oddEven)}
        ${metricCard("High / Low", sequence.highLow)}
      </div>
      <div class="result-card compact"><span>AI Insight</span><h2>${set.gameName} ${titleCase(set.strategy)} Lane</h2>${ballsHtml(set.numbers, set.special, set.specialName)}<p>${set.note}</p></div>
      <div class="hero-actions padded"><button class="primary-btn" data-action="lock-prediction">Lock Prediction</button><button class="ghost-btn" data-route="heatmap">Open Radar</button></div>
    </div>`;
  }
  if (routeKey === "challenges") {
    return `<div class="panel oracle-function-panel challenge-board-panel">
      <div class="section-head"><div><h2>Challenge Board</h2><p>Daily arcade tasks, streak checks, and credit goals stay with Play + Learn.</p></div><span>4 tasks</span></div>
      <div class="tool-grid padded">
        ${[
          ["Trivia Run", "Answer 5 questions"],
          ["Crossword", "Solve clue lane"],
          ["Word Search", "Find 6 terms"],
          ["Radar Check", "Build one set"],
        ].map(([label, value]) => metricCard(label, value)).join("")}
      </div>
      <div class="hero-actions padded"><button class="primary-btn" data-route="triviaPlay">Start Trivia</button><button class="ghost-btn" data-route="crossword">Crossword</button><button class="ghost-btn" data-route="wordSearch">Word Search</button></div>
    </div>`;
  }
  if (["dailyFortune", "futureRead", "nameNumbers", "contests"].includes(routeKey)) {
    const reading = interpretDream(state.dreamText, state.gameId);
    const cards = routeKey === "contests"
      ? [["Daily Entry", "Ready"], ["Credit Prize", "+50"], ["Arcade Score", "Open"], ["Share Card", "Soon"]]
      : [["Oracle Tone", reading.tone], ["Lucky Window", reading.numberLogic?.playWindow || "Evening"], ["Pick 3", reading.pick3], ["Pick 4", reading.pick4]];
    const contestScale = routeKey === "contests" ? `<div class="contest-scale">
        <div><span>Entry</span><strong>Free</strong><small>Daily challenge card</small></div>
        <div><span>Top 10</span><strong>+50</strong><small>Demo credits</small></div>
        <div><span>Top 3</span><strong>+150</strong><small>Demo credits</small></div>
        <div><span>Winner</span><strong>+500</strong><small>Demo credits</small></div>
      </div>` : "";
    return `<div class="panel oracle-function-panel">
      <div class="section-head"><div><h2>${routeKey === "contests" ? "Contest Board" : "Generate Your Dreams"}</h2><p>${routeKey === "contests" ? "Challenge cards and future contest entries connected into Arcade." : "Dream text becomes numbers, tone, and shareable reveal cards."}</p></div><span>${cards.length} cards</span></div>
      <div class="tool-grid padded">${cards.map(([label, value]) => metricCard(label, value)).join("")}</div>
      ${contestScale}
      <div class="hero-actions padded"><button class="primary-btn" data-action="build-dream-video">Generate Dreams</button><button class="ghost-btn" data-route="arcade">Arcade</button><button class="ghost-btn" data-route="history">History Vault</button></div>
    </div>`;
  }
  if (routeKey === "records" || routeKey === "historical" || routeKey === "liveData") {
    const saved = loadJson(STORAGE.history, []);
    const rows = LIVE_RESULT_RECORDS.filter((item) => item.stateCode === state.selectedState || item.stateCode === "US");
    return `<div class="panel records-board">
      <div class="section-head"><div><h2>LottoMind Records</h2><p>Draw cards, saved sets, and history lanes in one place.</p></div><span>${rows.length} draw cards</span></div>
      <div class="result-list padded">
        ${rows.map((record) => `<div class="history-row record-card">
          <strong>${record.gameName} - ${record.stateName}</strong>
          ${ballsHtml(record.numbers, record.special)}
          <small>${record.drawDate} - ${record.session}${record.jackpotMillions ? ` - $${record.jackpotMillions}M` : ""}</small>
        </div>`).join("")}
      </div>
      <div class="section-head"><div><h2>Saved From App</h2><p>Sets saved from Dashboard, Sequence, Power Tools, and Dreams.</p></div><span>${saved.length} saved</span></div>
      <div class="result-list padded">
        ${saved.length ? saved.slice(0, 8).map(savedSetRow).join("") : `<p>No saved sets yet. Run a generator and tap Save to Records.</p>`}
      </div>
    </div>`;
  }
  if (routeKey === "jackpot") {
    const taxRates = { NY: 0.109, FL: 0, TX: 0, CA: 0 };
    const jackpot = 425000000;
    const cash = 198000000;
    const stateTax = cash * (taxRates[state.selectedState] ?? 0.0575);
    const federal = cash * 0.37;
    const net = Math.max(0, cash - federal - stateTax);
    return `<div class="tool-grid">
      ${metricCard("Headline", "$425M")}
      ${metricCard("Cash Value", "$198M")}
      ${metricCard(`${state.selectedState} Tax`, `$${Math.round(stateTax / 1000000)}M`)}
      ${metricCard("Est. Net", `$${Math.round(net / 1000000)}M`)}
    </div>`;
  }
  if (routeKey === "wheelBuilder") {
    const pool = uniqueSorted(parseNumbers(state.numberInput).concat(set.numbers)).slice(0, 10);
    const tickets = [];
    for (let i = 0; i < Math.min(6, pool.length); i += 1) {
      tickets.push(uniqueSorted(pool.slice(i, i + getGame().mainCount).concat(pool.slice(0, Math.max(0, getGame().mainCount - (pool.length - i))))).slice(0, getGame().mainCount));
    }
    return `<div class="panel wheel-builder-panel">
      <div class="section-head"><div><h2>Wheel Builder Engine</h2><p>Build compact coverage tickets from the current stream and generated set.</p></div><span>${pool.length} pool</span></div>
      <label class="field-label padded">Number Pool <input data-bind="numberInput" value="${escapeHtml(state.numberInput)}" placeholder="7 23 38 42 11" /></label>
      <div class="tool-grid padded">
        ${metricCard("Pool", pool.join(" / ") || "Ready")}
        ${metricCard("Tickets", tickets.length)}
        ${metricCard("Main Count", getGame().mainCount)}
        ${metricCard("Game", getGame().name)}
      </div>
      <div class="result-list padded">
        ${tickets.map((ticket, index) => `<div class="history-row wheel-ticket"><strong>Wheel Ticket ${index + 1}</strong>${ballsHtml(ticket, getGame().specialMax ? ((ticket[0] * 3) % getGame().specialMax) + 1 : undefined)}<small>Balanced coverage lane. Entertainment helper only.</small></div>`).join("")}
      </div>
      <div class="hero-actions padded"><button class="primary-btn" data-action="save-current-set">Save Wheel Seed</button><button class="ghost-btn" data-route="numberGenerator">Edit Generator</button></div>
    </div>`;
  }
  if (routeKey === "predictions") {
    const saved = loadJson(STORAGE.history, []).filter((item) => item.locked).slice(0, 5);
    return `<div class="panel"><h2>Locked Predictions</h2>${saved.length ? saved.map(savedSetRow).join("") : `<p>No locked predictions yet.</p><button class="primary-btn" data-action="lock-prediction">Lock Current Set</button>`}</div>`;
  }
  if (routeKey === "newsRadar") {
    const rows = LIVE_RESULT_RECORDS.filter((item) => item.stateCode === state.selectedState || item.stateCode === "US").slice(0, 5);
    const alerts = [
      ["Matrix Watch", "Mega Millions current-era samples stay separated from legacy rules."],
      ["Daily Games Lab Ready", "Pick 3 and Pick 4 support sums, roots, mirrors, repeats, and balance checks."],
      ["Jackpot Movement Watch", "Cash value, withholding, and net estimate are separated from headline jackpot."],
      ["Saved Games Alert Queue", "Personal alerts are ready for state, game, and draw-time preferences."],
    ];
    return `<div class="panel news-radar-panel">
      <div class="section-head"><div><h2>News Radar Live Desk</h2><p>State draw alerts, jackpot movement, and app notices.</p></div><span>${state.selectedState}</span></div>
      <div class="tool-grid padded">${metricCard("Alerts", alerts.length)}${metricCard("Draw Cards", rows.length)}${metricCard("Pinned", state.selectedState)}${metricCard("Signal", `${getMatrixStats().trustScore}%`)}</div>
      <div class="result-list padded">${alerts.map(([title, copy]) => `<div class="history-row alert-card"><strong>${title}</strong><small>${copy}</small></div>`).join("")}</div>
      <div class="result-list padded">${rows.map((record) => `<div class="history-row record-card"><strong>${record.gameName} - ${record.stateName}</strong>${ballsHtml(record.numbers, record.special)}<small>${record.drawDate} - ${record.session}${record.jackpotMillions ? ` - $${record.jackpotMillions}M` : ""}</small></div>`).join("")}</div>
      <div class="hero-actions padded"><button class="primary-btn" data-route="live">Open Live Results</button><button class="ghost-btn" data-route="notifications">Open Alerts</button></div>
    </div>`;
  }
  if (routeKey === "energyMeter") {
    const stats = getMatrixStats();
    const weather = WEATHER_SIGNALS.find((item) => item.stateCode === state.selectedState) || WEATHER_SIGNALS[0];
    const toneScore = Number(state.tone) % 100;
    const readiness = Math.min(99, Math.max(30, Math.round((stats.trustScore * 0.58) + (toneScore * 0.24) + (getCredits() > 0 ? 14 : 4))));
    return `<div class="panel energy-meter-panel">
      <div class="section-head"><div><h2>Energy Meter Console</h2><p>Frequency mood, signal confidence, and play-readiness in one gauge.</p></div><span>${readiness}% ready</span></div>
      <div class="energy-gauge" style="--energy:${readiness}%"><strong>${readiness}%</strong><span>Readiness</span></div>
      <div class="tool-grid padded">
        ${metricCard("Tone", `${state.tone} Hz`)}
        ${metricCard("Signal", `${stats.trustScore}%`)}
        ${metricCard("Weather", `${weather.temperature}F`)}
        ${metricCard("Credits", getCredits())}
      </div>
      <div class="hero-actions padded"><button class="primary-btn" data-route="reset">Tune Reset</button><button class="ghost-btn" data-route="radioStation">Radio Station</button><button class="ghost-btn" data-route="dreams">Dream Oracle</button></div>
    </div>`;
  }
  if (routeKey === "marketplace") {
    return `<div class="tool-grid">${MARKETPLACE_ITEMS.map(([title, copy, cost]) => `<button class="store-card" data-action="buy-item" data-cost="${cost}"><strong>${title}</strong><span>${copy}</span><small>${cost} credits</small></button>`).join("")}</div>`;
  }
  if (routeKey === "proPlaybook" || routeKey === "academy") {
    const lessons = ["Matrix rules before trends", "Hot and cold numbers without chasing", "Pick 3 / Pick 4 straight and box basics", "Budget-first jackpot reality", "Dream symbols as entertainment seeds"];
    return `<div class="panel"><h2>Learning Path</h2>${lessons.map((lesson, index) => `<div class="history-row"><strong>${index + 1}. ${lesson}</strong><small>Open, learn, then try the matching tool.</small></div>`).join("")}</div>`;
  }
  if (routeKey === "dreamVideo") {
    return `<div class="panel"><h2>Dream Storyboard</h2><p>${escapeHtml(state.dreamText)}</p><div class="tool-grid">${["Opening symbol", "Lucky object", "Number reveal", "Share card"].map((label) => metricCard(label, "Ready")).join("")}</div></div>`;
  }
  return "";
}

function metricCard(label, value) {
  return `<div class="metric-card"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function formatTimer(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const min = Math.floor(safe / 60);
  const sec = String(safe % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function proPlaybookView() {
  const lessons = [
    ["Straight / Box Basics", "Read Pick 3 and Pick 4 lanes without changing the game rules.", "dailyTools"],
    ["Budget Guardrails", "Set a session limit, save notes, and keep every play entertainment-only.", "settings"],
    ["Pattern Notes", "Compare sums, roots, mirrors, gaps, and odd/even balance before saving.", "sequence"],
    ["Dream Bridge", "Turn symbols into a clean number note, then send it back to the vault.", "dreams"],
  ];
  return `<section class="screen pro-playbook-screen">
    <div class="panel art-panel playbook-hero" style="--panel-art:url('${ASSETS.power}')">
      <span class="eyebrow">Pro Playbook</span>
      <h1>Strategy Playbook</h1>
      <p>Quick lessons for reading LottoMind tools, saving signals, and staying in control.</p>
      <div class="hero-actions">
        <button class="primary-btn" data-route="dailyTools">Daily Digit Lab</button>
        <button class="ghost-btn" data-route="sequence">Pattern Scanner</button>
      </div>
    </div>
    <div class="panel playbook-grid-panel">
      <div class="section-head"><div><h2>Training Cards</h2><p>Tap a module to jump back into the matching tool.</p></div><span>4 cards</span></div>
      <div class="playbook-grid">
        ${lessons.map(([title, copy, route], index) => `<button class="playbook-card" data-route="${route}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${title}</strong>
          <small>${copy}</small>
        </button>`).join("")}
      </div>
    </div>
    <div class="panel disclaimer-card playbook-note">
      <strong>Responsible Play Note</strong>
      <p>LottoMind tools are for entertainment, organization, and learning. They do not guarantee lottery outcomes.</p>
    </div>
  </section>`;
}

function renderView() {
  if (state.route === "dashboard") return dashboardView();
  if (state.route === "powertools") return powerToolsView();
  if (state.route === "reset") return resetView();
  if (state.route === "dreams" || state.route === "dreamOracle") return dreamsView();
  if (state.route === "heatmap") return heatmapView();
  if (state.route === "numberGenerator") return numberGeneratorView();
  if (state.route === "dailyTools") return dailyToolsView();
  if (state.route === "sequence") return sequenceView();
  if (state.route === "history") return historyView();
  if (state.route === "live") return liveView();
  if (state.route === "scanner" || state.route === "ticketScanner") return scannerView();
  if (state.route === "wallet" || state.route === "creditStore" || state.route === "savedWallet") return walletView();
  if (state.route === "storeLocator") return storeLocatorView();
  if (state.route === "luckyWeather" || state.route === "horoscope") return luckyWeatherView();
  if (state.route === "ai" || state.route === "lottoIntel" || state.route === "intelligence" || state.route === "intelligenceLocker") return aiCoachView();
  if (state.route === "nameNumbers") return nameNumbersView();
  if (state.route === "music" || state.route === "radioStation") return musicHubView(state.route === "radioStation");
  if (state.route === "studio") return sonicStudioView();
  if (state.route === "dreamVideo" || state.route === "viralStudio") return videoStudioView();
  if (state.route === "futureRead") return futureReadView();
  if (state.route === "proPlaybook") return proPlaybookView();
  if (state.route === "records" || state.route === "historical" || state.route === "liveData" || state.route === "historyUi") return recordsView();
  if (state.route === "marketplace") return marketplaceView();
  if (state.route === "store") return merchStoreView();
  if (state.route === "profile") return profileView();
  if (state.route === "settings") return settingsView();
  if (state.route === "triviaPlay") return triviaGameView();
  if (state.route === "triviaRewards" || state.route === "triviaRedeem") return triviaRewardsView();
  if (["arcade", "arcadeGame", "game", "cardGame", "gamesHub", "crossword", "wordSearch", "ludo"].includes(state.route)) return arcadeView();
  if (state.route === "psychic") return psychicView();
  if (["vip", "community", "contests", "achievements", "usLottery", "notifications", "onboarding", "splash", "thankYou", "original", "help", "policies", "paywall"].includes(state.route)) return realRouteView(state.route);
  return genericToolView(state.route);
}

function render() {
  document.title = "LottoMind Oracle Real App";
  const app = document.getElementById("app");
  app.innerHTML = `<div class="real-shell route-${state.route}">
    ${header()}
    ${state.route !== "dashboard" ? `<div class="history-nav-pills"><button class="back-orb" data-action="go-back" type="button" aria-label="Go back to previous page"><strong>&lsaquo;</strong><span>Back</span><small>Previous page</small></button><button class="back-orb forward-orb" data-action="go-forward" type="button" aria-label="Go forward to next page"><strong>&rsaquo;</strong><span>Forward</span><small>Next page</small></button></div>` : ""}
    ${missionHud()}
    <main class="real-main">${renderView()}</main>
    ${bottomNav()}
    ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
  </div>`;
  stopAudioIfNeeded();
  syncRouteAudio();
}

function toast(message) {
  state.toast = message;
  clearTimeout(toastId);
  toastId = setTimeout(() => {
    state.toast = "";
    render();
  }, 1800);
  render();
}

function stopAudioIfNeeded() {
  if (state.route !== "reset") {
    state.audioPlaying = false;
    stopResetTone();
    if (resetAudio) resetAudio.pause();
    stopTimer();
  } else {
    stopRouteAudio();
  }
}

function muteAllMedia(muted) {
  if (resetAudio) {
    resetAudio.muted = muted;
    if (muted) resetAudio.pause();
  }
  if (muted) stopResetTone();
  if (routeAudio) {
    routeAudio.muted = muted;
    if (muted) routeAudio.pause();
  }
  document.querySelectorAll("audio, video").forEach((media) => {
    media.muted = muted;
    if (muted && typeof media.pause === "function") media.pause();
  });
}

function ensureResetAudio() {
  if (!resetAudio) {
    resetAudio = new Audio(AUDIO.reset);
    resetAudio.loop = true;
  }
  resetAudio.volume = state.volume;
  resetAudio.muted = state.muted;
  return resetAudio;
}

function stopResetTone() {
  try {
    if (resetToneGain && resetToneContext) {
      resetToneGain.gain.cancelScheduledValues(resetToneContext.currentTime);
      resetToneGain.gain.setTargetAtTime(0.0001, resetToneContext.currentTime, 0.04);
    }
    if (resetToneOscillator) {
      resetToneOscillator.stop(resetToneContext.currentTime + 0.12);
    }
  } catch (error) {
    // Tone may already be stopped by the browser.
  }
  resetToneOscillator = null;
  resetToneGain = null;
}

function startResetTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    if (!resetToneContext || resetToneContext.state === "closed") {
      resetToneContext = new AudioContext();
    }
    stopResetTone();
    const oscillator = resetToneContext.createOscillator();
    const gainNode = resetToneContext.createGain();
    const frequency = Number(state.tone) || 528;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, resetToneContext.currentTime);
    gainNode.gain.setValueAtTime(0.0001, resetToneContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.02, Math.min(0.22, state.volume * 0.32)), resetToneContext.currentTime + 0.08);
    oscillator.connect(gainNode);
    gainNode.connect(resetToneContext.destination);
    oscillator.start();
    resetToneOscillator = oscillator;
    resetToneGain = gainNode;
    return true;
  } catch (error) {
    return false;
  }
}

function toggleResetAudio() {
  if (state.route !== "reset") return;
  state.audioPlaying = !state.audioPlaying;
  if (state.audioPlaying) {
    const started = startResetTone();
    if (!started) {
      const audio = ensureResetAudio();
      audio.play().catch(() => toast("Tap play again if the browser blocked audio."));
    }
    startTimer();
  } else {
    stopResetTone();
    if (resetAudio) resetAudio.pause();
    stopTimer();
  }
  render();
}

function startTimer() {
  stopTimer();
  state.timerRunning = true;
  timerId = setInterval(() => {
    if (state.route !== "reset") {
      stopTimer();
      return;
    }
    state.timerRemaining = Math.max(0, state.timerRemaining - 1);
    if (state.timerRemaining <= 0) {
      state.audioPlaying = false;
      stopResetTone();
      ensureResetAudio().pause();
      stopTimer();
      toast("Reset session complete");
    } else {
      const scrollY = state.route === "reset" ? window.scrollY : 0;
      render();
      if (state.route === "reset") {
        requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: "auto" }));
      }
    }
  }, 1000);
}

function stopTimer() {
  state.timerRunning = false;
  clearInterval(timerId);
}

function bindInputs(target) {
  const bind = target.getAttribute("data-bind");
  if (!bind) return;
  state[bind] = target.value;
}

function startDreamRecording() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (state.route === "dreams" || state.route === "dreamVideo" || state.route === "studio") {
      state.dreamText = `${state.dreamText} I saw water, gold, a key, and a doorway.`;
      toast("Mic not available here, so I added a sample spoken dream.");
    } else {
      toast("Mic navigation ready: type a search and press Enter if voice is blocked.");
    }
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ");
    const wantsNavigation = /\b(open|go|show|take me|navigate|switch|launch)\b/i.test(transcript);
    const isDreamCapture = state.route === "dreams" || state.route === "dreamVideo" || state.route === "studio";
    if (wantsNavigation || !isDreamCapture) {
      const route = routeFromSearch(transcript);
      const label = routeMeta(route)[0];
      state.searchQuery = transcript;
      toast(`Voice opening ${label}`);
      speakText(`Opening ${label}`);
      go(route);
      return;
    }
    state.dreamText = transcript;
    toast("Dream recorded");
    speakText("Dream recorded. Run the Oracle when ready.");
    render();
  };
  recognition.onerror = () => toast("Mic could not start. Type the dream and run it.");
  recognition.start();
  toast(state.route === "dreams" || state.route === "dreamVideo" ? "Listening for your dream..." : "Listening for app search...");
}

function speakText(message) {
  const settings = getSettings();
  if (!settings.sound || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.96;
    utterance.pitch = 0.92;
    utterance.volume = Math.min(0.86, Math.max(0.18, state.volume + 0.18));
    window.speechSynthesis.speak(utterance);
  } catch {}
}

function routeFromSearch(value) {
  const [bestMatch] = functionSearchResults(value, 1);
  if (bestMatch) return bestMatch.route;
  const query = String(value || "").toLowerCase();
  const matches = [
    [["dream", "oracle", "meaning", "journal"], "dreams"],
    [["music", "radio", "apple", "youtube", "record", "song", "audio"], "music"],
    [["weather", "local", "horoscope"], "luckyWeather"],
    [["store locator", "locator", "near", "retailer"], "storeLocator"],
    [["ticket", "scan", "scanner", "barcode", "camera"], "scanner"],
    [["ai", "coach", "smart", "predictor", "intelligence"], "ai"],
    [["name", "code"], "nameNumbers"],
    [["power", "tool", "analyzer"], "powertools"],
    [["radar", "heat", "hot", "cold"], "heatmap"],
    [["reset", "tone", "frequency", "meditation"], "reset"],
    [["sequence", "pattern", "gap", "root"], "sequence"],
    [["history", "vault", "saved", "records"], "history"],
    [["arcade", "game", "play", "contest"], "arcade"],
    [["credit", "wallet", "market", "premium"], "marketplace"],
    [["number", "generator", "pick", "cash", "powerball", "mega"], "numberGenerator"],
    [["video", "dream video", "viral"], "dreamVideo"],
    [["help", "settings", "policy", "policies"], "help"],
  ];
  const found = matches.find(([terms]) => terms.some((term) => query.includes(term)));
  return found ? found[1] : "powertools";
}

async function scanBarcodeFromFile(file) {
  if (!file || !("BarcodeDetector" in window) || typeof createImageBitmap !== "function") return "";
  try {
    const detector = new BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "upc_a", "pdf417"] });
    const bitmap = await createImageBitmap(file);
    const codes = await detector.detect(bitmap);
    if (typeof bitmap.close === "function") bitmap.close();
    return codes[0]?.rawValue || "";
  } catch {
    return "";
  }
}

function applyScanReadout(action, source, upload = "", decoded = "") {
  const result = generateLottoSet(state.gameId, "quick", decoded || source);
  const digits = ((decoded || source).match(/\d/g) || result.numbers.map(String)).slice(0, 12).join("");
  state.scanResult = {
    ...result,
    title: action === "scan-ticket" ? "Ticket image scanned" : action === "scan-barcode" ? "Barcode scan decoded" : "Scan demo complete",
    barcode: decoded || digits || "LM-DEMO-528",
    matchedGame: getGame().name,
    status: decoded ? "Barcode detected" : "Demo check only",
    confidence: decoded ? 96 : upload ? 84 : action === "scan-barcode" ? 91 : 76,
    source: upload || (action === "scan-barcode" ? "Typed barcode" : "Demo camera lane"),
    note: `${upload ? `Read ${upload}. ` : ""}${decoded ? `Detected barcode ${decoded}. ` : ""}${action === "scan-barcode" && state.barcodeInput ? `Barcode ${state.barcodeInput} decoded. ` : ""}${result.note}`,
  };
  state.currentSet = state.scanResult;
}

function handleAction(action, target) {
  if (action === "go-back") {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      go("dashboard", true);
    }
    return;
  }
  if (action === "go-forward") {
    window.history.forward();
    return;
  }
  if (action === "menu") {
    state.showUtilityMenu = !state.showUtilityMenu;
    state.showStatePicker = false;
    render();
    return;
  }
  if (action === "toggle-global-audio") {
    state.muted = !state.muted;
    muteAllMedia(state.muted);
    toast(state.muted ? "Music muted" : "Music ready");
    return;
  }
  if (action === "voice-search") {
    startDreamRecording();
    return;
  }
  if (action === "set-game") {
    state.gameId = target.getAttribute("data-game");
    localStorage.setItem("lottomind.oracle.real.game", state.gameId);
    state.currentSet = generateLottoSet(state.gameId, state.strategy, "game-change");
    render();
  }
  if (action === "set-strategy") {
    state.strategy = target.getAttribute("data-strategy");
    localStorage.setItem("lottomind.oracle.real.strategy", state.strategy);
    state.currentSet = generateLottoSet(state.gameId, state.strategy, state.strategy === "dream" ? state.dreamText : "strategy-change");
    render();
  }
  if (action === "generate-set" || action === "run-power-analysis") {
    state.currentSet = generateLottoSet(state.gameId, state.strategy, state.dreamText);
    toast(action === "run-power-analysis" ? "Power analysis complete" : "Numbers generated");
  }
  if (action === "run-ai-coach") {
    const generated = generateLottoSet(state.gameId, state.strategy, `${state.aiPrompt} ${state.dreamText}`);
    state.currentSet = generated;
    state.currentAi = {
      title: "LottoMind AI Report",
      numbers: generated.numbers,
      copy: `${generated.note} Next move: compare against Radar, then save to History Vault.`,
    };
    toast("AI coach report generated");
  }
  if (action === "analyze-name-numbers") {
    state.currentNameNumbers = nameNumberReport(state.nameInput);
    state.currentSet = {
      ...generateLottoSet(state.gameId, "dream", state.nameInput),
      numbers: state.currentNameNumbers.numbers,
      strategy: "name",
      note: `Name code ${state.currentNameNumbers.clean}: root ${state.currentNameNumbers.root}, Pick 3 ${state.currentNameNumbers.pick3}, Pick 4 ${state.currentNameNumbers.pick4}.`,
    };
    toast("Name numbers analyzed");
  }
  if (action === "save-current-set") {
    if (!state.currentSet) state.currentSet = generateLottoSet(state.gameId, state.strategy, state.dreamText);
    saveSet(state.currentSet);
  }
  if (action === "lock-prediction") {
    if (!state.currentSet) state.currentSet = generateLottoSet(state.gameId, state.strategy, state.dreamText);
    saveSet({ ...state.currentSet, locked: true, note: `${state.currentSet.note} Locked for the next demo draw.` });
  }
  if (action === "interpret-dream") {
    state.currentDream = interpretDream(state.dreamText, state.gameId);
    state.currentSet = generateLottoSet(state.gameId, "dream", state.dreamText);
    toast("Dream interpreted");
  }
  if (action === "save-dream") {
    if (!state.currentDream) {
      state.currentDream = interpretDream(state.dreamText, state.gameId);
    }
    saveDream(state.currentDream);
  }
  if (action === "psychic-fusion") {
    state.currentPsychic = generatePsychicReading({ prompt: "oracle studio fusion", dreamText: state.dreamText, game: state.gameId });
    savePsychic(state.currentPsychic);
    toast("Psychic fusion generated");
  }
  if (action === "start-dream-recording") startDreamRecording();
  if (action === "build-dream-video") {
    const alreadyInStudio = state.route === "dreamVideo";
    state.currentDream = interpretDream(state.dreamText, state.gameId);
    state.currentVideo = buildDreamVideoPlan(state.dreamText);
    if (!alreadyInStudio) {
      go("dreamVideo");
      return;
    }
    toast("Dream video storyboard built");
  }
  if (action === "save-video-storyboard") {
    if (!state.currentVideo) state.currentVideo = buildDreamVideoPlan(state.dreamText);
    saveDream({
      ...state.currentVideo.reading,
      title: "Dream Video Storyboard",
      note: `${state.currentVideo.frames.map((frame) => frame[0]).join(" > ")} | ${state.currentVideo.reading.note}`,
      savedAt: new Date().toISOString(),
    });
  }
  if (action === "analyze-sequence") {
    state.lastSequence = analyzeSequence(parseNumbers(state.numberInput), getGame().mainMax);
    toast("Sequence analyzed");
  }
  if (action === "analyze-daily") toast("Daily digits analyzed");
  if (action === "generate-daily") {
    const pick = generateLottoSet(state.dailyInput.length >= 4 ? "pick-4" : "pick-3", "balanced", "daily");
    state.dailyInput = pick.numbers.join("");
    toast("Daily digits generated");
  }
  if (action === "cycle-state") {
    state.showStatePicker = !state.showStatePicker;
    state.showUtilityMenu = false;
    render();
  }
  if (action === "select-state") {
    state.selectedState = target.getAttribute("data-state") || state.selectedState;
    state.selectedStoreId = "";
    state.showStatePicker = false;
    localStorage.setItem("lottomind.oracle.real.state", state.selectedState);
    toast(`${state.selectedState} pin selected`);
  }
  if (action === "set-merch-category") {
    state.merchCategory = target.getAttribute("data-category") || "All";
    const first = MERCH_ITEMS.findIndex((item) => state.merchCategory === "All" || item.type === state.merchCategory);
    if (first >= 0) state.selectedMerchIndex = first;
    toast(`${state.merchCategory} shelf loaded`);
  }
  if (action === "search-stores") {
    state.selectedStoreId = "";
    toast(state.storeQuery ? "Store search filtered" : "Showing nearby mock retailers");
  }
  if (action === "toggle-store-filter") {
    const filter = target.getAttribute("data-filter");
    if (filter) {
      state.activeStoreFilters = state.activeStoreFilters.includes(filter)
        ? state.activeStoreFilters.filter((item) => item !== filter)
        : state.activeStoreFilters.concat(filter);
      state.selectedStoreId = "";
      toast(`${filter} filter ${state.activeStoreFilters.includes(filter) ? "on" : "off"}`);
    }
  }
  if (action === "select-store") {
    state.selectedStoreId = target.getAttribute("data-store") || "";
    toast(`${selectedStore().name} selected`);
  }
  if (action === "toggle-store-favorite") {
    const storeId = target.getAttribute("data-store") || selectedStore().id;
    const favorites = storeFavorites();
    const next = favorites.includes(storeId) ? favorites.filter((id) => id !== storeId) : favorites.concat(storeId);
    saveJson(STORAGE.storeFavorites, next);
    toast(next.includes(storeId) ? "Store saved" : "Store removed");
  }
  if (action === "use-current-location") {
    if (!navigator.geolocation) {
      state.userLocation = { lat: 42.3314, lng: -83.0458, fallback: true };
      toast("Location unavailable. Detroit fallback loaded.");
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          state.userLocation = { lat: position.coords.latitude, lng: position.coords.longitude, fallback: false };
          toast("Location permission active");
        },
        () => {
          state.userLocation = { lat: 42.3314, lng: -83.0458, fallback: true };
          toast("Location denied. Detroit fallback loaded.");
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
      );
    }
  }
  if (action === "sync-store-backend") {
    const base = window.LOTTOMIND_API_BASE_URL || localStorage.getItem("lottomind.api.base") || "";
    if (!base) {
      toast("Backend proxy not configured. Mock retailer layer is active.");
    } else {
      const loc = state.userLocation || { lat: 42.3314, lng: -83.0458 };
      fetch(`${base.replace(/\/$/, "")}/api/store-locator/nearby?lat=${loc.lat}&lng=${loc.lng}`)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("Store backend unavailable")))
        .then(() => toast("Backend route responded. Google proxy can be connected."))
        .catch(() => toast("Backend unavailable. Mock stores preserved."));
    }
  }
  if (action === "set-view") {
    state.viewMode = target.getAttribute("data-view");
    localStorage.setItem("lottomind.oracle.real.view", state.viewMode);
    toast(`${titleCase(state.viewMode)} view selected`);
  }
  if (action === "toggle-reset-audio") toggleResetAudio();
  if (action === "load-reset-session") {
    state.tone = target.getAttribute("data-tone") || state.tone;
    state.timerRemaining = state.duration;
    toast(`${state.tone} Hz loaded in Reset`);
    if (state.route !== "reset") {
      go("reset");
      return;
    }
  }
  if (action === "connect-stream") {
    const stream = target.getAttribute("data-stream") || "Music platform";
    const url = target.getAttribute("data-url");
    const connected = loadJson(STORAGE.streams, []);
    if (!connected.includes(stream)) saveJson(STORAGE.streams, connected.concat(stream));
    if (url && typeof window.open === "function") window.open(url, "_blank", "noopener");
    toast(`${stream} connected to LottoMind Records`);
  }
  if (action === "set-tone") {
    state.tone = target.getAttribute("data-tone");
    if (resetToneOscillator && resetToneContext) {
      resetToneOscillator.frequency.setTargetAtTime(Number(state.tone) || 528, resetToneContext.currentTime, 0.03);
    }
    toast(`${state.tone} Hz loaded`);
  }
  if (action === "set-duration") {
    state.duration = Number(target.getAttribute("data-duration")) || 300;
    state.timerRemaining = state.duration;
    toast(`${Math.round(state.duration / 60)} minute session loaded`);
  }
  if (action === "volume-up" || action === "volume-down") {
    state.volume = Math.max(0.02, Math.min(0.8, state.volume + (action === "volume-up" ? 0.04 : -0.04)));
    if (resetAudio) resetAudio.volume = state.volume;
    if (resetToneGain && resetToneContext) {
      resetToneGain.gain.setTargetAtTime(Math.max(0.02, Math.min(0.22, state.volume * 0.32)), resetToneContext.currentTime, 0.03);
    }
    render();
  }
  if (action === "favorite-tone") toast(`${state.tone} Hz saved as favorite`);
  if (action === "simulate-scan" || action === "scan-ticket" || action === "scan-barcode") {
    const upload = target.files && target.files[0] ? target.files[0].name : "";
    const source = action === "scan-barcode" ? state.barcodeInput || "barcode-demo-0427" : upload || "camera-demo-ticket";
    if (action === "scan-ticket" && target.files && target.files[0]) {
      const file = target.files[0];
      scanBarcodeFromFile(file).then((decoded) => {
        applyScanReadout(action, file.name, file.name, decoded);
        toast(decoded ? "Real barcode detected from ticket image" : "No barcode found. Demo readout loaded.");
      });
      toast("Reading ticket image...");
      return;
    }
    applyScanReadout(action, source, upload);
    toast("Ticket scanner readout loaded");
  }
  if (action === "save-store") {
    const savedStores = loadJson(STORAGE.stores, []);
    if (!savedStores.includes(state.selectedState)) saveJson(STORAGE.stores, savedStores.concat(state.selectedState));
    toast(`${state.selectedState} store locator saved`);
  }
  if (action === "buy-item") {
    const cost = Number(target.getAttribute("data-cost")) || 0;
    const unlockId = target.getAttribute("data-unlock");
    if (unlockId === "credits-pack") {
      setCredits(getCredits() + 100);
      toast("Demo credit pack added: +100 credits");
    } else if (unlockId && isUnlocked(unlockId)) {
      toast("Already unlocked");
    } else {
      const next = getCredits() - cost;
      if (next < 0) {
        toast("Not enough credits");
      } else {
        setCredits(next);
        if (unlockId) saveUnlock(unlockId, unlockId.includes("24") ? "24h" : "permanent");
        toast(unlockId ? "Feature unlocked" : "Credit purchase applied");
      }
    }
  }
  if (action === "unlock-feature") {
    const unlockId = target.getAttribute("data-unlock");
    const unlock = FEATURE_UNLOCKS.find((item) => item.id === unlockId);
    if (!unlock) {
      toast("Unlock not found");
    } else if (isUnlocked(unlock.id)) {
      toast(`${unlock.title} is already unlocked`);
    } else if (getCredits() < unlock.cost) {
      toast("Not enough credits");
    } else {
      setCredits(getCredits() - unlock.cost);
      saveUnlock(unlock.id, unlock.id.includes("24") ? "24h" : "permanent");
      toast(`${unlock.title} unlocked`);
    }
  }
  if (action === "watch-rewarded-ad") {
    setCredits(getCredits() + 25);
    toast("Rewarded ad placeholder: +25 credits");
  }
  if (action === "activate-credit-booster") {
    saveUnlock("double-credit-booster", "Double Credits Booster", 0, 24);
    toast("Double credits placeholder active for 24h");
  }
  if (action === "use-streak-saver") {
    saveUnlock("streak-saver", "Streak Saver", 0, 24);
    toast("Streak saver placeholder armed");
  }
  if (action === "subscribe-pro") {
    toast("Subscription placeholder ready for Stripe/IAP");
  }
  if (action === "toggle-setting") {
    const settings = getSettings();
    const key = target.getAttribute("data-setting");
    settings[key] = !settings[key];
    saveJson(STORAGE.settings, settings);
    if (key === "music") {
      state.muted = !settings.music;
      routeAudioPlayedRoute = "";
      muteAllMedia(state.muted);
    }
    render();
  }
  if (action === "clear-history") {
    saveJson(STORAGE.history, []);
    saveJson(STORAGE.readings, []);
    saveJson(STORAGE.psychic, []);
    toast("History cleared");
  }
  if (action === "answer-trivia") {
    const question = TRIVIA_QUESTIONS[state.triviaIndex] || TRIVIA_QUESTIONS[0];
    const selected = Number(target.getAttribute("data-answer"));
    if (!state.triviaAnswered && Number.isFinite(selected)) {
      const correct = selected === question.answer;
      const reward = triviaRewardFor(state.triviaIndex);
      state.triviaAnswered = { selected, correct };
      if (correct) {
        state.triviaStreak += 1;
        state.triviaScore += reward * 4 + (state.triviaStreak - 1) * 10;
        setCredits(getCredits() + reward);
      } else {
        state.triviaStreak = 0;
      }
      toast(correct ? `Trivia signal locked: +${reward} credits` : "Try the next signal");
    }
  }
  if (action === "next-trivia") {
    state.triviaIndex = Math.min(state.triviaIndex + 1, TRIVIA_QUESTIONS.length - 1);
    state.triviaAnswered = null;
  }
  if (action === "restart-trivia") {
    state.triviaIndex = 0;
    state.triviaScore = 0;
    state.triviaStreak = 0;
    state.triviaAnswered = null;
    state.triviaComplete = false;
    if (state.route !== "triviaPlay") {
      go("triviaPlay");
      return;
    }
  }
  if (action === "claim-trivia-reward") {
    const bonus = Math.max(25, Math.round(state.triviaScore / 12));
    setCredits(getCredits() + bonus);
    const streak = completeTriviaProgress();
    state.triviaComplete = true;
    toast(`Trivia reward claimed: +${bonus + (streak.bonus || 0)} credits`);
    go("triviaRewards");
    return;
  }
  if (action === "check-crossword") {
    if (state.crosswordSolved) {
      toast("Crossword already solved");
    } else {
      state.crosswordSolved = true;
      saveJson(STORAGE.crossword, { solved: true, solvedAt: new Date().toISOString() });
      setCredits(getCredits() + 40);
      toast("Crossword validated: +40 credits");
    }
  }
  if (action === "toggle-word-letter") {
    const index = Number(target.getAttribute("data-index"));
    if (Number.isFinite(index)) {
      const solved = loadJson(STORAGE.wordSearch, []).includes("SOLVED");
      if (!solved) {
        const set = new Set(state.wordSearchMarks.filter((item) => Number.isFinite(item)));
        if (set.has(index)) set.delete(index);
        else set.add(index);
        state.wordSearchMarks = Array.from(set).sort((a, b) => a - b);
        saveJson(STORAGE.wordSearch, state.wordSearchMarks);
      }
    }
  }
  if (action === "check-word-search") {
    const saved = loadJson(STORAGE.wordSearch, []);
    if (saved.includes("SOLVED")) {
      toast("Word search already solved");
    } else if (state.wordSearchMarks.length >= 8) {
      state.wordSearchMarks = state.wordSearchMarks.concat("SOLVED");
      saveJson(STORAGE.wordSearch, state.wordSearchMarks);
      setCredits(getCredits() + 30);
      toast("Word search validated: +30 credits");
    } else {
      toast("Mark more letters before locking words");
    }
  }
  if (action === "view-merch-item") {
    const index = Number(target.getAttribute("data-merch"));
    if (Number.isFinite(index)) state.selectedMerchIndex = Math.max(0, Math.min(MERCH_ITEMS.length - 1, index));
    toast(`${MERCH_ITEMS[state.selectedMerchIndex].title} loaded`);
  }
  if (action === "add-merch-demo") {
    const item = MERCH_ITEMS[state.selectedMerchIndex] || MERCH_ITEMS[0];
    toast(`${item.title} demo checkout ready`);
  }
  if (action === "play-mini-game") {
    setCredits(getCredits() + 10);
    toast("Arcade run complete: +10 credits");
  }
  render();
}

let pointerStart = null;
let lastTouchActivation = 0;
let flowSwipe = null;
let suppressFlowClickUntil = 0;

function activateInteractiveTarget(event) {
  const eventTarget = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!eventTarget) return;
  const routeTarget = eventTarget.closest("[data-route]");
  if (routeTarget) {
    event.preventDefault();
    const arcadeRouteKeys = ["arcade", "arcadeGame", "game", "cardGame", "gamesHub", "crossword", "wordSearch", "ludo", "triviaPlay", "triviaRewards", "triviaRedeem"];
    const preserveArcadeScroll = arcadeRouteKeys.includes(state.route)
      && arcadeRouteKeys.includes(routeTarget.getAttribute("data-route"))
      && Boolean(routeTarget.closest(".real-main"))
      && !routeTarget.closest(".real-bottom-nav, .real-header");
    const scrollY = preserveArcadeScroll ? window.scrollY : 0;
    const shellScrollTop = preserveArcadeScroll ? (document.querySelector(".real-shell")?.scrollTop || 0) : 0;
    if (routeTarget.closest(".function-search-results")) speakText(`Opening ${routeMeta(routeTarget.getAttribute("data-route"))[0]}`);
    if (routeTarget.closest(".real-bottom-nav")) {
      playTabNote(tabNotes[routeTarget.getAttribute("data-tab-label")]);
    }
    stopRouteAudio();
    go(routeTarget.getAttribute("data-route"));
    if (preserveArcadeScroll) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
        const shell = document.querySelector(".real-shell");
        if (shell) shell.scrollTop = shellScrollTop;
      });
    }
    return true;
  }
  const actionTarget = eventTarget.closest("[data-action]");
  if (actionTarget) {
    const action = actionTarget.getAttribute("data-action");
    if (action === "search" || action === "scan-ticket") return false;
    const preserveResetScroll = Boolean(actionTarget.closest(".reset-screen")) && [
      "toggle-reset-audio",
      "set-tone",
      "set-duration",
      "volume-up",
      "volume-down",
      "favorite-tone",
      "load-reset-session",
    ].includes(action);
    const scrollY = preserveResetScroll ? window.scrollY : 0;
    event.preventDefault();
    stopRouteAudio();
    handleAction(action, actionTarget);
    if (preserveResetScroll) {
      requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: "auto" }));
    }
    return true;
  }
  return false;
}

document.addEventListener("pointerdown", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const flowScroller = target?.closest?.(".oracle-flow-steps");
  if (flowScroller && event.pointerType !== "touch") {
    flowSwipe = {
      scroller: flowScroller,
      startX: event.clientX,
      scrollLeft: flowScroller.scrollLeft,
      moved: false,
    };
    flowScroller.classList.add("is-swiping");
  }
  if (event.pointerType === "mouse") return;
  pointerStart = { x: event.clientX, y: event.clientY, target };
}, { passive: true });

document.addEventListener("pointermove", (event) => {
  if (!flowSwipe) return;
  const dx = event.clientX - flowSwipe.startX;
  if (Math.abs(dx) > 3) flowSwipe.moved = true;
  flowSwipe.scroller.scrollLeft = flowSwipe.scrollLeft - dx;
  event.preventDefault();
}, { passive: false });

function endFlowSwipe() {
  if (!flowSwipe) return;
  if (flowSwipe.moved) suppressFlowClickUntil = Date.now() + 360;
  flowSwipe.scroller.classList.remove("is-swiping");
  flowSwipe = null;
}

document.addEventListener("pointerup", (event) => {
  endFlowSwipe();
  if (event.pointerType === "mouse") return;
  if (pointerStart) {
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    const moved = Math.hypot(dx, dy);
    const startedInScroller = pointerStart.target?.closest?.(".quest-steps, .oracle-flow-steps, .circle-carousel, .snap-carousel, .arcade-game-grid, .merch-grid, .lm-pill-row, .state-picker, .route-leg-list, .audio-list, textarea, input");
    pointerStart = null;
    if (!startedInScroller && dx > 84 && Math.abs(dy) < 62) {
      event.preventDefault();
      stopRouteAudio();
      window.history.back();
      return;
    }
    if (moved > 12) return;
  }
  if (activateInteractiveTarget(event)) lastTouchActivation = Date.now();
}, { passive: false });

document.addEventListener("pointercancel", endFlowSwipe, { passive: true });

document.addEventListener("click", (event) => {
  if (Date.now() < suppressFlowClickUntil && (event.target instanceof Element ? event.target : event.target?.parentElement)?.closest?.(".oracle-flow-steps")) {
    event.preventDefault();
    return;
  }
  if (Date.now() - lastTouchActivation < 450) return;
  if (activateInteractiveTarget(event)) return;
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target?.closest?.(".search-pill, .function-search-results")) {
    state.searchQuery = "";
    renderFunctionSearchResults("");
  }
});

document.addEventListener("input", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const searchInput = target?.closest?.('input[data-action="search"]');
  if (searchInput) {
    state.searchQuery = searchInput.value;
    renderFunctionSearchResults(state.searchQuery);
    return;
  }
  bindInputs(event.target);
});

document.addEventListener("keydown", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const searchInput = target?.closest?.('input[data-action="search"]');
  if (!searchInput) return;
  if (event.key === "Escape") {
    state.searchQuery = "";
    searchInput.value = "";
    renderFunctionSearchResults("");
    return;
  }
  if (event.key !== "Enter") return;
  event.preventDefault();
  const route = routeFromSearch(searchInput.value);
  const label = routeMeta(route)[0];
  toast(`Opening ${label}`);
  speakText(`Opening ${label}`);
  go(route);
});

document.addEventListener("focusin", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const searchInput = target?.closest?.('input[data-action="search"]');
  if (searchInput) renderFunctionSearchResults(searchInput.value);
});

document.addEventListener("change", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget) handleAction(actionTarget.getAttribute("data-action"), actionTarget);
});

window.addEventListener("popstate", () => {
  state.route = routeFromLocation();
  stopAudioIfNeeded();
  render();
});

render();
