const APP_SLUG = "/lotto%20mind%20refined";
const NATIVE_APP = Boolean(
  window.Capacitor?.isNativePlatform?.()
  || window.location.protocol === "capacitor:"
  || (window.location.hostname === "localhost" && !window.location.port),
);
const BASE = (() => {
  if (window.__LOTTOMIND_BASE__) return window.__LOTTOMIND_BASE__;
  if (NATIVE_APP) return ".";
  const path = window.location.pathname;
  const slugIndex = path.indexOf(APP_SLUG);
  return slugIndex >= 0 ? path.slice(0, slugIndex + APP_SLUG.length) : APP_SLUG;
})();
const ROOT = window.__LOTTOMIND_ROOT__ ?? BASE.replace(/\/lotto%20mind%20refined$/i, "");
const WEBSITE_BASE = NATIVE_APP
  ? "https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io"
  : `${ROOT}/lottominded-ultra.io`;
const PRODUCTION_MODE = true;

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
  psychic: `${BASE}/assets/custom/studio/studio-oracle-coin.png`,
  commandDeck: `${BASE}/assets/custom/generated-command-deck.webp`,
  studioBooth: `${BASE}/assets/images/dashboard-music-hub-bg.fd20530e40e09f38ef442fddd2f4a17c.png`,
  musicMotion: `${BASE}/assets/custom/studio/media/lottomind-music-hub-motion.mov`,
  turntable: `${BASE}/assets/custom/music/lottomind-turntable.svg`,
  youtubeOrb: `${BASE}/assets/custom/music/lottomind-video-orb.svg`,
  aiCoach: `${BASE}/assets/custom/ai-coach-console.svg`,
  aiNews: `${BASE}/assets/custom/ai-news-draw-news.svg`,
  paywallGate: `${BASE}/assets/custom/arcade/paywall-premium-gate.svg`,
  detroitHoodieClose: `${BASE}/assets/custom/detroit-hoodie-close.png`,
  detroitPoloClose: `${BASE}/assets/custom/detroit-polo-close.png`,
  detroitCapClose: `${BASE}/assets/custom/detroit-cap-close.png`,
  detroitCollection: `${BASE}/assets/custom/detroit-collection.png`,
  detroitPoloSmall: `${BASE}/assets/custom/detroit-polo-small.png`,
  detroitCapFront: `${BASE}/assets/custom/detroit-cap-front.png`,
  voiceCornerMic: `${BASE}/assets/custom/generated-lottomind-mic.webp`,
  searchMic: `${BASE}/assets/custom/generated-lottomind-mic.webp`,
  dreamOracleHost: `${BASE}/assets/custom/dream-oracle-host.png`,
  lmLive: `${BASE}/assets/custom/lottomind-live-lm-logo.png`,
  socialBoard: `${BASE}/assets/custom/social/lottomind-social-board.svg`,
  studioRecordsConsole: `${BASE}/assets/custom/studio/studio-records-console.png`,
  studioRecordsLogo: `${BASE}/assets/custom/studio/studio-records-logo.png`,
  studioFrequencyVault: `${BASE}/assets/custom/studio/studio-frequency-vault.png`,
  studioMicHost: `${BASE}/assets/custom/studio/studio-mic-host.png`,
  aiCoachHost: `${BASE}/assets/custom/coach/ai-coach-host.png`,
  mysticNewsBg: `${BASE}/assets/custom/news/mystic-news-bg.svg`,
  hfPowerTools: `${BASE}/assets/custom/higgsfield-fresh/lm-power-tools-panel.png`,
  hfAiMicrophone: `${BASE}/assets/custom/higgsfield-fresh/lm-ai-microphone-panel.png`,
  hfHistoryVault: `${BASE}/assets/custom/higgsfield-fresh/lm-history-vault-panel.png`,
  hfArcade: `${BASE}/assets/custom/higgsfield-fresh/lm-arcade-panel.png`,
  hfDreamOracle: `${BASE}/assets/custom/higgsfield-fresh/lm-dream-oracle-panel.png`,
  hfResetFrequency: `${BASE}/assets/custom/higgsfield-fresh/lm-reset-frequency-panel.png`,
  hfMusicStore: `${BASE}/assets/custom/higgsfield-fresh/lm-music-store-panel.png`,
  hfAcademy: `${BASE}/assets/custom/higgsfield-fresh/lm-academy-panel.png?v=nano-banana2-20260626`,
  hfMarketplace: `${BASE}/assets/custom/higgsfield-fresh/lm-marketplace-panel.png?v=nano-banana2-20260626`,
  dreamToolResetVault: `${BASE}/assets/custom/higgsfield-dream-tools/reset-vault.png?v=nano-banana2-dream-tools-20260626`,
  dreamToolDreamOracle: `${BASE}/assets/custom/higgsfield-dream-tools/dream-oracle.png?v=nano-banana2-dream-tools-20260626`,
  dreamToolAbundanceRadio: `${BASE}/assets/custom/higgsfield-dream-tools/abundance-radio.png?v=nano-banana2-dream-tools-20260626`,
  dreamToolMusicHub: `${BASE}/assets/custom/higgsfield-dream-tools/music-hub.png?v=nano-banana2-dream-tools-20260626`,
  dreamToolSonicStudio: `${BASE}/assets/custom/higgsfield-dream-tools/sonic-studio.png?v=nano-banana2-dream-tools-20260626`,
  dreamToolGenerateDreams: `${BASE}/assets/custom/higgsfield-dream-tools/generate-dreams.png?v=nano-banana2-dream-tools-20260626`,
  dreamToolDreamVideo: `${BASE}/assets/custom/higgsfield-dream-tools/dream-video.png?v=nano-banana2-dream-tools-20260626`,
  dreamToolViralStudio: `${BASE}/assets/custom/higgsfield-dream-tools/viral-studio.png?v=nano-banana2-dream-tools-20260626`,
  dreamToolPsychicEngine: `${BASE}/assets/custom/higgsfield-dream-tools/psychic-engine.png?v=nano-banana2-dream-tools-20260626`,
  dreamToolDailyFortune: `${BASE}/assets/custom/higgsfield-dream-tools/daily-fortune.png?v=nano-banana2-dream-tools-20260626`,
  dreamToolNameNumbers: `${BASE}/assets/custom/higgsfield-dream-tools/name-numbers.png?v=nano-banana2-dream-tools-20260626`,
  dreamToolFutureRead: `${BASE}/assets/custom/higgsfield-dream-tools/future-read.png?v=nano-banana2-dream-tools-20260626`,
  dreamKnobResetVault: `${BASE}/assets/custom/higgsfield-dream-knobs/reset-vault.png?v=nano-banana2-dream-knobs-20260626`,
  dreamKnobDreamOracle: `${BASE}/assets/custom/higgsfield-dream-knobs/dream-oracle.png?v=nano-banana2-dream-knobs-20260626`,
  dreamKnobAbundanceRadio: `${BASE}/assets/custom/higgsfield-dream-knobs/abundance-radio.png?v=nano-banana2-dream-knobs-20260626`,
  dreamKnobMusicHub: `${BASE}/assets/custom/higgsfield-dream-knobs/music-hub.png?v=nano-banana2-dream-knobs-20260626`,
  dreamKnobSonicStudio: `${BASE}/assets/custom/higgsfield-dream-knobs/sonic-studio.png?v=nano-banana2-dream-knobs-20260626`,
  dreamKnobGenerateDreams: `${BASE}/assets/custom/higgsfield-dream-knobs/generate-dreams.png?v=nano-banana2-dream-knobs-20260626`,
  dreamKnobDreamVideo: `${BASE}/assets/custom/higgsfield-dream-knobs/dream-video.png?v=nano-banana2-dream-knobs-20260626`,
  dreamKnobViralStudio: `${BASE}/assets/custom/higgsfield-dream-knobs/viral-studio.png?v=nano-banana2-dream-knobs-20260626`,
  dreamKnobPsychicEngine: `${BASE}/assets/custom/higgsfield-dream-knobs/psychic-engine.png?v=nano-banana2-dream-knobs-20260626`,
  dreamKnobDailyFortune: `${BASE}/assets/custom/higgsfield-dream-knobs/daily-fortune.png?v=nano-banana2-dream-knobs-20260626`,
  dreamKnobNameNumbers: `${BASE}/assets/custom/higgsfield-dream-knobs/name-numbers.png?v=nano-banana2-dream-knobs-20260626`,
  dreamKnobFutureRead: `${BASE}/assets/custom/higgsfield-dream-knobs/future-read.png?v=nano-banana2-dream-knobs-20260626`,
  powerToolNumberAnalyzer: `${BASE}/assets/custom/higgsfield-power-tools/number-analyzer.png?v=nano-banana2-power-tools-20260626`,
  powerToolTicketScanner: `${BASE}/assets/custom/higgsfield-power-tools/ticket-scanner.png?v=nano-banana2-power-tools-20260626`,
  powerToolLiveVaultHeatmap: `${BASE}/assets/custom/higgsfield-power-tools/live-vault-heatmap.png?v=nano-banana2-power-tools-20260626`,
  powerToolPatternScanner: `${BASE}/assets/custom/higgsfield-power-tools/pattern-scanner.png?v=nano-banana2-power-tools-20260626`,
  powerToolSmartPredictor: `${BASE}/assets/custom/higgsfield-power-tools/smart-predictor.png?v=nano-banana2-power-tools-20260626`,
  powerToolAiNews: `${BASE}/assets/custom/higgsfield-power-tools/ai-news.png?v=nano-banana2-power-tools-20260626`,
  powerToolLottoIntelligence: `${BASE}/assets/custom/higgsfield-power-tools/lotto-intelligence.png?v=nano-banana2-power-tools-20260626`,
  powerToolEnergyMeter: `${BASE}/assets/custom/higgsfield-power-tools/energy-meter.png?v=nano-banana2-power-tools-20260626`,
  powerToolPick34: `${BASE}/assets/custom/higgsfield-power-tools/pick-3-pick-4.png?v=nano-banana2-power-tools-20260626`,
  powerToolStraightBox: `${BASE}/assets/custom/higgsfield-power-tools/straight-box.png?v=nano-banana2-power-tools-20260626`,
  powerToolMirrorNumbers: `${BASE}/assets/custom/higgsfield-power-tools/mirror-numbers.png?v=nano-banana2-power-tools-20260626`,
  powerToolLiveResults: `${BASE}/assets/custom/higgsfield-power-tools/live-results.png?v=nano-banana2-power-tools-20260626`,
  powerToolPredictions: `${BASE}/assets/custom/higgsfield-power-tools/predictions.png?v=nano-banana2-power-tools-20260626`,
  powerToolJackpotReality: `${BASE}/assets/custom/higgsfield-power-tools/jackpot-reality.png?v=nano-banana2-power-tools-20260626`,
  powerToolWheelBuilder: `${BASE}/assets/custom/higgsfield-power-tools/wheel-builder.png?v=nano-banana2-power-tools-20260626`,
  powerToolCreditVault: `${BASE}/assets/custom/higgsfield-power-tools/credit-vault.png?v=nano-banana2-power-tools-20260626`,
  powerToolMarketplace: `${BASE}/assets/custom/higgsfield-power-tools/marketplace.png?v=nano-banana2-power-tools-20260626`,
  powerToolLottoMindRecords: `${BASE}/assets/custom/higgsfield-power-tools/lottomind-records.png?v=nano-banana2-power-tools-20260626`,
  powerToolHistoricalLab: `${BASE}/assets/custom/higgsfield-power-tools/historical-lab.png?v=nano-banana2-power-tools-20260626`,
  powerToolStoreLocator: `${BASE}/assets/custom/higgsfield-power-tools/store-locator.png?v=nano-banana2-power-tools-20260626`,
  powerToolUsLottery: `${BASE}/assets/custom/higgsfield-power-tools/us-lottery.png?v=nano-banana2-power-tools-20260626`,
  powerToolHistory: `${BASE}/assets/custom/higgsfield-power-tools/history.png?v=nano-banana2-power-tools-20260626`,
  heatmapToolNumberAnalyzer: `${BASE}/assets/custom/higgsfield-heatmap-tools/radar-number-analyzer.png?v=nano-banana2-heatmap-tools-20260626`,
  heatmapToolTicketScanner: `${BASE}/assets/custom/higgsfield-heatmap-tools/radar-ticket-scanner.png?v=nano-banana2-heatmap-tools-20260626`,
  heatmapToolLiveVaultHeatmap: `${BASE}/assets/custom/higgsfield-heatmap-tools/radar-live-vault-heatmap.png?v=nano-banana2-heatmap-tools-20260626`,
  radarRotaryCore: `${BASE}/assets/custom/generated-heatmap-art-20260809/radar-rotary-core.png`,
  radarToolDeckCore: `${BASE}/assets/custom/generated-heatmap-art-20260809/radar-tool-deck-core.png`,
  commandButtonCore: `${BASE}/assets/custom/generated-button-art-20260809/command-button-core.png`,
  frequencyToneCore: `${BASE}/assets/custom/generated-button-art-20260809/frequency-tone-core.png`,
  mainLabSurface: `${BASE}/assets/custom/generated-hud-surfaces-20260809/main-lab-surface.png`,
  arcadeTrainingSurface: `${BASE}/assets/custom/generated-hud-surfaces-20260809/arcade-training-surface.png`,
  arcadeQuestSurface: `${BASE}/assets/custom/generated-hud-surfaces-20260809/arcade-quest-surface.png`,
  arcadeHero: `${BASE}/assets/custom/generated-hud-surfaces-20260809/arcade-hero.png`,
  futureMusicStoreHero: `${BASE}/assets/custom/generated-hud-surfaces-20260809/future-music-store-hero.png`,
  futureMusicControlSurface: `${BASE}/assets/custom/generated-hud-surfaces-20260809/future-music-control-surface.png`,
  oracleFlowSonicStudio: `${BASE}/assets/custom/higgsfield-oracle-flow/sonic-studio-record-booth.png?v=nano-banana2-oracle-flow-20260626`,
  oracleFlowResetStudio: `${BASE}/assets/custom/higgsfield-oracle-flow/reset-studio.png?v=nano-banana2-oracle-flow-20260626`,
  oracleFlowDreamOracle: `${BASE}/assets/custom/higgsfield-oracle-flow/dream-oracle.png?v=nano-banana2-oracle-flow-20260626`,
  oracleFlowMusicStore: `${BASE}/assets/custom/higgsfield-oracle-flow/music-store-record-label.png?v=nano-banana2-oracle-flow-20260626`,
  oracleFlowAbundanceRadio: `${BASE}/assets/custom/higgsfield-oracle-flow/abundance-radio.png?v=nano-banana2-oracle-flow-20260626`,
  strategyBalanced: `${BASE}/assets/custom/higgsfield-strategies/balanced.png?v=nano-banana2-strategies-20260626`,
  strategyHot: `${BASE}/assets/custom/higgsfield-strategies/hot.png?v=nano-banana2-strategies-20260626`,
  strategyCold: `${BASE}/assets/custom/higgsfield-strategies/cold.png?v=nano-banana2-strategies-20260626`,
  strategyDreamSymbol: `${BASE}/assets/custom/higgsfield-strategies/dream-symbol.png?v=nano-banana2-strategies-20260626`,
  dreamActionInterpret: `${BASE}/assets/custom/generated-dream-actions-20260809/interpret-dream.png`,
  dreamActionPsychicFusion: `${BASE}/assets/custom/generated-dream-actions-20260809/psychic-fusion.png`,
  dreamActionGenerateDreams: `${BASE}/assets/custom/generated-dream-actions-20260809/generate-your-dreams.png`,
  dreamActionRecordDreamSong: `${BASE}/assets/custom/generated-dream-actions-20260809/record-dream-song.png`,
  generatorAddonWheelBuilder: `${BASE}/assets/custom/higgsfield-generator-addons/wheel-builder.png?v=nano-banana2-generator-addons-20260626`,
  generatorAddonEnergyMeter: `${BASE}/assets/custom/higgsfield-generator-addons/energy-meter.png?v=nano-banana2-generator-addons-20260626`,
  generatorAddonLottoIntel: `${BASE}/assets/custom/higgsfield-generator-addons/lotto-intelligence.png?v=nano-banana2-generator-addons-20260626`,
  recordButtonMusicStore: `${BASE}/assets/custom/higgsfield-record-buttons/open-music-store-record.png?v=nano-banana2-record-buttons-20260626`,
  recordButtonAbundanceRadio: `${BASE}/assets/custom/higgsfield-record-buttons/abundance-radio-record.png?v=nano-banana2-record-buttons-20260626`,
  recordButtonSonicStudio: `${BASE}/assets/custom/higgsfield-record-buttons/sonic-studio-record.png?v=nano-banana2-record-buttons-20260626`,
  recordButtonDreamVideo: `${BASE}/assets/custom/higgsfield-record-buttons/dream-video-record.png?v=nano-banana2-record-buttons-20260626`,
  arcadeAcademy: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-academy.png`,
  arcadeAchievements: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-achievements.png`,
  arcadeArcade: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-arcade.png`,
  arcadeChallenges: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-challenges.png`,
  arcadeCommunity: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-community.png`,
  arcadeContests: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-contests.png`,
  arcadeHelp: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-help.png`,
  arcadeJackpotRun: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-jackpot-run.png`,
  arcadeNotifications: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-notifications.png`,
  arcadePaywall: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-paywall.png`,
  arcadeProPlaybook: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-pro-playbook.png`,
  arcadeTrivia: `${BASE}/assets/custom/higgsfield-arcade-tools/arcade-trivia.png`,
  ticketScannerVideo: `${BASE}/videos/ticket-scanner-demo.mp4`,
  radarTicketScannerVideo: `${BASE}/videos/radar-ticket-scanner-tile.mp4`,
  dreamStageVideo: `${BASE}/videos/dream-oracle-bg.mp4?v=dream-bg-video-20260626`,
  oracleHeroVideo: `${BASE}/videos/lottomind-ultra-flow.mp4`,
};

const LOTTO_ULTRA_MERCH_URL = "https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/merch-store.html";
const LOTTO_ULTRA_SPHERES_URL = "https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/lottery-spheres.html#spheres";

const CATEGORY_ART = {
  power: ASSETS.hfPowerTools,
  ai: ASSETS.hfAiMicrophone,
  history: ASSETS.hfHistoryVault,
  arcade: ASSETS.hfArcade,
  dream: ASSETS.hfDreamOracle,
  music: ASSETS.hfMusicStore,
  academy: ASSETS.hfAcademy,
  marketplace: ASSETS.hfMarketplace,
  scanner: ASSETS.hfPowerTools,
  heatmap: ASSETS.heatmap,
  sequence: ASSETS.sequence,
  live: ASSETS.live,
  store: ASSETS.detroitCollection,
  wallet: ASSETS.credit,
  reset: ASSETS.hfResetFrequency,
};

const ARCADE_TOOL_ART = {
  arcade: ASSETS.arcadeArcade,
  arcadeGame: ASSETS.arcadeJackpotRun,
  academy: ASSETS.arcadeAcademy,
  proPlaybook: ASSETS.arcadeProPlaybook,
  achievements: ASSETS.arcadeAchievements,
  challenges: ASSETS.arcadeChallenges,
  contests: ASSETS.arcadeContests,
  paywall: ASSETS.arcadePaywall,
  triviaPlay: ASSETS.arcadeTrivia,
  triviaRewards: ASSETS.arcadeTrivia,
  community: ASSETS.arcadeCommunity,
  notifications: ASSETS.arcadeNotifications,
  help: ASSETS.arcadeHelp,
};

const DREAM_TOOL_ART = {
  "Reset Vault": ASSETS.dreamKnobResetVault,
  "Dream Oracle": ASSETS.dreamKnobDreamOracle,
  "Abundance Radio": ASSETS.dreamKnobAbundanceRadio,
  "Music Hub": ASSETS.dreamKnobMusicHub,
  "Sonic Studio": ASSETS.dreamKnobSonicStudio,
  "Generate Dreams": ASSETS.dreamKnobGenerateDreams,
  "Dream Video": ASSETS.dreamKnobDreamVideo,
  "Viral Studio": ASSETS.dreamKnobViralStudio,
  "Psychic Engine": ASSETS.dreamKnobPsychicEngine,
  "Daily Fortune": ASSETS.dreamKnobDailyFortune,
  "Name Numbers": ASSETS.dreamKnobNameNumbers,
  "Future Read": ASSETS.dreamKnobFutureRead,
};

const POWER_TOOL_ART = {
  "Number Analyzer": ASSETS.powerToolNumberAnalyzer,
  "Ticket Scanner": ASSETS.powerToolTicketScanner,
  "Live Vault Heatmap": ASSETS.powerToolLiveVaultHeatmap,
  "Pattern Scanner": ASSETS.powerToolPatternScanner,
  "Smart Predictor": ASSETS.powerToolSmartPredictor,
  "AI News": ASSETS.powerToolAiNews,
  "Lotto Intelligence": ASSETS.powerToolLottoIntelligence,
  "Energy Meter": ASSETS.powerToolEnergyMeter,
  "Pick 3 / Pick 4": ASSETS.powerToolPick34,
  "Straight / Box": ASSETS.powerToolStraightBox,
  "Mirror Numbers": ASSETS.powerToolMirrorNumbers,
  "Live Results": ASSETS.powerToolLiveResults,
  "Predictions": ASSETS.powerToolPredictions,
  "Jackpot Reality": ASSETS.powerToolJackpotReality,
  "Wheel Builder": ASSETS.powerToolWheelBuilder,
  "Credit Vault": ASSETS.powerToolCreditVault,
  "Marketplace": ASSETS.powerToolMarketplace,
  "LottoMind Records": ASSETS.powerToolLottoMindRecords,
  "Historical Lab": ASSETS.powerToolHistoricalLab,
  "Store Locator": ASSETS.powerToolStoreLocator,
  "US Lottery": ASSETS.powerToolUsLottery,
  "History": ASSETS.powerToolHistory,
};

const HEATMAP_TOOL_ART = {
  "Number Analyzer": ASSETS.heatmapToolNumberAnalyzer,
  "Ticket Scanner": ASSETS.heatmapToolTicketScanner,
  "Live Vault Heatmap": ASSETS.heatmapToolLiveVaultHeatmap,
};

const ORACLE_FLOW_ART = {
  "Sonic Studio / Record Booth": ASSETS.oracleFlowSonicStudio,
  "Reset Studio": ASSETS.oracleFlowResetStudio,
  "Dream Oracle": ASSETS.oracleFlowDreamOracle,
  "Music Store / Record Label": ASSETS.oracleFlowMusicStore,
  "Abundance Radio": ASSETS.oracleFlowAbundanceRadio,
};

const STRATEGY_ART = {
  balanced: ASSETS.strategyBalanced,
  hot: ASSETS.strategyHot,
  cold: ASSETS.strategyCold,
  dream: ASSETS.strategyDreamSymbol,
};

const DREAM_ACTION_ART = {
  interpretDream: ASSETS.dreamActionInterpret,
  psychicFusion: ASSETS.dreamActionPsychicFusion,
  generateDreams: ASSETS.dreamActionGenerateDreams,
  recordDreamSong: ASSETS.dreamActionRecordDreamSong,
};

const GENERATOR_ADDON_ART = {
  "Wheel Builder": ASSETS.generatorAddonWheelBuilder,
  "Energy Meter": ASSETS.generatorAddonEnergyMeter,
  "Lotto Intelligence": ASSETS.generatorAddonLottoIntel,
};

const RECORD_BUTTON_ART = {
  music: ASSETS.recordButtonMusicStore,
  radioStation: ASSETS.recordButtonAbundanceRadio,
  studio: ASSETS.recordButtonSonicStudio,
  dreamVideo: ASSETS.recordButtonDreamVideo,
};

const CATEGORY_KIND_BY_ROUTE = {
  dashboard: "dream",
  powertools: "power",
  numberGenerator: "power",
  lottoIntel: "ai",
  ai: "ai",
  scanner: "scanner",
  ticketScanner: "scanner",
  heatmap: "heatmap",
  sequence: "sequence",
  live: "live",
  records: "history",
  historical: "history",
  history: "history",
  arcade: "arcade",
  arcadeGame: "arcade",
  gamesHub: "arcade",
  triviaPlay: "arcade",
  triviaRewards: "arcade",
  achievements: "arcade",
  challenges: "arcade",
  contests: "arcade",
  dreams: "dream",
  dreamVideo: "dream",
  psychic: "dream",
  music: "music",
  radioStation: "music",
  studio: "music",
  academy: "academy",
  proPlaybook: "academy",
  help: "academy",
  marketplace: "marketplace",
  wallet: "wallet",
  store: "store",
  storeLocator: "store",
  reset: "reset",
  dailyTools: "power",
  pickGames: "power",
  predictions: "dream",
  jackpot: "live",
  wheelBuilder: "sequence",
  energyMeter: "music",
  paywall: "marketplace",
  notifications: "academy",
  usLottery: "live",
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
  ["LottoMind Frequency", `${BASE}/audio/lottomind-frequency.mp3`, "Dashboard-to-reset frequency bed", ASSETS.recordButtonMusicStore],
  ["Digital Static", `${BASE}/audio/digital-static.mp3`, "Tab intro and scanner texture", ASSETS.studioRecordsConsole],
  ["Miracle Gold Reset", `${BASE}/audio/miracle-gold-reset.mp3`, "Gold reset intro", ASSETS.studioFrequencyVault],
  ["Lucky Frequency Sessions", `${BASE}/audio/lucky-frequency-sessions.mp3`, "Long-form focus session", ASSETS.recordButtonAbundanceRadio],
  ["Detroit Rain 432", `${BASE}/audio/detroit-rain-432.mp3`, "432 Hz rainfield calm", ASSETS.recordButtonSonicStudio],
  ["LottoMind Startup", `${BASE}/audio/lottomind-startup.mp3`, "Branded app intro", ASSETS.recordButtonDreamVideo],
  ["LottoMind Rainfield", `${BASE}/audio/LottoMind%20Rainfield.mp3`, "Rain layer from the old media kit", ASSETS.studioRecordsLogo],
  ["LottoMind Vault 174", `${BASE}/audio/LottoMind%20Vault%20174.mp3`, "Vault tone session", ASSETS.recordButtonMusicStore],
];

const STREAMING_LINKS = [
  ["Apple Music", "Connect the LottoMind Records label lane to Apple Music.", "apple", ASSETS.logo, "https://music.apple.com/"],
  ["YouTube", "Open videos, shorts, and branded dream reveals.", "youtube", ASSETS.youtubeOrb, "https://www.youtube.com/"],
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
  legal: "policies",
};

const RESET_PRESETS = {
  calm: { label: "Calm", tone: "432", duration: 300 },
  focus: { label: "Focus", tone: "741", duration: 900 },
  sleep: { label: "Sleep", tone: "174", duration: 1800 },
};

const TRIVIA_QUESTIONS = [
  {
    id: "oracle-first-move",
    q: "What is the safest first move before saving a Dream Oracle pick?",
    options: ["Run the interpretation", "Clear the vault", "Mute every tab"],
    answer: 0,
    note: "Dream picks work best after the Oracle reads the symbols and creates the set.",
  },
  {
    id: "signal-radar-lane",
    q: "Which LottoMind lane compares hot, cold, and balance signals?",
    options: ["Signal Radar", "Merch Store", "Privacy Policy"],
    answer: 0,
    note: "Signal Radar is the quick scan lane for number movement.",
  },
  {
    id: "history-vault",
    q: "Where should saved numbers and dream readings live?",
    options: ["History Vault", "Search bar", "Mode switch"],
    answer: 0,
    note: "History Vault keeps saved sets, dream readings, and psychic readings together.",
  },
  {
    id: "abundance-radio",
    q: "What does Abundance Radio connect back into?",
    options: ["Reset tones", "State taxes", "A scratch-off camera"],
    answer: 0,
    note: "Radio sessions can load frequency lanes into the Reset player.",
  },
  {
    id: "random-outcomes",
    q: "Which reminder matters before every play session?",
    options: ["Lottery outcomes are random", "More taps guarantee wins", "Only one number can repeat"],
    answer: 0,
    note: "LottoMind is entertainment and organization; lottery results are random.",
  },
];

const TRIVIA_BUILD_ID = "lottomind-refined-trivia-2026-08-09";
let accountServiceLoadPromise = null;
let refinedTriviaModulePromise = null;
let refinedTriviaMount = null;

function loadAppScript(src, marker) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-lottomind-loader="${marker}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.lottomindLoader = marker;
    script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

function ensureLottoMindAccountService() {
  if (window.LottoMindAccountService) return Promise.resolve(window.LottoMindAccountService);
  if (accountServiceLoadPromise) return accountServiceLoadPromise;
  const root = window.__LOTTOMIND_ROOT__ || "";
  accountServiceLoadPromise = (async () => {
    if (!window.LOTTOMIND_SUPABASE_URL) {
      await loadAppScript(`${root}/lottominded-ultra.io/assets/js/lottomind-runtime-config.js?v=trivia-rewards-1`, "runtime-config");
    }
    if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
      window.LOTTOMIND_API_BASE_URL = "http://127.0.0.1:8142";
    }
    await loadAppScript(`${root}/lottominded-ultra.io/assets/js/lottomind-account-service.js?v=trivia-rewards-2`, "account-service");
    return window.LottoMindAccountService || null;
  })().catch(() => null);
  return accountServiceLoadPromise;
}

function ensureRefinedTriviaModule() {
  if (!document.querySelector('link[data-lottomind-trivia-embed="true"]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = `${BASE}/games/lottomind-trivia/refined-embed.css?v=20260809-2`;
    stylesheet.dataset.lottomindTriviaEmbed = "true";
    document.head.appendChild(stylesheet);
  }
  refinedTriviaModulePromise ||= import(`${BASE}/games/lottomind-trivia/src/refined-embed.mjs?v=20260809-2`);
  return refinedTriviaModulePromise;
}

async function mountRefinedTriviaRoute() {
  const root = document.getElementById("refined-trivia-vault-root");
  if (!root || state.route !== "triviaPlay") return;
  try {
    const module = await ensureRefinedTriviaModule();
    if (!root.isConnected || state.route !== "triviaPlay") return;
    refinedTriviaMount?.destroy?.();
    refinedTriviaMount = module.mountRefinedTriviaVault(root, {
      onRoute: (route) => go(route),
      accountServicePromise: ensureLottoMindAccountService,
    });
  } catch (error) {
    root.innerHTML = `<div class="panel"><h1>Trivia Vault unavailable</h1><p>${escapeHtml(error?.message || "The game module could not load.")}</p><button class="primary-btn" data-route="arcade">Return to Arcade</button></div>`;
  }
}

const ARCADE_GAMES = Object.freeze([
  { id: "gothtechnology", title: "GOTHTECHNOLOGY", copy: "Cross Blackwood forest, break the signal lock, and fight into the vault.", url: `${WEBSITE_BASE}/games/gothtechnology2/`, featureClass: "featured-fighter", art: `${WEBSITE_BASE}/games/gothtechnology2/assets/user-title/gothtechnology-cover-start-bg.webp` },
  { id: "jackpot-maze", title: "LottoMind: Jackpot Maze", copy: "Collect number reveals, outsmart five villains, and open the neon vault.", url: `${WEBSITE_BASE}/games/lottomind-jackpot-maze/`, featureClass: "featured-maze", art: `${WEBSITE_BASE}/games/lottomind-jackpot-maze/public/assets/ui/lottomind-jackpot-maze-title-card-gpt2.webp` },
  { id: "static-wave", title: "2084 Static Wave", copy: "Pilot the static signal through a fast neon combat grid.", url: `${WEBSITE_BASE}/games/opengw-levels/`, featureClass: "featured-static-wave", art: `${WEBSITE_BASE}/games/opengw-levels/assets/2084/branding/marquee-gameplay-keyart.png` },
  { id: "robot-rahbe", title: "Robot Rahbe", copy: "Enter the Shadow Ops arena and hold the tactical signal.", url: `${WEBSITE_BASE}/games/shadow-ops-canvas/`, featureClass: "featured-robot-rahbe", art: `${WEBSITE_BASE}/games/shadow-ops-canvas/assets/backgrounds/robot-rahbe-gameplay-keyart.png` },
  { id: "raytrace-pong", title: "Raytrace Pong", copy: "Play a light-traced Pong simulation with live shadows.", url: `${WEBSITE_BASE}/games/raytrace-pong-background/`, art: `${WEBSITE_BASE}/assets/arcade/raytrace-pong-title.webp` },
  { id: "lottery-spheres", title: "Lottery Spheres in Motion", copy: "Guide glowing spheres and bend the orbit path with touch or pointer.", url: `${WEBSITE_BASE}/lottery-spheres.html#spheres`, art: `${WEBSITE_BASE}/assets/arcade/lottery-spheres-title.webp` },
  { id: "beat2lotto", title: "Beat2Lotto+ Prompt Lab", copy: "Turn local beat energy into entertainment-only creative signals.", url: `${WEBSITE_BASE}/prompt-lab.html`, art: `${WEBSITE_BASE}/assets/arcade/beat2lotto-prompt-lab-title.webp` },
  { id: "stem-studio", title: "LottoMind Stem Studio", copy: "Mix stems and build a playable music route.", url: `${WEBSITE_BASE}/lottomind-stem-studio/`, art: `${WEBSITE_BASE}/assets/arcade/stem-studio-title.webp` },
]);

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

const MERCH_PRICE_FALLBACKS = {
  detroitHoodie: 64,
  detroitPolo: 46,
  detroitLogoTee: 34,
  detroitCap: 34,
  miniCrestPolo: 42,
  capCloseupDrop: 34,
  stickerPack: 14,
  deskMat: 39,
  pick34Playbook: 19,
  dreamSymbolGuide: 24,
  crosswordPack: 12,
  neuralVaultI: 68,
  liveOrbStudy: 72,
};

const MERCH_CATALOG_FALLBACK = [
  {
    priceKey: "detroitHoodie",
    title: "Detroit Embroidery Hoodie",
    copy: "Close-detail fleece concept with textured skyline embroidery and launch-team color hits.",
    type: "Clothing",
    className: "detroit-hoodie",
  },
  {
    priceKey: "detroitCap",
    title: "1701 Signal Cap",
    copy: "Navy structured cap with embroidered skyline signal mark and everyday launch-team fit.",
    type: "Clothing",
    className: "detroit-cap",
  },
  {
    priceKey: "detroitPolo",
    title: "Metro Signal Polo",
    copy: "Clean collared piece for demos, pop-ups, listening sessions, and product meetings.",
    type: "Clothing",
    className: "detroit-polo",
  },
  {
    priceKey: "neuralVaultI",
    title: "Neural Vault I",
    copy: "Neon LottoMind gallery artwork with vault-orb energy.",
    type: "Gallery Art",
    className: "neural-vault",
  },
  {
    priceKey: "liveOrbStudy",
    title: "Live Orb Study",
    copy: "Live-data orb artwork with blue-gold LottoMind motion.",
    type: "Gallery Art",
    className: "live-orb-study",
  },
];

const MERCH_ART_BY_KEY = {
  detroitHoodie: ASSETS.detroitHoodieClose,
  detroitCap: ASSETS.detroitCapFront,
  detroitPolo: ASSETS.detroitPoloClose,
  neuralVaultI: ASSETS.logo,
  liveOrbStudy: ASSETS.live,
};

function merchPriceValue(priceKey) {
  const sharedPrices = window.LOTTOMIND_MERCH_PRICES || {};
  const value = Number(sharedPrices[priceKey] ?? MERCH_PRICE_FALLBACKS[priceKey] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function merchPriceLabel(priceKey) {
  return `$${merchPriceValue(priceKey).toFixed(0)}`;
}

const RETIRED_MERCH_KEYS = new Set([
  "innovationFloorModelHoodie",
  "innovationFloorHoodie",
  "cyberBrainGlowHoodie",
  "lottomindCoinSet",
  "city1701Mark",
  "cyberBrainPlate",
  "boogieManKnitSweater",
  "cityOfDetroit1701Hoodie",
  "frequencyHalo",
]);
const SHARED_MERCH_CATALOG = Array.isArray(window.LOTTOMIND_MERCH_CATALOG) ? window.LOTTOMIND_MERCH_CATALOG : MERCH_CATALOG_FALLBACK;
const MERCH_ITEMS = SHARED_MERCH_CATALOG.filter((item) => !RETIRED_MERCH_KEYS.has(item.priceKey)).map((item) => ({
  title: item.title,
  copy: item.copy,
  priceKey: item.priceKey,
  price: merchPriceLabel(item.priceKey),
  type: item.type,
  art: MERCH_ART_BY_KEY[item.priceKey] || ASSETS.detroitCollection,
  className: item.className || item.priceKey,
}));

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
const REVENUECAT_PREMIUM_UNLOCK_IDS = new Set(FEATURE_UNLOCKS.map((item) => item.id));

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
    ["Abundance Radio", "Live audio", "radioStation"],
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
      ["AI News", "Draw news", "ai"],
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
      ["US Lottery", "State index", "usLottery"],
      ["History", "Saved runs", "history"],
    ],
  },
  {
    title: "Play + Learn",
    copy: "Arcade, challenges, and learning loops.",
    tools: [
      ["Arcade", "Reward games", "arcade"],
      ["Jackpot Run", "Play now", "arcadeGame"],
      ["Academy", "Lessons", "academy"],
      ["Pro Playbook", "Strategy", "proPlaybook"],
      ["Achievements", "Missions", "achievements"],
      ["Challenges", "Daily tasks", "challenges"],
      ["Contests", "Prize board", "contests"],
      ["Paywall", "Premium gate", "paywall"],
      ["Trivia", "Earn credits", "triviaRewards"],
      ["Community", "Share runs", "community"],
      ["Notifications", "Alerts", "notifications"],
      ["Help", "Support", "help"],
    ],
  },
];

const HOME_CAROUSEL = [
  ["Sonic Studio / Record Booth", "Record dream songs, lucky chants, and reset demos.", "studio", ASSETS.studioBooth],
  ["Reset Studio", "Start with a calm signal before numbers.", "reset", ASSETS.reset],
  ["Dream Oracle", "Speak or type the dream and receive numbers.", "dreams", ASSETS.dream],
  ["Music Store / Record Label", "Play LottoMind Records audio and reset sessions.", "music", ASSETS.music],
  ["Abundance Radio", "LottoMind Records live audio lane.", "radioStation", ASSETS.music],
  ["Viral Studio", "Build video loops and short promo scenes.", "viralStudio", ASSETS.power],
  ["Generate Your Dreams", "Turn dreams into scenes, readings, and lucky reveal cards.", "dreamVideo", ASSETS.dream],
  ["Heatmap Radar", "Read hot, cold, and overdue movement.", "heatmap", ASSETS.heatmap],
  ["Arcade Deck", "Run Power Tools like mission cards.", "powertools", ASSETS.power],
  ["LottoMind Records", "Open saved reports, draw cards, and reading history.", "records", ASSETS.live],
  ["Marketplace Vault", "Credits, VIP tools, and branded unlocks.", "marketplace", ASSETS.credit],
  ["Video Studio", "Preview branded motion loops from the old app.", "dreamVideo", ASSETS.power],
  ["Contests", "Challenge board, rewards, and future entries.", "contests", ASSETS.arcade],
];

const HOME_CAROUSEL_VIDEOS = {
  studio: `${BASE}/videos/oracle-flow-music-new.mp4`,
  reset: `${BASE}/videos/oracle-flow-reset-new.mp4`,
  dreams: `${BASE}/videos/oracle-flow-dream-new.mp4`,
};

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
  studio: "lottomind.studio.project.v1",
  socialScores: "lottomind.oracle.real.socialScores.v1",
};

const WEB_CREDIT_STORAGE_KEY = "lottomind_credits";
let centralAccountSnapshot = null;
let centralAccountUnsubscribe = null;

const DEFAULT_SETTINGS = {
  music: true,
  psychic: true,
  sound: true,
  motion: true,
  responsible: true,
};

const STATE_PINS = ["NY", "FL", "TX", "CA", "GA", "MI", "PA", "NJ", "OH", "IL"];

const STUDIO_DIVISIONS = ["1/4", "1/4T", "1/8", "1/8T", "1/16", "1/16T", "1/32", "1/32T", "1/64", "1/64T"];
const STUDIO_PAD_SHORTCUTS = ["1", "2", "3", "4", "q", "w", "e", "r", "a", "s", "d", "f", "z", "x", "c", "v"];
const STUDIO_PAD_DEFAULTS = [
  ["Kick", "kick"], ["Snare", "snare"], ["Clap", "clap"], ["Closed Hat", "hat"],
  ["Open Hat", "openhat"], ["Low Tom", "tom"], ["Mid Tom", "tom"], ["High Tom", "tom"],
  ["Perc 1", "perc"], ["Perc 2", "perc"], ["Crash", "crash"], ["Ride", "ride"],
  ["Vault FX", "fx"], ["Oracle Hit", "perc"], ["Cyan Bell", "bell"], ["Gold Riser", "fx"],
];
const STUDIO_DEFAULT_STEM_KIT_VERSION = "lottomind-default-stem-kit-v8-boom-bap";
const STUDIO_DEFAULT_STEM_ASSETS = [
  { id: "lead-vocals", name: "Lead Vocals", fileName: "lottomind-default-01-lead-vocals.mp3", url: `${BASE}/assets/studio/default-stems/lottomind-default-01-lead-vocals.mp3`, role: "vocal", targetStem: 0, sourceBpm: 92 },
  { id: "drums", name: "Drums", fileName: "lottomind-default-02-drums.mp3", url: `${BASE}/assets/studio/default-stems/lottomind-default-02-drums.mp3`, role: "drums", targetStem: 1, sourceBpm: 92 },
  { id: "synth", name: "Synth", fileName: "lottomind-default-03-synth.mp3", url: `${BASE}/assets/studio/default-stems/lottomind-default-03-synth.mp3`, role: "music", targetStem: 2, sourceBpm: 92 },
  { id: "other", name: "Other", fileName: "lottomind-default-04-other.mp3", url: `${BASE}/assets/studio/default-stems/lottomind-default-04-other.mp3`, role: "texture", targetStem: 3, sourceBpm: 92 },
  { id: "boom-bap-kick", name: "Boom Bap Kick", fileName: "lottomind-boom-bap-kick.mp3", url: `${BASE}/assets/custom/studio/samples/lottomind-boom-bap-kick.mp3`, role: "kick", targetStem: 4, sourceBpm: 92 },
  { id: "boom-bap-snare", name: "Boom Bap Snare", fileName: "lottomind-boom-bap-snare.mp3", url: `${BASE}/assets/custom/studio/samples/lottomind-boom-bap-snare.mp3`, role: "snare", targetStem: 5, sourceBpm: 92 },
  { id: "boom-bap-clap", name: "Boom Bap Clap", fileName: "lottomind-boom-bap-clap.mp3", url: `${BASE}/assets/custom/studio/samples/lottomind-boom-bap-clap.mp3`, role: "clap", targetStem: 6, sourceBpm: 92 },
];
const STUDIO_DEFAULT_PAD_STEM_MAP = [
  { pad: 0, stemId: "boom-bap-kick", name: "Boom Bap Kick", type: "kick", trimStart: 0.00, trimEnd: 100.00 },
  { pad: 1, stemId: "boom-bap-snare", name: "Boom Bap Snare", type: "snare", trimStart: 0.00, trimEnd: 100.00 },
  { pad: 2, stemId: "boom-bap-clap", name: "Boom Bap Clap", type: "clap", trimStart: 0.00, trimEnd: 100.00 },
  { pad: 3, stemId: "drums", name: "Stem Hat", type: "hat", trimStart: 2.25, trimEnd: 3.00 },
  { pad: 4, stemId: "drums", name: "Stem Open Hat", type: "openhat", trimStart: 3.00, trimEnd: 3.75 },
  { pad: 5, stemId: "drums", name: "Stem Perc 1", type: "perc", trimStart: 3.75, trimEnd: 4.50 },
  { pad: 6, stemId: "drums", name: "Stem Perc 2", type: "perc", trimStart: 4.50, trimEnd: 5.25 },
  { pad: 7, stemId: "drums", name: "Stem Fill", type: "tom", trimStart: 5.25, trimEnd: 6.00 },
  { pad: 8, stemId: "synth", name: "Synth Chop 1", type: "bell", trimStart: 0.00, trimEnd: 1.15 },
  { pad: 9, stemId: "synth", name: "Synth Chop 2", type: "bell", trimStart: 1.15, trimEnd: 2.30 },
  { pad: 10, stemId: "synth", name: "Synth Chop 3", type: "fx", trimStart: 2.30, trimEnd: 3.45 },
  { pad: 11, stemId: "synth", name: "Synth Chop 4", type: "fx", trimStart: 3.45, trimEnd: 4.60 },
  { pad: 12, stemId: "other", name: "Other Hit 1", type: "perc", trimStart: 0.00, trimEnd: 1.40 },
  { pad: 13, stemId: "other", name: "Other Hit 2", type: "perc", trimStart: 1.40, trimEnd: 2.80 },
  { pad: 14, stemId: "lead-vocals", name: "Vocal Chop 1", type: "fx", trimStart: 0.00, trimEnd: 4.00 },
  { pad: 15, stemId: "lead-vocals", name: "Vocal Chop 2", type: "fx", trimStart: 4.00, trimEnd: 8.00 },
];
const STUDIO_NOTE_KEYS = {
  z: "C", s: "C#", x: "D", d: "D#", c: "E", v: "F", g: "F#", b: "G", h: "G#", n: "A", j: "A#", m: "B",
  q: "C", 2: "C#", w: "D", 3: "D#", e: "E", r: "F", 5: "F#", t: "G", 6: "G#", y: "A", 7: "A#", u: "B",
};
const STUDIO_LOTTO_METHODS = [
  ["beat-signature", "Beat Signature", "Repeatable picks from the exact groove, pads, BPM, swing, and effects."],
  ["live-groove", "Live Groove", "Adds fresh browser entropy so the same beat can create a new lucky lane."],
  ["function-lab", "Function Lab", "Transforms the rhythm through prime, Fibonacci, and chaos-style music functions."],
];
const STUDIO_LOTTO_FUNCTIONS = [
  ["groove-prime", "Prime Pulse"],
  ["fibonacci", "Fibonacci Flow"],
  ["velocity-map", "Velocity Map"],
  ["syncopation", "Syncopation Code"],
];


const SOCIAL_CHALLENGE_TYPES = ["Trivia", "Crossword", "Word Search", "Studio Beat", "Dream Oracle"];
const SOCIAL_PREVIEW_RIVALS = [
  { name: "NeonOracle", score: 960, streak: 7, badge: "Demo rival", challenge: "Dream Oracle", source: "Demo rivals" },
  { name: "VaultRunner", score: 870, streak: 5, badge: "Demo rival", challenge: "Trivia", source: "Demo rivals" },
  { name: "RadarMuse", score: 740, streak: 4, badge: "Demo rival", challenge: "Heatmap", source: "Demo rivals" },
  { name: "Beat2Lotto", score: 690, streak: 3, badge: "Demo rival", challenge: "Studio Beat", source: "Demo rivals" },
  { name: "LuckyCipher", score: 520, streak: 2, badge: "Demo rival", challenge: "Crossword", source: "Demo rivals" },
];
const SOCIAL_PROMPTS = [
  ["Post a Dream Prompt", "Share one dream symbol, then run the Oracle and save the clearest lane.", "dreams", "Dream"],
  ["Share a Heatmap Read", "Compare one hot signal, one cold watch number, and a balance cue.", "heatmap", "Radar"],
  ["Beat2Lotto Challenge", "Build a beat, convert the groove to creative picks, then save the result.", "studio", "Studio"],
  ["Trivia Night", "Run a quick question streak and save the score to your local board.", "triviaPlay", "Arcade"],
  ["State Streak Room", "Pin the state, check local retailer notes, and organize your route.", "storeLocator", "State"],
  ["Contest Entry Board", "Open contest prompts and future entry lanes for credits and unlocks.", "contests", "Contest"],
];

function studioDefaultStemAssetById(id) {
  return STUDIO_DEFAULT_STEM_ASSETS.find((asset) => asset.id === id) || null;
}

function isStudioDefaultStemUrl(value = "") {
  const text = String(value || "");
  return STUDIO_DEFAULT_STEM_ASSETS.some((asset) => text.includes(asset.fileName));
}

function studioDefaultStemSlot(index) {
  const asset = STUDIO_DEFAULT_STEM_ASSETS.find((item) => Number(item.targetStem) === Number(index));
  return {
    name: asset ? asset.name : `Stem ${index + 1}`,
    fileName: asset ? asset.fileName : "",
    data: asset ? asset.url : "",
    muted: false,
    solo: false,
    volume: 78,
    startStep: 0,
    sourceBpm: asset?.sourceBpm || 92,
    sync: Boolean(asset),
    sequenceEnabled: false,
    sessionOnly: false,
    padTarget: Math.min(15, 8 + index),
    defaultStemId: asset?.id || "",
    isDefaultStem: Boolean(asset),
  };
}

function studioDefaultPadTemplate(pad, index) {
  const map = STUDIO_DEFAULT_PAD_STEM_MAP.find((item) => item.pad === index);
  const asset = map ? studioDefaultStemAssetById(map.stemId) : null;
  if (!map || !asset) return pad;
  return {
    ...pad,
    name: map.name || pad.name,
    type: map.type || pad.type,
    sampleName: `${asset.name} · ${map.name || `Pad ${index + 1}`}`,
    sampleData: asset.url,
    trimStart: map.trimStart,
    trimEnd: map.trimEnd,
    pitch: 0,
    gain: 88,
    reverse: false,
    defaultStemId: asset.id,
    stemSlice: `${asset.id}:${map.trimStart}-${map.trimEnd}`,
    sampleTooLargeForSave: false,
  };
}

function applyStudioDefaultStemPadMapToProject(project, { replacePads = false } = {}) {
  if (!project?.pads) return project;
  STUDIO_DEFAULT_PAD_STEM_MAP.forEach((map) => {
    const pad = project.pads[map.pad];
    const asset = studioDefaultStemAssetById(map.stemId);
    if (!pad || !asset) return;
    const canReplace = replacePads || !pad.sampleData || isStudioDefaultStemUrl(pad.sampleData);
    if (!canReplace) return;
    project.pads[map.pad] = studioDefaultPadTemplate({
      ...pad,
      shortcut: pad.shortcut || STUDIO_PAD_SHORTCUTS[map.pad],
      velocity: Number(pad.velocity) || 82,
      muted: Boolean(pad.muted),
    }, map.pad);
  });
  return project;
}

function applyStudioDefaultStemKitToProject(project, { replaceStems = false, replacePads = false } = {}) {
  if (!project) return project;
  project.stems = Array.isArray(project.stems) ? project.stems : [];
  while (project.stems.length < 8) project.stems.push(studioDefaultStemSlot(project.stems.length));
  STUDIO_DEFAULT_STEM_ASSETS.forEach((asset) => {
    const index = Math.max(0, Math.min(project.stems.length - 1, Number(asset.targetStem) || 0));
    const existing = project.stems[index] || {};
    const canReplace = replaceStems || !existing.data || isStudioDefaultStemUrl(existing.data) || existing.isDefaultStem;
    if (!canReplace) return;
    project.stems[index] = {
      ...existing,
      ...studioDefaultStemSlot(index),
      name: asset.name,
      fileName: asset.fileName,
      data: asset.url,
      sourceBpm: Number(existing.sourceBpm) || asset.sourceBpm || Number(project.bpm) || 92,
      defaultStemId: asset.id,
      isDefaultStem: true,
      sessionOnly: false,
    };
  });
  applyStudioDefaultStemPadMapToProject(project, { replacePads });
  project.defaultStemKit = {
    ...(project.defaultStemKit || {}),
    version: STUDIO_DEFAULT_STEM_KIT_VERSION,
    sourceName: "Boom Bap Factory Stem Kit",
    active: true,
    initialized: true,
    useAsPadSounds: true,
    allowCustomReplacement: true,
    lastLoadedAt: new Date().toISOString(),
  };
  return project;
}

function normalizeStudioDefaultStemKit(project) {
  if (!project) return project;
  project.defaultStemKit = {
    version: STUDIO_DEFAULT_STEM_KIT_VERSION,
    sourceName: "Boom Bap Factory Stem Kit",
    active: true,
    initialized: false,
    useAsPadSounds: true,
    allowCustomReplacement: true,
    ...(project.defaultStemKit || {}),
  };
  const customPads = (project.pads || []).some((pad) => pad.sampleData && !isStudioDefaultStemUrl(pad.sampleData));
  const customStems = (project.stems || []).some((stem) => stem.data && !isStudioDefaultStemUrl(stem.data));
  const missingDefaultStems = STUDIO_DEFAULT_STEM_ASSETS.some((asset) => {
    const slot = (project.stems || [])[Number(asset.targetStem) || 0] || {};
    return !slot.data || !isStudioDefaultStemUrl(slot.data);
  });
  if (!project.defaultStemKit.initialized || (missingDefaultStems && !customStems)) {
    applyStudioDefaultStemKitToProject(project, { replaceStems: !customStems, replacePads: !customPads });
    project.defaultStemKit.initialized = true;
  } else if (project.defaultStemKit.useAsPadSounds && !customPads) {
    applyStudioDefaultStemPadMapToProject(project, { replacePads: false });
  }
  return project;
}

function mapCurrentStudioStemsToPadKit({ replacePads = true } = {}) {
  const loaded = (state.studio.stems || []).filter((stem) => stem?.data);
  if (!loaded.length) {
    toast("Import or load stems first, then map them into the drum pads.");
    return;
  }
  const perStem = Math.max(1, Math.ceil(16 / loaded.length));
  state.studio.pads = state.studio.pads.map((pad, index) => {
    if (!replacePads && pad.sampleData && !isStudioDefaultStemUrl(pad.sampleData)) return pad;
    const stem = loaded[Math.min(loaded.length - 1, Math.floor(index / perStem))] || loaded[index % loaded.length];
    const slice = index % perStem;
    const sliceWidth = Math.max(0.75, Math.min(4.0, 12 / perStem));
    const trimStart = Math.min(96, Number((slice * sliceWidth).toFixed(2)));
    const trimEnd = Math.min(100, Number((trimStart + sliceWidth).toFixed(2)));
    return {
      ...pad,
      name: `${stem.name || stem.fileName || "Stem"} ${slice + 1}`.slice(0, 24),
      sampleName: stem.fileName || stem.name || `Stem ${index + 1}`,
      sampleData: stem.data,
      trimStart,
      trimEnd,
      pitch: 0,
      gain: Math.max(1, Math.min(120, Number(stem.volume) || 82)),
      reverse: false,
      defaultStemId: stem.defaultStemId || "custom-stem",
      stemSlice: `${stem.name || "custom"}:${trimStart}-${trimEnd}`,
      sampleTooLargeForSave: Boolean(stem.sessionOnly || String(stem.data || "").startsWith("blob:")),
    };
  });
  state.studio.defaultStemKit = {
    ...(state.studio.defaultStemKit || {}),
    active: false,
    initialized: true,
    useAsPadSounds: true,
    allowCustomReplacement: true,
    lastCustomMapAt: new Date().toISOString(),
  };
  studioSampleBuffers = {};
  saveStudioProject();
  toast(`${loaded.length} stem${loaded.length === 1 ? "" : "s"} sliced into the 16 drum pads.`);
  render();
}

function createDefaultStudioProject() {
  return {
    bpm: 92,
    division: "1/16",
    swing: 8,
    velocity: 82,
    humanize: 6,
    recArmed: false,
    metronome: false,
    stepPage: 0,
    pageSize: 128,
    projectName: "Neon Dreams",
    selectedPad: 0,
    selectedStem: 0,
    defaultStemKit: {
      version: STUDIO_DEFAULT_STEM_KIT_VERSION,
      sourceName: "Boom Bap Factory Stem Kit",
      active: true,
      initialized: true,
      useAsPadSounds: true,
      allowCustomReplacement: true,
      lastLoadedAt: "",
    },
    dj: {
      crossfader: 50,
      recordLaunches: false,
      deckA: { stemIndex: 0, volume: 82, pitch: 0, jog: 0, filter: 72, cueStep: 0, sync: true, loop: false, reverse: false, playing: false },
      deckB: { stemIndex: 1, volume: 82, pitch: 0, jog: 0, filter: 72, cueStep: 0, sync: true, loop: false, reverse: false, playing: false },
    },
    waveform: "sawtooth",
    octave: 4,
    synthVolume: 55,
    effects: { drive: 0, tone: 76, delay: 0, reverb: 0, punch: 12 },
    lotto: {
      gameId: "powerball",
      method: "beat-signature",
      functionMode: "groove-prime",
      setCount: 3,
      entropy: false,
      lastSet: null,
      lastPicks: [],
    },
    pads: STUDIO_PAD_DEFAULTS.map(([name, type], index) => studioDefaultPadTemplate({
      name,
      type,
      velocity: 82,
      muted: false,
      sampleName: "",
      sampleData: "",
      trimStart: 0,
      trimEnd: 100,
      pitch: 0,
      gain: 85,
      reverse: false,
      shortcut: STUDIO_PAD_SHORTCUTS[index],
    }, index)),
    stems: Array.from({ length: 8 }, (_, index) => studioDefaultStemSlot(index)),
    events: [],
    vocals: Array.from({ length: 4 }, (_, index) => ({
      name: `Vocal ${index + 1}`,
      data: "",
      fileName: "",
      muted: false,
      solo: false,
      volume: 75,
      startStep: 0,
      sessionOnly: false,
    })),
  };
}

function studioProject() {
  const saved = loadJson(STORAGE.studio, {});
  const fallback = createDefaultStudioProject();
  const merged = {
    ...fallback,
    ...saved,
    defaultStemKit: { ...fallback.defaultStemKit, ...(saved.defaultStemKit || {}) },
    effects: { ...fallback.effects, ...(saved.effects || {}) },
    lotto: { ...fallback.lotto, ...(saved.lotto || {}) },
    dj: {
      ...fallback.dj,
      ...(saved.dj || {}),
      deckA: { ...fallback.dj.deckA, ...(saved.dj?.deckA || {}) },
      deckB: { ...fallback.dj.deckB, ...(saved.dj?.deckB || {}) },
    },
    pads: fallback.pads.map((pad, index) => ({ ...pad, ...(saved.pads?.[index] || {}) })),
    stems: fallback.stems.map((stem, index) => ({ ...stem, ...(saved.stems?.[index] || {}) })),
    vocals: fallback.vocals.map((track, index) => ({ ...track, ...(saved.vocals?.[index] || {}) })),
    events: Array.isArray(saved.events) ? saved.events : [],
  };
  return normalizeStudioDefaultStemKit(merged);
}

const state = {
  route: routeFromLocation(),
  gameId: localStorage.getItem("lottomind.oracle.real.game") || "powerball",
  strategy: localStorage.getItem("lottomind.oracle.real.strategy") || "balanced",
  selectedState: localStorage.getItem("lottomind.oracle.real.state") || "NY",
  radarPicks: [],
  viewMode: localStorage.getItem("lottomind.oracle.real.view") || "app",
  dreamText: "I dreamed I was flying over water and found a golden key near a moonlit bridge.",
  numberInput: "7 23 38 42 11",
  dailyInput: "194",
  nameInput: "LottoMind",
  barcodeInput: "",
  aiPrompt: "Build me a balanced set from my dream, weather, and radar.",
  dreamListening: false,
  dreamInterimText: "",
  knobPositions: loadJson("lottomind.oracle.real.knobs.v1", {
    reset: 432,
    dreams: 68,
    powertools: 42,
    studio: 82,
  }),
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
  resetPreset: "calm",
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
  triviaRewardSession: null,
  triviaRewardStatus: "score-only",
  triviaRewardError: "",
  triviaAward: null,
  revenueCat: null,
  selectedMerchIndex: 0,
  merchCategory: "All",
  storeQuery: "",
  activeStoreFilters: [],
  selectedStoreId: "",
  userLocation: null,
  studio: studioProject(),
  studioPlaying: false,
  studioStep: 0,
  studioInputStatus: "Mic/line input idle",
  studioInputDevices: [],
  studioInputDeviceId: localStorage.getItem("lottomind.studio.inputDeviceId") || "",
  studioHelpOpen: false,
  studioSampling: false,
  studioSamplingLabel: "",
  studioRecordingTrack: null,
  studioMasterRecording: false,
  wordSearchMarks: loadJson("lottomind.oracle.real.wordSearch.v1", []),
  crosswordSolved: loadJson("lottomind.oracle.real.crossword.v1", { solved: false }).solved || false,
  privacyDeleteArmed: false,
  activeArcadeGameId: localStorage.getItem("lottomind.refined.arcade.active-game.v1") || "jackpot-maze",
};

syncCreditsFromLaunchParams();

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
const mediaFadeFrames = new WeakMap();
let timerId = null;
let toastId = null;
let dreamRecognition = null;
let studioCtx = null;
let studioMaster = null;
let studioDrive = null;
let studioFilter = null;
let studioCompressor = null;
let studioDryGain = null;
let studioReverb = null;
let studioReverbGain = null;
let studioDelay = null;
let studioDelayWet = null;
let studioFeedback = null;
let studioOutputGain = null;
let studioDestination = null;
let studioTimerId = null;
let studioPlayheadTimers = [];
let studioNextStepTime = 0;
let studioLastScheduledStep = 0;
let studioScheduleAheadSeconds = 0.12;
let studioLookaheadMs = 24;
let studioSampleBuffers = {};
let studioStemBuffers = {};
let studioActiveStemSources = [];
let studioDjDecks = {};
let studioVocalBuffers = {};
let studioMicStream = null;
let studioMonitorSource = null;
let studioRecorders = {};
let studioSampleRecorder = null;
let studioSampleChunks = [];
let studioSampleStream = null;
let studioSampleReleaseStream = true;
let studioMasterRecorder = null;
let studioMasterChunks = [];
let studioFxKnobDrag = null;

function studioRotaryBounds(input) {
  const min = Number(input?.min ?? 0) || 0;
  const max = Number(input?.max ?? 100) || 100;
  return { min, max: Math.max(min + 1, max) };
}

function syncStudioRotaryInput(input) {
  if (!input) return;
  const { min, max } = studioRotaryBounds(input);
  const raw = Math.max(min, Math.min(max, Number(input.value) || min));
  const pct = ((raw - min) / (max - min)) * 100;
  const wrap = input.closest(".fx-module, .dj-knob-control");
  if (!wrap) return;
  wrap.style.setProperty("--knob-value", pct);
  wrap.style.setProperty("--knob-angle", `${-135 + pct * 2.7}deg`);
  const readout = wrap.querySelector(".dj-knob-value, em");
  if (readout && input.classList.contains("dj-knob-input")) {
    readout.textContent = `${raw}${input.getAttribute("data-suffix") || ""}`;
  } else if (readout) {
    readout.textContent = `${raw}%`;
  }
}

function setStudioRotaryInputValue(input, value) {
  const { min, max } = studioRotaryBounds(input);
  const nextValue = Math.max(min, Math.min(max, Math.round(Number(value) || min)));
  input.value = String(nextValue);
  handleAction(input.getAttribute("data-action"), input);
  syncStudioRotaryInput(input);
}

function setStudioEffectInputValue(input, value) {
  setStudioRotaryInputValue(input, value);
}

function updateStudioFxKnobFromPointer(input, event) {
  const knob = input.closest(".fx-module, .dj-knob-control")?.querySelector(".fx-knob-face, .dj-knob-face") || input;
  const rect = knob.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  let angle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI) + 90;
  if (angle > 180) angle -= 360;
  if (angle < -180) angle += 360;
  const clampedAngle = Math.max(-135, Math.min(135, angle));
  const { min, max } = studioRotaryBounds(input);
  setStudioRotaryInputValue(input, min + ((clampedAngle + 135) / 270) * (max - min));
}

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
  if (isRevenueCatPremiumUnlock(id) && hasRevenueCatProAccess()) return true;
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

function getSocialScores() {
  const entries = loadJson(STORAGE.socialScores, []);
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && Number.isFinite(Number(entry.score)))
    .map((entry, index) => ({
      id: entry.id || `social-score-${index}`,
      name: String(entry.name || "Local Player").trim() || "Local Player",
      score: Math.min(999999, Math.max(0, Math.round(Number(entry.score) || 0))),
      challenge: SOCIAL_CHALLENGE_TYPES.includes(entry.challenge) ? entry.challenge : "Trivia",
      streak: Math.max(0, Math.round(Number(entry.streak) || 0)),
      createdAt: entry.createdAt || new Date().toISOString(),
      source: entry.source || "Local preview",
    }))
    .slice(0, 20);
}

function saveSocialScore(score) {
  const entry = {
    id: score.id || `social-score-${Date.now()}`,
    name: String(score.name || "Local Player").trim() || "Local Player",
    score: Math.min(999999, Math.max(0, Math.round(Number(score.score) || 0))),
    challenge: SOCIAL_CHALLENGE_TYPES.includes(score.challenge) ? score.challenge : "Trivia",
    streak: Math.max(0, Math.round(Number(score.streak) || 0)),
    createdAt: score.createdAt || new Date().toISOString(),
    source: score.source || "Local preview",
  };
  const next = [entry, ...getSocialScores().filter((item) => item.id !== entry.id)].slice(0, 20);
  saveJson(STORAGE.socialScores, next);
  return entry;
}

function clearSocialScores() {
  saveJson(STORAGE.socialScores, []);
  return [];
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
  if (isRevenueCatPremiumUnlock(id) && hasRevenueCatProAccess()) return true;
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

function localTriviaScoreRows(progress = getTriviaProgress()) {
  return (Array.isArray(progress.history) ? progress.history : []).map((run, index) => ({
    id: `trivia-run-${run.date || "local"}-${index}`,
    name: "Local Player",
    score: Math.min(999999, Math.max(0, Math.round(Number(run.score) || 0))),
    challenge: "Trivia",
    streak: Math.max(0, Math.round(Number(run.streak) || 0)),
    createdAt: run.date || new Date().toISOString(),
    source: "Local preview",
  }));
}

function bestLocalTriviaScore(progress = getTriviaProgress()) {
  return localTriviaScoreRows(progress).reduce((best, row) => Math.max(best, row.score), 0);
}

function socialDateLabel(value) {
  if (!value) return "Local";
  try {
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "Local";
  }
}

function communityLeaderboardRows() {
  const progress = getTriviaProgress();
  const saved = getSocialScores().map((entry) => ({ ...entry, source: entry.source || "Saved challenge" }));
  const localBest = bestLocalTriviaScore(progress);
  const localRow = {
    id: "local-player-best",
    name: "Local Player",
    score: localBest,
    challenge: "Trivia",
    streak: Math.max(Number(progress.dailyStreak) || 0, Number(progress.weeklyStreak) || 0),
    createdAt: progress.lastPlayedDate || new Date().toISOString(),
    source: "On-device",
  };
  return [localRow, ...saved, ...localTriviaScoreRows(progress)]
    .filter((entry, index, list) => list.findIndex((item) => item.id === entry.id) === index)
    .sort((a, b) => Number(b.score) - Number(a.score) || Number(b.streak) - Number(a.streak))
    .slice(0, 9)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
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
  const bonus = Number(state.triviaAward?.amount || 0);
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

function triviaRewardMessage() {
  if (state.triviaRewardStatus === "eligible") return "Server verified · reward eligible";
  if (state.triviaRewardStatus === "connecting") return "Connecting secure reward session…";
  if (state.triviaRewardStatus === "submitting") return "Validating answer on the server…";
  if (state.triviaRewardStatus === "claiming") return "Claiming verified reward…";
  if (state.triviaRewardStatus === "rewarded") return `Verified reward +${Number(state.triviaAward?.amount || 0)} credits`;
  if (state.triviaRewardStatus === "signin-required") return "Sign in for verified credits · score-only now";
  return "Score-only · wallet values never change in the browser";
}

async function startSecureTriviaRun() {
  state.triviaRewardSession = null;
  state.triviaAward = null;
  state.triviaRewardError = "";
  state.triviaRewardStatus = "connecting";
  render();
  const service = await ensureLottoMindAccountService();
  if (!service?.createTriviaSession) {
    state.triviaRewardStatus = "score-only";
    state.triviaRewardError = "Secure reward service is unavailable. This run remains score-only.";
    render();
    return;
  }
  try {
    const session = await service.createTriviaSession({ mode: "daily", buildId: TRIVIA_BUILD_ID });
    state.triviaRewardSession = session;
    state.triviaRewardStatus = session?.eligible ? "eligible" : "score-only";
  } catch (error) {
    state.triviaRewardStatus = error?.code === "AUTH_REQUIRED" ? "signin-required" : "score-only";
    state.triviaRewardError = error?.message || "Secure rewards are unavailable. This run remains score-only.";
  }
  render();
}

async function submitSecureTriviaAnswer(selected) {
  if (state.triviaRewardStatus === "submitting" || state.triviaAnswered) return;
  const question = TRIVIA_QUESTIONS[state.triviaIndex] || TRIVIA_QUESTIONS[0];
  const sessionId = state.triviaRewardSession?.sessionId;
  let correct = selected === question.answer;
  if (sessionId && state.triviaRewardStatus === "eligible") {
    state.triviaRewardStatus = "submitting";
    render();
    try {
      const result = await window.LottoMindAccountService.submitTriviaAnswer(sessionId, {
        questionId: question.id,
        selectedIndex: selected,
        sequence: state.triviaIndex,
      });
      correct = Boolean(result.correct);
      state.triviaRewardStatus = "eligible";
    } catch (error) {
      state.triviaRewardStatus = "score-only";
      state.triviaRewardError = error?.message || "The answer could not be verified. The rest of this run is score-only.";
    }
  }
  const scorePoints = triviaRewardFor(state.triviaIndex) * 4 + (state.triviaStreak * 10);
  state.triviaAnswered = { selected, correct };
  if (correct) {
    state.triviaStreak += 1;
    state.triviaScore += scorePoints;
  } else {
    state.triviaStreak = 0;
  }
  toast(correct ? `Trivia signal locked: +${scorePoints} score` : "Try the next signal");
  render();
}

async function claimSecureTriviaReward() {
  const sessionId = state.triviaRewardSession?.sessionId;
  if (!sessionId || state.triviaRewardStatus !== "eligible") {
    completeTriviaProgress();
    state.triviaComplete = true;
    toast("Run saved as score-only. No wallet value changed.");
    go("triviaRewards");
    return;
  }
  state.triviaRewardStatus = "claiming";
  render();
  try {
    const result = await window.LottoMindAccountService.claimTriviaReward(
      sessionId,
      window.LottoMindAccountService.createIdempotencyKey("trivia-daily"),
    );
    state.triviaAward = result.reward || { amount: 0 };
    state.triviaRewardStatus = "rewarded";
    completeTriviaProgress();
    state.triviaComplete = true;
    toast(`Verified trivia reward: +${Number(state.triviaAward.amount || 0)} credits`);
  } catch (error) {
    state.triviaRewardStatus = "score-only";
    state.triviaRewardError = error?.message || "The reward could not be verified. No wallet value changed.";
    completeTriviaProgress();
    state.triviaComplete = true;
    toast("Reward not verified. No wallet value changed.");
  }
  go("triviaRewards");
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

function localProfileEntries() {
  const entries = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || (!key.startsWith("lottomind.") && !key.startsWith("lottomind_"))) continue;
    entries[key] = localStorage.getItem(key);
  }
  return entries;
}

function exportLocalProfile() {
  const payload = {
    app: "LottoMind",
    exportedAt: new Date().toISOString(),
    storage: localProfileEntries(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lottomind-local-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function deleteLocalProfile() {
  Object.keys(localProfileEntries()).forEach((key) => localStorage.removeItem(key));
  sessionStorage.clear();
  window.location.replace(routeUrl("dashboard"));
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

function normalizeCreditValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : null;
}

function readCreditValue(key) {
  return normalizeCreditValue(localStorage.getItem(key));
}

function getCredits() {
  if (centralAccountSnapshot?.authenticated && centralAccountSnapshot.wallet) {
    return normalizeCreditValue(centralAccountSnapshot.wallet.balance) ?? 0;
  }
  return 0;
}

function setCredits(value) {
  void value;
  return getCredits();
}

function syncCreditsFromLaunchParams() {
  // Wallet values are server snapshots only. Legacy query/local values are intentionally ignored.
}

function installCentralAccountSync() {
  const service = window.LottoMindAccountService;
  if (!service) return;
  const applySnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    const previousBalance = centralAccountSnapshot?.wallet?.balance;
    const previousStatus = centralAccountSnapshot?.authenticated;
    centralAccountSnapshot = snapshot;
    const changed = previousBalance !== snapshot.wallet?.balance || previousStatus !== snapshot.authenticated;
    if (changed && state.route !== "triviaPlay") render();
    if (changed) window.dispatchEvent(new CustomEvent("lottomind:wallet-sync", { detail: snapshot }));
  };
  centralAccountUnsubscribe?.();
  centralAccountUnsubscribe = service.subscribeToWallet(applySnapshot);
  service.getSnapshot().then(applySnapshot).catch(() => {
    centralAccountSnapshot = centralAccountSnapshot ? { ...centralAccountSnapshot, verified: false, offline: true } : null;
  });
}

const REVENUECAT_CLIENT_SRC = `${BASE}/revenuecat-client.js?v=revenuecat-web-20260722`;
let revenueCatClientLoadPromise = null;
let revenueCatUnsubscribe = null;

function isRevenueCatPremiumUnlock(id) {
  return REVENUECAT_PREMIUM_UNLOCK_IDS.has(id);
}

function revenueCatSnapshot() {
  return window.LottoMindRevenueCat?.getSnapshot?.() || state.revenueCat || null;
}

function hasRevenueCatProAccess() {
  return Boolean(revenueCatSnapshot()?.isEntitled);
}

function revenueCatStatusLabel() {
  const rc = revenueCatSnapshot();
  if (!rc) return "Loading";
  if (rc.isEntitled) return "Active";
  if (rc.status === "setup-required") return "Setup";
  if (rc.status === "checkout") return "Checkout";
  if (rc.status === "error") return "Error";
  if (rc.isConfigured) return "Ready";
  return "Offline";
}

function revenueCatCtaLabel() {
  const rc = revenueCatSnapshot();
  if (rc?.isEntitled) return "Pro Active";
  if (rc?.status === "checkout") return "Opening...";
  if (rc?.status === "setup-required") return "Unavailable";
  return rc?.priceLabel ? `Subscribe ${rc.priceLabel}` : "Subscribe Pro";
}

function ensureRevenueCatClient() {
  if (window.LottoMindRevenueCat) return Promise.resolve(window.LottoMindRevenueCat);
  if (revenueCatClientLoadPromise) return revenueCatClientLoadPromise;
  revenueCatClientLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = REVENUECAT_CLIENT_SRC;
    script.async = true;
    script.onload = () => resolve(window.LottoMindRevenueCat);
    script.onerror = () => reject(new Error("RevenueCat client failed to load"));
    document.head.appendChild(script);
  });
  return revenueCatClientLoadPromise;
}

function installRevenueCatSync() {
  ensureRevenueCatClient().then((service) => {
    if (!service) return;
    revenueCatUnsubscribe?.();
    revenueCatUnsubscribe = service.subscribe((snapshot) => {
      const previous = JSON.stringify(state.revenueCat || {});
      state.revenueCat = snapshot;
      if (JSON.stringify(snapshot || {}) !== previous) render();
    });
    return service.init();
  }).catch((error) => {
    state.revenueCat = {
      status: "error",
      message: "RevenueCat client did not load.",
      error: error?.message || String(error),
      isEntitled: false,
      isConfigured: false,
    };
    render();
  });
}

function startRevenueCatPurchase() {
  ensureRevenueCatClient().then((service) => {
    if (!service?.purchase) {
      toast("RevenueCat is still loading");
      return null;
    }
    const mount = document.querySelector("[data-revenuecat-paywall]");
    toast("Opening RevenueCat checkout");
    return service.purchase({ htmlTarget: mount }).then((snapshot) => {
      state.revenueCat = snapshot;
      toast(snapshot?.isEntitled ? "LottoMind Pro active" : "RevenueCat checkout finished");
      render();
    });
  }).catch((error) => {
    const message = error?.errorCode && String(error.errorCode).toLowerCase().includes("cancel")
      ? "Checkout cancelled"
      : error?.message || "RevenueCat checkout failed";
    toast(message);
  });
}

function refreshRevenueCatStatus() {
  ensureRevenueCatClient().then((service) => service?.refresh?.()).then((snapshot) => {
    if (snapshot) state.revenueCat = snapshot;
    toast(snapshot?.isEntitled ? "RevenueCat Pro active" : "RevenueCat status refreshed");
    render();
  }).catch((error) => {
    toast(error?.message || "RevenueCat refresh failed");
  });
}

function restoreRevenueCatPurchases() {
  ensureRevenueCatClient().then((service) => service?.restore?.()).then((snapshot) => {
    if (snapshot) state.revenueCat = snapshot;
    toast(snapshot?.isEntitled ? "Purchases restored" : "No active purchase was found");
    render();
  }).catch((error) => {
    toast(error?.message || "Purchases could not be restored");
  });
}

function manageRevenueCatSubscription() {
  ensureRevenueCatClient().then((service) => service?.manage?.()).then((snapshot) => {
    if (snapshot) state.revenueCat = snapshot;
  }).catch((error) => {
    toast(error?.message || "Subscription management is unavailable");
  });
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
  if (NATIVE_APP) {
    const route = path || "dashboard";
    return `${BASE}/index.html?route=${encodeURIComponent(route)}`;
  }
  return `${BASE}/${path}`.replace(/\/$/, "/");
}

function isResetRoute(routeKey = state.route) {
  return (ROUTE_ALIASES[routeKey] || routeKey) === "reset";
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
  const existingFrame = mediaFadeFrames.get(media);
  if (existingFrame) cancelAnimationFrame(existingFrame);
  if (media === routeAudio && routeAudioFadeId) cancelAnimationFrame(routeAudioFadeId);
  const startedAt = performance.now();
  const startVolume = Math.max(0, Math.min(0.8, from));
  const endVolume = Math.max(0, Math.min(0.8, to));
  media.volume = Math.max(0, Math.min(0.8, from));
  const tick = (now) => {
    const pct = Math.min(1, (now - startedAt) / Math.max(1, duration));
    const eased = pct < 0.5 ? 2 * pct * pct : 1 - Math.pow(-2 * pct + 2, 2) / 2;
    media.volume = startVolume + (endVolume - startVolume) * eased;
    if (pct >= 1) {
      media.volume = endVolume;
      mediaFadeFrames.delete(media);
      if (media === routeAudio) routeAudioFadeId = null;
      if (onDone) onDone();
      return;
    }
    const frameId = requestAnimationFrame(tick);
    mediaFadeFrames.set(media, frameId);
    if (media === routeAudio) routeAudioFadeId = frameId;
  };
  const frameId = requestAnimationFrame(tick);
  mediaFadeFrames.set(media, frameId);
  if (media === routeAudio) routeAudioFadeId = frameId;
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
    <button class="strategy-pill ${state.strategy === key ? "active" : ""}" data-action="set-strategy" data-strategy="${key}" style="--pill-art:url('${STRATEGY_ART[key] || art}')">
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
  Seq: 440.00,
  Vault: 493.88,
  Arcade: 523.25,
};

const TAB_ROUTES = ["dashboard", "powertools", "heatmap", "dreams", "reset", "sequence", "history", "arcade"];

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
    <button class="brand-lockup" data-route="dashboard" aria-label="Open LottoMind home">
      <img src="${ASSETS.logo}" alt="LottoMind logo" />
      <span>Lotto<span>Mind</span><sup>TM</sup></span>
    </button>
    <button class="pin-button top-state-button" data-action="cycle-state" aria-label="Change state pin"><span>State</span><strong>${state.selectedState}</strong></button>
    <button class="round-icon menu-orb command-meatball" data-action="menu" aria-label="Open LottoMind command menu"><span></span><em>MENU</em></button>
    <label class="search-pill top-search">
      <span>AI Search</span>
      <input data-action="search" value="${escapeHtml(state.searchQuery)}" placeholder="Ask LottoMind AI for tools, dreams, numbers..." autocomplete="off" />
      <button class="mic-chip art-search-mic" type="button" data-action="voice-search" aria-label="Voice search"><img src="${ASSETS.searchMic}" alt="" /></button>
    </label>
    <div class="function-search-results" hidden></div>
    ${state.showStatePicker ? `<div class="state-picker">
      ${STATE_PINS.map((pin) => `<button class="${pin === state.selectedState ? "active" : ""}" data-action="select-state" data-state="${pin}"><span>${pin}</span><small>${pin === state.selectedState ? "Pinned" : "Select"}</small></button>`).join("")}
    </div>` : ""}
    ${state.showUtilityMenu ? `<div class="utility-menu command-dropdown">
      <div class="menu-title"><span>Command Menu</span><strong>State, voice, store, radio, help</strong></div>
      <div class="command-menu-grid">
        <button data-action="cycle-state"><strong>Pin ${state.selectedState}</strong><small>Change state</small></button>
        <button data-action="voice-search"><strong>Voice</strong><small>Speak command</small></button>
        <button data-route="store"><strong>Store</strong><small>Gear drop</small></button>
        <button data-route="radioStation"><strong>Radio</strong><small>Live audio</small></button>
      </div>
      <button data-route="help"><strong>How To Use</strong><small>Reset, Dream, Radar, Power Tools, Arcade</small></button>
      <button data-route="settings"><strong>Settings</strong><small>Sound, motion, voice, and app mode</small></button>
      <button data-route="notifications"><strong>Alerts</strong><small>Draw reminders and saved-state notices</small></button>
      <button data-route="policies"><strong>Privacy + Policies</strong><small>Terms, accessibility, responsible play</small></button>
    </div>` : ""}
  </header>`;
}

function bottomNav() {
  const labels = { dashboard: ["Home", "C"], powertools: ["Tools", "D"], heatmap: ["Radar", "E"], dreams: ["Dream", "F"], reset: ["Reset", "G"], sequence: ["Seq", "A"], history: ["Vault", "B"], arcade: ["Arcade", "C"] };
  const items = TAB_ROUTES.map((route) => [route, ...labels[route]]);
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
    radioStation: ["Abundance Radio", "LottoMind Records live lane"],
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

const ORACLE_HARDWARE_CONTROLS = [
  { key: "reset", route: "reset", label: "Reset Vault", hint: "Tone wheel", art: ASSETS.dreamKnobResetVault, min: 174, max: 963, step: 3, unit: "Hz" },
  { key: "dreams", route: "dreams", label: "Dream Oracle", hint: "Voice meaning", art: ASSETS.dreamKnobDreamOracle, min: 0, max: 100, step: 2, unit: "%" },
  { key: "powertools", route: "powertools", label: "Power Tools", hint: "Main lab", art: ASSETS.powerToolNumberAnalyzer, min: 0, max: 100, step: 2, unit: "%" },
  { key: "studio", route: "studio", label: "Sonic Studio", hint: "Record booth", art: ASSETS.dreamKnobSonicStudio, min: 0, max: 100, step: 2, unit: "%" },
];

function oracleKnobReadout(value, unit) {
  return `${value}${unit === "%" ? "%" : ` ${unit}`}`;
}

function oracleKnobAngle(value, min, max) {
  const ratio = (value - min) / Math.max(1, max - min);
  return -135 + (Math.max(0, Math.min(1, ratio)) * 270);
}

function storedKnobPosition(key, fallback, min = 0, max = 100) {
  const stored = Number(state.knobPositions[key]);
  return Math.max(min, Math.min(max, Number.isFinite(stored) ? stored : fallback));
}

function knobControlAttributes({ key, label, min = 0, max = 100, step = 2, unit = "%", fallback = 50, pressVerb = "open" }) {
  const stored = storedKnobPosition(key, fallback, min, max);
  const value = Math.max(min, Math.min(max, min + Math.round((stored - min) / step) * step));
  const readout = oracleKnobReadout(value, unit);
  return {
    angle: oracleKnobAngle(value, min, max),
    attributes: `data-knob-control data-knob-key="${key}" data-knob-label="${label}" data-knob-min="${min}" data-knob-max="${max}" data-knob-step="${step}" data-knob-unit="${unit}" data-knob-value="${value}" data-knob-press-verb="${pressVerb}" aria-label="${label}. Knob position ${readout}. Rotate to adjust, press to ${pressVerb}."`,
  };
}

function oracleStudioControl({
  key,
  label,
  hint,
  art,
  surfaceArt = art,
  route = "",
  action = "",
  className = "",
  extraAttributes = "",
  min = 0,
  max = 100,
  step = 2,
  unit = "%",
  fallback = 50,
  pressVerb = action ? "activate" : "open",
  liveReadout = false,
}) {
  const knob = knobControlAttributes({ key, label, min, max, step, unit, fallback, pressVerb });
  const command = action ? `data-action="${action}"` : `data-route="${route}"`;
  return `<button class="oracle-studio-control ${className}" type="button" ${command} ${extraAttributes} ${knob.attributes} style="--oracle-control-art:url('${surfaceArt}');--oracle-knob-art:url('${art}');--knob-live-angle:${knob.angle}deg">
    <i aria-hidden="true"></i><span${liveReadout ? " data-knob-readout" : ""}>${label}</span><small>${hint}</small>
  </button>`;
}

function oracleKnobControl({ key, route, label, hint, art, min, max, step, unit }) {
  return oracleStudioControl({
    key,
    route,
    label,
    hint,
    art,
    min,
    max,
    step,
    unit,
    fallback: state.knobPositions[key],
    className: "home-oracle-tile",
  });
}

function dashboardView() {
  const current = state.currentSet || generateLottoSet(state.gameId, state.strategy, "dashboard");
  return `<section class="screen dashboard-screen">
    <div class="oracle-hero panel art-panel" style="--panel-art:url('${ASSETS.dream}')">
      <video class="oracle-hero-bg-video ambient-video" data-src="${ASSETS.oracleHeroVideo}" muted loop playsinline preload="none" data-autoplay-on-visible="true"></video>
      <div>
        <h1>Oracle Studio</h1>
        <p>Reset, dream, read the map, then run Power Tools with every old feature wired inside one branded app.</p>
        <div class="home-oracle-actions" role="group" aria-label="Oracle Studio rotary controls">
          ${ORACLE_HARDWARE_CONTROLS.map(oracleKnobControl).join("")}
        </div>
      </div>
      <a class="hero-emblem-link" href="${LOTTO_ULTRA_SPHERES_URL}" aria-label="Open LottoMind lottery spheres page">
        <img class="hero-mascot hero-emblem" src="${ASSETS.logo}" alt="LottoMind oracle emblem" />
      </a>
    </div>

    <div class="live-strip panel">
      <div><h2>Live Results</h2><p>Next Draw in</p><strong>02:18:45</strong></div>
      ${ballsHtml([12, 28, 33, 44, 50])}
      <button class="chev-btn" data-route="live">View</button>
    </div>

    <div class="carousel-panel panel">
      <div class="section-head movie-head">
        <div><h2>Oracle Flow</h2><p>Swipe through the main app functions.</p></div>
        <button class="tiny-btn" data-route="powertools">All Tools</button>
      </div>
      <div class="quest-steps oracle-flow-steps">
        ${HOME_CAROUSEL.map(([title, copy, route, art], index) => {
          const customFlowArt = ORACLE_FLOW_ART[title];
          const flowKind = categoryKindForTool(title, route);
          return `
          <button class="quest-step oracle-flow-step" data-route="${route}" data-art-kind="${flowKind}" style="--quest-art:url('${customFlowArt || art}')">
            <b>${String(index + 1).padStart(2, "0")}</b>
            <strong>${title}</strong>
            <small>${copy}</small>
          </button>
        `;
        }).join("")}
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

    <div class="split-grid">
      <button class="action-tile" data-action="menu" data-art-kind="academy" style="--tile-art:url('${CATEGORY_ART.academy}')"><strong>LottoMind Academy</strong><span>Help, settings, policies, and privacy</span></button>
      <button class="action-tile" data-route="marketplace" data-art-kind="marketplace" style="--tile-art:url('${CATEGORY_ART.marketplace}')"><strong>Marketplace</strong><span>Credits, VIP tools, and unlocks</span></button>
    </div>

    <div class="panel home-merch-video" data-art-kind="store">
      <div class="home-merch-catalog" aria-label="Featured products from the LottoMind Merch Store">
        ${MERCH_ITEMS.slice(0, 4).map((item) => `<button class="home-merch-card" data-route="store" style="--product-art:url('${item.art}')">
          <span>${escapeHtml(item.type)}</span><strong>${escapeHtml(item.title)}</strong><b>${item.price}</b>
        </button>`).join("")}
      </div>
      <div class="merch-hero-copy">
        <span class="eyebrow">Official Merch Store</span>
        <h2>LottoMind Gear Drop</h2>
        <p>Featured products are pulled from the same catalog and prices used by the Merch Store.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-route="store">Open Merch Store</button>
          <button class="ghost-btn" data-route="marketplace">Marketplace</button>
        </div>
      </div>
    </div>
  </section>`;
}

function categoryKindForTool(title, route) {
  const label = String(title || "").toLowerCase();
  if (label.includes("dream") || label.includes("psychic") || label.includes("future")) return "dream";
  if (label.includes("music") || label.includes("radio") || label.includes("sonic") || label.includes("energy")) return "music";
  if (label.includes("academy") || label.includes("playbook") || label.includes("help") || label.includes("notification")) return "academy";
  if (label.includes("market") || label.includes("paywall") || label.includes("credit") || label.includes("wallet")) return "marketplace";
  if (label.includes("arcade") || label.includes("trivia") || label.includes("challenge") || label.includes("contest") || label.includes("jackpot")) return "arcade";
  if (label.includes("history") || label.includes("records") || label.includes("vault")) return "history";
  if (label.includes("scanner") || label.includes("ticket")) return "scanner";
  if (label.includes("heatmap") || label.includes("radar")) return "heatmap";
  if (label.includes("sequence") || label.includes("pattern") || label.includes("mirror") || label.includes("wheel")) return "sequence";
  if (label.includes("ai") || label.includes("predictor") || label.includes("intelligence")) return "ai";
  return CATEGORY_KIND_BY_ROUTE[route] || "power";
}

function categoryArtForTool(title, route, index) {
  const kind = categoryKindForTool(title, route);
  const titleArt = {
    "AI News": ASSETS.aiNews,
    "Smart Predictor": ASSETS.aiCoachHost,
    "LottoMind Records": ASSETS.studioRecordsConsole,
    "History": ASSETS.studioRecordsConsole,
    "Ticket Scanner": ASSETS.powerTools,
    "Reset Vault": ASSETS.reset,
    "Dream Oracle": ASSETS.dream,
    "Music Hub": ASSETS.music,
    "Sonic Studio": ASSETS.studioRecordsConsole,
    "Arcade": ASSETS.arcadeArcade,
    "Jackpot Run": ASSETS.arcadeJackpotRun,
    "Academy": ASSETS.arcadeAcademy,
    "Pro Playbook": ASSETS.arcadeProPlaybook,
    "Achievements": ASSETS.arcadeAchievements,
    "Challenges": ASSETS.arcadeChallenges,
    "Contests": ASSETS.arcadeContests,
    "Paywall": ASSETS.arcadePaywall,
    "Trivia": ASSETS.arcadeTrivia,
    "Community": ASSETS.arcadeCommunity,
    "Notifications": ASSETS.arcadeNotifications,
    "Help": ASSETS.arcadeHelp,
  }[title];
  const fallback = [ASSETS.commandDeck, ASSETS.powerTools, ASSETS.heatmap, ASSETS.live, ASSETS.reset, ASSETS.dream, ASSETS.arcade, ASSETS.credit, ASSETS.psychic, ASSETS.music];
  return titleArt || ARCADE_TOOL_ART[route] || CATEGORY_ART[kind] || fallback[index % fallback.length];
}

function circleTool(title, sub, route, index, options = {}) {
  const artKind = categoryKindForTool(title, route);
  const video = title === "Number Analyzer" && !options.preferStaticArt
    ? `<video class="circle-tool-video" data-src="${BASE}/videos/power-tools-dashboard-box.mp4" poster="${ASSETS.powerTools}" muted loop playsinline preload="none" data-autoplay-on-visible="true"></video>`
    : (route === "scanner" || route === "ticketScanner") && !options.preferStaticArt
      ? `<video class="circle-tool-video scanner-tile-video" data-src="${ASSETS.radarTicketScannerVideo}" poster="${ASSETS.powerTools}" muted loop playsinline preload="none" data-autoplay-on-visible="true"></video>`
    : title === "Reset Vault" && !options.preferStaticArt
      ? `<video class="circle-tool-video singer-video" data-src="${BASE}/videos/power-tools-button-green-screen.mp4" poster="${ASSETS.music}" muted loop playsinline preload="none" data-autoplay-on-visible="true"></video>`
      : "";
  const art = options.art || categoryArtForTool(title, route, index);
  const surfaceArt = options.surfaceArt || art;
  const knob = options.knob
    ? knobControlAttributes({ key: `tool:${route}`, label: title, fallback: 30 + ((index * 13) % 58) })
    : null;
  return `<button class="circle-tool" data-route="${route}" data-art-kind="${artKind}" ${knob?.attributes || ""} style="--circle-art:url('${art}');--circle-surface:url('${surfaceArt}');${knob ? `--knob-live-angle:${knob.angle}deg` : ""}">
    ${video}
    <span>${title}</span>
    <small>${sub}</small>
  </button>`;
}

function powerToolsView() {
  const current = state.currentSet || generateLottoSet(state.gameId, state.strategy, "power-tools");
  const commandActions = [
    ["primary-btn", "data-action=\"run-power-analysis\"", "power", "Run Analysis", ASSETS.powerTools],
    ["ghost-btn", "data-route=\"numberGenerator\"", "power", "Number Generator", ASSETS.powerToolNumberAnalyzer],
    ["ghost-btn", "data-route=\"lottoIntel\"", "ai", "Lotto Intelligence", ASSETS.powerToolLottoIntelligence],
    ["ghost-btn", "data-route=\"dailyTools\"", "power", "Pick 3 / Pick 4", ASSETS.powerToolPick34],
    ["ghost-btn", "data-route=\"radioStation\"", "music", "Abundance Radio", ASSETS.dreamToolAbundanceRadio],
    ["ghost-btn", "data-route=\"marketplace\"", "marketplace", "Marketplace", ASSETS.powerToolMarketplace],
  ];
  return `<section class="screen power-screen">
    <div class="panel arcade-deck art-panel" style="--panel-art:url('${ASSETS.power}')">
      <div>
        <h1 class="game-title">Command Deck</h1>
        <p>Swipe tool medals, lock a state pin, then run the next analysis like a mission.</p>
        <div class="hero-actions command-action-grid">
          ${commandActions.map(([className, command, artKind, label, iconArt]) => `<button class="${className} command-action" ${command} data-art-kind="${artKind}" style="--button-surface:url('${ASSETS.commandButtonCore}');--button-icon:url('${iconArt}')"><i aria-hidden="true"></i><span>${label}</span></button>`).join("")}
        </div>
      </div>
      <div class="deck-coin command-crest lm-live-crest"><img src="${ASSETS.lmLive}" alt="LottoMind Live LM logo" /><span>Power Tools</span></div>
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
          ${group.tools.map(([title, sub, route], index) => circleTool(title, sub, route, groupIndex * 4 + index, {
            art: group.title === "Main Lab" ? POWER_TOOL_ART[title] : undefined,
            surfaceArt: group.title === "Main Lab" ? ASSETS.mainLabSurface : undefined,
            preferStaticArt: group.title === "Main Lab",
            knob: group.title === "Main Lab",
          })).join("")}
        </div>
      </div>
    `).join("")}

    <div class="panel result-card mission-output-card video-backed">
      <video data-src="${BASE}/videos/power-tools-dashboard-box.mp4" muted loop playsinline preload="none" data-autoplay-on-visible="true"></video>
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
  const currentPreset = RESET_PRESETS[state.resetPreset] || RESET_PRESETS.calm;
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
    <div class="panel tone-wheel art-panel" style="--panel-art:url('${ASSETS.reset}');--tone-control-art:url('${ASSETS.frequencyToneCore}')">
      <div class="tone-top">
        <h1><span>Frequency</span> Reset</h1>
        <span class="pro-badge">PRO</span>
      </div>
      <div class="tone-chips">
        ${Object.entries(RESET_PRESETS).map(([key, preset]) => `<button class="lm-pill ${state.resetPreset === key ? "active" : ""}" data-action="load-reset-preset" data-preset="${key}">${preset.label}</button>`).join("")}
      </div>
      <div class="wheel-orbit">
        ${tones.filter(([hz]) => hz !== state.tone).slice(0, 4).map(([hz, label], index) => `<button class="orbit-tone t${index + 1}" data-action="load-reset-session" data-tone="${hz}" data-autoplay="true" style="--tone-art:url('${ASSETS.frequencyToneCore}')"><strong>${hz}</strong><small>${label}</small></button>`).join("")}
        <button class="center-tone" data-action="load-reset-session" data-tone="${state.tone}" data-autoplay="true" style="--tone-art:url('${ASSETS.frequencyToneCore}')"><strong>${state.tone} Hz</strong><small>${tones.find(([hz]) => hz === state.tone)?.[1] || "Reset"}</small></button>
      </div>
      <div class="session-card">
        <div><strong>${formatTimer(state.timerRemaining)} ${currentPreset.label} Session</strong><span>${pct}% volume</span></div>
        <div class="progress"><i style="width:${100 - (state.timerRemaining / state.duration) * 100}%"></i></div>
        <div class="ambient-generator">
          <button class="${state.tone === "432" ? "active" : ""}" data-action="load-reset-session" data-tone="432" data-autoplay="true"><span>Rain Generator</span><small>432 Hz rainfield</small></button>
          <button class="${state.tone === "741" ? "active" : ""}" data-action="load-reset-session" data-tone="741" data-autoplay="true"><span>White Noise</span><small>Clean static bed</small></button>
        </div>
        <div class="transport">
          <button data-action="volume-down">-</button>
          <button class="play-btn" data-action="toggle-reset-audio">${state.audioPlaying ? "Pause" : "Play"}</button>
          <button data-action="favorite-tone">Save</button>
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
        ${tones.map(([hz, label], index) => oracleStudioControl({
          key: `reset-tone:${index}`,
          action: "load-reset-session",
          label: `${hz} Hz`,
          hint: `${label} - ${label === "Heart Field" ? "528 Hz box" : hz === "528" ? "Love frequency" : hz === "741" ? "Clear signal" : "Focus support"}`,
          art: ASSETS.frequencyToneCore,
          surfaceArt: ASSETS.frequencyToneCore,
          className: `sound-card tone-pill ${state.tone === hz ? "active" : ""}`,
          extraAttributes: `data-tone="${hz}" data-autoplay="true" data-knob-bind="tone"`,
          min: 174,
          max: 963,
          step: 1,
          unit: "Hz",
          fallback: Number(hz),
          pressVerb: "load tone",
          liveReadout: true,
        })).join("")}
      </div>
    </div>
    ${importedMusicDeckPanel("reset-imported-music")}
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
        <p>Review saved location references, local weather context, and a quick radar path for ${state.selectedState}. Always confirm retailers with the official state lottery.</p>
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
    <div class="panel art-panel media-hero" data-art-kind="ai" style="--panel-art:url('${CATEGORY_ART.ai}')">
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
      <img class="deck-coin ai-coach-mascot" src="${ASSETS.aiCoachHost}" alt="LottoMind AI coach host" />
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
  const micLabel = state.dreamListening ? "Listening..." : "Speak Dream";
  const micHint = state.dreamListening ? "Tap to stop" : "Tap to record";
  return `<section class="screen dreams-screen">
    ${!reading ? `<div class="panel empty-state dream-ready-spotlight dream-ready-top"><h2>Dream engine ready</h2><p>Tap the mic or type a dream, then run the full interpretation.</p></div>` : ""}
    <div class="panel dream-stage art-panel" style="--panel-art:url('${ASSETS.dream}')">
      <h1>Dream Oracle<sup>SM</sup> AI</h1>
      <p>Describe your dream. The Oracle detects symbols, explains meaning, and generates lucky numbers.</p>
      ${gamePills()}
      <button class="big-mic branded-mic dream-oracle-host-mic ${state.dreamListening ? "is-recording" : ""}" data-action="start-dream-recording" aria-label="${state.dreamListening ? "Stop dream recording" : "Record dream"}" style="--panel-art:url('${ASSETS.voiceCornerMic}')">
        <img class="dream-oracle-host-art" src="${ASSETS.voiceCornerMic}" alt="" />
        <span class="mic-mark"></span>
        <strong>${micLabel}</strong>
        <small>${micHint}</small>
      </button>
      <textarea class="dream-input" data-bind="dreamText" placeholder="Speak or type your dream...">${escapeHtml(state.dreamText)}</textarea>
      ${state.dreamListening ? `<div class="dream-dictation-status" role="status">Live dictation active${state.dreamInterimText ? `: ${escapeHtml(state.dreamInterimText)}` : ""}</div>` : ""}
      <div class="hero-actions">
        <button class="primary-btn" data-action="interpret-dream" data-art-kind="dream" style="--button-art:url('${DREAM_ACTION_ART.interpretDream}')"><span class="dream-action-label">Interpret Dream</span></button>
        <button class="ghost-btn" data-action="psychic-fusion" data-art-kind="ai" style="--button-art:url('${DREAM_ACTION_ART.psychicFusion}')"><span class="dream-action-label">Psychic Fusion</span></button>
        <button class="ghost-btn" data-action="build-dream-video" data-art-kind="dream" style="--button-art:url('${DREAM_ACTION_ART.generateDreams}')"><span class="dream-action-label">Generate Your Dreams</span></button>
        <button class="ghost-btn" data-route="studio" data-art-kind="music" style="--button-art:url('${DREAM_ACTION_ART.recordDreamSong}')"><span class="dream-action-label">Record Dream Song</span></button>
      </div>
    </div>

    <div class="panel tool-bank dream-oracle-tools">
      <div class="section-head">
        <div><h2>${ORACLE_STUDIO_GROUP.title}</h2><p>${ORACLE_STUDIO_GROUP.copy}</p></div>
        <span>${ORACLE_STUDIO_GROUP.tools.length} tools</span>
      </div>
      <div class="circle-carousel tool-bento dream-studio-bento">
        ${ORACLE_STUDIO_GROUP.tools.map(([title, sub, route], index) => circleTool(title, sub, route, index + 3, { art: DREAM_TOOL_ART[title], preferStaticArt: true, knob: true })).join("")}
      </div>
    </div>

    ${dreamGeneratePanel()}

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

    <div class="panel record-label-panel dream-record-label future-music-store art-panel" data-art-kind="music" style="--panel-art:url('${ASSETS.futureMusicStoreHero}');--record-surface:url('${ASSETS.futureMusicControlSurface}')">
      <div>
        <span class="eyebrow">LottoMind Records</span>
        <h2>Music Store</h2>
        <p>Prominent dream-lane audio store for reset sessions, radio intros, and dream video sound beds.</p>
      </div>
      <div class="hero-actions">
        <button class="primary-btn record-disc-btn" data-route="music" style="--record-art:url('${RECORD_BUTTON_ART.music}')">Open Music Store</button>
        <button class="ghost-btn record-disc-btn" data-route="radioStation" style="--record-art:url('${RECORD_BUTTON_ART.radioStation}')">Abundance Radio</button>
        <button class="ghost-btn record-disc-btn" data-route="studio" style="--record-art:url('${RECORD_BUTTON_ART.studio}')">Sonic Studio</button>
        <button class="ghost-btn record-disc-btn" data-route="dreamVideo" style="--record-art:url('${RECORD_BUTTON_ART.dreamVideo}')">Dream Video</button>
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
        <button class="ghost-btn" data-route="radioStation">Abundance Radio</button>
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
        ].map(([title, sub, route], index) => circleTool(title, sub, route, index + 2, { art: GENERATOR_ADDON_ART[title], preferStaticArt: true })).join("")}
      </div>
    </div>
    <div class="panel radio-mini">
      <div><span class="eyebrow">Abundance Radio</span><h2>Frequency while you generate</h2><p>Open the dedicated radio lane for LottoMind Records tracks and reset audio.</p></div>
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
  const heatmap = getHeatmap("powerball");
  const stats = getMatrixStats("powerball");
  const radarPicks = Array.isArray(state.radarPicks) ? state.radarPicks : [];
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
        <p>${stats.game.name} - ${stats.drawCount} reference draws - pattern view only, not predictive.</p>
      </div>
      <div class="radar-summary">
        <strong>${state.selectedState}</strong>
        <small>State pin</small>
        <em>${stats.trustScore}%</em>
      </div>
      ${gamePills()}
    </div>
    <div class="panel radar-controls" role="group" aria-label="Radar rotary controls">
      ${[
        ["Target Lock", "hot", String(topSignal.number), STRATEGY_ART.hot || ASSETS.hot],
        ["Cold Sweep", "cold", String(lowSignal.number), STRATEGY_ART.cold || ASSETS.cold],
        ["Balance Lane", "balanced", "Mix", STRATEGY_ART.balanced || ASSETS.balanced],
        ["Save Set", "history", "Open vault", ASSETS.live],
        ["Run Power Tools", "powertools", "Open lab", ASSETS.powerTools],
        ["Store Locator", "storeLocator", "Find stores", ASSETS.heatmap],
      ].map(([label, mode, hint, art], index) => oracleStudioControl({
        key: `radar-action:${mode}:${index}`,
        label,
        hint,
        art,
        surfaceArt: ASSETS.radarRotaryCore,
        action: ["hot", "cold", "balanced"].includes(mode) ? "set-strategy" : "",
        route: ["hot", "cold", "balanced"].includes(mode) ? "" : mode,
        className: `control-chip ${state.strategy === mode ? "active" : ""}`,
        extraAttributes: ["hot", "cold", "balanced"].includes(mode) ? `data-strategy="${mode}" aria-pressed="${state.strategy === mode ? "true" : "false"}"` : "",
        fallback: 28 + (index * 12),
        pressVerb: ["hot", "cold", "balanced"].includes(mode) ? "select" : "open",
      })).join("")}
    </div>
    <div class="panel quick-panel radar-quick-panel">
      <div class="section-head"><div><h2>Radar Tool Deck</h2><p>Old functions grouped under the Radar tab as swipeable Oracle buttons.</p></div><span>${QUICK_TOOLS.length} tools</span></div>
      <div class="circle-carousel oracle-control-carousel" role="group" aria-label="Radar tool controls">
        ${QUICK_TOOLS.map(([title, sub, route], index) => oracleStudioControl({
          key: `radar-tool:${route}:${index}`,
          route,
          label: title,
          hint: sub,
          art: HEATMAP_TOOL_ART[title] || categoryArtForTool(title, route, index),
          surfaceArt: ASSETS.radarToolDeckCore,
          className: "radar-tool-control",
          fallback: 30 + ((index * 13) % 58),
        })).join("")}
      </div>
    </div>
    <div class="panel radar-panel">
      <div class="radar-titlebar">
        <div><span>Live Board</span><strong>${stats.game.name} Signal Grid</strong></div>
        <button class="tiny-btn" data-action="build-radar-locks">Generate from Radar</button>
      </div>
      <div class="radar-lock-strip" role="status" aria-live="polite">
        <div><span>Target locks</span><strong>${radarPicks.length ? radarPicks.join(" / ") : "Tap signal nodes"}</strong><small>${radarPicks.length}/${stats.game.mainCount} main-number locks</small></div>
        <div class="radar-lock-actions"><button type="button" data-action="clear-radar-picks" ${radarPicks.length ? "" : "disabled"}>Clear</button><button type="button" data-action="build-radar-locks">Build set</button></div>
      </div>
      <div class="radar-map ${heatmap.length > 36 ? "dense" : ""}">
        ${heatmap.map((cell, index) => radarDot(cell, index, heatmap.length)).join("")}
      </div>
      <div class="legend"><span class="hot"></span> Hot <span class="active"></span> Active <span class="cold"></span> Cold</div>
    </div>
    ${todaysSnapshotPanel("Radar Snapshot")}
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
    const angle = index * 2.399963229728653;
    const radius = 14 + Math.sqrt((index + 0.5) / total) * 31;
    x = 50 + Math.cos(angle) * radius;
    y = 50 + Math.sin(angle) * radius;
  } else {
    [x, y] = RADAR_POSITIONS[index % RADAR_POSITIONS.length];
  }
  const selected = Array.isArray(state.radarPicks) && state.radarPicks.includes(cell.number);
  const signalLabel = cell.label === "hot" ? "hot" : cell.label === "cold" ? "cold" : "active";
  return `<button type="button" class="radar-dot ${cell.label} ${selected ? "selected" : ""}" data-action="toggle-radar-number" data-number="${cell.number}" aria-pressed="${selected ? "true" : "false"}" aria-label="${cell.number}, ${signalLabel} signal, ${cell.count} reference hits" title="${cell.number}: ${signalLabel}, ${cell.count} hits" style="left:${x}%;top:${y}%">${cell.number}</button>`;
}

function buildRadarSetFromLocks() {
  const game = getGame("powerball");
  const locked = uniqueSorted((state.radarPicks || []).filter((number) => number >= 1 && number <= game.mainMax)).slice(0, game.mainCount);
  const generated = generateLottoSet("powerball", state.strategy, `radar-locks-${locked.join("-")}`);
  const numbers = uniqueSorted([...locked, ...generated.numbers]).slice(0, game.mainCount);
  state.currentSet = {
    ...generated,
    numbers,
    note: locked.length
      ? `Built from ${locked.length} player-selected Radar lock${locked.length === 1 ? "" : "s"}, then completed with the ${state.strategy} lane.`
      : `Built from the current ${state.strategy} Radar lane with no manual locks.`,
  };
  toast(locked.length ? `Radar set built with ${locked.length} locked signal${locked.length === 1 ? "" : "s"}` : "Radar set generated");
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
    <div class="panel art-panel" data-art-kind="history" style="--panel-art:url('${CATEGORY_ART.history}')">
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
      <p>Saved reference results for state and national games. Verify every result with the official lottery operator. Pin ${state.selectedState} controls the local rows.</p>
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
      <p>Capture a ticket image or enter its barcode. Always verify tickets with the official lottery operator or retailer.</p>
      <div class="scanner-frame">
        <video class="scanner-video" data-src="${ASSETS.ticketScannerVideo}" muted loop playsinline preload="none" data-autoplay-on-visible="true"></video>
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
        <button class="ghost-btn" data-route="history">Records</button>
      </div>
    </div>
    <div class="panel result-card scanner-result">${result ? `<span>Scanner output</span><h2>${result.title}</h2><p>${result.note}</p><div class="tool-grid padded">${metricCard("Barcode", result.barcode || "Image only")}${metricCard("Status", result.status || "Needs official verification")}${metricCard("Game", result.matchedGame || getGame().name)}</div><div class="hero-actions"><button class="primary-btn" data-route="live">Open Reference Results</button></div>` : `<p>No scan yet. Upload a ticket image or enter a barcode. Images stay on this device unless you choose to share them.</p>`}</div>
  </section>`;
}

function walletView() {
  const credits = getCredits();
  const unlocks = getUnlocks();
  return `<section class="screen">
    <div class="panel art-panel" style="--panel-art:url('${ASSETS.credit}')">
      <h1>Activity Points</h1>
      <p>Free points earned inside LottoMind unlock local activities. They cannot be purchased, transferred, redeemed for cash, or used to buy lottery tickets.</p>
      <div class="credit-balance">${credits}</div>
    </div>
    <div class="tool-grid">${FEATURE_UNLOCKS.map((item) => `<button class="store-card ${isUnlocked(item.id) ? "unlocked" : ""}" data-action="unlock-feature" data-unlock="${item.id}"><strong>${item.title}</strong><span>${item.window}</span><small>${isUnlocked(item.id) ? "Unlocked" : `${item.cost} points`}</small></button>`).join("")}</div>
    <div class="panel result-card"><span>Unlocked Activities</span><h2>${Object.values(unlocks).filter((item) => isUnlocked(item.id)).length} active</h2><p>Activity points have no monetary value and remain on this device.</p></div>
  </section>`;
}

function musicHubView(isRadio = false) {
  const motionPanel = isRadio ? "" : musicHubMotionPanel();
  return `<section class="screen media-screen">
    <div class="panel art-panel media-hero" style="--panel-art:url('${ASSETS.music}')">
      <div>
        <span class="eyebrow">${isRadio ? "Abundance Radio" : "Music Hub"}</span>
        <h1>${isRadio ? "Abundance Radio" : "Music Store"}</h1>
        <p>${isRadio ? "A dedicated Abundance Radio lane for live focus audio, reset tracks, and branded station IDs." : "LottoMind Records label: imported frequency tracks, reset sessions, and branded audio loops connected back into Reset."}</p>
        <div class="hero-actions">
          <button class="primary-btn" data-route="reset">Open Reset Wheel</button>
          <button class="ghost-btn" data-route="music">Music Store</button>
          <button class="ghost-btn" data-route="studio">Sonic Studio</button>
          <button class="ghost-btn" data-route="dreamVideo">Open Video Studio</button>
        </div>
      </div>
      <img class="deck-coin" src="${ASSETS.turntable}" alt="LottoMind frequency record deck" />
    </div>
    <div class="panel radio-station-panel">
      <div>
        <span class="eyebrow">On Air</span>
        <h2>Abundance Frequency Radio</h2>
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
    ${importedMusicDeckPanel()}
    ${musicHubTurntablePanel(isRadio)}
    ${motionPanel}
    <div class="panel related-panel">
      <div class="section-head"><div><h2>Sound Routes</h2><p>Fast paths connected to the rest of the app.</p></div></div>
      <div class="sound-route-bento">
        ${[["Reset Wheel", "Tone player", "reset", ASSETS.reset], ["Abundance Radio", "Live audio", "radioStation", ASSETS.music], ["Sonic Studio", "Record booth", "studio", ASSETS.studioBooth], ["Dream Oracle", "Speak", "dreams", ASSETS.dream], ["Video Studio", "Loops", "dreamVideo", ASSETS.arcade], ["History Vault", "Archive", "history", ASSETS.live]].map(([title, sub, route, art], index) => `
          <button class="sound-route-card ${index === 0 ? "featured" : ""}" data-route="${route}" style="--route-art:url('${art}')">
            ${index === 0 ? `<video class="route-video-bg" data-src="${BASE}/videos/power-tools-button-green-screen.mp4" muted loop playsinline preload="none" data-autoplay-on-visible="true"></video>` : ""}
            <span>0${index + 1}</span>
            <strong>${title}</strong>
            <small>${sub}</small>
          </button>
        `).join("")}
      </div>
    </div>
  </section>`;
}

function importedMusicDeckPanel(extraClass = "") {
  return `<div class="panel audio-deck imported-music-deck ${extraClass}">
      <div class="section-head"><div><h2>Imported Music</h2><p>Branded tracks and frequency sessions.</p></div><span>${AUDIO_LIBRARY.length} tracks</span></div>
      <div class="audio-list record-audio-list">
        ${AUDIO_LIBRARY.map(([title, src, copy, art], index) => `<article class="media-card record-track-card vinyl-style-card" style="--record-art:url('${art || [ASSETS.logo, ASSETS.music, ASSETS.reset, ASSETS.live][index % 4]}')">
          <span class="vinyl-record" aria-hidden="true"></span>
          <div class="track-copy"><strong>${title}</strong><small>${copy}</small></div>
          <audio controls preload="none" src="${src}"></audio>
          <button class="ghost-btn" data-action="load-reset-session" data-tone="${title.includes("174") ? "174" : title.includes("432") ? "432" : title.includes("Frequency") ? "528" : "396"}">Load in LottoMind Reset</button>
        </article>`).join("")}
      </div>
    </div>`;
}

function musicHubTurntablePanel(isRadio = false) {
  const importedTracks = AUDIO_LIBRARY;
  const stemTracks = STUDIO_DEFAULT_STEM_ASSETS;
  const trackRows = (items, type) => items.map((item, index) => {
    const isStem = type === "stem";
    const title = isStem ? item.name : item[0];
    const src = isStem ? item.url : item[1];
    const copy = isStem ? `${titleCase(item.role)} stem - ${item.sourceBpm || state.studio.bpm} BPM` : item[2];
    return `<article class="mini-turntable-row">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></div>
      <audio controls preload="none" src="${src}"></audio>
    </article>`;
  }).join("");
  return `<div class="panel music-turntable-panel ${isRadio ? "radio-turntable-panel" : ""}">
    <div class="section-head">
      <div><h2>${isRadio ? "Abundance Radio Decks" : "Imported Music Turntables"}</h2><p>Two compact decks for previewing LottoMind tracks and Studio stems.</p></div>
      <span>2 decks</span>
    </div>
    <div class="music-turntable-grid">
      <article class="mini-turntable-deck deck-a" style="--turntable-art:url('${ASSETS.turntable}')">
        <div class="mini-turntable-head"><span>Deck A</span><strong>Imported Music</strong><small>Music Hub library</small></div>
        <div class="mini-vinyl"><b>A</b></div>
        <div class="mini-turntable-list">${trackRows(importedTracks, "audio")}</div>
      </article>
      <article class="mini-turntable-deck deck-b" style="--turntable-art:url('${ASSETS.studioBooth}')">
        <div class="mini-turntable-head"><span>Deck B</span><strong>Studio Stems</strong><small>Kick, snare, clap, and default stems</small></div>
        <div class="mini-vinyl"><b>B</b></div>
        <div class="mini-turntable-list">${trackRows(stemTracks, "stem")}</div>
      </article>
    </div>
  </div>`;
}

function musicHubMotionPanel() {
  return `<div class="panel music-motion-panel">
    <div class="section-head">
      <div><h2>Studio Motion Reel</h2><p>Uploaded LottoMind video placed inside the Music Hub media lane.</p></div>
      <span>Video</span>
    </div>
    <div class="music-motion-stage">
      <video data-src="${ASSETS.musicMotion}" poster="${ASSETS.music}" controls muted playsinline preload="none"></video>
      <div>
        <span class="eyebrow">Fourth Lane</span>
        <h3>LottoMind Records Motion</h3>
        <p>This clip can sit under Imported Music as a branded visual bed for the record decks and Studio stems.</p>
      </div>
    </div>
  </div>`;
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
          <button class="primary-btn" data-action="build-dream-video">Build Board</button>
          <button class="ghost-btn" data-action="start-dream-recording">Mic Dream</button>
          <button class="ghost-btn" data-route="dreams">Dream Oracle</button>
          <button class="ghost-btn" data-route="settings">Settings</button>
        </div>
      </div>
      <img class="deck-coin" src="${ASSETS.live}" alt="LottoMind dream video brand artwork" />
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
        ${storyboard.frames.map(([title, value, copy], index) => `<article class="story-card" style="--story-art:url('${[ASSETS.dream, ASSETS.reset, ASSETS.logo, ASSETS.live][index]}')">
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

function saveStudioProject() {
  const persistable = {
    ...state.studio,
    pads: state.studio.pads.map((pad) => ({
      ...pad,
      sampleData: String(pad.sampleData || "").startsWith("blob:") || String(pad.sampleData || "").length > 950000 ? "" : pad.sampleData,
      sampleTooLargeForSave: pad.sampleTooLargeForSave || String(pad.sampleData || "").startsWith("blob:") || String(pad.sampleData || "").length > 950000,
    })),
    stems: (state.studio.stems || []).map((stem) => ({
      ...stem,
      data: String(stem.data || "").startsWith("blob:") || String(stem.data || "").length > 950000 ? "" : stem.data,
      sessionOnly: stem.sessionOnly || String(stem.data || "").startsWith("blob:") || String(stem.data || "").length > 950000,
    })),
    vocals: state.studio.vocals.map((track) => ({
      ...track,
      data: String(track.data || "").length > 950000 ? "" : track.data,
      sessionOnly: track.sessionOnly || String(track.data || "").length > 950000,
    })),
  };
  try {
    saveJson(STORAGE.studio, persistable);
  } catch {
    const trimmed = {
      ...persistable,
      pads: persistable.pads.map((pad) => ({ ...pad, sampleData: "", sampleTooLargeForSave: Boolean(pad.sampleData) })),
      stems: persistable.stems.map((stem) => ({ ...stem, data: "", sessionOnly: Boolean(stem.data) || stem.sessionOnly })),
      vocals: persistable.vocals.map((track) => ({ ...track, data: "", sessionOnly: Boolean(track.data) || track.sessionOnly })),
    };
    try {
      saveJson(STORAGE.studio, trimmed);
      toast("Large audio was kept for this session; export sounds to keep them safely.");
    } catch {
      toast("Studio project is too large for browser storage. Export the project/sounds.");
    }
  }
}

function studioStepsPerBeat(division = state.studio.division) {
  const exact = {
    "1/4": 1,
    "1/4T": 1.5,
    "1/8": 2,
    "1/8T": 3,
    "1/16": 4,
    "1/16T": 6,
    "1/32": 8,
    "1/32T": 12,
    "1/64": 16,
    "1/64T": 24,
  };
  if (exact[division]) return exact[division];
  const base = Number(String(division).match(/\d+/)?.[0] || 16);
  const steps = base / 4;
  return Math.max(1, String(division).includes("T") ? steps * 1.5 : steps);
}

function studioTotalSteps(division = state.studio.division) {
  return Math.max(16, Math.round(16 * 4 * studioStepsPerBeat(division)));
}

function studioVisibleSteps() {
  const preferred = Math.max(32, Math.min(192, Number(state.studio.pageSize) || 128));
  return Math.min(preferred, studioTotalSteps());
}

function studioStepPageCount() {
  return Math.max(1, Math.ceil(studioTotalSteps() / studioVisibleSteps()));
}

function studioStepOffset() {
  const pages = studioStepPageCount();
  const page = Math.max(0, Math.min(pages - 1, Number(state.studio.stepPage) || 0));
  state.studio.stepPage = page;
  return page * studioVisibleSteps();
}

function studioStepSeconds() {
  return (60 / Math.max(40, Number(state.studio.bpm) || 92)) / studioStepsPerBeat();
}

function studioStepMs() {
  return studioStepSeconds() * 1000;
}

function studioSwingSeconds(step) {
  const swing = Math.max(0, Math.min(75, Number(state.studio.swing) || 0));
  if (studioStepsPerBeat() < 2 || step % 2 === 0) return 0;
  return studioStepSeconds() * (swing / 100) * (String(state.studio.division).includes("T") ? 0.18 : 0.48);
}

function studioLottoConfig() {
  const fallback = createDefaultStudioProject().lotto;
  state.studio.lotto = { ...fallback, ...(state.studio.lotto || {}) };
  return state.studio.lotto;
}

function studioEntropyToken() {
  try {
    const values = new Uint32Array(4);
    window.crypto?.getRandomValues?.(values);
    if (values.some(Boolean)) return Array.from(values).join("-");
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function studioBeatFeatures() {
  const total = studioTotalSteps();
  const events = (state.studio.events || [])
    .filter((event) => Number.isFinite(Number(event.step)))
    .map((event) => ({
      type: event.type || "pad",
      pad: Math.max(0, Math.min(15, Number(event.pad) || 0)),
      stem: Math.max(0, Math.min(7, Number(event.stem) || 0)),
      note: event.note || "",
      step: ((Number(event.step) || 0) + total) % total,
      velocity: Math.max(1, Math.min(127, Number(event.velocity) || Number(state.studio.velocity) || 82)),
      offset: Number(event.offset) || 0,
    }))
    .sort((a, b) => a.step - b.step || a.pad - b.pad || String(a.note).localeCompare(String(b.note)));
  const padCounts = Array.from({ length: 16 }, () => 0);
  const velocities = [];
  let noteCount = 0;
  let drumCount = 0;
  let stemEventCount = 0;
  events.forEach((event) => {
    if (event.type === "note") noteCount += 1;
    else if (event.type === "stem") stemEventCount += 1;
    else {
      drumCount += 1;
      padCounts[event.pad] = (padCounts[event.pad] || 0) + 1;
    }
    velocities.push(event.velocity);
  });
  const beatStep = Math.max(1, Math.round(studioStepsPerBeat()));
  const downbeatHits = events.filter((event) => event.step % beatStep === 0).length;
  const syncopatedHits = Math.max(0, events.length - downbeatHits);
  const sampleCount = (state.studio.pads || []).filter((pad) => pad.sampleData).length;
  const vocalCount = (state.studio.vocals || []).filter((track) => track.data).length;
  const stemCount = (state.studio.stems || []).filter((stem) => stem.data).length;
  const defaultStemCount = (state.studio.stems || []).filter((stem) => stem.data && isStudioDefaultStemUrl(stem.data)).length;
  const customStemCount = (state.studio.stems || []).filter((stem) => stem.data && !isStudioDefaultStemUrl(stem.data)).length;
  const defaultPadSliceCount = (state.studio.pads || []).filter((pad) => pad.sampleData && isStudioDefaultStemUrl(pad.sampleData)).length;
  const dj = state.studio.dj || createDefaultStudioProject().dj;
  const djDecks = [dj.deckA || {}, dj.deckB || {}];
  const djStemCount = djDecks.filter((deck) => state.studio.stems?.[Number(deck.stemIndex)]?.data).length;
  const djMix = Math.round(Number(dj.crossfader) || 50);
  const djEnergy = djDecks.reduce((sum, deck, index) => {
    const stem = state.studio.stems?.[Number(deck.stemIndex)] || {};
    return sum + (stem.data ? 71 + index * 13 : 0) + (Number(deck.volume) || 0) + Math.abs(Number(deck.pitch) || 0) + (Number(deck.filter) || 0);
  }, djMix);
  const fx = state.studio.effects || {};
  const effectEnergy = Object.values(fx).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const avgVelocity = velocities.length ? Math.round(velocities.reduce((sum, value) => sum + value, 0) / velocities.length) : Number(state.studio.velocity) || 82;
  const accentSum = events.reduce((sum, event, index) => sum + (event.step + 1) * (event.pad + 1) + Math.round(event.velocity) * (index + 3), 0);
  return {
    total,
    events,
    eventCount: events.length,
    drumCount,
    noteCount,
    stemEventCount,
    padCounts,
    padsUsed: padCounts.filter(Boolean).length,
    density: Math.round((events.length / Math.max(1, total)) * 10000) / 100,
    downbeatHits,
    syncopatedHits,
    sampleCount,
    vocalCount,
    stemCount,
    defaultStemCount,
    customStemCount,
    defaultPadSliceCount,
    djStemCount,
    djMix,
    djEnergy,
    avgVelocity,
    effectEnergy,
    accentSum,
  };
}

function studioBeatSignature(extra = "") {
  const features = studioBeatFeatures();
  const slimPads = (state.studio.pads || []).map((pad, index) => ({
    index,
    name: pad.name,
    type: pad.type,
    velocity: pad.velocity,
    sampleName: pad.sampleName || "",
    trimStart: pad.trimStart,
    trimEnd: pad.trimEnd,
    pitch: pad.pitch,
    gain: pad.gain,
    reverse: Boolean(pad.reverse),
    muted: Boolean(pad.muted),
  }));
  const slimVocals = (state.studio.vocals || []).map((track, index) => ({
    index,
    name: track.name,
    fileName: track.fileName || "",
    volume: track.volume,
    startStep: track.startStep,
    muted: Boolean(track.muted),
    solo: Boolean(track.solo),
    loaded: Boolean(track.data),
  }));
  const slimStems = (state.studio.stems || []).map((stem, index) => ({
    index,
    name: stem.name,
    fileName: stem.fileName || "",
    volume: stem.volume,
    startStep: stem.startStep,
    sourceBpm: stem.sourceBpm,
    sync: Boolean(stem.sync),
    muted: Boolean(stem.muted),
    solo: Boolean(stem.solo),
    sequenceEnabled: Boolean(stem.sequenceEnabled),
    loaded: Boolean(stem.data),
    padTarget: stem.padTarget,
  }));
  const slimDj = {
    crossfader: Number(state.studio.dj?.crossfader) || 50,
    recordLaunches: Boolean(state.studio.dj?.recordLaunches),
    deckA: { ...(state.studio.dj?.deckA || {}) },
    deckB: { ...(state.studio.dj?.deckB || {}) },
  };
  const slimEvents = features.events.slice(0, 4096).map((event) => [
    event.type,
    event.type === "stem" ? event.stem : event.pad,
    event.note,
    event.step,
    Math.round(event.velocity),
    Number(event.offset || 0).toFixed(4),
  ]);
  return JSON.stringify({
    projectName: state.studio.projectName || "LottoMind Studio",
    bpm: Number(state.studio.bpm) || 92,
    division: state.studio.division || "1/16",
    swing: Number(state.studio.swing) || 0,
    velocity: Number(state.studio.velocity) || 82,
    humanize: Number(state.studio.humanize) || 0,
    effects: state.studio.effects || {},
    features: {
      total: features.total,
      eventCount: features.eventCount,
      padsUsed: features.padsUsed,
      stemEventCount: features.stemEventCount,
      density: features.density,
      downbeatHits: features.downbeatHits,
      syncopatedHits: features.syncopatedHits,
      sampleCount: features.sampleCount,
      vocalCount: features.vocalCount,
      stemCount: features.stemCount,
      defaultStemCount: features.defaultStemCount,
      customStemCount: features.customStemCount,
      defaultPadSliceCount: features.defaultPadSliceCount,
      djStemCount: features.djStemCount,
      djMix: features.djMix,
      djEnergy: features.djEnergy,
      avgVelocity: features.avgVelocity,
      effectEnergy: features.effectEnergy,
      accentSum: features.accentSum,
    },
    pads: slimPads,
    stems: slimStems,
    dj: slimDj,
    vocals: slimVocals,
    events: slimEvents,
    extra,
  });
}

function studioNumberFromRange(value, game) {
  const raw = Math.abs(Math.floor(Number(value) || 0));
  return game.mainMax === 9 ? raw % 10 : (raw % game.mainMax) + 1;
}

function studioBuildNumberCandidates(features, game, method, functionMode) {
  const candidates = [];
  const bpm = Math.round(Number(state.studio.bpm) || 92);
  const swing = Math.round(Number(state.studio.swing) || 0);
  const human = Math.round(Number(state.studio.humanize) || 0);
  const total = Math.max(1, features.total);
  const beatStep = Math.max(1, Math.round(studioStepsPerBeat()));
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];
  const fib = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];
  const fx = state.studio.effects || {};
  const dj = state.studio.dj || createDefaultStudioProject().dj;
  const djDecks = [dj.deckA || {}, dj.deckB || {}];
  djDecks.forEach((deck, index) => {
    const stem = state.studio.stems?.[Number(deck.stemIndex)] || {};
    const stemCode = `${stem.name || ""}:${stem.fileName || ""}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const raw = stemCode + (Number(deck.volume) || 0) * 5 + (Number(deck.filter) || 0) * 7 + Math.round((Number(deck.pitch) || 0) * 11) + (Number(dj.crossfader) || 50) * (index + 3);
    if (stem.data) candidates.push(studioNumberFromRange(raw + features.djEnergy + bpm, game));
  });
  features.events.forEach((event, index) => {
    const pad = event.type === "note" ? 17 : event.pad + 1;
    const step = event.step + 1;
    const velocity = Math.round(event.velocity || features.avgVelocity || 82);
    const offset = Math.round((Number(event.offset) || 0) * 1000);
    const noteCode = String(event.note || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    let raw = step + pad * 7 + velocity * 3 + bpm * 5 + swing * 2 + human + offset + noteCode;
    if (functionMode === "fibonacci") raw += fib[(index + pad + features.padsUsed) % fib.length] * 3;
    else if (functionMode === "velocity-map") raw = velocity * (pad + 3) + step * Math.max(1, features.padsUsed) + bpm + noteCode;
    else if (functionMode === "syncopation") raw += (event.step % beatStep ? 37 : 11) * (index + 1) + features.syncopatedHits * 5;
    else raw += primes[(index + pad + Math.round(features.density)) % primes.length] * 5;
    if (method === "function-lab") raw += features.effectEnergy * 2 + features.sampleCount * 19 + features.vocalCount * 23;
    candidates.push(studioNumberFromRange(raw, game));
    candidates.push(studioNumberFromRange(raw + features.padCounts[event.pad] * 17 + total + index * 13, game));
  });
  features.padCounts.forEach((count, index) => {
    if (!count) return;
    candidates.push(studioNumberFromRange((index + 1) * count * 13 + bpm + swing + total, game));
    candidates.push(studioNumberFromRange((index + 1) * 31 + count * features.avgVelocity + features.accentSum, game));
  });
  Object.entries(fx).forEach(([key, value], index) => {
    const keyCode = key.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    candidates.push(studioNumberFromRange(keyCode + Number(value || 0) * (index + 5) + bpm, game));
  });
  if (!candidates.length) {
    [bpm, total, swing, human, features.avgVelocity, features.effectEnergy, features.sampleCount * 11, features.vocalCount * 17]
      .forEach((value, index) => candidates.push(studioNumberFromRange(value + primes[index % primes.length] * 9, game)));
  }
  return candidates;
}

function studioPickMainNumbers(candidates, rng, game) {
  const allowRepeats = game.mainMax === 9;
  const picks = [];
  const shuffled = candidates
    .map((number, index) => ({ number, rank: rng() + index / Math.max(1, candidates.length * 1000) }))
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.number);
  let cursor = 0;
  let safety = 0;
  while (picks.length < game.mainCount && safety < 5000) {
    safety += 1;
    const candidate = cursor < shuffled.length
      ? shuffled[cursor]
      : studioNumberFromRange(Math.floor(rng() * 100000000), game);
    cursor += 1;
    if (allowRepeats || !picks.includes(candidate)) picks.push(candidate);
  }
  return allowRepeats ? picks : uniqueSorted(picks);
}

function generateStudioLottoSet(index = 0) {
  const lotto = studioLottoConfig();
  const game = getGame(lotto.gameId || state.gameId);
  const method = lotto.method || "beat-signature";
  const functionMode = lotto.functionMode || "groove-prime";
  const methodLabel = STUDIO_LOTTO_METHODS.find((item) => item[0] === method)?.[1] || "Beat Signature";
  const functionLabel = STUDIO_LOTTO_FUNCTIONS.find((item) => item[0] === functionMode)?.[1] || "Prime Pulse";
  const entropy = method === "live-groove" || lotto.entropy ? studioEntropyToken() : "locked";
  const features = studioBeatFeatures();
  const signature = studioBeatSignature(`${method}:${functionMode}:${game.id}:${index}:${entropy}`);
  const rng = seededRandom(signature);
  const candidates = studioBuildNumberCandidates(features, game, method, functionMode);
  const numbers = studioPickMainNumbers(candidates, rng, game);
  const special = game.specialMax
    ? (Math.abs(hashSeed(`${signature}:special:${features.accentSum}`) + Math.floor(rng() * 1000000)) % game.specialMax) + 1
    : undefined;
  const compactFeatures = {
    events: features.eventCount,
    padsUsed: features.padsUsed,
    density: features.density,
    samples: features.sampleCount,
    vocals: features.vocalCount,
    avgVelocity: features.avgVelocity,
  };
  return {
    id: `studio_${Date.now()}_${index}_${Math.floor(rng() * 10000)}`,
    gameId: game.id,
    gameName: game.name,
    strategy: "beat-to-lotto",
    numbers,
    special,
    specialName: game.specialName,
    createdAt: new Date().toISOString(),
    note: `Beat2Lotto ${methodLabel} using ${functionLabel}: ${features.eventCount} events, ${features.padsUsed} pads, ${features.density}% density, ${features.avgVelocity} avg velocity. Creative picks only; random draws are not predictable.`,
    beat2Lotto: {
      method,
      methodLabel,
      functionMode,
      functionLabel,
      gameId: game.id,
      bpm: Number(state.studio.bpm) || 92,
      division: state.studio.division,
      features: compactFeatures,
    },
  };
}

function generateStudioLottoPicks() {
  const lotto = studioLottoConfig();
  const count = Math.max(1, Math.min(10, Number(lotto.setCount) || 3));
  const picks = Array.from({ length: count }, (_, index) => generateStudioLottoSet(index));
  lotto.lastPicks = picks;
  lotto.lastSet = picks[0] || null;
  state.currentSet = lotto.lastSet;
  state.gameId = lotto.lastSet?.gameId || state.gameId;
  localStorage.setItem("lottomind.oracle.real.game", state.gameId);
  saveStudioProject();
  return picks;
}

function studioLottoSetText(set) {
  if (!set) return "";
  const main = (set.numbers || []).join("-");
  const bonus = set.special !== undefined ? ` ${set.specialName || "Bonus"}: ${set.special}` : "";
  return `${set.gameName}: ${main}${bonus}`;
}

function copyStudioLottoSet() {
  const lotto = studioLottoConfig();
  const text = (lotto.lastPicks || []).map(studioLottoSetText).filter(Boolean).join("\n");
  if (!text) {
    toast("Generate Beat2Lotto picks first.");
    return;
  }
  navigator.clipboard?.writeText?.(text).then(() => toast("Beat2Lotto picks copied")).catch(() => toast(text));
}

function makeStudioDriveCurve(amount = 0) {
  const samples = 512;
  const curve = new Float32Array(samples);
  const drive = Math.max(0.0001, Number(amount) || 0) / 100;
  const k = drive * 62;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function makeStudioImpulse(ctx, seconds = 1.8, decay = 2.35) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function resetStudioConnections() {
  [studioMaster, studioDrive, studioFilter, studioCompressor, studioDryGain, studioReverb, studioReverbGain, studioDelay, studioDelayWet, studioFeedback, studioOutputGain].forEach((node) => {
    try { node?.disconnect?.(); } catch {}
  });
}

function ensureStudioAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!studioCtx || studioCtx.state === "closed") {
    studioCtx = new AudioContext();
    studioMaster = studioCtx.createGain();
    studioDrive = studioCtx.createWaveShaper();
    studioFilter = studioCtx.createBiquadFilter();
    studioCompressor = studioCtx.createDynamicsCompressor();
    studioDryGain = studioCtx.createGain();
    studioReverb = studioCtx.createConvolver();
    studioReverbGain = studioCtx.createGain();
    studioDelay = studioCtx.createDelay(2.5);
    studioDelayWet = studioCtx.createGain();
    studioFeedback = studioCtx.createGain();
    studioOutputGain = studioCtx.createGain();
    studioDestination = studioCtx.createMediaStreamDestination();
    studioMaster.gain.value = 0.72;
    studioDrive.oversample = "4x";
    studioFilter.type = "lowpass";
    studioReverb.buffer = makeStudioImpulse(studioCtx, 1.9, 2.4);
    resetStudioConnections();
    studioMaster.connect(studioDrive);
    studioDrive.connect(studioFilter);
    studioFilter.connect(studioCompressor);
    studioCompressor.connect(studioDryGain);
    studioDryGain.connect(studioOutputGain);
    studioCompressor.connect(studioReverb);
    studioReverb.connect(studioReverbGain);
    studioReverbGain.connect(studioOutputGain);
    studioCompressor.connect(studioDelay);
    studioDelay.connect(studioDelayWet);
    studioDelayWet.connect(studioOutputGain);
    studioDelay.connect(studioFeedback);
    studioFeedback.connect(studioDelay);
    studioOutputGain.connect(studioCtx.destination);
    studioOutputGain.connect(studioDestination);
  }
  if (studioCtx.state === "suspended") studioCtx.resume().catch(() => {});
  updateStudioEffects();
  return studioCtx;
}

function updateStudioEffects() {
  if (!studioCtx || !studioFilter || !studioFeedback || !studioMaster || !studioDrive || !studioCompressor) return;
  const fx = state.studio.effects || {};
  const now = studioCtx.currentTime;
  const drive = Math.max(0, Math.min(100, Number(fx.drive) || 0));
  const tone = Math.max(0, Math.min(100, Number(fx.tone) || 76));
  const delay = Math.max(0, Math.min(100, Number(fx.delay) || 0));
  const reverb = Math.max(0, Math.min(100, Number(fx.reverb) || 0));
  const punch = Math.max(0, Math.min(100, Number(fx.punch) || 0));
  studioDrive.curve = makeStudioDriveCurve(drive);
  studioMaster.gain.setTargetAtTime(0.66 + Math.min(0.16, drive / 700), now, 0.025);
  studioFilter.frequency.setTargetAtTime(420 + Math.pow(tone / 100, 1.7) * 17000, now, 0.03);
  studioFilter.Q.setTargetAtTime(0.38 + punch / 78, now, 0.03);
  studioDelay.delayTime.setTargetAtTime(0.07 + (delay / 100) * 0.54, now, 0.03);
  studioFeedback.gain.setTargetAtTime(Math.min(0.62, delay / 165), now, 0.03);
  studioDelayWet?.gain.setTargetAtTime(Math.min(0.42, delay / 220), now, 0.03);
  studioReverbGain?.gain.setTargetAtTime(Math.min(0.46, reverb / 190), now, 0.05);
  studioDryGain?.gain.setTargetAtTime(1 - Math.min(0.22, reverb / 420), now, 0.05);
  studioCompressor.threshold.setTargetAtTime(-30 + punch * 0.18, now, 0.04);
  studioCompressor.knee.setTargetAtTime(18 + punch * 0.12, now, 0.04);
  studioCompressor.ratio.setTargetAtTime(1.8 + punch / 22, now, 0.04);
  studioCompressor.attack.setTargetAtTime(0.006, now, 0.04);
  studioCompressor.release.setTargetAtTime(0.12 + (100 - punch) / 700, now, 0.04);
  studioOutputGain?.gain.setTargetAtTime(0.95, now, 0.03);
}

function studioOutput() {
  ensureStudioAudio();
  return studioMaster || studioCtx?.destination;
}

function makeNoiseBuffer(duration = 0.18, ctxOverride = null) {
  const ctx = ctxOverride || ensureStudioAudio();
  if (!ctx) return null;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(duration * ctx.sampleRate)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function reverseStudioBuffer(buffer) {
  if (!buffer) return null;
  const ctx = ensureStudioAudio();
  if (!ctx) return buffer;
  const copy = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const input = buffer.getChannelData(channel);
    const output = copy.getChannelData(channel);
    for (let i = 0, j = input.length - 1; i < input.length; i += 1, j -= 1) output[i] = input[j];
  }
  return copy;
}

function triggerStudioSynthDrum(type = "perc", velocity = 0.8, when = 0) {
  const ctx = ensureStudioAudio();
  if (!ctx) {
    toast("Tap again in a browser with Web Audio enabled.");
    return;
  }
  const t = Math.max(ctx.currentTime, when || ctx.currentTime);
  const out = studioOutput();
  const amp = Math.max(0.01, Math.min(1, velocity));
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.015, amp * 0.78), t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + (type === "openhat" || type === "crash" || type === "ride" ? 0.65 : 0.24));
  gain.connect(out);
  if (type === "kick") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(155, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.24);
    return;
  }
  if (["snare", "clap", "hat", "openhat", "crash", "ride"].includes(type)) {
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    source.buffer = makeNoiseBuffer(type === "clap" ? 0.28 : type === "hat" ? 0.08 : type === "openhat" ? 0.48 : 0.62, ctx);
    filter.type = type === "snare" || type === "clap" ? "bandpass" : "highpass";
    filter.frequency.value = type === "snare" ? 1850 : type === "clap" ? 1250 : type === "ride" ? 7200 : 6400;
    filter.Q.value = type === "hat" ? 3.2 : 1.1;
    source.connect(filter);
    filter.connect(gain);
    source.start(t);
    source.stop(t + (type === "hat" ? 0.1 : type === "openhat" ? 0.48 : 0.62));
    return;
  }
  const osc = ctx.createOscillator();
  osc.type = type === "bell" ? "triangle" : type === "fx" ? "sawtooth" : "square";
  osc.frequency.setValueAtTime(type === "tom" ? 190 : type === "bell" ? 780 : 360, t);
  osc.frequency.exponentialRampToValueAtTime(type === "fx" ? 88 : 120, t + 0.24);
  osc.connect(gain);
  osc.start(t);
  osc.stop(t + 0.34);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function decodeStudioSample(padIndex) {
  const pad = state.studio.pads[padIndex];
  if (!pad?.sampleData) return null;
  const cacheKey = `${padIndex}:${pad.sampleData}`;
  if (studioSampleBuffers[cacheKey]) return studioSampleBuffers[cacheKey];
  const ctx = ensureStudioAudio();
  if (!ctx) return null;
  const response = await fetch(pad.sampleData);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  studioSampleBuffers[cacheKey] = buffer;
  return buffer;
}

async function studioPadPlaybackBuffer(index) {
  const pad = state.studio.pads[index];
  const buffer = await decodeStudioSample(index).catch(() => null);
  if (!buffer || !pad?.reverse) return buffer;
  const reverseKey = `${index}:${pad.sampleData}:reverse`;
  if (!studioSampleBuffers[reverseKey]) studioSampleBuffers[reverseKey] = reverseStudioBuffer(buffer);
  return studioSampleBuffers[reverseKey] || buffer;
}

async function triggerStudioPad(index, record = true, when = 0, eventVelocity) {
  const pad = state.studio.pads[index];
  if (!pad || pad.muted) return;
  const velocity = Math.max(0.02, (Number(eventVelocity ?? pad.velocity ?? state.studio.velocity) || 80) / 100);
  flashStudioPad(index);
  if (pad.sampleData) {
    const ctx = ensureStudioAudio();
    const buffer = await studioPadPlaybackBuffer(index);
    if (ctx && buffer) {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.playbackRate.value = Math.pow(2, (Number(pad.pitch) || 0) / 12);
      const startAt = Math.max(ctx.currentTime, when || ctx.currentTime);
      gain.gain.setValueAtTime(Math.max(0.0001, velocity * ((Number(pad.gain) || 80) / 100)), startAt);
      source.connect(gain);
      gain.connect(studioOutput());
      const trimStart = Math.max(0, Math.min(95, Number(pad.trimStart) || 0));
      const trimEnd = Math.max(trimStart + 1, Math.min(100, Number(pad.trimEnd) || 100));
      const start = Math.max(0, buffer.duration * (trimStart / 100));
      const end = Math.max(start + 0.02, buffer.duration * (trimEnd / 100));
      try { source.start(startAt, start, end - start); } catch { source.start(ctx.currentTime, start, end - start); }
    }
  } else {
    triggerStudioSynthDrum(pad.type, velocity, when);
  }
  if (record && state.studio.recArmed && state.studioPlaying) recordStudioEvent("pad", index, "", velocity);
}

function flashStudioPad(index) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-studio-pad="${index}"]`);
    if (!el) return;
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 160);
  });
}

function recordStudioEvent(type, pad = 0, note = "", velocity = 0.82) {
  const total = studioTotalSteps();
  const step = Math.max(0, Math.min(total - 1, Math.round(state.studioStep)));
  const event = { id: `ev-${Date.now()}-${Math.random().toString(16).slice(2)}`, type, pad, note, step, velocity: Math.round(velocity * 100), offset: 0 };
  state.studio.events = state.studio.events.filter((item) => !(item.type === type && item.pad === pad && item.note === note && item.step === step)).concat(event);
  saveStudioProject();
}

function scheduleStudioPlayhead(step, when) {
  const ctx = ensureStudioAudio();
  const delay = Math.max(0, ((when || ctx?.currentTime || 0) - (ctx?.currentTime || 0)) * 1000);
  const id = setTimeout(() => {
    if (!state.studioPlaying) return;
    state.studioStep = step % studioTotalSteps();
    renderStudioPlayhead();
  }, delay);
  studioPlayheadTimers.push(id);
  if (studioPlayheadTimers.length > 256) studioPlayheadTimers.splice(0, studioPlayheadTimers.length - 128).forEach(clearTimeout);
}

function scheduleStudioStep(step, when) {
  const total = studioTotalSteps();
  const normalized = ((step % total) + total) % total;
  const baseSwing = studioSwingSeconds(normalized);
  const soloed = state.studio.vocals.some((track) => track.solo);
  const soloedStem = (state.studio.stems || []).some((stem) => stem.solo);
  state.studio.events.filter((event) => Number(event.step) === normalized).forEach((event) => {
    const savedOffset = (Number(event.offset) || 0) * studioStepSeconds();
    const randomHuman = (Math.random() - 0.5) * (Number(state.studio.humanize) || 0) * 0.0008;
    const eventTime = Math.max(ensureStudioAudio()?.currentTime || 0, when + baseSwing + savedOffset + randomHuman);
    const velocity = Math.max(8, Math.min(100, (Number(event.velocity) || state.studio.velocity) + (Math.random() - 0.5) * (Number(state.studio.humanize) || 0) * 0.55));
    if (event.type === "pad") triggerStudioPad(event.pad, false, eventTime, velocity);
    if (event.type === "note") triggerStudioNote(event.note, false, velocity / 100, eventTime);
    if (event.type === "stem") playStudioStem(event.stem, eventTime);
  });
  state.studio.vocals.forEach((track, index) => {
    if (!track.data || track.muted || (soloed && !track.solo)) return;
    if (Number(track.startStep) === normalized) playVocalTrack(index, when + baseSwing);
  });
  (state.studio.stems || []).forEach((stem, index) => {
    if (!stem.data || !stem.sequenceEnabled || stem.muted || (soloedStem && !stem.solo)) return;
    if (Number(stem.startStep) === normalized) playStudioStem(index, when + baseSwing);
  });
  const beatStep = Math.max(1, Math.round(studioStepsPerBeat()));
  if (state.studio.metronome && normalized % beatStep === 0) triggerStudioSynthDrum("bell", 0.18, when);
  scheduleStudioPlayhead(normalized, when);
}

function studioSchedulerTick() {
  const ctx = ensureStudioAudio();
  if (!ctx || !state.studioPlaying) return;
  const total = studioTotalSteps();
  while (studioNextStepTime < ctx.currentTime + studioScheduleAheadSeconds) {
    scheduleStudioStep(studioLastScheduledStep, studioNextStepTime);
    studioNextStepTime += studioStepSeconds();
    studioLastScheduledStep = (studioLastScheduledStep + 1) % total;
  }
}

function startStudioSequence() {
  const ctx = ensureStudioAudio();
  if (!ctx) return;
  stopStudioSequence(false);
  state.studioPlaying = true;
  const total = studioTotalSteps();
  state.studioStep = ((Number(state.studioStep) || 0) + total) % total;
  studioLastScheduledStep = state.studioStep;
  studioNextStepTime = ctx.currentTime + 0.055;
  state.studio.vocals.forEach((track, index) => { if (track.data) decodeStudioVocal(index).catch(() => {}); });
  (state.studio.stems || []).forEach((stem, index) => { if (stem.data) decodeStudioStem(index).catch(() => {}); });
  studioTimerId = setInterval(studioSchedulerTick, studioLookaheadMs);
  studioSchedulerTick();
  render();
}

function stopStudioSequence(update = true) {
  clearInterval(studioTimerId);
  studioTimerId = null;
  studioPlayheadTimers.splice(0).forEach(clearTimeout);
  stopStudioActiveStems();
  stopStudioDjDecks();
  state.studioPlaying = false;
  state.studioStep = 0;
  if (update) render();
}

function renderStudioPlayhead() {
  document.querySelectorAll(".studio-step").forEach((cell) => {
    cell.classList.toggle("playing", Number(cell.getAttribute("data-step")) === state.studioStep);
  });
  const readout = document.querySelector("[data-studio-playhead-readout]");
  if (readout) {
    const stepsPerBar = Math.max(1, Math.round(studioStepsPerBeat() * 4));
    const bar = Math.floor(state.studioStep / stepsPerBar) + 1;
    const tick = state.studioStep % stepsPerBar;
    readout.textContent = `Bar ${bar} · Tick ${String(tick).padStart(3, "0")}`;
  }
}

function triggerStudioNote(note = "C", record = true, velocity = 0.7, when = 0) {
  const ctx = ensureStudioAudio();
  if (!ctx) return;
  const noteIndex = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].indexOf(note);
  const freq = 440 * Math.pow(2, ((noteIndex < 0 ? 0 : noteIndex) + (Number(state.studio.octave) - 4) * 12 - 9) / 12);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t = Math.max(ctx.currentTime, when || ctx.currentTime);
  osc.type = state.studio.waveform || "sawtooth";
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(velocity * ((Number(state.studio.synthVolume) || 55) / 100), t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);
  osc.connect(gain);
  gain.connect(studioOutput());
  osc.start(t);
  osc.stop(t + 0.5);
  if (record && state.studio.recArmed && state.studioPlaying) recordStudioEvent("note", 0, note, velocity);
}

function downloadTextFile(name, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}


async function decodeStudioStem(index) {
  const stem = state.studio.stems?.[index];
  if (!stem?.data) return null;
  const key = `${index}:${stem.data}`;
  if (studioStemBuffers[key]) return studioStemBuffers[key];
  const ctx = ensureStudioAudio();
  if (!ctx) return null;
  const response = await fetch(stem.data);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  studioStemBuffers[key] = buffer;
  return buffer;
}

function stopStudioActiveStems() {
  studioActiveStemSources.splice(0).forEach((source) => {
    try { source.stop(0); } catch {}
    try { source.disconnect(); } catch {}
  });
}

async function playStudioStem(index, when = 0) {
  const stem = state.studio.stems?.[index];
  if (!stem?.data || stem.muted) return;
  const soloed = (state.studio.stems || []).some((item) => item.solo);
  if (soloed && !stem.solo) return;
  const ctx = ensureStudioAudio();
  const buffer = await decodeStudioStem(index).catch(() => null);
  if (!ctx || !buffer) {
    toast("Stem could not be decoded in this browser.");
    return;
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const t = Math.max(ctx.currentTime, when || ctx.currentTime);
  source.buffer = buffer;
  const sourceBpm = Math.max(1, Number(stem.sourceBpm) || Number(state.studio.bpm) || 92);
  const playbackRate = stem.sync ? Math.max(0.25, Math.min(4, (Number(state.studio.bpm) || 92) / sourceBpm)) : 1;
  source.playbackRate.setValueAtTime(playbackRate, t);
  gain.gain.setValueAtTime(Math.max(0, Math.min(1.2, Number(stem.volume) / 100 || 0.78)), t);
  source.connect(gain);
  gain.connect(studioOutput());
  source.onended = () => {
    studioActiveStemSources = studioActiveStemSources.filter((item) => item !== source);
    try { source.disconnect(); } catch {}
  };
  studioActiveStemSources.push(source);
  try { source.start(t); } catch { source.start(ctx.currentTime); }
}

function ensureStudioDjState() {
  const fallback = createDefaultStudioProject().dj;
  state.studio.dj = {
    ...fallback,
    ...(state.studio.dj || {}),
    deckA: { ...fallback.deckA, ...(state.studio.dj?.deckA || {}) },
    deckB: { ...fallback.deckB, ...(state.studio.dj?.deckB || {}) },
  };
  ["deckA", "deckB"].forEach((key, index) => {
    const deck = state.studio.dj[key];
    deck.stemIndex = Math.max(0, Math.min((state.studio.stems || []).length - 1, Number(deck.stemIndex) || index));
    deck.volume = Math.max(0, Math.min(120, Number(deck.volume) || 82));
    deck.pitch = Math.max(-50, Math.min(50, Number(deck.pitch) || 0));
    deck.jog = Math.max(-12, Math.min(12, Number(deck.jog) || 0));
    deck.filter = Math.max(0, Math.min(100, Number(deck.filter) || 72));
    deck.cueStep = Math.max(0, Math.min(studioTotalSteps() - 1, Number(deck.cueStep) || 0));
  });
  state.studio.dj.crossfader = Math.max(0, Math.min(100, Number(state.studio.dj.crossfader) || 50));
  return state.studio.dj;
}

function studioDjKey(deckId = "A") {
  return String(deckId).toUpperCase() === "B" ? "deckB" : "deckA";
}

function studioDjDeck(deckId = "A") {
  const dj = ensureStudioDjState();
  return dj[studioDjKey(deckId)];
}

function studioDjStem(deckId = "A") {
  const deck = studioDjDeck(deckId);
  return state.studio.stems?.[Number(deck.stemIndex) || 0] || null;
}

function ensureStudioDjRuntime(deckId = "A") {
  const id = String(deckId).toUpperCase() === "B" ? "B" : "A";
  const ctx = ensureStudioAudio();
  if (!ctx) return null;
  if (!studioDjDecks[id] || studioDjDecks[id].ctx !== ctx) {
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = "lowpass";
    filter.Q.value = 0.72;
    gain.gain.value = 0;
    filter.connect(gain);
    gain.connect(studioOutput());
    studioDjDecks[id] = { id, ctx, filter, gain, source: null, startedAt: 0, startOffset: 0 };
  }
  updateStudioDjDeckMix();
  return studioDjDecks[id];
}

function studioDjPlaybackRate(deckId = "A") {
  const deck = studioDjDeck(deckId);
  const stem = studioDjStem(deckId);
  const sourceBpm = Math.max(1, Number(stem?.sourceBpm) || Number(state.studio.bpm) || 92);
  const sync = deck.sync ? (Number(state.studio.bpm) || 92) / sourceBpm : 1;
  const pitch = 1 + (Math.max(-50, Math.min(50, Number(deck.pitch) || 0)) / 100);
  const jog = 1 + (Math.max(-12, Math.min(12, Number(deck.jog) || 0)) / 100);
  return Math.max(0.1, Math.min(4, sync * pitch * jog));
}

function updateStudioDjDeckMix() {
  if (!studioCtx) return;
  const dj = ensureStudioDjState();
  const x = Math.max(0, Math.min(100, Number(dj.crossfader) || 50)) / 100;
  const deckMix = { A: Math.cos(x * Math.PI / 2), B: Math.sin(x * Math.PI / 2) };
  ["A", "B"].forEach((id) => {
    const runtime = studioDjDecks[id];
    if (!runtime?.gain || !runtime?.filter) return;
    const deck = studioDjDeck(id);
    const now = studioCtx.currentTime;
    const volume = Math.max(0, Math.min(1.2, Number(deck.volume) / 100 || 0));
    runtime.gain.gain.setTargetAtTime(volume * deckMix[id], now, 0.025);
    const filter = Math.max(0, Math.min(100, Number(deck.filter) || 72));
    runtime.filter.frequency.setTargetAtTime(260 + Math.pow(filter / 100, 1.85) * 17800, now, 0.03);
    runtime.filter.Q.setTargetAtTime(0.35 + (100 - filter) / 95, now, 0.03);
    if (runtime.source?.playbackRate) runtime.source.playbackRate.setTargetAtTime(studioDjPlaybackRate(id), now, 0.02);
  });
}

function stopStudioDjDeck(deckId = "A", shouldRender = false) {
  const id = String(deckId).toUpperCase() === "B" ? "B" : "A";
  const runtime = studioDjDecks[id];
  if (runtime?.source) {
    try { runtime.source.onended = null; } catch {}
    try { runtime.source.stop(0); } catch {}
    try { runtime.source.disconnect(); } catch {}
    runtime.source = null;
  }
  const deck = studioDjDeck(id);
  deck.playing = false;
  if (shouldRender) render();
}

function stopStudioDjDecks() {
  stopStudioDjDeck("A", false);
  stopStudioDjDeck("B", false);
}

async function playStudioDjDeck(deckId = "A", options = {}) {
  const id = String(deckId).toUpperCase() === "B" ? "B" : "A";
  const deck = studioDjDeck(id);
  const stem = studioDjStem(id);
  if (!stem?.data) {
    toast(`Load a stem on Deck ${id} first.`);
    return;
  }
  const ctx = ensureStudioAudio();
  const buffer = await decodeStudioStem(Number(deck.stemIndex)).catch(() => null);
  if (!ctx || !buffer) {
    toast("Deck stem could not be decoded in this browser.");
    return;
  }
  const runtime = ensureStudioDjRuntime(id);
  if (!runtime) return;
  stopStudioDjDeck(id, false);
  const source = ctx.createBufferSource();
  const useBuffer = deck.reverse ? reverseStudioBuffer(buffer) || buffer : buffer;
  const startAt = Math.max(ctx.currentTime, Number(options.when) || ctx.currentTime);
  const cueSeconds = Math.max(0, Number(deck.cueStep) || 0) * studioStepSeconds();
  const startOffset = useBuffer.duration ? cueSeconds % useBuffer.duration : 0;
  source.buffer = useBuffer;
  source.loop = Boolean(deck.loop) && !options.cue;
  if (source.loop) {
    source.loopStart = 0;
    source.loopEnd = useBuffer.duration;
  }
  source.playbackRate.setValueAtTime(studioDjPlaybackRate(id), startAt);
  source.connect(runtime.filter);
  runtime.source = source;
  runtime.startedAt = startAt;
  runtime.startOffset = startOffset;
  source.onended = () => {
    if (runtime.source === source) runtime.source = null;
    const liveDeck = studioDjDeck(id);
    liveDeck.playing = false;
    try { source.disconnect(); } catch {}
    if (state.route === "studio") render();
  };
  try {
    if (options.cue) source.start(startAt, startOffset, Math.min(0.75, Math.max(0.12, useBuffer.duration - startOffset)));
    else source.start(startAt, startOffset);
  } catch {
    source.start(ctx.currentTime);
  }
  if (!options.cue) {
    deck.playing = true;
    if (ensureStudioDjState().recordLaunches && state.studio.recArmed && state.studioPlaying) addStudioDjDeckLaunchToSequence(id, false);
  }
  updateStudioDjDeckMix();
  if (!options.silent) render();
}

function addStudioDjDeckLaunchToSequence(deckId = "A", shouldRender = true) {
  const id = String(deckId).toUpperCase() === "B" ? "B" : "A";
  const deck = studioDjDeck(id);
  const stemIndex = Math.max(0, Math.min((state.studio.stems || []).length - 1, Number(deck.stemIndex) || 0));
  const step = Math.max(0, Math.min(studioTotalSteps() - 1, Math.round(Number(state.studioStep) || 0)));
  const exists = state.studio.events.find((event) => event.type === "stem" && Number(event.stem) === stemIndex && Number(event.step) === step);
  if (!exists) state.studio.events.push({ id: `dj-${id}-${stemIndex}-${step}-${Date.now()}`, type: "stem", stem: stemIndex, step, velocity: state.studio.velocity, offset: 0 });
  state.studio.selectedStem = stemIndex;
  saveStudioProject();
  if (shouldRender) {
    toast(`Deck ${id} stem launch added at step ${step + 1}`);
    render();
  }
}

function assignStudioDjDeckToPad(deckId = "A") {
  const deck = studioDjDeck(deckId);
  state.studio.selectedStem = Math.max(0, Math.min((state.studio.stems || []).length - 1, Number(deck.stemIndex) || 0));
  assignStudioStemToPad(state.studio.selectedStem);
}

async function decodeStudioVocal(index) {
  const track = state.studio.vocals[index];
  if (!track?.data) return null;
  const key = `${index}:${track.data}`;
  if (studioVocalBuffers[key]) return studioVocalBuffers[key];
  const ctx = ensureStudioAudio();
  if (!ctx) return null;
  const response = await fetch(track.data);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  studioVocalBuffers[key] = buffer;
  return buffer;
}

async function playVocalTrack(index, when = 0) {
  const track = state.studio.vocals[index];
  if (!track?.data) return;
  const ctx = ensureStudioAudio();
  const buffer = await decodeStudioVocal(index).catch(() => null);
  if (!ctx || !buffer) {
    toast("Vocal clip could not be decoded in this browser.");
    return;
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const t = Math.max(ctx.currentTime, when || ctx.currentTime);
  source.buffer = buffer;
  gain.gain.setValueAtTime(Math.max(0, Math.min(1, Number(track.volume) / 100 || 0.75)), t);
  source.connect(gain);
  gain.connect(studioOutput());
  try { source.start(t); } catch { source.start(ctx.currentTime); }
}

function studioTransportControls() {
  return `<div class="studio-transport-panel panel lm-studio-header-panel lm-studio-glass">
    <div class="studio-help-menu ${state.studioHelpOpen ? "open" : ""}">
      <button class="studio-back-toggle" data-action="studio-go-back" aria-label="Go back to the previous LottoMind page">Back</button>
      <button class="studio-help-toggle" data-action="studio-toggle-help" aria-expanded="${state.studioHelpOpen ? "true" : "false"}">Help</button>
      ${state.studioHelpOpen ? `<div class="studio-help-dropdown">
        <strong>How to use Studio</strong>
        <span>Tap MPC pads or use keyboard shortcuts to play sounds.</span>
        <span>Open Beat Lotto to turn the groove into creative picks.</span>
        <span>Use FX knobs for drive, filter, delay, reverb, and punch.</span>
        <span>Import only audio you own or have permission to use.</span>
      </div>` : ""}
    </div>
    <div class="studio-brand-lock lm-studio-brand">
      <div class="lm-studio-logo-mark">LM</div>
      <div><span>LottoMind</span><strong>Studio</strong><small>Make Beats. Manifest Wins.</small></div>
    </div>
    <div class="lm-studio-title-block">
      <h1>LottoMind <span>Studio</span></h1>
      <p>Make Beats. Manifest Wins. A premium MPC, DJ, stem, vocal, and Beat2Lotto workstation.</p>
      <small data-studio-playhead-readout>Bar ${Math.floor(state.studioStep / Math.max(1, Math.round(studioStepsPerBeat() * 4))) + 1} · Tick ${String(state.studioStep % Math.max(1, Math.round(studioStepsPerBeat() * 4))).padStart(3, "0")}</small>
    </div>
    <div class="lm-top-controls">
      <label class="lm-mini-card">Project <input data-bind="studioProjectName" value="${escapeHtml(state.studio.projectName || "Neon Dreams")}" /></label>
      <label class="lm-mini-card">BPM <input type="number" min="40" max="220" value="${state.studio.bpm}" data-action="studio-set" data-studio-field="bpm" /></label>
      <label class="lm-mini-card">Grid <select data-action="studio-set" data-studio-field="division">${STUDIO_DIVISIONS.map((item) => `<option ${item === state.studio.division ? "selected" : ""}>${item}</option>`).join("")}</select></label>
      <div class="lm-status-card"><span class="online-dot"></span><strong>Studio Status</strong><small>${state.studioPlaying ? "Online" : "Standby"}</small></div>
    </div>
    <div class="studio-transport-actions">
      <button class="primary-btn play-btn" data-action="studio-play">${state.studioPlaying ? "Restart" : "Play"}</button>
      <button class="ghost-btn" data-action="studio-stop">Stop</button>
      <button class="${state.studio.recArmed ? "record-btn active" : "record-btn"}" data-action="studio-toggle-rec">Seq Rec</button>
      <button class="${state.studioMasterRecording ? "record-btn active" : "gold-btn"}" data-action="${state.studioMasterRecording ? "studio-stop-master-record" : "studio-start-master-record"}">${state.studioMasterRecording ? "Stop Mix" : "Mix Rec"}</button>
    </div>
  </div>`;
}

function studioControlStrip() {
  return `<div class="studio-control-strip panel lm-studio-nav lm-studio-glass">
    <div class="studio-tabs">
      ${[
        ["SEQ", "Beat Lotto", "studio-beat-lotto"],
        ["▦", "Drum Machine", "studio-pads"],
        ["♫", "Sampler", "studio-sampler"],
        ["▣", "Stem Kit", "studio-default-stem-kit"],
        ["⇄", "Stems", "studio-stems"],
        ["◌", "DJ Decks", "studio-dj-decks"],
        ["◉", "Vocals", "studio-vocals"],
        ["✦", "Effects", "studio-effects"],
        ["◈", "Memory", "studio-files"],
        ["⇪", "Export", "studio-files"],
      ].map(([icon, label, panel], index) => `<button class="${index === 0 ? "active" : ""}" data-action="studio-jump-panel" data-panel="${panel}"><span>${icon}</span>${label}</button>`).join("")}
    </div>
    <div class="studio-mode-strip">
      ${["Score", "Options", "Metro", "Chain", "Rock", "HipHop", "Latin"].map((label) => `<button class="ghost-btn micro">${label}</button>`).join("")}
      <button class="gold-btn micro" data-action="studio-randomize">Random</button>
      <button class="gold-btn micro" data-action="studio-humanize">Humanize</button>
    </div>
    <div class="studio-stat-pills">
      <span>16 Bars</span><span>2 Vocal Tracks</span><span>1/64T Timing</span><span>${(state.studio.stems || []).filter((stem) => stem.data).length} Stems</span><span>${(state.studio.pads || []).filter((pad) => pad.sampleData && isStudioDefaultStemUrl(pad.sampleData)).length} Default Slices</span><span>Dual DJ Decks</span><span>${state.studio.division} Timing</span><span>FX Rack</span>
    </div>
  </div>`;
}

function studioDrumPadSurface() {
  const colors = ["cyan", "blue", "violet", "pink", "green", "gold"];
  return `<div class="panel lm-studio-panel lm-studio-glass" id="studio-pads">
    <div class="panel-title-row"><div><span class="eyebrow">Drum Pads</span><h2>Drum Machine</h2></div><span class="panel-badge">Bank A</span></div>
    <div class="studio-pad-grid">
      ${state.studio.pads.map((pad, index) => `<button class="studio-pad ${colors[index % colors.length]} ${state.studio.selectedPad === index ? "selected" : ""} ${pad.muted ? "muted" : ""} ${isStudioDefaultStemUrl(pad.sampleData) ? "stem-default" : ""}" data-action="studio-pad" data-studio-pad="${index}" data-default-stem="${isStudioDefaultStemUrl(pad.sampleData) ? "true" : "false"}">
        <span class="pad-number">${index + 1}</span><strong>${escapeHtml(pad.name)}</strong><small>${pad.sampleData ? (isStudioDefaultStemUrl(pad.sampleData) ? "DEFAULT STEM" : "SAMPLE") : pad.type} · ${pad.velocity}</small><em>${escapeHtml(pad.shortcut || "")}</em>
      </button>`).join("")}
    </div>
    <div class="pad-footer"><button class="ghost-btn micro">‹</button><span>Bank A</span><button class="ghost-btn micro">›</button><button class="ghost-btn micro">Pad Editor</button></div>
  </div>`;
}

function studioDrumPads() {
  return studioDrumPadSurface();
}

function studioSequencerGrid() {
  const visible = studioVisibleSteps();
  const total = studioTotalSteps();
  const offset = studioStepOffset();
  const page = Number(state.studio.stepPage) || 0;
  const pages = studioStepPageCount();
  const stepsPerBar = Math.max(1, Math.round(studioStepsPerBeat() * 4));
  const hasEvent = (pad, step) => state.studio.events.some((event) => event.type === "pad" && Number(event.pad) === pad && Number(event.step) === step);
  const hasStemEvent = (stem, step) => state.studio.events.some((event) => event.type === "stem" && Number(event.stem) === stem && Number(event.step) === step);
  const barMarkers = Array.from({ length: 16 }, (_, index) => {
    const absolute = index * stepsPerBar;
    if (absolute < offset || absolute >= offset + visible) return "";
    const left = ((absolute - offset) / Math.max(1, visible - 1)) * 100;
    return `<span style="left:${left}%">${index + 1}</span>`;
  }).join("");
  const stemRows = (state.studio.stems || []).map((stem, stemIndex) => `<div class="seq-row seq-row-stem ${stem.data ? "loaded" : "empty"}">
        <div class="seq-label stem-label"><span class="seq-dot stem-dot"></span>${escapeHtml(stem.name || `Stem ${stemIndex + 1}`)}<small>${stem.data ? "stem" : "empty"}</small></div>
        <div class="seq-cells">
          ${Array.from({ length: visible }, (_, step) => {
            const absolute = offset + step;
            const active = hasStemEvent(stemIndex, absolute) || (stem.sequenceEnabled && Number(stem.startStep) === absolute);
            const isBar = absolute % stepsPerBar === 0;
            const isBeat = absolute % Math.max(1, Math.round(studioStepsPerBeat())) === 0;
            return `<button class="studio-step stem-step ${active ? "active" : ""} ${isBar ? "bar" : isBeat ? "beat" : ""} ${absolute === state.studioStep ? "playing" : ""}" data-action="studio-toggle-stem-step" data-stem="${stemIndex}" data-step="${absolute}" title="${escapeHtml(stem.name || `Stem ${stemIndex + 1}`)} trigger step ${absolute + 1}"></button>`;
          }).join("")}
        </div>
      </div>`).join("");
  return `<div class="panel lm-studio-panel lm-sequencer-panel lm-studio-glass" id="studio-sequencer">
    <div class="panel-title-row"><div><span class="eyebrow">Sequencer · 16 Bars</span><h2>16-Bar Sequencer</h2></div><span class="panel-badge">${state.studio.events.length} events</span></div>
    <div class="sequencer-meta">
      <span>${state.studio.division} grid</span><span>Steps ${offset + 1}-${Math.min(total, offset + visible)} / ${total}</span><span>Page ${page + 1}/${pages}</span><span>${(state.studio.stems || []).filter((stem) => stem.data).length} stems ready</span>
    </div>
    <div class="timing-division-row">
      ${STUDIO_DIVISIONS.map((item) => `<button class="${item === state.studio.division ? "active" : ""}" data-action="studio-set" data-studio-field="division" value="${item}">${item}</button>`).join("")}
    </div>
    <div class="sequencer-pager">
      <button class="ghost-btn micro" data-action="studio-set-step-page" data-step-page="${Math.max(0, page - 1)}">‹ Prev</button>
      <input type="range" min="0" max="${Math.max(0, pages - 1)}" value="${page}" data-action="studio-set-step-page" />
      <button class="ghost-btn micro" data-action="studio-set-step-page" data-step-page="${Math.min(pages - 1, page + 1)}">Next ›</button>
    </div>
    <div class="sequencer-barline">${barMarkers}</div>
    <div class="sequencer-grid" style="--visible-steps:${visible}">
      ${state.studio.pads.map((pad, padIndex) => `<div class="seq-row">
        <div class="seq-label"><span class="seq-dot"></span>${escapeHtml(pad.name)}</div>
        <div class="seq-cells">
          ${Array.from({ length: visible }, (_, step) => {
            const absolute = offset + step;
            const active = hasEvent(padIndex, absolute);
            const isBar = absolute % stepsPerBar === 0;
            const isBeat = absolute % Math.max(1, Math.round(studioStepsPerBeat())) === 0;
            return `<button class="studio-step ${active ? "active" : ""} ${isBar ? "bar" : isBeat ? "beat" : ""} ${absolute === state.studioStep ? "playing" : ""}" data-action="studio-toggle-step" data-pad="${padIndex}" data-step="${absolute}" title="${escapeHtml(pad.name)} step ${absolute + 1}"></button>`;
          }).join("")}
        </div>
      </div>`).join("")}
      ${stemRows}
    </div>
    <div class="studio-mix-controls">
      <label>BPM <input type="number" min="40" max="220" value="${state.studio.bpm}" data-action="studio-set" data-studio-field="bpm" /></label>
      <label>Swing <input type="range" min="0" max="75" value="${state.studio.swing}" data-action="studio-set" data-studio-field="swing" /></label>
      <label>Velocity <input type="range" min="1" max="100" value="${state.studio.velocity}" data-action="studio-set" data-studio-field="velocity" /></label>
      <label>Human <input type="range" min="0" max="40" value="${state.studio.humanize}" data-action="studio-set" data-studio-field="humanize" /></label>
      <button class="ghost-btn micro" data-action="studio-toggle-metronome">Metronome ${state.studio.metronome ? "On" : "Off"}</button>
      <button class="ghost-btn micro" data-action="studio-clear-pattern">Clear</button>
    </div>
  </div>`;
}

function studioKeyboardSurface() {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `<div class="panel lm-studio-panel keyboard-panel lm-studio-glass" id="studio-keyboard">
    <div class="panel-title-row"><div><span class="eyebrow">Keyboard / Synth</span><h2>Studio Keyboard</h2></div><span class="panel-badge">MIDI Ready</span></div>
    <div class="keyboard-controls">
      <label>Wave <select data-action="studio-set" data-studio-field="waveform">${["sine", "triangle", "sawtooth", "square"].map((item) => `<option ${item === state.studio.waveform ? "selected" : ""}>${item}</option>`).join("")}</select></label>
      <label>Octave <input type="number" min="1" max="7" value="${state.studio.octave}" data-action="studio-set" data-studio-field="octave" /></label>
      <label>Vol <input type="range" min="1" max="100" value="${state.studio.synthVolume}" data-action="studio-set" data-studio-field="synthVolume" /></label>
    </div>
    <div class="studio-keyboard-keys">
      ${notes.map((note) => `<button class="key ${note.includes("#") ? "black" : "white"}" data-action="studio-note" data-note="${note}">${note}</button>`).join("")}
    </div>
  </div>`;
}

function studioKeyboardSection() {
  return studioKeyboardSurface();
}

function studioRecordingBooth() {
  return `<div class="lm-studio-feature-strip panel lm-studio-glass">
    <article><strong>Drum Machine</strong><span>Program 16-bar LottoMind beats with timing up to 1/64T.</span></article>
    <article><strong>Sampler</strong><span>Import, record, trim, pitch, reverse, and export custom pad sounds.</span></article>
    <article><strong>Default Stem Kit</strong><span>The uploaded Lead Vocals, Drums, Synth, and Other stems load as the factory pad bank.</span></article>
    <article><strong>Stem Loader</strong><span>Import beat stems, assign them to pads, and launch them from the 16-bar sequence.</span></article>
    <article><strong>DJ Turntables</strong><span>Mix stems on Deck A and Deck B with crossfader, cue, sync, loop, filter, and pitch controls.</span></article>
    <article><strong>2-Track Vocals</strong><span>Mic/line input, device routing, mute/solo, and synced clip playback.</span></article>
    <article><strong>Beat2Lotto</strong><span>Transform generated beats, humanized grooves, samples, vocals, and FX settings into creative number picks.</span></article>
    <article><strong>Effects + Export</strong><span>Drive, filter, delay, reverb, compression, project memory, and sound export.</span></article>
  </div>`;
}


function studioDefaultStemKitPanel() {
  const loadedDefaults = (state.studio.stems || []).filter((stem) => stem.data && isStudioDefaultStemUrl(stem.data)).length;
  const customStems = (state.studio.stems || []).filter((stem) => stem.data && !isStudioDefaultStemUrl(stem.data)).length;
  const defaultPadSlices = (state.studio.pads || []).filter((pad) => pad.sampleData && isStudioDefaultStemUrl(pad.sampleData)).length;
  const kit = state.studio.defaultStemKit || {};
  return `<div class="panel lm-studio-panel default-stem-kit-panel lm-studio-glass" id="studio-default-stem-kit">
    <div class="panel-title-row"><div><span class="eyebrow">Default Stem Kit</span><h2>Stem-to-Pad Sound Engine</h2></div><span class="panel-badge">v9 Factory Kit</span></div>
    <p class="studio-note">The uploaded Boom Bap kick, snare, and clap are built into LottoMind Studio as the first three default drum pads, with the factory stems still available for chops and deck mixes.</p>
    <div class="default-stem-metrics">
      <span><strong>${loadedDefaults}</strong><small>Factory Stems</small></span>
      <span><strong>${customStems}</strong><small>Custom Stems</small></span>
      <span><strong>${defaultPadSlices}</strong><small>Pad Slices</small></span>
      <span><strong>${kit.allowCustomReplacement === false ? "Locked" : "Open"}</strong><small>Custom Swap</small></span>
    </div>
    <div class="default-stem-actions">
      <button class="gold-btn" data-action="studio-load-default-stem-kit">Load Default Stem Kit</button>
      <button class="ghost-btn" data-action="studio-force-default-stem-kit">Replace Pads With Defaults</button>
      <button class="ghost-btn" data-action="studio-map-default-stem-pads">Re-Slice Default Pads</button>
      <button class="ghost-btn" data-action="studio-use-current-stems-as-kit">Use Current Stems As Pad Kit</button>
      <label class="file-pill">Import Custom Stems<input type="file" accept="audio/*" multiple data-action="studio-import-stems" /></label>
    </div>
    <div class="default-stem-asset-grid">
      ${STUDIO_DEFAULT_STEM_ASSETS.map((asset) => {
        const stem = (state.studio.stems || [])[Number(asset.targetStem) || 0] || {};
        const loaded = stem.data && isStudioDefaultStemUrl(stem.data);
        return `<article class="default-stem-asset ${loaded ? "loaded" : ""}">
          <span>${String((Number(asset.targetStem) || 0) + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(asset.name)}</strong>
          <small>${escapeHtml(asset.role)} · ${escapeHtml(asset.fileName)}</small>
          <em>${loaded ? "Loaded as default" : stem.data ? "Slot has custom stem" : "Ready to load"}</em>
        </article>`;
      }).join("")}
    </div>
  </div>`;
}

function studioSamplerPanel() {
  const pad = state.studio.pads[state.studio.selectedPad] || state.studio.pads[0];
  return `<div class="panel lm-studio-panel sampler-panel lm-studio-glass" id="studio-sampler">
    <div class="panel-title-row"><div><span class="eyebrow">Sampler</span><h2>Pad Sampler</h2></div><span class="panel-badge">Pad ${String(state.studio.selectedPad + 1).padStart(2, "0")}</span></div>
    <div class="sample-wave"><span></span><span></span><span></span><span></span><span></span><strong>${escapeHtml(pad.sampleName || pad.name)}</strong></div>
    <div class="sampler-target-row">
      <label>Target <select data-action="studio-set" data-studio-field="selectedPad">${state.studio.pads.map((item, index) => `<option value="${index}" ${index === state.studio.selectedPad ? "selected" : ""}>${index + 1}. ${escapeHtml(item.name)}</option>`).join("")}</select></label>
      <label class="file-pill">Import Sound<input type="file" accept="audio/*" data-action="studio-import-sample" /></label>
    </div>
    <div class="url-sample-row"><input placeholder="Direct audio URL, where CORS allows" value="${escapeHtml(state.studioSampleUrl || "")}" data-bind="studioSampleUrl" /><button class="ghost-btn" data-action="studio-load-url-sample">Load URL</button></div>
    <div class="sample-actions">
      <button class="gold-btn" data-action="studio-sample-mic">Sample Mic/Line</button>
      <button class="ghost-btn" data-action="studio-sample-tab">Sample Browser/Tab</button>
      <button class="record-btn ${state.studioSampling ? "active" : ""}" data-action="studio-stop-sampling">${state.studioSampling ? `Stop ${escapeHtml(state.studioSamplingLabel || "Sample")}` : "Stop Sample"}</button>
    </div>
    <div class="knob-grid">
      <label>Start <input type="range" min="0" max="95" value="${pad.trimStart}" data-action="studio-pad-set" data-pad-field="trimStart" /></label>
      <label>End <input type="range" min="1" max="100" value="${pad.trimEnd}" data-action="studio-pad-set" data-pad-field="trimEnd" /></label>
      <label>Pitch <input type="range" min="-24" max="24" value="${pad.pitch}" data-action="studio-pad-set" data-pad-field="pitch" /></label>
      <label>Gain <input type="range" min="1" max="120" value="${pad.gain}" data-action="studio-pad-set" data-pad-field="gain" /></label>
    </div>
    <div class="sample-actions bottom">
      <button class="ghost-btn" data-action="studio-toggle-pad-reverse">${pad.reverse ? "Reverse On" : "Reverse Off"}</button>
      <button class="ghost-btn" data-action="studio-preview-sample">Preview</button>
      <button class="ghost-btn" data-action="studio-export-sample">Export Sample</button>
      <button class="ghost-btn danger" data-action="studio-clear-sample">Clear</button>
    </div>
  </div>`;
}


function studioStemDeckPanel() {
  const stems = state.studio.stems || [];
  const selectedIndex = Math.max(0, Math.min(stems.length - 1, Number(state.studio.selectedStem) || 0));
  const stem = stems[selectedIndex] || createDefaultStudioProject().stems[0];
  const maxStep = Math.max(0, studioTotalSteps() - 1);
  return `<div class="panel lm-studio-panel stem-panel lm-studio-glass" id="studio-stems">
    <div class="panel-title-row"><div><span class="eyebrow">Stem Loader</span><h2>Stem Deck + Pad Mapping</h2></div><span class="panel-badge">${stems.filter((item) => item.data).length}/8 Loaded</span></div>
    <p class="studio-note">Import beat stems, loops, drum breaks, melodies, or vocal chops. Launch them from the 16-bar sequencer, play them as synced stems, or assign any stem to an MPC pad as a custom sound.</p>
    <div class="stem-loader-actions">
      <label>Stem Slot <select data-action="studio-select-stem">${stems.map((item, index) => `<option value="${index}" ${index === selectedIndex ? "selected" : ""}>${index + 1}. ${escapeHtml(item.name || `Stem ${index + 1}`)}</option>`).join("")}</select></label>
      <label class="file-pill">Import Stem<input type="file" accept="audio/*" data-action="studio-import-stem" /></label>
      <label class="file-pill">Import Multi-Stems<input type="file" accept="audio/*" multiple data-action="studio-import-stems" /></label>
      <button class="gold-btn" data-action="studio-stem-to-pad">Load To Selected Pad</button>
      <button class="ghost-btn" data-action="studio-stems-to-pads">Map Loaded Stems To Pads</button>
      <button class="ghost-btn" data-action="studio-use-current-stems-as-kit">Slice Current Stems To Pads</button>
    </div>
    <div class="stem-focus-card ${stem.data ? "loaded" : "empty"}">
      <div class="stem-wave"><span></span><span></span><span></span><span></span><span></span><strong>${escapeHtml(stem.fileName || stem.name || `Stem ${selectedIndex + 1}`)}</strong></div>
      <div class="stem-edit-grid">
        <label>Name <input value="${escapeHtml(stem.name || `Stem ${selectedIndex + 1}`)}" data-action="studio-stem-set" data-stem-field="name" /></label>
        <label>Volume <input type="range" min="0" max="120" value="${Number(stem.volume) || 78}" data-action="studio-stem-set" data-stem-field="volume" /></label>
        <label>Start Step <input type="number" min="0" max="${maxStep}" value="${Number(stem.startStep) || 0}" data-action="studio-stem-set" data-stem-field="startStep" /></label>
        <label>Source BPM <input type="number" min="40" max="220" value="${Number(stem.sourceBpm) || Number(state.studio.bpm) || 92}" data-action="studio-stem-set" data-stem-field="sourceBpm" /></label>
        <label>Pad Target <select data-action="studio-stem-set" data-stem-field="padTarget">${state.studio.pads.map((pad, index) => `<option value="${index}" ${Number(stem.padTarget) === index ? "selected" : ""}>${index + 1}. ${escapeHtml(pad.name)}</option>`).join("")}</select></label>
        <label class="stem-check"><input type="checkbox" ${stem.sync ? "checked" : ""} data-action="studio-stem-set" data-stem-field="sync" /> Sync to Studio BPM</label>
        <label class="stem-check"><input type="checkbox" ${stem.sequenceEnabled ? "checked" : ""} data-action="studio-stem-set" data-stem-field="sequenceEnabled" /> Auto-launch at Start Step</label>
      </div>
      <div class="sample-actions bottom">
        <button class="ghost-btn" data-action="studio-play-stem">Preview Stem</button>
        <button class="ghost-btn" data-action="studio-export-stem">Export Stem</button>
        <button class="ghost-btn ${stem.muted ? "active" : ""}" data-action="studio-toggle-stem-mute">Mute</button>
        <button class="ghost-btn ${stem.solo ? "active" : ""}" data-action="studio-toggle-stem-solo">Solo</button>
        <button class="ghost-btn danger" data-action="studio-clear-stem">Clear Stem</button>
      </div>
      <small class="studio-note">Large stems are session-only inside the browser. They will play now, but export or keep the original file if you need to reload them later.</small>
    </div>
    <div class="stem-slot-grid">
      ${stems.map((item, index) => `<button class="stem-slot ${index === selectedIndex ? "selected" : ""} ${item.data ? "loaded" : "empty"} ${item.muted ? "muted" : ""} ${item.solo ? "solo" : ""}" data-action="studio-select-stem" value="${index}">
        <span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.name || `Stem ${index + 1}`)}</strong><small>${item.data ? escapeHtml(item.fileName || "loaded") : "drop/import audio"}</small><em>${item.sequenceEnabled ? "SEQ" : item.data ? "READY" : "EMPTY"}</em>
      </button>`).join("")}
    </div>
  </div>`;
}

function studioDjDecksPanel() {
  const dj = ensureStudioDjState();
  const stems = state.studio.stems || [];
  const maxStep = Math.max(0, studioTotalSteps() - 1);
  const clampDeckValue = (value, min, max, fallback = min) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));
  const knobControl = (deckId, label, field, min, max, rawValue, suffix = "", step = "1") => {
    const value = clampDeckValue(rawValue, min, max, min);
    const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
    const angle = -135 + pct * 2.7;
    const maxAttr = Math.max(max, min + 1);
    const display = `${value}${suffix}`;
    return `<label class="dj-knob-control" style="--knob-value:${pct};--knob-angle:${angle}deg">
      <span class="dj-knob-label">${label}</span>
      <span class="dj-knob-face" aria-hidden="true"><i></i></span>
      <input class="dj-knob-input" type="range" min="${min}" max="${maxAttr}" step="${step}" value="${value}" data-action="studio-dj-set" data-deck="${deckId}" data-dj-field="${field}" data-suffix="${escapeHtml(suffix)}" />
      <strong class="dj-knob-value">${display}</strong>
    </label>`;
  };
  const waveformBars = (seed, active = false, count = 34) => {
    const rand = seededRandom(seed || "studio-wave");
    return Array.from({ length: count }, (_, index) => {
      const height = Math.round(18 + rand() * 54 + (active ? Math.sin(index * 0.7) * 10 : 0));
      return `<i style="--wave-h:${Math.max(12, Math.min(78, height))}%"></i>`;
    }).join("");
  };
  const deckWaveform = (deckId, deck, stem, label) => `<div class="dj-live-waveform ${deck.playing ? "playing" : ""}">
    <span>${deckId}</span>
    <div>${waveformBars(`${deckId}-${stem?.fileName || stem?.name || "empty"}-${deck.filter}-${deck.volume}`, deck.playing)}</div>
    <small>${escapeHtml(label || stem?.name || "No stem")}</small>
  </div>`;
  const renderDeck = (deckId, title) => {
    const key = studioDjKey(deckId);
    const deck = dj[key];
    const stemIndex = Math.max(0, Math.min(stems.length - 1, Number(deck.stemIndex) || 0));
    const stem = stems[stemIndex] || {};
    const playing = Boolean(deck.playing);
    return `<div class="dj-deck-card deck-${deckId.toLowerCase()} ${playing ? "playing" : ""} ${stem.data ? "loaded" : "empty"}">
      <div class="dj-deck-top">
        <span class="eyebrow">Turntable ${deckId}</span>
        <strong>${escapeHtml(title)}</strong>
        <em>${stem.data ? escapeHtml(stem.fileName || stem.name || `Stem ${stemIndex + 1}`) : "No stem loaded"}</em>
      </div>
      <div class="turntable-wrap">
        <button class="turntable-platter" data-action="studio-dj-cue" data-deck="${deckId}" title="Cue Deck ${deckId}">
          <span class="platter-ring one"></span><span class="platter-ring two"></span><span class="platter-ring three"></span>
          <strong>${deckId}</strong><small>${playing ? "ON AIR" : stem.data ? "CUE" : "LOAD"}</small>
        </button>
        <div class="tonearm"><span></span></div>
      </div>
      <div class="dj-stem-select-row">
        <label>Stem Source <select data-action="studio-dj-set" data-deck="${deckId}" data-dj-field="stemIndex">
          ${stems.map((item, index) => `<option value="${index}" ${index === stemIndex ? "selected" : ""}>${index + 1}. ${escapeHtml(item.name || `Stem ${index + 1}`)}${item.data ? " ✓" : ""}</option>`).join("")}
        </select></label>
        <label class="file-pill">Load Stem<input type="file" accept="audio/*" data-action="studio-dj-import-stem" data-deck="${deckId}" /></label>
      </div>
      <div class="dj-transport-row">
        <button class="primary-btn" data-action="studio-dj-play" data-deck="${deckId}">${playing ? "Restart" : "Play"}</button>
        <button class="ghost-btn" data-action="studio-dj-cue" data-deck="${deckId}">Cue</button>
        <button class="ghost-btn" data-action="studio-dj-stop" data-deck="${deckId}">Stop</button>
      </div>
      <div class="dj-toggle-row">
        <label class="dj-check"><input type="checkbox" ${deck.sync ? "checked" : ""} data-action="studio-dj-set" data-deck="${deckId}" data-dj-field="sync" /> BPM Sync</label>
        <label class="dj-check"><input type="checkbox" ${deck.loop ? "checked" : ""} data-action="studio-dj-set" data-deck="${deckId}" data-dj-field="loop" /> Loop</label>
        <label class="dj-check"><input type="checkbox" ${deck.reverse ? "checked" : ""} data-action="studio-dj-set" data-deck="${deckId}" data-dj-field="reverse" /> Reverse</label>
      </div>
      <div class="dj-control-grid">
        ${knobControl(deckId, "Volume", "volume", 0, 120, Number(deck.volume) || 82, "%")}
        ${knobControl(deckId, "Pitch", "pitch", -50, 50, Number(deck.pitch) || 0, "%")}
        ${knobControl(deckId, "Jog / Scratch", "jog", -12, 12, Number(deck.jog) || 0)}
        ${knobControl(deckId, "Filter", "filter", 0, 100, Number(deck.filter) || 72, "%")}
        ${knobControl(deckId, "Cue Step", "cueStep", 0, Math.max(1, maxStep), Number(deck.cueStep) || 0, `/${maxStep}`)}
      </div>
      <div class="dj-deck-actions">
        <button class="ghost-btn micro" data-action="studio-dj-jog-reset" data-deck="${deckId}">Release Jog</button>
        <button class="ghost-btn micro" data-action="studio-dj-to-pad" data-deck="${deckId}">Send To Pad</button>
        <button class="ghost-btn micro" data-action="studio-dj-add-trigger" data-deck="${deckId}">Add Seq Launch</button>
      </div>
    </div>`;
  };
  const deckA = dj.deckA || studioDjDeck("A");
  const deckB = dj.deckB || studioDjDeck("B");
  const stemA = stems[Math.max(0, Math.min(stems.length - 1, Number(deckA.stemIndex) || 0))] || {};
  const stemB = stems[Math.max(0, Math.min(stems.length - 1, Number(deckB.stemIndex) || 0))] || {};
  const xfade = Math.max(0, Math.min(100, Number(dj.crossfader) || 50));
  return `<div class="panel lm-studio-panel dj-decks-panel lm-studio-glass" id="studio-dj-decks">
    <div class="panel-title-row"><div><span class="eyebrow">DJ Stem Mixer</span><h2>Dual Turntables</h2></div><span class="panel-badge">Deck A/B</span></div>
    <p class="studio-note">Load any stem onto the left or right deck, cue it like a turntable, blend with the crossfader, sync to Studio BPM, and record the mix through LottoMind Studio’s master recorder.</p>
    <div class="dj-deck-layout">
      ${renderDeck("A", "Left Stem Deck")}
      <div class="dj-mixer-core">
        <div class="mixer-vu"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="dj-waveform-stack">
          ${deckWaveform("A", deckA, stemA, "Left deck waveform")}
          ${deckWaveform("B", deckB, stemB, "Right deck waveform")}
        </div>
        <label class="dj-crossfader dj-real-crossfader" style="--xfade:${xfade}">
          <span>Crossfader</span>
          <div class="dj-fader-rail"><b>A</b><input type="range" min="0" max="100" value="${xfade}" data-action="studio-dj-set" data-dj-field="crossfader" /><b>B</b></div>
          <strong>A ${100 - xfade} - B ${xfade}</strong>
        </label>
        <label class="dj-crossfader">Crossfader <input type="range" min="0" max="100" value="${Number(dj.crossfader) || 50}" data-action="studio-dj-set" data-dj-field="crossfader" /><strong>A ${100 - (Number(dj.crossfader) || 50)} · B ${Number(dj.crossfader) || 50}</strong></label>
        <label class="dj-check dj-record-check"><input type="checkbox" ${dj.recordLaunches ? "checked" : ""} data-action="studio-dj-set" data-dj-field="recordLaunches" /> Record deck launches to the 16-bar stem lanes</label>
        <div class="dj-mixer-actions">
          <button class="gold-btn" data-action="studio-dj-play-both">Play Both</button>
          <button class="ghost-btn" data-action="studio-dj-stop-both">Stop Decks</button>
          <button class="${state.studioMasterRecording ? "record-btn active" : "ghost-btn"}" data-action="${state.studioMasterRecording ? "studio-stop-master-record" : "studio-start-master-record"}">${state.studioMasterRecording ? "Stop DJ Mix" : "Record DJ Mix"}</button>
        </div>
        <small class="studio-note">Tip: import multi-stems first, then choose a different stem for Deck A and Deck B. Use headphones while monitoring mic input.</small>
      </div>
      ${renderDeck("B", "Right Stem Deck")}
    </div>
  </div>`;
}

function studioMicPanel() {
  const options = (state.studioInputDevices || []).map((device, index) => `<option value="${escapeHtml(device.deviceId)}" ${device.deviceId === state.studioInputDeviceId ? "selected" : ""}>${escapeHtml(device.label || `Audio Input ${index + 1}`)}</option>`).join("");
  return `<div class="panel lm-studio-panel mic-panel lm-studio-glass" id="studio-mic">
    <div class="panel-title-row"><div><span class="eyebrow">Mic / Line Input</span><h2>Input Routing</h2></div><span class="panel-badge">Headphones</span></div>
    <p class="studio-note">${escapeHtml(state.studioInputStatus)}</p>
    <label>Input Device <select data-action="studio-select-input"><option value="">Default input</option>${options}</select></label>
    <div class="sample-actions"><button class="ghost-btn" data-action="studio-refresh-inputs">Refresh Inputs</button><button class="gold-btn" data-action="studio-monitor-input">Monitor Input</button><button class="ghost-btn" data-action="studio-stop-monitoring">Stop Monitoring</button></div>
    <small class="studio-note">Use headphones while monitoring to avoid feedback. Browser permission is required.</small>
  </div>`;
}

function studioVocalTracks() {
  const visibleTracks = (state.studio.vocals || []).slice(0, 2);
  return `<div class="panel lm-studio-panel vocals-panel lm-studio-glass" id="studio-vocals">
    <div class="panel-title-row"><div><span class="eyebrow">Mic/Line Input</span><h2>2-Track Vocals</h2></div><span class="panel-badge">2 Tracks</span></div>
    <div class="vocal-track-list">
      ${visibleTracks.map((track, index) => `<div class="vocal-track ${track.solo ? "solo" : ""} ${track.muted ? "muted" : ""}">
        <div class="track-number">${index + 1}</div>
        <div class="track-info"><strong>${escapeHtml(track.name)}</strong><small>${track.data ? escapeHtml(track.fileName || "clip ready") : "empty"}</small><div class="vocal-wave"><span></span><span></span><span></span><span></span><span></span></div></div>
        <div class="track-actions"><button class="${state.studioRecordingTrack === index ? "record-btn active" : "record-btn"}" data-action="${state.studioRecordingTrack === index ? "studio-stop-vocal" : "studio-record-vocal"}" data-track="${index}">${state.studioRecordingTrack === index ? "Stop" : "Rec"}</button><button class="ghost-btn micro" data-action="studio-play-vocal" data-track="${index}">Play</button><label class="file-pill micro">Import<input type="file" accept="audio/*" data-action="studio-import-vocal" data-track="${index}" /></label><button class="ghost-btn micro" data-action="studio-export-vocal" data-track="${index}">Export</button></div>
        <div class="track-mix"><button class="ghost-btn micro" data-action="studio-toggle-vocal-mute" data-track="${index}">M</button><button class="ghost-btn micro" data-action="studio-toggle-vocal-solo" data-track="${index}">S</button><label>Vol <input type="range" min="0" max="100" value="${track.volume}" data-action="studio-vocal-set" data-track="${index}" data-vocal-field="volume" /></label><label>Start <input type="number" min="0" max="${studioTotalSteps() - 1}" value="${track.startStep}" data-action="studio-vocal-set" data-track="${index}" data-vocal-field="startStep" /></label><button class="ghost-btn micro danger" data-action="studio-clear-vocal" data-track="${index}">Clear</button></div>
      </div>`).join("")}
    </div>
  </div>`;
}

function studioEffectsRack() {
  const fx = [
    ["drive", "Drive", "Saturation"],
    ["tone", "Filter", "Cutoff"],
    ["delay", "Delay", "Echo"],
    ["reverb", "Reverb", "Space"],
    ["punch", "Comp", "Punch"],
  ];
  return `<div class="panel lm-studio-panel effects-panel lm-studio-glass" id="studio-effects">
    <div class="panel-title-row"><div><span class="eyebrow">Effects Rack</span><h2>Master FX Chain</h2></div><span class="panel-badge">Live</span></div>
    <div class="fx-rack-grid">
      ${fx.map(([key, label, sub]) => {
        const value = Math.max(0, Math.min(100, Number(state.studio.effects[key]) || 0));
        const angle = -135 + value * 2.7;
        return `<label class="fx-module fx-knob-module" style="--knob-value:${value};--knob-angle:${angle}deg">
          <strong>${label}</strong>
          <span>${sub}</span>
          <span class="fx-knob-face" aria-hidden="true"><i></i></span>
          <input class="fx-knob-input" type="range" min="0" max="100" value="${value}" data-action="studio-effect-set" data-effect="${key}" aria-label="${escapeHtml(label)} ${escapeHtml(sub)}" />
          <em>${value}%</em>
        </label>`;
      }).join("")}
    </div>
  </div>`;
}

function studioImportExportPanel() {
  return `<div class="panel lm-studio-panel files-panel lm-studio-glass" id="studio-files">
    <div class="panel-title-row"><div><span class="eyebrow">Project & Files</span><h2>Import / Export</h2></div><span class="panel-badge">Memory</span></div>
    <div class="file-action-grid">
      <button class="ghost-btn" data-action="studio-save-project">Save Browser Project</button>
      <button class="ghost-btn" data-action="studio-export-project">Export Project JSON</button>
      <label class="file-pill">Import Project<input type="file" accept="application/json,.json" data-action="studio-import-project" /></label>
      <button class="ghost-btn" data-action="studio-export-pack">Export Sound Pack</button>
      <label class="file-pill">Import Pack<input type="file" accept="application/json,.json" data-action="studio-import-pack" /></label>
      <label class="file-pill">Import Stems<input type="file" accept="audio/*" multiple data-action="studio-import-stems" /></label>
      <button class="ghost-btn" data-action="studio-export-sample">Export Selected Pad</button>
      <button class="gold-btn" data-action="studio-export-stems">Export Sounds / Stems</button>
      <button class="${state.studioMasterRecording ? "record-btn active" : "ghost-btn"}" data-action="${state.studioMasterRecording ? "studio-stop-master-record" : "studio-start-master-record"}">${state.studioMasterRecording ? "Stop Mix Export" : "Record Full Mix"}</button>
    </div>
    <div class="drag-zone">Drag & drop samples or stems here<br><small>or use Import Sound / Import Stems / Import Pack</small></div>
    <small class="studio-note">Mic, tab capture, direct URL loading, and MediaRecorder depend on browser permissions and CORS. Protected media is not bypassed.</small>
  </div>`;
}

function studioBeatLottoPanel() {
  const lotto = studioLottoConfig();
  const features = studioBeatFeatures();
  const lastSet = lotto.lastSet || null;
  const lastPicks = Array.isArray(lotto.lastPicks) ? lotto.lastPicks : [];
  const methodInfo = STUDIO_LOTTO_METHODS.find((item) => item[0] === lotto.method) || STUDIO_LOTTO_METHODS[0];
  return `<div class="panel lm-studio-panel beat-lotto-panel lm-studio-glass" id="studio-beat-lotto">
    <div class="panel-title-row">
      <div><span class="eyebrow">Beat → Lotto</span><h2>Groove Number Engine</h2></div>
      <span class="panel-badge">Creative Picks</span>
    </div>
    <p class="studio-note">Turn the rhythm, pad hits, BPM, swing, human feel, samples, vocals, and FX settings into LottoMind number picks. This is a creative generator, not a prediction system.</p>
    <div class="beat-lotto-controls">
      <label>Game <select data-action="studio-lotto-set" data-lotto-field="gameId">${LOTTO_GAMES.map((game) => `<option value="${game.id}" ${game.id === (lotto.gameId || state.gameId) ? "selected" : ""}>${escapeHtml(game.name)}</option>`).join("")}</select></label>
      <label>Method <select data-action="studio-lotto-set" data-lotto-field="method">${STUDIO_LOTTO_METHODS.map(([id, label]) => `<option value="${id}" ${id === lotto.method ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label>Function <select data-action="studio-lotto-set" data-lotto-field="functionMode">${STUDIO_LOTTO_FUNCTIONS.map(([id, label]) => `<option value="${id}" ${id === lotto.functionMode ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label>Sets <input type="number" min="1" max="10" value="${Number(lotto.setCount) || 3}" data-action="studio-lotto-set" data-lotto-field="setCount" /></label>
      <label class="beat-lotto-check"><input type="checkbox" ${lotto.entropy ? "checked" : ""} data-action="studio-lotto-set" data-lotto-field="entropy" /> Fresh entropy</label>
    </div>
    <div class="beat-lotto-metrics">
      <span><strong>${features.eventCount}</strong><small>Events</small></span>
      <span><strong>${features.padsUsed}</strong><small>Pads</small></span>
      <span><strong>${features.density}%</strong><small>Density</small></span>
      <span><strong>${features.sampleCount}</strong><small>Samples</small></span>
      <span><strong>${features.stemCount || 0}</strong><small>Stems</small></span>
      <span><strong>${features.djStemCount || 0}</strong><small>DJ Decks</small></span>
      <span><strong>${features.vocalCount}</strong><small>Vocals</small></span>
      <span><strong>${features.avgVelocity}</strong><small>Avg Vel</small></span>
    </div>
    <div class="beat-lotto-output ${lastSet ? "has-set" : ""}">
      <span>${escapeHtml(methodInfo[1])}</span>
      <strong>${lastSet ? escapeHtml(lastSet.gameName) : "No picks yet"}</strong>
      ${lastSet ? ballsHtml(lastSet.numbers || [], lastSet.special, lastSet.specialName) : `<div class="empty-lotto-pick">Program a beat or tap Random, then generate.</div>`}
      ${lastSet ? `<small>${escapeHtml(lastSet.note)}</small>` : `<small>${escapeHtml(methodInfo[2])}</small>`}
    </div>
    ${lastPicks.length > 1 ? `<div class="beat-lotto-list">${lastPicks.slice(1, 10).map((set, index) => `<div><span>Alt ${index + 2}</span>${ballsHtml(set.numbers || [], set.special, set.specialName)}</div>`).join("")}</div>` : ""}
    <div class="sample-actions bottom beat-lotto-actions">
      <button class="gold-btn" data-action="studio-generate-lotto">Generate From Beat</button>
      <button class="ghost-btn" data-action="studio-randomize-and-lotto">Random Beat + Picks</button>
      <button class="ghost-btn" data-action="studio-copy-lotto">Copy Picks</button>
      <button class="ghost-btn" data-action="studio-save-lotto">Save To Records</button>
    </div>
  </div>`;
}

function sonicStudioView() {
  return `<section class="screen sonic-studio-screen lottomind-studio-screen lm-studio-mode lm-studio-v9">
    ${studioTransportControls()}
    ${studioControlStrip()}
    <div class="lm-studio-grid">
      ${studioDrumPads()}
      ${studioSequencerGrid()}
      ${studioSamplerPanel()}
      ${studioKeyboardSection()}
      ${studioEffectsRack()}
      ${studioDjDecksPanel()}
      ${studioVocalTracks()}
      ${studioMicPanel()}
      ${studioStemDeckPanel()}
      ${studioDefaultStemKitPanel()}
      ${studioImportExportPanel()}
    </div>
    ${studioBeatLottoPanel()}
    ${studioRecordingBooth()}
    <div class="panel studio-terms lm-studio-footer lm-studio-glass">
      <span>LottoMind Studio v9.0 · Custom Branded Interface</span>
      <span class="online">All systems ${state.studioPlaying ? "running" : "ready"}</span>
      <span>Audio-clock scheduler</span>
      <span>FX chain active</span>
      <span>${studioTotalSteps()} loop ticks</span><span>${(state.studio.stems || []).filter((stem) => stem.data).length} stems loaded</span><span>${(state.studio.pads || []).filter((pad) => pad.sampleData && isStudioDefaultStemUrl(pad.sampleData)).length} default pad slices</span><span>dual turntables ready</span>
      <p>Only import or record audio you own or have permission to use. Mic, line, tab capture, direct URL loading, and MediaRecorder exports depend on browser support and permission prompts.</p>
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
        <h1>LottoMind Records</h1>
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
        <span class="eyebrow">Rewards Vault</span>
        <h1>Activity Rewards</h1>
        <p>Use free points earned through LottoMind activities. Points are not sold and have no cash or lottery-ticket value.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-route="wallet">Activity Points</button>
          <button class="ghost-btn" data-route="vip">VIP</button>
          <button class="ghost-btn" data-route="store">Merch Store</button>
        </div>
      </div>
      <img class="deck-coin" src="${ASSETS.credit}" alt="LottoMind credit coin" />
    </div>
    <div class="tool-grid">
      ${MARKETPLACE_ITEMS.map(([title, copy, cost, unlock]) => `<button class="store-card ${unlocked[unlock] ? "unlocked" : ""}" data-action="buy-item" data-cost="${cost}" data-unlock="${unlock}" data-title="${escapeHtml(title)}"><strong>${title}</strong><span>${copy}</span><small>${unlocked[unlock] ? "Unlocked" : `${cost} points`}</small></button>`).join("")}
      ${FEATURE_UNLOCKS.map((item) => `<button class="store-card ${isUnlocked(item.id) ? "unlocked" : ""}" data-action="unlock-feature" data-unlock="${item.id}"><strong>${item.title}</strong><span>${item.window} - ${routeMeta(item.route)[0]}</span><small>${isUnlocked(item.id) ? "Unlocked" : `${item.cost} points`}</small></button>`).join("")}
    </div>
    <div class="panel related-panel">
      <div class="section-head"><div><h2>Store Routes</h2><p>More old app functions connected here.</p></div></div>
      <div class="circle-carousel">
        ${[["Official Merch", "Shop", "store"], ["Activity Points", "Free", "wallet"], ["VIP", "Premium", "vip"], ["Achievements", "Rewards", "achievements"], ["Arcade", "Play", "arcade"]].map(([title, sub, route], index) => circleTool(title, sub, route, index + 4)).join("")}
      </div>
    </div>
  </section>`;
}

function merchStoreView() {
  const selectedIndex = Math.min(Math.max(Number(state.selectedMerchIndex) || 0, 0), Math.max(MERCH_ITEMS.length - 1, 0));
  const selected = MERCH_ITEMS[selectedIndex] || MERCH_ITEMS[0];
  const categories = ["All", ...Array.from(new Set(MERCH_ITEMS.map((item) => item.type)))];
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
      <div class="merch-video-medallion"><img src="${ASSETS.detroitCapClose}" alt="" /></div>
      <div class="merch-hero-status" aria-label="Merch store status"><span>Inventory</span><strong>${MERCH_ITEMS.length} drops online</strong></div>
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
        <div class="product-buy"><b>${escapeHtml(selected.price)}</b><span class="release-availability">Ordering is not included in this app release.</span></div>
      </div>
    </div>
    <div class="merch-grid">
      ${filtered.map((item) => {
        const index = MERCH_ITEMS.indexOf(item);
        return `<article class="panel product-card ${index === selectedIndex ? "active" : ""}">
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
  const localEntryCount = Object.keys(localProfileEntries()).length;
  const membership = hasRevenueCatProAccess() ? "Pro active" : "Free access";
  return `<section class="screen">
    <div class="panel art-panel" style="--panel-art:url('${ASSETS.mascot}')">
      <span class="eyebrow">On-device profile</span>
      <h1>Local Profile</h1>
      <p>This release does not create a LottoMind account. Your saved activity stays on this device unless you export or share it.</p>
      <div class="stat-row">
        <div><strong>${getCredits()}</strong><span>Points</span></div>
        <div><strong>${loadJson(STORAGE.history, []).length}</strong><span>Saved</span></div>
        <div><strong>${localEntryCount}</strong><span>Local records</span></div>
      </div>
    </div>
    <div class="panel account-control-panel">
      <div class="section-head"><div><h2>Profile Controls</h2><p>${membership}. Subscription purchases are tied to the Apple ID or Google account used by the store.</p></div></div>
      <button class="list-button" data-route="history">Saved Picks and Readings<span>Open</span></button>
      <button class="list-button" data-route="paywall">Membership<span>${membership}</span></button>
      <button class="list-button" data-action="restore-revenuecat">Restore Purchases<span>Restore</span></button>
      <button class="list-button" data-action="manage-revenuecat">Manage Subscription<span>Open</span></button>
      <button class="list-button" data-route="settings">Privacy and App Settings<span>Open</span></button>
      <button class="list-button" data-route="policies">Privacy Policy and Terms<span>Read</span></button>
      <button class="list-button" data-external-url="https://github.com/robjasper2084/Jungle-Lotto/issues">Support<span>Open</span></button>
    </div>
  </section>`;
}

function settingsView() {
  const settings = getSettings();
  return `<section class="screen">
    <div class="panel settings-panel">
      <h1>App Settings</h1>
      <p>Feature switches and app activity are stored locally on this device.</p>
      ${Object.entries(settings).map(([key, value]) => `<button class="list-button settings-toggle" data-action="toggle-setting" data-setting="${key}" aria-pressed="${value ? "true" : "false"}">
        <span class="setting-copy"><strong>${key === "music" ? "Tab Intro Music" : titleCase(key)}</strong><small>${key === "music" ? "5-second tab intros" : key === "responsible" ? "Responsible play reminders" : `${titleCase(key)} controls`}</small></span>
        <span class="switch-control ${value ? "on" : ""}"><i></i><b>${value ? "On" : "Off"}</b></span>
      </button>`).join("")}
    </div>
    <div class="panel privacy-control-panel">
      <div class="section-head"><div><h2>Privacy Controls</h2><p>Camera, microphone, speech, and location are requested only when you start a feature that needs them.</p></div><span>On device</span></div>
      <button class="list-button" data-action="export-local-data">Export My Local Data<span>JSON</span></button>
      <button class="list-button" data-route="policies">Privacy Policy and Terms<span>Read</span></button>
      <button class="list-button" data-action="restore-revenuecat">Restore Purchases<span>Restore</span></button>
      <button class="list-button" data-action="manage-revenuecat">Manage Subscription<span>Open</span></button>
      ${state.privacyDeleteArmed ? `<div class="delete-confirmation" role="alert"><strong>Delete all local LottoMind data?</strong><p>This removes saved numbers, readings, recordings metadata, settings, points, and local subscription identifiers from this device. Store subscriptions are not cancelled.</p><div class="hero-actions"><button class="danger-btn" data-action="confirm-delete-local-data">Delete Local Data</button><button class="ghost-btn" data-action="cancel-delete-local-data">Cancel</button></div></div>` : `<button class="list-button danger-list-button" data-action="request-delete-local-data">Delete Local Profile and Data<span>Delete</span></button>`}
    </div>
  </section>`;
}

function policiesView() {
  return `<section class="screen policies-screen">
    <div class="panel art-panel policy-hero" style="--panel-art:url('${ASSETS.live}')">
      <span class="eyebrow">Effective July 22, 2026</span>
      <h1>Privacy, Terms, and Responsible Play</h1>
      <p>LottoMind is an entertainment, creativity, organization, and learning app. It does not sell lottery tickets, accept wagers, provide cash prizes, or guarantee lottery outcomes.</p>
    </div>
    <div class="panel policy-document">
      <section><h2>Privacy Policy</h2><p>This release does not require or create a LottoMind account. Saved sets, dream text, activity scores, settings, points, and studio project metadata are stored in this app on your device.</p></section>
      <section><h2>Device Permissions</h2><p>Camera or photo access is used only when you choose ticket scanning. Microphone and speech access are used only when you choose recording or voice input. Location is used only when you request nearby retailer context. Permission denial does not block unrelated parts of the app.</p></section>
      <section><h2>Subscriptions</h2><p>On iOS and Android, subscription purchases are processed by Apple or Google and synchronized by RevenueCat. LottoMind receives subscription status, product, renewal, and technical purchase identifiers needed to provide access. LottoMind does not receive your full payment card number.</p></section>
      <section><h2>Sharing and Tracking</h2><p>LottoMind does not sell personal information and does not include advertising trackers in this release. Content leaves the device only when you deliberately share, export, follow an external link, or complete a store purchase.</p></section>
      <section><h2>Retention and Deletion</h2><p>Local data remains until you delete it in App Settings, clear the app storage, or uninstall the app. The export and deletion controls are available from Profile and Settings. Deleting local data does not cancel an Apple or Google subscription; use Manage Subscription for cancellation.</p></section>
      <section><h2>Children</h2><p>The app is not directed to children under 13. Lottery participation is age-restricted by jurisdiction. Users must follow the minimum legal lottery age where they live, even though this app does not sell tickets.</p></section>
      <section><h2>Terms of Use</h2><p>Use LottoMind only for lawful entertainment and personal organization. Number generators, heatmaps, dreams, psychic-themed tools, and historical views are creative or informational experiences, not predictions or financial advice. Official lottery sources control winning results and ticket validation.</p></section>
      <section><h2>Activity Points</h2><p>Activity points are free, local, non-transferable, and have no cash value. They cannot be purchased, redeemed, cashed out, or used to buy lottery tickets.</p></section>
      <section><h2>User Content</h2><p>Only record, import, or share audio, images, and text that you own or have permission to use. You are responsible for content you export or share through another service.</p></section>
      <section><h2>Support</h2><p>Questions, privacy requests, and support reports can be submitted through the LottoMind project support page.</p><button class="ghost-btn" data-external-url="https://github.com/robjasper2084/Jungle-Lotto/issues">Open Support</button></section>
    </div>
    <div class="panel policy-actions"><button class="primary-btn" data-route="settings">Privacy Controls</button><button class="ghost-btn" data-route="profile">Local Profile</button><button class="ghost-btn" data-route="dashboard">Home</button></div>
  </section>`;
}

function jackpotChaseView() {
  const game = ARCADE_GAMES.find((entry) => entry.id === state.activeArcadeGameId) || ARCADE_GAMES[0];
  return `<section class="screen jackpot-chase-screen arcade-player-screen">
    <div class="panel art-panel jackpot-chase-hero arcade-player-hero" style="--panel-art:url('${game.art || ASSETS.arcade}')">
      <span class="eyebrow">LottoMind In-App Game Player</span>
      <h1>${escapeHtml(game.title)}</h1>
      <p>${escapeHtml(game.copy)}</p>
      <div class="hero-actions"><button class="primary-btn" data-action="fullscreen-arcade-game">Full Screen</button><button class="ghost-btn" data-action="reload-arcade-game">Reload Game</button><button class="ghost-btn" data-route="arcade">Back to Game Select</button></div>
    </div>
    <div class="panel jackpot-chase-stage">
      <iframe id="lottomind-arcade-player" src="${game.url}" title="${escapeHtml(game.title)} game" loading="eager" allow="fullscreen; gamepad" allowfullscreen></iframe>
    </div>
    <div class="panel disclaimer-card"><strong>Entertainment Only</strong><p>Game scores, points, and number reveals have no cash value and do not predict lottery results. Audio starts only after player interaction inside the game.</p></div>
  </section>`;
}

function arcadeView() {
  const games = [
    ...ARCADE_GAMES.map((game) => ({ ...game, route: "arcadeGame" })),
    { id: "trivia-rewards", title: "Trivia Rewards", copy: "Review verified Daily Vault rewards and local streak progress.", route: "triviaRewards", art: ASSETS.arcadeTrivia },
    { id: "trivia-vault", title: "LottoMind Trivia Vault", copy: "Play five complete modes with 154 reviewed questions.", route: "triviaPlay", featureClass: "featured-trivia-vault", art: ASSETS.arcadeTrivia },
  ];
  const activeArcadePanel = state.route === "crossword" ? crosswordGameView() : state.route === "wordSearch" ? wordSearchGameView() : state.route !== "arcade" ? miniGameView(routeMeta(state.route)[0]) : "";
  return `<section class="screen">
    <div class="panel art-panel arcade-hero-panel" data-art-kind="arcade" style="--panel-art:url('${ASSETS.arcadeHero}')">
      <div class="arcade-hero-copy">
        <span class="eyebrow">Future Play Grid</span>
        <h1 class="game-title">LottoMind Arcade</h1>
        <p>Original games, verified trivia runs, learning missions, and reward-status tools.</p>
        <div class="hero-actions arcade-launch-actions"><button class="primary-btn" data-route="triviaPlay">Launch Trivia Game</button><button class="ghost-btn" data-route="triviaRewards">Rewards</button></div>
      </div>
      <div class="arcade-hero-status" aria-label="Arcade status"><span>${games.length} games</span><strong>Grid online</strong></div>
    </div>
    <div class="panel arcade-motion arcade-hud-panel">
          <video data-src="${BASE}/videos/play-arcade-button-loop.mp4" muted loop playsinline preload="none" data-autoplay-on-visible="true"></video>
      <div class="arcade-hud-copy"><span class="arcade-hud-kicker">Arcade Command Link</span><strong>Mission Control Online</strong><p>Launch games, verify trivia runs, and track reward status from one built-in HUD.</p><div class="arcade-hud-meter" aria-hidden="true"><i></i></div><div class="arcade-hud-chips"><span>09 stages</span><span>secure claim</span><span>live</span></div></div>
    </div>
    ${activeArcadePanel}
    <div class="panel arcade-game-panel">
      <div class="section-head"><div><h2>Game Select</h2><p>Live LottoMind games from the current website build.</p></div><span>${games.length} games</span></div>
      <div class="arcade-game-grid">${games.map((game, index) => `
        <button class="arcade-game-card ${game.featureClass || ""}" ${game.url ? `data-action="open-arcade-game" data-game-id="${game.id}"` : `data-route="${game.route}"`} style="--game-art:url('${game.art || ASSETS.arcadeArcade}')">
          <span>Stage ${String(index + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(game.title)}</strong>
          <small>${escapeHtml(game.copy)}</small>
          <b>${game.featureClass ? "Launch" : "Play"}</b>
        </button>
      `).join("")}</div>
    </div>
    ${PLAY_LEARN_GROUP ? `<div class="panel tool-bank arcade-learn-bank arcade-hud-panel">
      <div class="section-head arcade-hud-head"><div><span class="arcade-hud-kicker">Training Matrix</span><h2>${PLAY_LEARN_GROUP.title}</h2><p>${PLAY_LEARN_GROUP.copy}</p></div><span class="arcade-hud-status">${PLAY_LEARN_GROUP.tools.length} tools · online</span></div>
      <div class="circle-carousel tool-bento">
        ${PLAY_LEARN_GROUP.tools.map(([title, sub, route], index) => circleTool(title, sub, route, index + 8, { surfaceArt: ASSETS.arcadeTrainingSurface, preferStaticArt: true })).join("")}
      </div>
    </div>` : ""}
    <div class="panel quest-board arcade-quest-board">
      <div class="section-head movie-head arcade-hud-head"><div><span class="arcade-hud-kicker">Verified Run Protocol</span><h2>Quest Board</h2></div><span class="arcade-hud-status">4 steps</span></div>
      <div class="quest-steps">
        ${[
          ["1", "Pick Stage", "Choose a game lane", "triviaPlay", ASSETS.arcade],
          ["2", "Run", "Complete the mission", "triviaPlay", ASSETS.arcadeCoin],
          ["3", "Verify", "Server validates the result", "triviaRewards", ASSETS.credit],
          ["4", "Wallet", "Claim once, then sync", "history", ASSETS.live],
        ].map(([step, title, copy, route, art]) => `<button class="quest-step ${state.route === route ? "active" : ""}" data-route="${route}" style="--quest-art:url('${art}');--quest-surface:url('${ASSETS.arcadeQuestSurface}')"><b>${step}</b><strong>${title}</strong><small>${copy}</small></button>`).join("")}
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
        <h1>Game Show Trivia</h1>
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
          return `<button class="trivia-option ${stateClass}" data-action="answer-trivia" data-answer="${optionIndex}" ${state.triviaRewardStatus === "submitting" ? "disabled" : ""}>
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
      <p class="release-note">Activity points are earned only through completed on-device activities. Paid boosts and rewarded ads are not included in this release.</p>
      <button class="primary-btn full" data-action="restart-trivia">Start New Trivia Run</button>
    </div>
  </section>`;
}

function triviaGameView() {
  return `<section class="screen trivia-screen refined-trivia-route">
    <div id="refined-trivia-vault-root" class="refined-trivia-vault" aria-busy="true">
      <div class="panel"><span class="eyebrow">Loading game engine</span><h1>LottoMind Trivia Vault</h1><p>Preparing 154 reviewed questions and saved local progress...</p></div>
    </div>
  </section>`;
}

function triviaRewardsView() {
  const reward = Number(state.triviaAward?.amount || 0);
  const progress = getTriviaProgress();
  const dailyPct = Math.min(100, Math.round((progress.dailyStreak / 7) * 100));
  const weeklyPct = Math.min(100, Math.round((progress.weeklyStreak / 7) * 100));
  return `<section class="screen trivia-screen">
    <div class="panel art-panel trivia-hero reward-hero trivia-show-hero" style="--panel-art:url('${ASSETS.commandDeck}')">
      <div>
        <span class="eyebrow">LottoMind Trivia Home</span>
        <h1>Verified Trivia Rewards</h1>
        <p>Scores stay local; wallet credits are issued only by the authenticated reward service after a completed run.</p>
        <div class="trivia-streak-strip"><span>${triviaRewardMessage()}</span><span>Daily ${progress.dailyStreak}/7</span><span>Weekly ${progress.weeklyStreak}/7</span></div>
        <div class="hero-actions">
          <button class="primary-btn" data-route="triviaPlay">Start Trivia</button>
          <button class="ghost-btn" data-route="arcade">Arcade</button>
          <button class="ghost-btn" data-route="marketplace">Redeem Credits</button>
        </div>
      </div>
      <div class="trivia-score-orb"><strong>${reward}</strong><span>Verified credits</span></div>
    </div>
    <div class="trivia-home-grid">
      <div class="panel streak-card">
        <span class="eyebrow">Daily Challenge</span>
        <h2>5 Questions</h2>
        <p>Complete all five questions, then request one idempotent server-verified daily claim.</p>
        <button class="primary-btn full" data-action="restart-trivia">Start Trivia</button>
      </div>
      <div class="panel streak-card">
        <span class="eyebrow">Daily Streak</span>
        <h2>${progress.dailyStreak} days</h2>
        <div class="progress-rail"><i style="width:${dailyPct}%"></i></div>
        <p>Streaks are progress markers. They do not mutate the wallet in the browser.</p>
      </div>
      <div class="panel streak-card">
        <span class="eyebrow">Weekly Streak</span>
        <h2>${progress.weeklyStreak}/7</h2>
        <div class="progress-rail"><i style="width:${weeklyPct}%"></i></div>
        <p>Wallet awards remain controlled by the authoritative reward API.</p>
      </div>
      <div class="panel streak-card">
        <span class="eyebrow">Leaderboard</span>
        <h2>Preview Lane</h2>
        <p>Local board tracks recent runs. Cloud ranking can plug in later.</p>
        <button class="ghost-btn full" data-route="community">Open Community</button>
      </div>
    </div>
    <div class="panel trivia-console trivia-reward-panel trivia-game-show-console">
      <div class="section-head"><div><h2>Reward Summary</h2><p>Server claim status for the completed daily run.</p></div><span>${reward} verified</span></div>
      <div class="trivia-reward-grid">
        <div><span>Run Score</span><strong>${state.triviaScore}</strong></div>
        <div><span>Best Streak</span><strong>${state.triviaStreak}x</strong></div>
        <div><span>Questions</span><strong>${TRIVIA_QUESTIONS.length}</strong></div>
        <div><span>Daily Streak</span><strong>${progress.dailyStreak}</strong></div>
        <div><span>Weekly Track</span><strong>${progress.weeklyStreak}/7</strong></div>
        <div><span>History</span><strong>${progress.history.length}</strong></div>
      </div>
      <p class="release-note">No wallet values are simulated or modified by Trivia Vault. A failed, offline, or signed-out claim stays score-only.</p>
      <button class="primary-btn full" data-action="restart-trivia">Start New Trivia Run</button>
    </div>
    <div class="panel disclaimer-card">
      <strong>Secure reward model</strong>
      <p>Trivia Vault never spends or grants credits from local storage. Marketplace unlocks require the verified account wallet and its authoritative spend API.</p>
      <div class="hero-actions"><button class="ghost-btn" data-route="profile">Account Status</button><button class="ghost-btn" data-route="marketplace">Marketplace</button></div>
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
    copy: "Location helps find stores, credits are demo rewards, and LottoMind does not guarantee winning numbers. Music and audio are original or properly licensed for use in Lotto Mind. Lotto Mind is for entertainment and mindset support only and does not guarantee lottery results.",
    art: ASSETS.live,
    stats: [["Location", "Optional"], ["Credits", "Demo"], ["Data", "Local"]],
    actions: [["Help", "route", "help"], ["Settings", "route", "settings"], ["Home", "route", "dashboard"]],
  },
  paywall: {
    eyebrow: "Premium Gate",
    title: "Unlock LottoMind Pro",
    copy: "RevenueCat Web Billing now powers subscriptions while Lotto Credits still unlock one-off premium tools.",
    art: ASSETS.credit,
    stats: () => [["Credits", getCredits()], ["VIP", isUnlocked("vip-insights") ? "Open" : "Locked"], ["RevenueCat", revenueCatStatusLabel()]],
    actions: () => [[revenueCatCtaLabel(), "subscribe-pro"], ["VIP Unlock", "unlock-feature", "vip-insights"], ["Redeem Credits", "route", "triviaRewards"]],
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
    <p>${unlock.window}. Unlock with Lotto Credits or activate LottoMind Pro through RevenueCat.</p>
    <div class="hero-actions padded">
      <button class="primary-btn" data-action="unlock-feature" data-unlock="${unlock.id}">Unlock for ${unlock.cost}</button>
      <button class="ghost-btn" data-action="subscribe-pro">Subscribe</button>
      <button class="ghost-btn" data-route="triviaRewards">Earn Credits</button>
    </div>
  </div>`;
}

function revenueCatPanel() {
  const rc = revenueCatSnapshot();
  const status = revenueCatStatusLabel();
  const message = rc?.error || rc?.message || "Checking subscription availability.";
  const price = rc?.priceLabel || "Unavailable";
  const packageLabel = rc?.packageLabel || "LottoMind Pro";
  const subscribeDisabled = !rc?.isConfigured || rc?.isEntitled || rc?.status === "checkout";
  return `<div class="panel revenuecat-panel ${rc?.isEntitled ? "active" : ""}">
    <div class="section-head"><div><h2>LottoMind Pro</h2><p>${escapeHtml(message)}</p></div><span>${escapeHtml(status)}</span></div>
    <div class="revenuecat-status-strip">
      <span><strong>${escapeHtml(price)}</strong><small>Store price</small></span>
      <span><strong>${escapeHtml(packageLabel)}</strong><small>Membership</small></span>
      <span><strong>${rc?.isEntitled ? "Active" : "Free"}</strong><small>Current access</small></span>
    </div>
    <div class="revenuecat-checkout-frame" data-revenuecat-paywall></div>
    <div class="hero-actions padded">
      <button class="primary-btn" data-action="subscribe-pro" ${subscribeDisabled ? "disabled" : ""}>${escapeHtml(revenueCatCtaLabel())}</button>
      <button class="ghost-btn" data-action="restore-revenuecat">Restore Purchases</button>
      <button class="ghost-btn" data-action="manage-revenuecat">Manage Subscription</button>
      <button class="ghost-btn" data-action="refresh-revenuecat">Refresh Status</button>
    </div>
  </div>`;
}

function realRouteView(routeKey) {
  const config = REAL_ROUTE_SCREENS[routeKey] || REAL_ROUTE_SCREENS.original;
  const actions = typeof config.actions === "function" ? config.actions() : config.actions;
  const stats = typeof config.stats === "function" ? config.stats() : config.stats;
  const routeUnlocked = !config.unlock || isUnlocked(config.unlock);
  return `<section class="screen feature-route-screen route-real-${routeKey}">
    <div class="panel art-panel feature-route-hero" style="--panel-art:url('${config.art}')">
      <div>
        <span class="eyebrow">${config.eyebrow}</span>
        <h1>${config.title}</h1>
        <p>${config.copy}</p>
        <div class="hero-actions">${actions.map(routeActionButton).join("")}</div>
      </div>
      <div class="feature-status-orb"><strong>${routeUnlocked ? "ON" : "LOCK"}</strong><span>${routeUnlocked ? "Ready" : "Credits"}</span></div>
    </div>
    ${lockedFeatureOverlay(config)}
    ${routeKey === "paywall" ? revenueCatPanel() : ""}
    <div class="feature-route-grid">
      ${stats.map(([label, value]) => metricCard(label, value)).join("")}
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

function communityBoardView() {
  const progress = getTriviaProgress();
  const manualScores = getSocialScores();
  const triviaRows = localTriviaScoreRows(progress);
  const leaders = communityLeaderboardRows();
  const localLeader = leaders[0];
  const localRank = localLeader ? `#${localLeader.rank}` : "Local";
  const bestScore = Math.max(bestLocalTriviaScore(progress), ...manualScores.map((score) => score.score), 0);
  const dailyPct = Math.min(100, Math.round(((Number(progress.dailyStreak) || 0) / 7) * 100));
  const weeklyPct = Math.min(100, Math.round(((Number(progress.weeklyStreak) || 0) / 7) * 100));
  const savedRows = manualScores.length ? manualScores : [];
  return `<section class="screen social-screen lottomind-social-screen">
    <div class="panel art-panel social-hero" style="--panel-art:url('${ASSETS.socialBoard || ASSETS.arcade}')">
      <div class="social-hero-copy">
        <span class="eyebrow">LottoMind Social</span>
        <h1>Community Board</h1>
        <p>Your on-device streaks and saved challenge scores. This release does not publish a public leaderboard.</p>
        <div class="hero-actions social-hero-actions">
          <button class="primary-btn" data-route="triviaPlay">Play Trivia</button>
          <button class="ghost-btn" data-route="triviaRewards">Rewards</button>
        </div>
        <div class="social-status-strip">
          <span>Stored on this device</span>
          <span>No public posting</span>
          <span>No simulated players</span>
        </div>
      </div>
      <div class="social-orb">
        <strong>${localRank}</strong>
        <span>Local Rank</span>
      </div>
    </div>

    <div class="social-stats-grid">
      ${metricCard("Local Rank", localRank)}
      ${metricCard("Daily Streak", Number(progress.dailyStreak) || 0)}
      ${metricCard("Weekly Track", `${Number(progress.weeklyStreak) || 0}/7`)}
      ${metricCard("Activity Points", getCredits())}
      ${metricCard("Saved Scores", manualScores.length)}
    </div>

    <div class="social-board-layout">
      <div class="panel social-leaderboard">
        <div class="section-head">
          <div>
            <h2>Local Scoreboard</h2>
            <p>Only activity saved on this device appears here.</p>
          </div>
          <span>${leaders.length} rows</span>
        </div>
        <div class="social-leader-list">
          ${leaders.map((row) => `<article class="social-leader-row is-local">
            <span class="social-rank">${String(row.rank).padStart(2, "0")}</span>
            <div class="social-player">
              <strong>${escapeHtml(row.name)}</strong>
              <small>${escapeHtml(row.challenge || "Activity")} / ${escapeHtml(row.source || "On-device")}</small>
            </div>
            <div class="social-score">
              <strong>${row.score}</strong>
              <small>${row.streak ? `${row.streak} streak` : escapeHtml(row.badge || "Preview")}</small>
            </div>
          </article>`).join("")}
        </div>
      </div>

      <div class="panel social-streak-panel">
        <div class="section-head">
          <div>
            <h2>Local Streaks</h2>
            <p>Streaks come from Trivia Rewards and local challenge saves.</p>
          </div>
          <span>Device</span>
        </div>
        <div class="social-streak-card">
          <span>Daily Streak</span>
          <strong>${Number(progress.dailyStreak) || 0}/7</strong>
          <div class="social-progress"><i style="width:${dailyPct}%"></i></div>
        </div>
        <div class="social-streak-card">
          <span>Weekly Streak</span>
          <strong>${Number(progress.weeklyStreak) || 0}/7</strong>
          <div class="social-progress"><i style="width:${weeklyPct}%"></i></div>
        </div>
        <div class="social-streak-metrics">
          <div><span>Recent Trivia Runs</span><strong>${triviaRows.length}</strong></div>
          <div><span>Best Local Score</span><strong>${bestScore}</strong></div>
          <div><span>Activity Points</span><strong>${getCredits()}</strong></div>
        </div>
      </div>
    </div>

    <div class="panel social-score-panel">
      <div class="section-head">
        <div>
          <h2>Saved Challenge Scores</h2>
          <p>Save local scores from Trivia, Crossword, Word Search, Studio Beat, or Dream Oracle.</p>
        </div>
        <span>${manualScores.length}/20 saved</span>
      </div>
      <div class="social-score-form">
        <label><span>Player</span><input data-bind="socialNameInput" value="${escapeHtml(state.socialNameInput)}" placeholder="Local Player" /></label>
        <label><span>Score</span><input type="number" min="0" max="999999" inputmode="numeric" data-bind="socialScoreInput" value="${escapeHtml(state.socialScoreInput)}" placeholder="0" /></label>
        <div class="social-challenge-tabs">
          ${SOCIAL_CHALLENGE_TYPES.map((challenge) => `<button class="${state.socialChallengeType === challenge ? "active" : ""}" data-action="set-social-challenge" data-challenge="${escapeHtml(challenge)}">${escapeHtml(challenge)}</button>`).join("")}
        </div>
        <div class="hero-actions">
          <button class="primary-btn" data-action="save-social-score">Save Score</button>
          <button class="ghost-btn" data-action="clear-social-scores">Clear Local Scores</button>
        </div>
      </div>
      <div class="social-score-list">
        ${savedRows.length ? savedRows.map((row) => `<article>
          <div>
            <strong>${escapeHtml(row.name)}</strong>
            <small>${escapeHtml(row.challenge)} / ${socialDateLabel(row.createdAt)}</small>
          </div>
          <b>${row.score}</b>
          <span>${row.streak} streak</span>
        </article>`).join("") : `<div class="social-empty-score"><strong>No saved challenge scores yet.</strong><p>Add a score above or play Trivia to start your local board.</p></div>`}
      </div>
    </div>

    <div class="panel social-prompts-panel">
      <div class="section-head">
        <div>
          <h2>Future Community Prompts</h2>
          <p>Friendly challenge cards route into real LottoMind screens and can be connected to cloud posting later.</p>
        </div>
        <span>${SOCIAL_PROMPTS.length} prompts</span>
      </div>
      <div class="social-prompt-grid">
        ${SOCIAL_PROMPTS.map(([title, copy, route, tag], index) => `<article class="social-prompt-card prompt-${index}">
          <span>${escapeHtml(tag)}</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(copy)}</small>
          <button class="ghost-btn" data-route="${route}">Open ${escapeHtml(routeMeta(route)[0])}</button>
        </article>`).join("")}
      </div>
    </div>

    <div class="panel social-responsible-note">
      <strong>Community features are for entertainment, organization, learning, and friendly challenges.</strong>
      <p>LottoMind does not guarantee lottery outcomes.</p>
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
    radioStation: ["Abundance Radio", "LottoMind Records live audio lane."],
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
    return [["Abundance Radio", "Listen", "radioStation"], ["Sonic Studio", "Record", "studio"], ["Reset Vault", "Tone", "reset"], ["Dream Oracle", "Speak", "dreams"], ["History Vault", "Save", "history"]];
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
    return `<div class="panel news-radar-panel daily-mystic-news-panel" style="--mystic-news-art:url('${ASSETS.mysticNewsBg}')">
      <div class="daily-mystic-hero">
        <span class="eyebrow">Daily Mystic News</span>
        <h2>News Radar Live Desk</h2>
        <p>State draw alerts, jackpot movement, matrix notes, and app notices styled as a focused LottoMind briefing.</p>
      </div>
      <div class="daily-mystic-stats">${metricCard("Alerts", alerts.length)}${metricCard("Draw Cards", rows.length)}${metricCard("Pinned", state.selectedState)}</div>
      <div class="daily-mystic-filter-row" aria-label="News radar filters">
        ${["Matrix", "Daily Games", "Jackpot", "Saved Alerts"].map((label, index) => `<button class="${index === 0 ? "active" : ""}" data-route="newsRadar">${label}</button>`).join("")}
      </div>
      <div class="daily-mystic-grid">${alerts.map(([title, copy], index) => `<article class="daily-mystic-card premium-news-card">
        <button class="daily-mystic-card-main" data-route="notifications">
          <img src="${ASSETS.mysticNewsBg}" alt="" />
          <span class="mystic-source-logo"><img src="${ASSETS.logo}" alt="" /></span>
          <div class="mystic-card-copy">
            <div class="mystic-card-topline"><span>${String(index + 1).padStart(2, "0")}</span><b>${state.selectedState}</b></div>
            <h3>${title}</h3>
            <p>${copy}</p>
            <em>Open alerts for notification setup.</em>
          </div>
        </button>
      </article>`).join("")}</div>
      <div class="result-list padded">${rows.map((record) => `<div class="history-row record-card"><strong>${record.gameName} - ${record.stateName}</strong>${ballsHtml(record.numbers, record.special)}<small>${record.drawDate} - ${record.session}${record.jackpotMillions ? ` - $${record.jackpotMillions}M` : ""}</small></div>`).join("")}</div>
      <p class="daily-mystic-note ethical">Entertainment and planning context only. Always verify official results with the lottery source before playing.</p>
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
      <div class="hero-actions padded"><button class="primary-btn" data-route="reset">Tune Reset</button><button class="ghost-btn" data-route="radioStation">Abundance Radio</button><button class="ghost-btn" data-route="dreams">Dream Oracle</button></div>
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
  if (state.route === "arcadeGame") return jackpotChaseView();
  if (["arcade", "game", "cardGame", "gamesHub", "crossword", "wordSearch", "ludo"].includes(state.route)) return arcadeView();
  if (state.route === "psychic") return psychicView();
  if (state.route === "community") return communityBoardView();
  if (["vip", "community", "contests", "achievements", "usLottery", "notifications", "onboarding", "splash", "thankYou", "original", "help", "policies", "paywall"].includes(state.route)) return realRouteView(state.route);
  return genericToolView(state.route);
}

let deferredMediaObserver = null;

function shouldConserveInlineMedia() {
  return Boolean(
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ||
    window.matchMedia?.("(pointer: coarse)")?.matches ||
    navigator.connection?.saveData ||
    /2g/.test(navigator.connection?.effectiveType || ""),
  );
}

function hydrateDeferredMedia(root = document) {
  const media = Array.from(root.querySelectorAll("video[data-src], video source[data-src]"))
    .map((element) => element.tagName === "SOURCE" ? element.closest("video") : element)
    .filter(Boolean);
  const uniqueVideos = Array.from(new Set(media));
  if (!uniqueVideos.length) return;

  const conserveMedia = shouldConserveInlineMedia();
  const restore = (video, autoplayed) => {
    if (video.dataset.mediaReady === "true") return autoplayed;
    if (video.dataset.src && !video.getAttribute("src")) {
      video.setAttribute("src", video.dataset.src);
    }
    video.querySelectorAll("source[data-src]").forEach((source) => {
      if (!source.getAttribute("src")) source.setAttribute("src", source.dataset.src);
    });
    video.preload = "none";
    video.setAttribute("preload", "none");
    video.load?.();
    video.dataset.mediaReady = "true";
    if (video.dataset.autoplayOnVisible === "true" && !conserveMedia && autoplayed < 1) {
      video.muted = true;
      video.play?.().catch(() => {});
      return autoplayed + 1;
    }
    return autoplayed;
  };

  if (deferredMediaObserver) deferredMediaObserver.disconnect();
  let autoplayed = 0;

  if (!("IntersectionObserver" in window)) {
    uniqueVideos.forEach((video) => {
      autoplayed = restore(video, autoplayed);
    });
    return;
  }

  deferredMediaObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      autoplayed = restore(entry.target, autoplayed);
      deferredMediaObserver.unobserve(entry.target);
    });
  }, { rootMargin: conserveMedia ? "80px" : "220px", threshold: 0.04 });

  uniqueVideos.forEach((video) => {
    video.preload = "none";
    video.setAttribute("preload", "none");
    deferredMediaObserver.observe(video);
  });
}

function render() {
  document.title = "LottoMind Refined";
  const app = document.getElementById("app");
  const previousShell = app.querySelector(".real-shell");
  const previousRoute = previousShell?.dataset.route || "";
  const previousScrollTop = previousShell?.scrollTop || 0;
  if (refinedTriviaMount) {
    refinedTriviaMount.destroy?.();
    refinedTriviaMount = null;
  }
  app.innerHTML = `<div class="real-shell route-${state.route}" data-route="${state.route}">
    <div class="future-vault-chrome" aria-hidden="true">
      <span class="vault-ring ring-a"></span>
      <span class="vault-ring ring-b"></span>
      <span class="vault-scanline"></span>
      <span class="vault-waveform"></span>
    </div>
    ${header()}
    ${missionHud()}
    <main class="real-main">${renderView()}</main>
    ${bottomNav()}
    ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
  </div>`;
  bindResetControls();
  if (previousShell && previousRoute === state.route && previousScrollTop > 0) {
    requestAnimationFrame(() => {
      const nextShell = document.querySelector(".real-shell");
      if (nextShell) nextShell.scrollTop = previousScrollTop;
    });
  }
  stopAudioIfNeeded();
  syncRouteAudio();
  hydrateDeferredMedia(app);
  startAmbientVideos();
  if (state.route === "triviaPlay") requestAnimationFrame(mountRefinedTriviaRoute);
}

function handleResetControlEvent(event) {
  const target = event.currentTarget;
  const action = target?.getAttribute?.("data-action");
  if (!action) return;
  const scrollY = window.scrollY;
  event.preventDefault();
  event.stopPropagation();
  handleAction(action, target);
  requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: "auto" }));
}

function bindResetControls() {
  document.querySelectorAll(".reset-screen button[data-action]").forEach((control) => {
    control.onclick = handleResetControlEvent;
  });
}

function startAmbientVideos() {
  requestAnimationFrame(() => {
    const conserveMedia = shouldConserveInlineMedia();
    document.querySelectorAll(".ambient-video").forEach((video) => {
      video.muted = true;
      const box = video.getBoundingClientRect();
      const visible = box.bottom > -160 && box.top < window.innerHeight + 160;
      if (visible && !conserveMedia && video.dataset.mediaReady === "true") {
        video.play?.().catch(() => {});
      } else {
        video.pause?.();
      }
    });
  });
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
  if (state.route !== "studio" && state.studioPlaying) stopStudioSequence(false);
  if (!isResetRoute()) {
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

function presetKeyForTone(tone) {
  return Object.entries(RESET_PRESETS).find(([, preset]) => preset.tone === String(tone))?.[0] || state.resetPreset || "calm";
}

function loadResetSession(tone, options = {}) {
  const presetKey = options.presetKey || presetKeyForTone(tone);
  const preset = RESET_PRESETS[presetKey] || RESET_PRESETS.calm;
  state.resetPreset = presetKey;
  state.tone = String(tone || preset.tone || state.tone || "528");
  if (options.duration || preset.tone === state.tone) {
    state.duration = Number(options.duration || preset.duration || state.duration) || 300;
  }
  state.timerRemaining = state.duration;
  if (options.autoplay) {
    state.audioPlaying = true;
    const started = startResetTone();
    if (!started) {
      const audio = ensureResetAudio();
      audio.play().catch(() => toast("Tap play again if the browser blocked audio."));
    }
    startTimer();
  }
  toast(`${state.tone} Hz generated`);
  render();
}

function loadResetPreset(presetKey) {
  const key = RESET_PRESETS[presetKey] ? presetKey : "calm";
  const preset = RESET_PRESETS[key];
  loadResetSession(preset.tone, { presetKey: key, duration: preset.duration, autoplay: true });
}

function toggleResetAudio() {
  if (!isResetRoute()) return;
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
    if (!isResetRoute()) {
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
      const scrollY = isResetRoute() ? window.scrollY : 0;
      render();
      if (isResetRoute()) {
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

function cleanTranscript(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function updateDreamInputs(value) {
  document.querySelectorAll('[data-bind="dreamText"]').forEach((input) => {
    if (input.value !== value) input.value = value;
  });
}

function startDreamRecording() {
  if (dreamRecognition) {
    try {
      dreamRecognition.stop();
    } catch {}
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (state.route === "dreams" || state.route === "dreamVideo" || state.route === "studio") {
      state.dreamText = `${state.dreamText} I saw water, gold, a key, and a doorway.`;
      state.currentDream = interpretDream(state.dreamText, state.gameId);
      state.currentSet = generateLottoSet(state.gameId, "dream", state.dreamText);
      toast("Mic not available here, so I added a sample spoken dream.");
      render();
    } else {
      toast("Mic navigation ready: type a search and press Enter if voice is blocked.");
    }
    return;
  }
  const recognition = new SpeechRecognition();
  const isDreamCapture = state.route === "dreams" || state.route === "dreamVideo" || state.route === "studio";
  const transcriptBase = isDreamCapture ? cleanTranscript(state.dreamText) : "";
  let finalTranscript = "";
  let lastInterimTranscript = "";
  let hadError = false;
  dreamRecognition = recognition;
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    state.dreamListening = isDreamCapture;
    state.dreamInterimText = "";
    render();
    toast(isDreamCapture ? "Dream dictation is live." : "Listening for app search...");
  };
  recognition.onresult = (event) => {
    let interimTranscript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = cleanTranscript(result?.[0]?.transcript);
      if (!transcript) continue;
      if (result.isFinal) {
        finalTranscript = cleanTranscript(`${finalTranscript} ${transcript}`);
      } else {
        interimTranscript = cleanTranscript(`${interimTranscript} ${transcript}`);
      }
    }
    lastInterimTranscript = interimTranscript;
    const transcript = cleanTranscript([transcriptBase, finalTranscript, interimTranscript].filter(Boolean).join(" "));
    const wantsNavigation = /\b(open|go|show|take me|navigate|switch|launch)\b/i.test(transcript);
    if (wantsNavigation || !isDreamCapture) {
      const route = routeFromSearch(transcript);
      const label = routeMeta(route)[0];
      state.searchQuery = transcript;
      toast(`Voice opening ${label}`);
      speakText(`Opening ${label}`);
      try {
        recognition.stop();
      } catch {}
      go(route);
      return;
    }
    state.dreamText = transcript;
    state.dreamInterimText = interimTranscript;
    updateDreamInputs(state.dreamText);
  };
  recognition.onerror = (event) => {
    hadError = true;
    dreamRecognition = null;
    state.dreamListening = false;
    state.dreamInterimText = "";
    const reason = event?.error === "not-allowed"
      ? "Mic permission is blocked. Allow microphone access, then tap Speak Dream again."
      : "Mic could not start. Type the dream and run it.";
    toast(reason);
    render();
  };
  recognition.onend = () => {
    dreamRecognition = null;
    state.dreamListening = false;
    state.dreamInterimText = "";
    if (hadError) return;
    const capturedTranscript = finalTranscript || lastInterimTranscript;
    const finalText = cleanTranscript([transcriptBase, capturedTranscript].filter(Boolean).join(" "));
    if (isDreamCapture && finalText) {
      state.dreamText = finalText;
      state.currentDream = interpretDream(state.dreamText, state.gameId);
      state.currentSet = generateLottoSet(state.gameId, "dream", state.dreamText);
      toast("Dream dictation captured.");
      speakText("Dream recorded. Run the Oracle when ready.");
    } else {
      toast(isDreamCapture ? "No voice captured. Try again near the mic." : "Voice search ended.");
    }
    render();
  };
  try {
    recognition.start();
  } catch {
    dreamRecognition = null;
    state.dreamListening = false;
    state.dreamInterimText = "";
    toast("Mic is already warming up. Try again in a second.");
    render();
  }
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
    [["studio", "music studio", "drum machine", "sampler", "record vocals", "beat maker", "mpc", "dj", "turntable", "turntables", "mix stems", "crossfader", "default stems", "stem kit", "custom stems"], "studio"],
    [["music", "radio", "apple", "youtube", "song", "audio"], "music"],
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
  const barcode = String(decoded || (action === "scan-barcode" ? state.barcodeInput : "")).trim();
  state.scanResult = {
    title: barcode ? "Barcode detected" : "Ticket image received",
    barcode,
    matchedGame: getGame().name,
    status: "Needs official verification",
    source: upload || (action === "scan-barcode" ? "Typed barcode" : "Ticket image"),
    note: `${upload ? `${upload} was opened on this device. ` : ""}${barcode ? `Barcode ${barcode} was read. ` : "No supported barcode was detected. "}LottoMind does not determine whether a ticket is valid or winning. Verify it with the official lottery operator or an authorized retailer.`,
  };
}

async function importStudioSampleFile(file, padIndex = state.studio.selectedPad) {
  if (!file) return;
  if (!String(file.type || "").startsWith("audio/")) {
    toast("Choose an audio file for the sampler.");
    return;
  }
  const data = await readFileAsDataUrl(file);
  const large = String(data).length > 950000;
  state.studio.pads[padIndex] = { ...state.studio.pads[padIndex], sampleName: file.name, sampleData: data, sampleTooLargeForSave: large };
  studioSampleBuffers = {};
  saveStudioProject();
  toast(large ? `${file.name} loaded. Export it too; this sample may be too large for browser save.` : `${file.name} loaded to ${state.studio.pads[padIndex].name}`);
  render();
}

async function importStudioVocalFile(file, trackIndex) {
  if (!file) return;
  if (!String(file.type || "").startsWith("audio/")) {
    toast("Choose an audio file for the vocal track.");
    return;
  }
  const data = await readFileAsDataUrl(file);
  const sessionOnly = String(data).length > 950000;
  state.studio.vocals[trackIndex] = { ...state.studio.vocals[trackIndex], fileName: file.name, data: sessionOnly ? "" : data, sessionOnly };
  studioVocalBuffers = {};
  saveStudioProject();
  toast(sessionOnly ? "Vocal is too large for local save; export it or keep it session-only." : `${file.name} loaded to vocal ${trackIndex + 1}`);
  render();
}


async function importStudioStemFile(file, stemIndex = state.studio.selectedStem) {
  if (!file) return;
  if (!String(file.type || "").startsWith("audio/")) {
    toast("Choose an audio file for the stem loader.");
    return;
  }
  const safeIndex = Math.max(0, Math.min((state.studio.stems || []).length - 1, Number(stemIndex) || 0));
  const large = Number(file.size || 0) > 720000;
  const data = large ? URL.createObjectURL(file) : await readFileAsDataUrl(file);
  const shortName = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 24) || `Stem ${safeIndex + 1}`;
  state.studio.stems[safeIndex] = {
    ...state.studio.stems[safeIndex],
    name: shortName,
    fileName: file.name,
    data,
    sessionOnly: large,
    sourceBpm: Number(state.studio.stems[safeIndex]?.sourceBpm) || Number(state.studio.bpm) || 92,
  };
  state.studio.selectedStem = safeIndex;
  studioStemBuffers = {};
  saveStudioProject();
  toast(large ? `${file.name} loaded as a session stem. Export it or keep the file nearby.` : `${file.name} loaded into Stem ${safeIndex + 1}`);
  render();
}

async function importStudioStemFiles(files, startIndex = state.studio.selectedStem) {
  const list = Array.from(files || []).filter((file) => String(file.type || "").startsWith("audio/"));
  if (!list.length) {
    toast("Choose one or more audio stem files.");
    return;
  }
  const base = Math.max(0, Math.min((state.studio.stems || []).length - 1, Number(startIndex) || 0));
  for (let i = 0; i < list.length && base + i < state.studio.stems.length; i += 1) {
    await importStudioStemFile(list[i], base + i);
  }
  toast(`${Math.min(list.length, state.studio.stems.length - base)} stem${list.length === 1 ? "" : "s"} imported`);
  render();
}

function assignStudioStemToPad(stemIndex = state.studio.selectedStem, padIndex = null) {
  const stem = state.studio.stems?.[stemIndex];
  if (!stem?.data) {
    toast("Load a stem first, then assign it to a pad.");
    return;
  }
  const targetPad = padIndex == null ? Math.max(0, Math.min(15, Number(stem.padTarget ?? state.studio.selectedPad) || 0)) : Math.max(0, Math.min(15, Number(padIndex) || 0));
  state.studio.pads[targetPad] = {
    ...state.studio.pads[targetPad],
    name: state.studio.pads[targetPad].name || `Pad ${targetPad + 1}`,
    sampleName: stem.fileName || stem.name || `Stem ${stemIndex + 1}`,
    sampleData: stem.data,
    trimStart: 0,
    trimEnd: 100,
    pitch: 0,
    gain: Math.max(1, Math.min(120, Number(stem.volume) || 78)),
    sampleTooLargeForSave: Boolean(stem.sessionOnly),
  };
  state.studio.selectedPad = targetPad;
  studioSampleBuffers = {};
  saveStudioProject();
  toast(`${stem.name || `Stem ${stemIndex + 1}`} assigned to pad ${targetPad + 1}`);
  render();
}

function assignLoadedStemsToPads() {
  let count = 0;
  (state.studio.stems || []).forEach((stem, index) => {
    if (!stem.data) return;
    assignStudioStemToPad(index, stem.padTarget ?? Math.min(15, 8 + index));
    count += 1;
  });
  toast(count ? `${count} stem${count === 1 ? "" : "s"} mapped to drum pads` : "No loaded stems to map yet.");
  render();
}

function exportStudioStem(stemIndex = state.studio.selectedStem) {
  const stem = state.studio.stems?.[stemIndex];
  if (!stem?.data) {
    toast("No stem loaded in that slot.");
    return;
  }
  const a = document.createElement("a");
  a.href = stem.data;
  a.download = stem.fileName || `lottomind-stem-${stemIndex + 1}.webm`;
  a.click();
}

function clearStudioStem(stemIndex = state.studio.selectedStem) {
  const safeIndex = Math.max(0, Math.min((state.studio.stems || []).length - 1, Number(stemIndex) || 0));
  const current = state.studio.stems[safeIndex];
  if (String(current?.data || "").startsWith("blob:")) {
    try { URL.revokeObjectURL(current.data); } catch {}
  }
  state.studio.stems[safeIndex] = { ...createDefaultStudioProject().stems[safeIndex] };
  state.studio.events = state.studio.events.filter((event) => !(event.type === "stem" && Number(event.stem) === safeIndex));
  studioStemBuffers = {};
  saveStudioProject();
  toast(`Stem ${safeIndex + 1} cleared`);
  render();
}

async function refreshStudioInputs() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    state.studioInputStatus = "Audio input listing is not supported.";
    render();
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    state.studioInputDevices = devices.filter((device) => device.kind === "audioinput").map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Audio Input ${index + 1}`,
    }));
    state.studioInputStatus = `${state.studioInputDevices.length} audio inputs available`;
    render();
    return state.studioInputDevices;
  } catch {
    state.studioInputStatus = "Audio inputs could not be listed.";
    render();
    return [];
  }
}

async function getStudioMicStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    state.studioInputStatus = "Mic/line input is not supported in this browser.";
    render();
    return null;
  }
  try {
    const selected = state.studioInputDeviceId || "";
    const hasLiveTrack = studioMicStream?.getAudioTracks?.().some((track) => track.readyState === "live");
    const activeDevice = studioMicStream?.getAudioTracks?.()[0]?.getSettings?.().deviceId || "";
    if (!studioMicStream || !hasLiveTrack || (selected && selected !== activeDevice)) {
      studioMicStream?.getTracks?.().forEach((track) => track.stop?.());
      studioMicStream = await navigator.mediaDevices.getUserMedia({
        audio: selected ? {
          deviceId: { exact: selected },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } : {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      refreshStudioInputs();
    }
    state.studioInputStatus = "Mic/line input ready";
    return studioMicStream;
  } catch {
    studioMicStream = null;
    state.studioInputStatus = "Mic permission was blocked or no input was found.";
    render();
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function startStudioVocalRecording(trackIndex) {
  const stream = await getStudioMicStream();
  if (!stream || typeof MediaRecorder === "undefined") {
    toast("MediaRecorder or mic permission is not available.");
    return;
  }
  const chunks = [];
  const recorder = new MediaRecorder(stream);
  studioRecorders[`vocal-${trackIndex}`] = recorder;
  state.studioRecordingTrack = trackIndex;
  recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    const data = await blobToDataUrl(blob);
    const sessionOnly = data.length > 950000;
    state.studio.vocals[trackIndex] = {
      ...state.studio.vocals[trackIndex],
      data: sessionOnly ? "" : data,
      fileName: `lottomind-vocal-${trackIndex + 1}.webm`,
      sessionOnly,
    };
    studioVocalBuffers = {};
    state.studioRecordingTrack = null;
    saveStudioProject();
    toast(sessionOnly ? "Vocal captured, but too large for local save. Export it now if needed." : `Vocal ${trackIndex + 1} recorded`);
    render();
  };
  recorder.start();
  toast(`Recording vocal ${trackIndex + 1}`);
  render();
}

function stopStudioVocalRecording(trackIndex = state.studioRecordingTrack) {
  const recorder = studioRecorders[`vocal-${trackIndex}`];
  if (recorder && recorder.state !== "inactive") recorder.stop();
}

async function recordStudioSourceToPad(sourcePromise, label, releaseStream = true) {
  if (typeof MediaRecorder === "undefined") {
    toast("MediaRecorder is not available in this browser.");
    return;
  }
  try {
    if (studioSampleRecorder && studioSampleRecorder.state !== "inactive") {
      toast("Stop the current sample before starting another.");
      return;
    }
    const stream = await sourcePromise;
    if (!stream) return;
    studioSampleChunks = [];
    studioSampleStream = stream;
    studioSampleReleaseStream = releaseStream;
    studioSampleRecorder = new MediaRecorder(stream);
    studioSampleRecorder.ondataavailable = (event) => { if (event.data?.size) studioSampleChunks.push(event.data); };
    studioSampleRecorder.onstop = async () => {
      if (studioSampleReleaseStream && studioSampleStream !== studioMicStream) studioSampleStream?.getTracks?.().forEach((track) => track.stop?.());
      const blob = new Blob(studioSampleChunks, { type: studioSampleRecorder.mimeType || "audio/webm" });
      const data = await blobToDataUrl(blob);
      const padIndex = state.studio.selectedPad;
      const large = data.length > 950000;
      state.studio.pads[padIndex] = { ...state.studio.pads[padIndex], sampleName: `${label} sample`, sampleData: data, sampleTooLargeForSave: large };
      studioSampleBuffers = {};
      state.studioSampling = false;
      state.studioSamplingLabel = "";
      saveStudioProject();
      toast(large ? `${label} sample captured. Export it too; it may be too large for browser save.` : `${label} sampled to ${state.studio.pads[padIndex].name}`);
      render();
    };
    studioSampleRecorder.start();
    state.studioSampling = true;
    state.studioSamplingLabel = label;
    toast(`Sampling ${label}. Tap Stop Sample when finished.`);
    render();
  } catch {
    state.studioSampling = false;
    state.studioSamplingLabel = "";
    toast(`${label} capture was blocked or unavailable.`);
    render();
  }
}

function stopStudioPadSampling() {
  if (studioSampleRecorder && studioSampleRecorder.state !== "inactive") {
    studioSampleRecorder.stop();
    return;
  }
  state.studioSampling = false;
  state.studioSamplingLabel = "";
  toast("No sampler recording is active.");
  render();
}

function exportStudioStems() {
  const exportedAt = new Date().toISOString();
  const sounds = [];
  state.studio.pads.forEach((pad, index) => {
    if (!pad.sampleData) return;
    sounds.push({ type: "pad", index, name: pad.name, fileName: pad.sampleName || `pad-${index + 1}.webm` });
    const a = document.createElement("a");
    a.href = pad.sampleData;
    a.download = pad.sampleName || `lottomind-pad-${index + 1}.webm`;
    a.click();
  });
  (state.studio.stems || []).forEach((stem, index) => {
    if (!stem.data) return;
    sounds.push({ type: "stem", index, name: stem.name, fileName: stem.fileName || `stem-${index + 1}.webm`, startStep: stem.startStep, sync: Boolean(stem.sync) });
    const a = document.createElement("a");
    a.href = stem.data;
    a.download = stem.fileName || `lottomind-stem-${index + 1}.webm`;
    a.click();
  });
  state.studio.vocals.forEach((track, index) => {
    if (!track.data) return;
    sounds.push({ type: "vocal", index, name: track.name, fileName: track.fileName || `vocal-${index + 1}.webm` });
    const a = document.createElement("a");
    a.href = track.data;
    a.download = track.fileName || `lottomind-vocal-${index + 1}.webm`;
    a.click();
  });
  downloadTextFile("lottomind-studio-stems-dj-export-manifest.json", JSON.stringify({ exportedAt, bpm: state.studio.bpm, division: state.studio.division, defaultStemKit: state.studio.defaultStemKit || {}, dj: ensureStudioDjState(), sounds }, null, 2));
  toast(sounds.length ? "Pad, stem, vocal, and DJ deck exports started with manifest." : "No imported samples, stems, or vocal clips to export yet.");
}

function exportStudioSample(padIndex = state.studio.selectedPad) {
  const pad = state.studio.pads[padIndex];
  if (!pad?.sampleData) {
    toast("No sample loaded on this pad.");
    return;
  }
  const a = document.createElement("a");
  a.href = pad.sampleData;
  a.download = pad.sampleName || `lottomind-pad-${padIndex + 1}.webm`;
  a.click();
}

function exportStudioVocal(trackIndex) {
  const track = state.studio.vocals[trackIndex];
  if (!track?.data) {
    toast("No vocal clip on that track.");
    return;
  }
  const a = document.createElement("a");
  a.href = track.data;
  a.download = track.fileName || `lottomind-vocal-${trackIndex + 1}.webm`;
  a.click();
}

function handleStudioPolishAction(action, target) {
  if (action === "studio-set-step-page") {
    const value = target.getAttribute("data-step-page") ?? target.value;
    state.studio.stepPage = Math.max(0, Math.min(studioStepPageCount() - 1, Number(value) || 0));
    saveStudioProject();
    render();
    return true;
  }
  if (action === "studio-select-input") {
    state.studioInputDeviceId = target.value || "";
    localStorage.setItem("lottomind.studio.inputDeviceId", state.studioInputDeviceId);
    studioMicStream?.getTracks?.().forEach((track) => track.stop?.());
    studioMicStream = null;
    state.studioInputStatus = state.studioInputDeviceId ? "Input selected. Tap Monitor or Record to activate it." : "Default input selected.";
    render();
    return true;
  }
  if (action === "studio-refresh-inputs") {
    refreshStudioInputs();
    toast("Checking studio inputs");
    return true;
  }
  if (action === "studio-monitor-input") {
    getStudioMicStream().then((stream) => {
      const ctx = ensureStudioAudio();
      if (!stream || !ctx) return;
      if (studioMonitorSource) studioMonitorSource.disconnect();
      studioMonitorSource = ctx.createMediaStreamSource(stream);
      studioMonitorSource.connect(studioOutput());
      state.studioInputStatus = "Monitoring live. Use headphones.";
      render();
    });
    return true;
  }
  if (action === "studio-stop-monitoring") {
    if (studioMonitorSource) studioMonitorSource.disconnect();
    studioMonitorSource = null;
    state.studioInputStatus = "Monitoring stopped";
    render();
    return true;
  }
  if (action === "studio-sample-mic") {
    recordStudioSourceToPad(getStudioMicStream(), "Mic/Line", false);
    return true;
  }
  if (action === "studio-sample-tab") {
    const capture = navigator.mediaDevices?.getDisplayMedia
      ? navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : Promise.resolve(null);
    recordStudioSourceToPad(capture, "Browser/Tab");
    return true;
  }
  if (action === "studio-stop-sampling") {
    stopStudioPadSampling();
    return true;
  }
  if (action === "studio-dj-set") {
    const dj = ensureStudioDjState();
    const field = target.getAttribute("data-dj-field");
    const deckId = target.getAttribute("data-deck");
    const deckFields = ["stemIndex", "volume", "pitch", "jog", "filter", "cueStep", "sync", "loop", "reverse"];
    if (!field) return true;
    if (field === "crossfader") dj.crossfader = Math.max(0, Math.min(100, Number(target.value) || 0));
    else if (field === "recordLaunches") dj.recordLaunches = Boolean(target.checked);
    else if (deckFields.includes(field)) {
      const deck = studioDjDeck(deckId || "A");
      if (["sync", "loop", "reverse"].includes(field)) deck[field] = Boolean(target.checked);
      else deck[field] = Number(target.value) || 0;
      if (field === "stemIndex") deck[field] = Math.max(0, Math.min((state.studio.stems || []).length - 1, Number(deck[field]) || 0));
      if (field === "cueStep") deck[field] = Math.max(0, Math.min(studioTotalSteps() - 1, Number(deck[field]) || 0));
      if (field === "jog") deck[field] = Math.max(-12, Math.min(12, Number(deck[field]) || 0));
      if (field === "pitch") deck[field] = Math.max(-50, Math.min(50, Number(deck[field]) || 0));
    }
    saveStudioProject();
    updateStudioDjDeckMix();
    syncStudioRotaryInput(target);
    const crossfader = target.closest(".dj-real-crossfader");
    if (crossfader && field === "crossfader") {
      crossfader.style.setProperty("--xfade", String(dj.crossfader));
      const readout = crossfader.querySelector("strong");
      if (readout) readout.textContent = `A ${100 - dj.crossfader} - B ${dj.crossfader}`;
    }
    if (["stemIndex", "sync", "loop", "reverse", "recordLaunches"].includes(field)) render();
    return true;
  }
  if (action === "studio-dj-import-stem") {
    const deckId = target.getAttribute("data-deck") || "A";
    const deck = studioDjDeck(deckId);
    importStudioStemFile(target.files?.[0], Number(deck.stemIndex) || 0).then(() => {
      studioDjDeck(deckId).stemIndex = Number(deck.stemIndex) || 0;
      saveStudioProject();
      render();
    });
    return true;
  }
  if (action === "studio-dj-play") {
    playStudioDjDeck(target.getAttribute("data-deck") || "A");
    return true;
  }
  if (action === "studio-dj-cue") {
    playStudioDjDeck(target.getAttribute("data-deck") || "A", { cue: true });
    return true;
  }
  if (action === "studio-dj-stop") {
    stopStudioDjDeck(target.getAttribute("data-deck") || "A", true);
    return true;
  }
  if (action === "studio-dj-play-both") {
    playStudioDjDeck("A", { silent: true });
    playStudioDjDeck("B");
    return true;
  }
  if (action === "studio-dj-stop-both") {
    stopStudioDjDecks();
    saveStudioProject();
    render();
    return true;
  }
  if (action === "studio-dj-jog-reset") {
    studioDjDeck(target.getAttribute("data-deck") || "A").jog = 0;
    saveStudioProject();
    updateStudioDjDeckMix();
    render();
    return true;
  }
  if (action === "studio-dj-to-pad") {
    assignStudioDjDeckToPad(target.getAttribute("data-deck") || "A");
    return true;
  }
  if (action === "studio-dj-add-trigger") {
    addStudioDjDeckLaunchToSequence(target.getAttribute("data-deck") || "A");
    return true;
  }
  if (action === "studio-load-default-stem-kit") {
    applyStudioDefaultStemKitToProject(state.studio, { replaceStems: false, replacePads: false });
    studioSampleBuffers = {};
    studioStemBuffers = {};
    saveStudioProject();
    toast("Default stem kit loaded without overwriting custom sounds.");
    render();
    return true;
  }
  if (action === "studio-force-default-stem-kit") {
    applyStudioDefaultStemKitToProject(state.studio, { replaceStems: true, replacePads: true });
    studioSampleBuffers = {};
    studioStemBuffers = {};
    saveStudioProject();
    toast("Pads and stem slots replaced with the default LottoMind stem kit.");
    render();
    return true;
  }
  if (action === "studio-map-default-stem-pads") {
    applyStudioDefaultStemPadMapToProject(state.studio, { replacePads: true });
    studioSampleBuffers = {};
    saveStudioProject();
    toast("Default stems re-sliced across all 16 drum pads.");
    render();
    return true;
  }
  if (action === "studio-use-current-stems-as-kit") {
    mapCurrentStudioStemsToPadKit({ replacePads: true });
    return true;
  }
  if (action === "studio-export-stems") {
    exportStudioStems();
    return true;
  }
  if (action === "studio-select-stem") {
    const raw = target.value ?? target.getAttribute("value") ?? target.getAttribute("data-stem") ?? "0";
    state.studio.selectedStem = Math.max(0, Math.min((state.studio.stems || []).length - 1, Number(raw) || 0));
    saveStudioProject();
    render();
    return true;
  }
  if (action === "studio-import-stem") {
    importStudioStemFile(target.files?.[0], state.studio.selectedStem);
    return true;
  }
  if (action === "studio-import-stems") {
    importStudioStemFiles(target.files, state.studio.selectedStem);
    return true;
  }
  if (action === "studio-stem-set") {
    const stemIndex = Math.max(0, Math.min((state.studio.stems || []).length - 1, Number(state.studio.selectedStem) || 0));
    const field = target.getAttribute("data-stem-field");
    if (!field || !state.studio.stems?.[stemIndex]) return true;
    if (["volume", "startStep", "sourceBpm", "padTarget"].includes(field)) state.studio.stems[stemIndex][field] = Number(target.value) || 0;
    else if (["sync", "sequenceEnabled"].includes(field)) state.studio.stems[stemIndex][field] = Boolean(target.checked);
    else state.studio.stems[stemIndex][field] = target.value;
    if (field === "startStep") state.studio.stems[stemIndex][field] = Math.max(0, Math.min(studioTotalSteps() - 1, Number(target.value) || 0));
    saveStudioProject();
    if (["name", "sync", "sequenceEnabled", "padTarget"].includes(field)) render();
    return true;
  }
  if (action === "studio-toggle-stem-mute" || action === "studio-toggle-stem-solo") {
    const stemIndex = Math.max(0, Math.min((state.studio.stems || []).length - 1, Number(state.studio.selectedStem) || 0));
    const key = action === "studio-toggle-stem-mute" ? "muted" : "solo";
    state.studio.stems[stemIndex][key] = !state.studio.stems[stemIndex][key];
    saveStudioProject();
    render();
    return true;
  }
  if (action === "studio-play-stem") {
    playStudioStem(Number(state.studio.selectedStem) || 0);
    return true;
  }
  if (action === "studio-export-stem") {
    exportStudioStem(Number(state.studio.selectedStem) || 0);
    return true;
  }
  if (action === "studio-clear-stem") {
    clearStudioStem(Number(state.studio.selectedStem) || 0);
    return true;
  }
  if (action === "studio-stem-to-pad") {
    assignStudioStemToPad(Number(state.studio.selectedStem) || 0);
    return true;
  }
  if (action === "studio-stems-to-pads") {
    assignLoadedStemsToPads();
    return true;
  }
  if (action === "studio-toggle-stem-step") {
    const stem = Number(target.getAttribute("data-stem"));
    const step = Number(target.getAttribute("data-step"));
    const existing = state.studio.events.find((event) => event.type === "stem" && Number(event.stem) === stem && Number(event.step) === step);
    state.studio.events = existing
      ? state.studio.events.filter((event) => event !== existing)
      : state.studio.events.concat({ id: `stem-${stem}-${step}-${Date.now()}`, type: "stem", stem, step, velocity: state.studio.velocity, offset: 0 });
    state.studio.selectedStem = Math.max(0, Math.min((state.studio.stems || []).length - 1, stem || 0));
    saveStudioProject();
    render();
    return true;
  }
  if (action === "studio-export-pack") {
    const pack = {
      version: "lottomind-studio-sound-pack-v7-default-stems-dj-decks",
      defaultStemKit: state.studio.defaultStemKit || {},
      exportedAt: new Date().toISOString(),
      pads: state.studio.pads.map(({ name, sampleName, sampleData, trimStart, trimEnd, pitch, gain, reverse }) => ({ name, sampleName, sampleData, trimStart, trimEnd, pitch, gain, reverse })),
      stems: (state.studio.stems || []).map(({ name, fileName, data, volume, startStep, sourceBpm, sync, sequenceEnabled, padTarget, sessionOnly }) => ({
        name, fileName, data: sessionOnly || String(data || "").startsWith("blob:") ? "" : data, volume, startStep, sourceBpm, sync, sequenceEnabled, padTarget, sessionOnly,
      })),
      dj: ensureStudioDjState(),
    };
    downloadTextFile("lottomind-studio-sound-and-stem-pack.json", JSON.stringify(pack, null, 2));
    return true;
  }
  if (action === "studio-import-pack") {
    const file = target.files?.[0];
    if (file) file.text().then((text) => {
      const pack = JSON.parse(text);
      if (Array.isArray(pack.pads)) state.studio.pads = state.studio.pads.map((pad, index) => ({ ...pad, ...(pack.pads[index] || {}) }));
      if (Array.isArray(pack.stems)) state.studio.stems = createDefaultStudioProject().stems.map((stem, index) => ({ ...stem, ...(pack.stems[index] || {}) }));
      if (pack.dj) state.studio.dj = { ...createDefaultStudioProject().dj, ...pack.dj, deckA: { ...createDefaultStudioProject().dj.deckA, ...(pack.dj.deckA || {}) }, deckB: { ...createDefaultStudioProject().dj.deckB, ...(pack.dj.deckB || {}) } };
      if (pack.defaultStemKit) state.studio.defaultStemKit = { ...createDefaultStudioProject().defaultStemKit, ...pack.defaultStemKit };
      studioSampleBuffers = {};
      studioStemBuffers = {};
      saveStudioProject();
      toast(Array.isArray(pack.stems) ? "Sound + stem pack imported" : "Sound pack imported");
      render();
    }).catch(() => toast("Sound/stem pack JSON could not be imported."));
    return true;
  }
  if (action === "studio-lotto-set") {
    const lotto = studioLottoConfig();
    const field = target.getAttribute("data-lotto-field");
    if (!field) return true;
    if (field === "entropy") lotto[field] = Boolean(target.checked);
    else if (field === "setCount") lotto[field] = Math.max(1, Math.min(10, Number(target.value) || 3));
    else lotto[field] = target.value;
    if (field === "gameId") {
      state.gameId = lotto.gameId;
      localStorage.setItem("lottomind.oracle.real.game", state.gameId);
    }
    saveStudioProject();
    render();
    return true;
  }
  if (action === "studio-generate-lotto") {
    const picks = generateStudioLottoPicks();
    toast(`Beat2Lotto generated ${picks.length} set${picks.length === 1 ? "" : "s"}`);
    render();
    return true;
  }
  if (action === "studio-copy-lotto") {
    copyStudioLottoSet();
    return true;
  }
  if (action === "studio-save-lotto") {
    const lotto = studioLottoConfig();
    if (!lotto.lastSet) generateStudioLottoPicks();
    if (state.studio.lotto?.lastSet) saveSet({ ...state.studio.lotto.lastSet, savedFrom: "LottoMind Studio Beat2Lotto" });
    else toast("Generate Beat2Lotto picks first.");
    return true;
  }
  if (action === "studio-randomize-and-lotto") {
    state.studio.events = [];
    const total = studioTotalSteps();
    const stepsPerBeat = studioStepsPerBeat();
    const kickEvery = Math.max(1, Math.round(stepsPerBeat));
    const hatEvery = Math.max(1, Math.round(stepsPerBeat / 2));
    for (let step = 0; step < total; step += 1) {
      if (step % (kickEvery * 4) === 0) state.studio.events.push({ id: `rnd-k-${step}`, type: "pad", pad: 0, step, velocity: 78 + Math.round(Math.random() * 14), offset: 0 });
      if (step % (kickEvery * 4) === kickEvery * 2 && Math.random() > 0.35) state.studio.events.push({ id: `rnd-k2-${step}`, type: "pad", pad: 0, step, velocity: 58 + Math.round(Math.random() * 18), offset: 0 });
      if (step % (kickEvery * 2) === kickEvery) state.studio.events.push({ id: `rnd-s-${step}`, type: "pad", pad: 1, step, velocity: 72 + Math.round(Math.random() * 16), offset: 0 });
      if (step % hatEvery === 0 && Math.random() > 0.12) state.studio.events.push({ id: `rnd-h-${step}`, type: "pad", pad: 3, step, velocity: 42 + Math.round(Math.random() * 30), offset: 0 });
      if (step % (kickEvery * 8) === kickEvery * 6 && Math.random() > 0.45) state.studio.events.push({ id: `rnd-p-${step}`, type: "pad", pad: 8 + Math.floor(Math.random() * 4), step, velocity: 55 + Math.round(Math.random() * 28), offset: 0 });
    }
    generateStudioLottoPicks();
    saveStudioProject();
    toast("Random groove generated and converted to Lotto picks");
    render();
    return true;
  }
  if (action === "studio-randomize") {
    state.studio.events = [];
    const total = studioTotalSteps();
    const stepsPerBeat = studioStepsPerBeat();
    const kickEvery = Math.max(1, Math.round(stepsPerBeat));
    const hatEvery = Math.max(1, Math.round(stepsPerBeat / 2));
    for (let step = 0; step < total; step += 1) {
      if (step % (kickEvery * 4) === 0) state.studio.events.push({ id: `rnd-k-${step}`, type: "pad", pad: 0, step, velocity: 78 + Math.round(Math.random() * 14), offset: 0 });
      if (step % (kickEvery * 4) === kickEvery * 2 && Math.random() > 0.35) state.studio.events.push({ id: `rnd-k2-${step}`, type: "pad", pad: 0, step, velocity: 58 + Math.round(Math.random() * 18), offset: 0 });
      if (step % (kickEvery * 2) === kickEvery) state.studio.events.push({ id: `rnd-s-${step}`, type: "pad", pad: 1, step, velocity: 72 + Math.round(Math.random() * 16), offset: 0 });
      if (step % hatEvery === 0 && Math.random() > 0.12) state.studio.events.push({ id: `rnd-h-${step}`, type: "pad", pad: 3, step, velocity: 42 + Math.round(Math.random() * 30), offset: 0 });
    }
    saveStudioProject();
    toast("Full 16-bar random groove generated");
    render();
    return true;
  }
  return false;
}

function handleAction(action, target) {
  if (handleStudioPolishAction(action, target)) return;
  if (action === "open-arcade-game") {
    const gameId = target.getAttribute("data-game-id");
    const game = ARCADE_GAMES.find((entry) => entry.id === gameId);
    if (!game) {
      toast("That game is unavailable");
      return;
    }
    state.activeArcadeGameId = game.id;
    localStorage.setItem("lottomind.refined.arcade.active-game.v1", game.id);
    go("arcadeGame");
    return;
  }
  if (action === "reload-arcade-game") {
    const frame = document.getElementById("lottomind-arcade-player");
    if (frame) frame.src = frame.src;
    toast("Game reloaded");
    return;
  }
  if (action === "fullscreen-arcade-game") {
    const frame = document.getElementById("lottomind-arcade-player");
    if (!frame?.requestFullscreen) {
      toast("Full screen is unavailable in this browser");
      return;
    }
    frame.requestFullscreen().catch(() => toast("Full screen request was blocked"));
    return;
  }
  if (action === "set-social-challenge") {
    const challenge = target.getAttribute("data-challenge") || "Trivia";
    state.socialChallengeType = SOCIAL_CHALLENGE_TYPES.includes(challenge) ? challenge : "Trivia";
    render();
    return;
  }
  if (action === "save-social-score") {
    const rawScore = String(state.socialScoreInput ?? "").trim();
    const score = Number(rawScore);
    if (!rawScore || !Number.isFinite(score) || score < 0 || score > 999999) {
      toast("Enter a score from 0 to 999999");
      return;
    }
    saveSocialScore({
      name: state.socialNameInput,
      score,
      challenge: state.socialChallengeType,
      streak: getTriviaProgress().dailyStreak,
      createdAt: new Date().toISOString(),
      source: "Saved challenge",
    });
    if (!String(state.socialNameInput || "").trim()) state.socialNameInput = "Local Player";
    state.socialScoreInput = "";
    toast("Challenge score saved");
    render();
    return;
  }
  if (action === "clear-social-scores") {
    clearSocialScores();
    toast("Local social scores cleared");
    render();
    return;
  }
  if (action === "studio-play") {
    startStudioSequence();
    return;
  }
  if (action === "studio-stop") {
    stopStudioSequence();
    return;
  }
  if (action === "studio-toggle-loop") {
    state.studio.loopEnabled = !state.studio.loopEnabled;
    if (state.studio.loopEnabled) state.studioStep %= studioTotalSteps();
    saveStudioProject();
    toast(state.studio.loopEnabled ? "16-bar loop on" : "Loop off. Sequence stops at bar 16.");
    render();
    return;
  }
  if (action === "studio-toggle-rec") {
    state.studio.recArmed = !state.studio.recArmed;
    saveStudioProject();
    toast(state.studio.recArmed ? "Sequence record armed" : "Sequence record off");
    return;
  }
  if (action === "studio-toggle-metronome") {
    state.studio.metronome = !state.studio.metronome;
    saveStudioProject();
    render();
    return;
  }
  if (action === "studio-save-project") {
    saveStudioProject();
    toast("Studio project saved");
    return;
  }
  if (action === "studio-toggle-help") {
    state.studioHelpOpen = !state.studioHelpOpen;
    render();
    return;
  }
  if (action === "studio-go-back") {
    state.studioHelpOpen = false;
    if (window.history.length > 1) window.history.back();
    else go("dashboard");
    return;
  }
  if (action === "studio-jump-panel") {
    const panel = target.getAttribute("data-panel");
    const el = panel ? document.getElementById(panel) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    return;
  }
  if (action === "studio-set") {
    const field = target.getAttribute("data-studio-field");
    const numeric = ["bpm", "swing", "velocity", "humanize", "octave", "synthVolume", "selectedPad", "seqPage", "seqZoom"];
    state.studio[field] = numeric.includes(field) ? Number(target.value) : target.value;
    if (field === "division" || field === "seqZoom") {
      state.studioStep = 0;
      state.studio.seqPage = 0;
    }
    if (field === "inputDeviceId") {
      studioMicStream?.getTracks?.().forEach((track) => track.stop?.());
      studioMicStream = null;
      state.studioInputStatus = "Input device selected";
    }
    saveStudioProject();
    if (state.studioPlaying && ["bpm", "division"].includes(field)) startStudioSequence();
    else render();
    return;
  }
  if (action === "studio-seq-page") {
    const { maxPage } = studioSequencerWindow();
    state.studio.seqPage = Math.max(0, Math.min(maxPage, (Number(state.studio.seqPage) || 0) + Number(target.getAttribute("data-dir") || 0)));
    saveStudioProject();
    render();
    return;
  }
  if (action === "studio-pad-set") {
    const field = target.getAttribute("data-pad-field");
    const padIndex = state.studio.selectedPad;
    state.studio.pads[padIndex][field] = Number(target.value);
    saveStudioProject();
    return;
  }
  if (action === "studio-effect-set") {
    const effect = target.getAttribute("data-effect");
    const value = Math.max(0, Math.min(100, Number(target.value) || 0));
    state.studio.effects[effect] = value;
    const module = target.closest(".fx-module");
    if (module) {
      module.style.setProperty("--knob-value", value);
      module.style.setProperty("--knob-angle", `${-135 + value * 2.7}deg`);
      const readout = module.querySelector("em");
      if (readout) readout.textContent = `${value}%`;
    }
    saveStudioProject();
    updateStudioEffects();
    return;
  }
  if (action === "studio-vocal-set") {
    const track = Number(target.getAttribute("data-track"));
    const field = target.getAttribute("data-vocal-field");
    state.studio.vocals[track][field] = Number(target.value);
    saveStudioProject();
    return;
  }
  if (action === "studio-pad") {
    const index = Number(target.getAttribute("data-studio-pad"));
    state.studio.selectedPad = index;
    triggerStudioPad(index);
    saveStudioProject();
    render();
    return;
  }
  if (action === "studio-note") {
    triggerStudioNote(target.getAttribute("data-note"));
    return;
  }
  if (action === "studio-toggle-step") {
    const pad = Number(target.getAttribute("data-pad"));
    const step = Number(target.getAttribute("data-step"));
    const existing = state.studio.events.find((event) => event.type === "pad" && event.pad === pad && event.step === step);
    state.studio.events = existing
      ? state.studio.events.filter((event) => event !== existing)
      : state.studio.events.concat({ id: `step-${pad}-${step}-${Date.now()}`, type: "pad", pad, step, velocity: state.studio.velocity, offset: 0 });
    saveStudioProject();
    render();
    return;
  }
  if (action === "studio-clear-pattern") {
    state.studio.events = [];
    saveStudioProject();
    toast("Studio pattern cleared");
    return;
  }
  if (action === "studio-humanize") {
    const total = studioTotalSteps();
    state.studio.events = state.studio.events.map((event) => ({
      ...event,
      velocity: Math.max(8, Math.min(100, Number(event.velocity || state.studio.velocity) + Math.round((Math.random() - 0.5) * state.studio.humanize))),
      offset: Math.max(-0.48, Math.min(0.48, Number(event.offset || 0) + (Math.random() - 0.5) * state.studio.humanize / 50)),
      step: ((Number(event.step) || 0) + total) % total,
    }));
    saveStudioProject();
    toast("Human feel applied");
    return;
  }
  if (action === "studio-lotto-set") {
    const lotto = studioLottoConfig();
    const field = target.getAttribute("data-lotto-field");
    if (!field) return;
    if (field === "entropy") lotto[field] = Boolean(target.checked);
    else if (field === "setCount") lotto[field] = Math.max(1, Math.min(10, Number(target.value) || 3));
    else lotto[field] = target.value;
    if (field === "gameId") {
      state.gameId = lotto.gameId;
      localStorage.setItem("lottomind.oracle.real.game", state.gameId);
    }
    saveStudioProject();
    render();
    return;
  }
  if (action === "studio-generate-lotto") {
    const picks = generateStudioLottoPicks();
    toast(`Beat2Lotto generated ${picks.length} set${picks.length === 1 ? "" : "s"}`);
    render();
    return;
  }
  if (action === "studio-copy-lotto") {
    copyStudioLottoSet();
    return;
  }
  if (action === "studio-save-lotto") {
    const lotto = studioLottoConfig();
    if (!lotto.lastSet) generateStudioLottoPicks();
    if (state.studio.lotto?.lastSet) saveSet({ ...state.studio.lotto.lastSet, savedFrom: "LottoMind Studio Beat2Lotto" });
    else toast("Generate Beat2Lotto picks first.");
    return;
  }
  if (action === "studio-randomize-and-lotto") {
    state.studio.events = [];
    const total = studioTotalSteps();
    const stepsPerBeat = studioStepsPerBeat();
    const kickEvery = Math.max(1, Math.round(stepsPerBeat));
    const hatEvery = Math.max(1, Math.round(stepsPerBeat / 2));
    for (let step = 0; step < total; step += 1) {
      if (step % (kickEvery * 4) === 0) state.studio.events.push({ id: `rnd-k-${step}`, type: "pad", pad: 0, step, velocity: 78 + Math.round(Math.random() * 14), offset: 0 });
      if (step % (kickEvery * 4) === kickEvery * 2 && Math.random() > 0.35) state.studio.events.push({ id: `rnd-k2-${step}`, type: "pad", pad: 0, step, velocity: 58 + Math.round(Math.random() * 18), offset: 0 });
      if (step % (kickEvery * 2) === kickEvery) state.studio.events.push({ id: `rnd-s-${step}`, type: "pad", pad: 1, step, velocity: 72 + Math.round(Math.random() * 16), offset: 0 });
      if (step % hatEvery === 0 && Math.random() > 0.12) state.studio.events.push({ id: `rnd-h-${step}`, type: "pad", pad: 3, step, velocity: 42 + Math.round(Math.random() * 30), offset: 0 });
      if (step % (kickEvery * 8) === kickEvery * 6 && Math.random() > 0.45) state.studio.events.push({ id: `rnd-p-${step}`, type: "pad", pad: 8 + Math.floor(Math.random() * 4), step, velocity: 55 + Math.round(Math.random() * 28), offset: 0 });
    }
    generateStudioLottoPicks();
    saveStudioProject();
    toast("Random groove generated and converted to Lotto picks");
    render();
    return;
  }
  if (action === "studio-randomize") {
    state.studio.events = [];
    const total = studioTotalSteps();
    state.studio.pads.forEach((_, pad) => {
      const interval = pad === 0 ? 4 : pad === 3 || pad === 4 ? 2 : pad < 8 ? 8 : 16;
      for (let step = 0; step < total; step += interval) {
        if (Math.random() > (pad === 0 ? 0.18 : pad < 5 ? 0.48 : 0.7)) state.studio.events.push({ id: `rnd-${pad}-${step}`, type: "pad", pad, step, velocity: 65 + Math.round(Math.random() * 30), offset: 0 });
      }
    });
    saveStudioProject();
    toast("Random groove generated");
    render();
    return;
  }
  if (action === "studio-import-sample") {
    importStudioSampleFile(target.files?.[0]);
    return;
  }
  if (action === "studio-load-url-sample") {
    const url = state.studioSampleUrl || "";
    if (!url) toast("Paste an audio URL first.");
    else {
      const padIndex = state.studio.selectedPad;
      state.studio.pads[padIndex].sampleData = url;
      state.studio.pads[padIndex].sampleName = "URL sample";
      studioSampleBuffers = {};
      saveStudioProject();
      toast("URL sample assigned. Browser CORS must allow playback.");
    }
    return;
  }
  if (action === "studio-start-sample-mic") {
    startStudioSourceSample(getStudioMicStream(), "Mic", false);
    return;
  }
  if (action === "studio-start-sample-tab") {
    const capture = navigator.mediaDevices?.getDisplayMedia
      ? navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : Promise.resolve(null);
    startStudioSourceSample(capture, "Tab audio");
    return;
  }
  if (action === "studio-stop-sample") {
    stopStudioSourceSample();
    return;
  }
  if (action === "studio-preview-sample") {
    triggerStudioPad(state.studio.selectedPad, false);
    return;
  }
  if (action === "studio-export-sample") {
    exportStudioSample();
    return;
  }
  if (action === "studio-clear-sample") {
    const padIndex = state.studio.selectedPad;
    state.studio.pads[padIndex] = { ...state.studio.pads[padIndex], sampleName: "", sampleData: "" };
    studioSampleBuffers = {};
    saveStudioProject();
    toast("Sample cleared");
    render();
    return;
  }
  if (action === "studio-toggle-pad-reverse") {
    const pad = state.studio.pads[state.studio.selectedPad];
    pad.reverse = !pad.reverse;
    studioSampleBuffers = {};
    saveStudioProject();
    render();
    return;
  }
  if (action === "studio-refresh-inputs") {
    refreshStudioInputs();
    toast("Checking inputs");
    return;
  }
  if (action === "studio-monitor-input") {
    getStudioMicStream().then((stream) => {
      const ctx = ensureStudioAudio();
      if (!stream || !ctx) return;
      if (studioMonitorSource) studioMonitorSource.disconnect();
      studioMonitorSource = ctx.createMediaStreamSource(stream);
      studioMonitorSource.connect(studioOutput());
      state.studioInputStatus = "Monitoring live. Use headphones.";
      render();
    });
    return;
  }
  if (action === "studio-stop-monitoring") {
    if (studioMonitorSource) studioMonitorSource.disconnect();
    studioMonitorSource = null;
    state.studioInputStatus = "Monitoring stopped";
    render();
    return;
  }
  if (action === "studio-record-vocal") {
    startStudioVocalRecording(Number(target.getAttribute("data-track")));
    return;
  }
  if (action === "studio-stop-vocal") {
    stopStudioVocalRecording(Number(target.getAttribute("data-track")));
    return;
  }
  if (action === "studio-play-vocal") {
    playVocalTrack(Number(target.getAttribute("data-track")));
    return;
  }
  if (action === "studio-import-vocal") {
    importStudioVocalFile(target.files?.[0], Number(target.getAttribute("data-track")));
    return;
  }
  if (action === "studio-export-vocal") {
    exportStudioVocal(Number(target.getAttribute("data-track")));
    return;
  }
  if (action === "studio-clear-vocal") {
    const track = Number(target.getAttribute("data-track"));
    state.studio.vocals[track] = { ...createDefaultStudioProject().vocals[track] };
    studioSampleBuffers = {};
    saveStudioProject();
    render();
    return;
  }
  if (action === "studio-toggle-vocal-mute" || action === "studio-toggle-vocal-solo") {
    const track = Number(target.getAttribute("data-track"));
    const key = action === "studio-toggle-vocal-mute" ? "muted" : "solo";
    state.studio.vocals[track][key] = !state.studio.vocals[track][key];
    saveStudioProject();
    render();
    return;
  }
  if (action === "studio-export-project") {
    const { project, trimmed } = studioSerializableProject();
    downloadTextFile("lottomind-studio-project.json", JSON.stringify(project, null, 2));
    if (trimmed) toast("Project exported with large audio marked session-only.");
    return;
  }
  if (action === "studio-import-project") {
    const file = target.files?.[0];
    if (file) file.text().then((text) => {
      const incoming = JSON.parse(text);
      const fallback = createDefaultStudioProject();
      state.studio = {
        ...fallback,
        ...incoming,
        effects: { ...fallback.effects, ...(incoming.effects || {}) },
        lotto: { ...fallback.lotto, ...(incoming.lotto || {}) },
        pads: fallback.pads.map((pad, index) => ({ ...pad, ...(incoming.pads?.[index] || {}) })),
        vocals: fallback.vocals.map((track, index) => ({ ...track, ...(incoming.vocals?.[index] || {}) })),
        events: Array.isArray(incoming.events) ? incoming.events : [],
      };
      studioSampleBuffers = {};
      saveStudioProject();
      toast("Studio project imported");
      render();
    }).catch(() => toast("Project JSON could not be imported."));
    return;
  }
  if (action === "studio-export-pack") {
    const { project, trimmed } = studioSerializableProject();
    downloadTextFile("lottomind-sound-pack.json", JSON.stringify({ pads: project.pads.map(({ name, sampleName, sampleData, trimStart, trimEnd, pitch, gain, reverse }) => ({ name, sampleName, sampleData, trimStart, trimEnd, pitch, gain, reverse })) }, null, 2));
    if (trimmed) toast("Sound pack exported; large samples were left session-only.");
    return;
  }
  if (action === "studio-import-pack") {
    const file = target.files?.[0];
    if (file) file.text().then((text) => {
      const pack = JSON.parse(text);
      if (Array.isArray(pack.pads)) {
        state.studio.pads = state.studio.pads.map((pad, index) => ({ ...pad, ...(pack.pads[index] || {}) }));
        studioSampleBuffers = {};
        saveStudioProject();
        toast("Sound pack imported");
        render();
      }
    }).catch(() => toast("Sound pack JSON could not be imported."));
    return;
  }
  if (action === "studio-export-stems") {
    exportStudioStems();
    return;
  }
  if (action === "studio-start-master-record") {
    const ctx = ensureStudioAudio();
    if (!ctx || typeof MediaRecorder === "undefined" || !studioDestination) {
      toast("Master recording is not supported here.");
      return;
    }
    studioMasterChunks = [];
    studioMasterRecorder = new MediaRecorder(studioDestination.stream);
    studioMasterRecorder.ondataavailable = (event) => { if (event.data?.size) studioMasterChunks.push(event.data); };
    studioMasterRecorder.onstop = () => {
      const blob = new Blob(studioMasterChunks, { type: studioMasterRecorder.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lottomind-studio-master.webm";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      state.studioMasterRecording = false;
      render();
    };
    studioMasterRecorder.start();
    state.studioMasterRecording = true;
    render();
    return;
  }
  if (action === "studio-stop-master-record") {
    if (studioMasterRecorder?.state !== "inactive") studioMasterRecorder.stop();
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
  if (action === "toggle-radar-number") {
    const number = Number(target.getAttribute("data-number"));
    const game = getGame("powerball");
    const picks = Array.isArray(state.radarPicks) ? [...state.radarPicks] : [];
    const existingIndex = picks.indexOf(number);
    if (existingIndex >= 0) picks.splice(existingIndex, 1);
    else if (Number.isFinite(number) && picks.length < game.mainCount) picks.push(number);
    else {
      toast(`Lock up to ${game.mainCount} main numbers`);
      return;
    }
    state.radarPicks = uniqueSorted(picks);
    render();
    return;
  }
  if (action === "clear-radar-picks") {
    state.radarPicks = [];
    toast("Radar locks cleared");
    render();
    return;
  }
  if (action === "build-radar-locks") {
    buildRadarSetFromLocks();
    render();
    return;
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
  if (action === "start-dream-recording") {
    startDreamRecording();
    return;
  }
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
  if (action === "load-reset-preset") {
    loadResetPreset(target.getAttribute("data-preset"));
    return;
  }
  if (action === "load-reset-session") {
    if (!isResetRoute()) {
      state.tone = target.getAttribute("data-tone") || state.tone;
      state.timerRemaining = state.duration;
      go("reset");
      return;
    }
    loadResetSession(target.getAttribute("data-tone") || state.tone, { autoplay: target.getAttribute("data-autoplay") === "true" });
    return;
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
    if (action === "simulate-scan") {
      toast("Simulated ticket scans are not included in this release");
      return;
    }
    const upload = target.files && target.files[0] ? target.files[0].name : "";
    const source = action === "scan-barcode" ? state.barcodeInput.trim() : upload;
    if (action === "scan-barcode" && !source) {
      toast("Enter or scan a barcode first");
      return;
    }
    if (action === "scan-ticket" && !upload) return;
    if (action === "scan-ticket" && target.files && target.files[0]) {
      const file = target.files[0];
      scanBarcodeFromFile(file).then((decoded) => {
        applyScanReadout(action, file.name, file.name, decoded);
        toast(decoded ? "Barcode detected. Verify it with the official lottery." : "No supported barcode was detected");
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
    const unlockId = target.getAttribute("data-unlock");
    if (unlockId === "credits-pack") {
      toast("Activity points are not sold");
      return;
    } else if (unlockId && isUnlocked(unlockId)) {
      toast("Already unlocked");
    } else {
      toast("Secure marketplace checkout is not connected for this item. No wallet value changed.");
    }
  }
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
  if (action === "unlock-feature") {
    const unlockId = target.getAttribute("data-unlock");
    const unlock = FEATURE_UNLOCKS.find((item) => item.id === unlockId);
    if (!unlock) {
      toast("Unlock not found");
    } else if (isUnlocked(unlock.id)) {
      toast(`${unlock.title} is already unlocked`);
    } else {
      toast("Secure marketplace unlocks are not connected yet. No wallet value changed.");
    }
  }
  if (action === "watch-rewarded-ad") {
    toast("Rewarded ads are not included in this release");
    return;
  }
  if (action === "activate-credit-booster") {
    toast("Point boosters are not included in this release");
    return;
  }
  if (action === "use-streak-saver") {
    toast("Streak savers are not included in this release");
    return;
  }
  if (action === "subscribe-pro") {
    startRevenueCatPurchase();
  }
  if (action === "refresh-revenuecat") {
    refreshRevenueCatStatus();
  }
  if (action === "restore-revenuecat") {
    restoreRevenueCatPurchases();
  }
  if (action === "manage-revenuecat") {
    manageRevenueCatSubscription();
  }
  if (action === "export-local-data") {
    exportLocalProfile();
    toast("Local data exported");
  }
  if (action === "request-delete-local-data") {
    state.privacyDeleteArmed = true;
  }
  if (action === "cancel-delete-local-data") {
    state.privacyDeleteArmed = false;
  }
  if (action === "confirm-delete-local-data") {
    deleteLocalProfile();
    return;
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
      submitSecureTriviaAnswer(selected);
      return;
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
    state.triviaAward = null;
    if (state.route !== "triviaPlay") {
      go("triviaPlay");
      return;
    }
    startSecureTriviaRun();
    return;
  }
  if (action === "claim-trivia-reward") {
    claimSecureTriviaReward();
    return;
  }
  if (action === "check-crossword") {
    if (state.crosswordSolved) {
      toast("Crossword already solved");
    } else {
      state.crosswordSolved = true;
      saveJson(STORAGE.crossword, { solved: true, solvedAt: new Date().toISOString() });
      toast("Crossword solved and saved locally. No wallet value changed.");
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
      toast("Word search solved and saved locally. No wallet value changed.");
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
    toast("Merch ordering is not included in this release");
    return;
  }
  if (action === "play-mini-game") {
    toast("Arcade run complete. No wallet value changed.");
  }
  render();
}

let pointerStart = null;
let touchStart = null;
let lastTouchActivation = 0;
let flowSwipe = null;
let suppressFlowClickUntil = 0;
let globalKnobDrag = null;
let suppressGlobalKnobClickUntil = 0;
const TAP_MOVE_THRESHOLD = 18;
const ROUTE_SWIPE_THRESHOLD = 96;

function setGlobalKnobValue(control, nextValue) {
  const min = Number(control.dataset.knobMin);
  const max = Number(control.dataset.knobMax);
  const step = Number(control.dataset.knobStep) || 1;
  const value = Math.max(min, Math.min(max, min + Math.round((nextValue - min) / step) * step));
  const unit = control.dataset.knobUnit || "";
  const readout = oracleKnobReadout(value, unit);
  control.dataset.knobValue = String(value);
  control.style.setProperty("--knob-live-angle", `${oracleKnobAngle(value, min, max)}deg`);
  control.setAttribute("aria-label", `${control.dataset.knobLabel}. Knob position ${readout}. Rotate to adjust, press to ${control.dataset.knobPressVerb || "open"}.`);
  const liveReadout = control.querySelector("[data-knob-readout]");
  if (liveReadout) liveReadout.textContent = readout;
  if (control.dataset.knobBind === "tone") {
    control.dataset.tone = String(value);
    state.tone = String(value);
    if (resetToneOscillator && resetToneContext) {
      resetToneOscillator.frequency.setTargetAtTime(value, resetToneContext.currentTime, 0.03);
    }
  }
  state.knobPositions[control.dataset.knobKey] = value;
  localStorage.setItem("lottomind.oracle.real.knobs.v1", JSON.stringify(state.knobPositions));
}

function interactiveGesturePoint(event) {
  const touch = event.changedTouches?.[0] || event.touches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  return { x: event.clientX, y: event.clientY };
}

function startedInNativeTouchSurface(target) {
  return Boolean(target?.closest?.(".quest-steps, .oracle-flow-steps, .circle-carousel, .snap-carousel, .arcade-game-grid, .merch-grid, .lm-pill-row, .state-picker, .route-leg-list, .audio-list, textarea, input, select, [contenteditable='true']"));
}

function pressableControlFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target) return null;
  const control = target.closest?.("button, .file-pill, a.primary-btn, a.ghost-btn, [role='button'], [data-route]:not(.real-shell)");
  if (!control || control.matches?.("input, textarea, select, [contenteditable='true']")) return null;
  return control;
}

function clearPressedControls() {
  document.querySelectorAll(".is-pressing").forEach((control) => control.classList.remove("is-pressing"));
}

function activateInteractiveTarget(event) {
  const eventTarget = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!eventTarget) return;
  const routeTarget = eventTarget.closest("[data-route]:not(.real-shell)");
  const externalTarget = eventTarget.closest("[data-external-url]");
  if (externalTarget) {
    event.preventDefault();
    window.location.href = externalTarget.getAttribute("data-external-url");
    return true;
  }
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
    if (actionTarget.matches?.("input, select, textarea") && actionTarget.type !== "button" && actionTarget.type !== "submit") return false;
    const preserveResetScroll = Boolean(actionTarget.closest(".reset-screen")) && [
      "toggle-reset-audio",
      "set-tone",
      "set-duration",
      "volume-up",
      "volume-down",
      "favorite-tone",
      "load-reset-preset",
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
  const pressedControl = pressableControlFromEvent(event);
  if (pressedControl) pressedControl.classList.add("is-pressing");
  const globalKnob = target?.closest?.("[data-knob-control]");
  if (globalKnob) {
    globalKnobDrag = {
      control: globalKnob,
      pointerId: event.pointerId,
      startY: event.clientY,
      startValue: Number(globalKnob.dataset.knobValue),
      moved: false,
    };
    globalKnob.classList.add("is-adjusting");
    globalKnob.focus({ preventScroll: true });
    globalKnob.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    return;
  }
  const fxKnobInput = target?.closest?.(".fx-knob-input, .dj-knob-input");
  if (fxKnobInput) {
    studioFxKnobDrag = fxKnobInput;
    fxKnobInput.setPointerCapture?.(event.pointerId);
    updateStudioFxKnobFromPointer(fxKnobInput, event);
    event.preventDefault();
    return;
  }
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
}, { passive: false });

document.addEventListener("pointermove", (event) => {
  if (globalKnobDrag) {
    const dy = globalKnobDrag.startY - event.clientY;
    if (Math.abs(dy) > 4) globalKnobDrag.moved = true;
    setGlobalKnobValue(
      globalKnobDrag.control,
      globalKnobDrag.startValue + (dy * Number(globalKnobDrag.control.dataset.knobStep || 1)),
    );
    event.preventDefault();
    return;
  }
  if (studioFxKnobDrag) {
    updateStudioFxKnobFromPointer(studioFxKnobDrag, event);
    event.preventDefault();
    return;
  }
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
  clearPressedControls();
  if (globalKnobDrag) {
    const completedDrag = globalKnobDrag;
    completedDrag.control.releasePointerCapture?.(completedDrag.pointerId);
    completedDrag.control.classList.remove("is-adjusting");
    globalKnobDrag = null;
    if (completedDrag.moved) {
      suppressGlobalKnobClickUntil = Date.now() + 420;
      event.preventDefault();
      return;
    }
  }
  if (studioFxKnobDrag) {
    studioFxKnobDrag.releasePointerCapture?.(event.pointerId);
    studioFxKnobDrag = null;
    event.preventDefault();
    return;
  }
  endFlowSwipe();
  if (event.pointerType === "mouse") return;
  if (pointerStart) {
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    const moved = Math.hypot(dx, dy);
    const startedInScroller = startedInNativeTouchSurface(pointerStart.target);
    pointerStart = null;
    if (!startedInScroller && dx > ROUTE_SWIPE_THRESHOLD && Math.abs(dy) < 62) {
      event.preventDefault();
      stopRouteAudio();
      const tabIndex = TAB_ROUTES.indexOf(state.route);
      if (tabIndex > 0) go(TAB_ROUTES[tabIndex - 1]);
      else window.history.back();
      return;
    }
    if (!startedInScroller && dx < -ROUTE_SWIPE_THRESHOLD && Math.abs(dy) < 62) {
      event.preventDefault();
      stopRouteAudio();
      const tabIndex = TAB_ROUTES.indexOf(state.route);
      if (tabIndex >= 0 && tabIndex < TAB_ROUTES.length - 1) go(TAB_ROUTES[tabIndex + 1]);
      else window.history.forward();
      return;
    }
    if (moved > TAP_MOVE_THRESHOLD) return;
  }
  if (activateInteractiveTarget(event)) lastTouchActivation = Date.now();
}, { passive: false });

document.addEventListener("pointercancel", () => {
  clearPressedControls();
  globalKnobDrag?.control.classList.remove("is-adjusting");
  globalKnobDrag = null;
  studioFxKnobDrag = null;
  pointerStart = null;
  endFlowSwipe();
}, { passive: true });

document.addEventListener("wheel", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const globalKnob = target?.closest?.("[data-knob-control]");
  if (!globalKnob) return;
  const direction = Math.sign(event.deltaY) * -1;
  setGlobalKnobValue(globalKnob, Number(globalKnob.dataset.knobValue) + (direction * Number(globalKnob.dataset.knobStep || 1)));
  event.preventDefault();
}, { passive: false });

document.addEventListener("keydown", (event) => {
  const globalKnob = event.target?.closest?.("[data-knob-control]");
  if (!globalKnob || !["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) return;
  const direction = event.key === "ArrowUp" || event.key === "ArrowRight" ? 1 : -1;
  setGlobalKnobValue(globalKnob, Number(globalKnob.dataset.knobValue) + (direction * Number(globalKnob.dataset.knobStep || 1)));
  event.preventDefault();
});

document.addEventListener("touchstart", (event) => {
  if (Date.now() - lastTouchActivation < 320) return;
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const point = interactiveGesturePoint(event);
  touchStart = { x: point.x, y: point.y, target };
}, { passive: true });

document.addEventListener("touchmove", (event) => {
  if (!touchStart) return;
  const point = interactiveGesturePoint(event);
  const moved = Math.hypot(point.x - touchStart.x, point.y - touchStart.y);
  if (moved > TAP_MOVE_THRESHOLD) touchStart.moved = true;
}, { passive: true });

document.addEventListener("touchend", (event) => {
  if (!touchStart) return;
  if (Date.now() - lastTouchActivation < 320) {
    touchStart = null;
    return;
  }
  const start = touchStart;
  touchStart = null;
  const point = interactiveGesturePoint(event);
  const moved = Math.hypot(point.x - start.x, point.y - start.y);
  if (start.moved || moved > TAP_MOVE_THRESHOLD || startedInNativeTouchSurface(start.target)) return;
  if (activateInteractiveTarget(event)) lastTouchActivation = Date.now();
}, { passive: false });

document.addEventListener("touchcancel", () => {
  clearPressedControls();
  touchStart = null;
}, { passive: true });

document.addEventListener("click", (event) => {
  if (Date.now() < suppressGlobalKnobClickUntil && (event.target instanceof Element ? event.target : event.target?.parentElement)?.closest?.("[data-knob-control]")) {
    event.preventDefault();
    return;
  }
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
  const studioRotaryInput = target?.closest?.(".fx-knob-input, .dj-knob-input");
  if (studioRotaryInput) {
    handleAction(studioRotaryInput.getAttribute("data-action"), studioRotaryInput);
    syncStudioRotaryInput(studioRotaryInput);
    return;
  }
  bindInputs(event.target);
});

document.addEventListener("keydown", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const fxKnobInput = target?.closest?.(".fx-knob-input, .dj-knob-input");
  if (fxKnobInput && ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const current = Number(fxKnobInput.value) || 0;
    const step = event.shiftKey ? 10 : 3;
    const { min, max } = studioRotaryBounds(fxKnobInput);
    if (event.key === "Home") setStudioRotaryInputValue(fxKnobInput, min);
    else if (event.key === "End") setStudioRotaryInputValue(fxKnobInput, max);
    else setStudioRotaryInputValue(fxKnobInput, current + (["ArrowRight", "ArrowUp"].includes(event.key) ? step : -step));
    return;
  }
  const isTyping = target?.matches?.("input, textarea, select") || target?.closest?.("input, textarea, select");
  if (state.route === "studio" && !isTyping) {
    const key = event.key.toLowerCase();
    const padIndex = STUDIO_PAD_SHORTCUTS.indexOf(key);
    if (padIndex >= 0) {
      event.preventDefault();
      triggerStudioPad(padIndex);
      return;
    }
    const note = STUDIO_NOTE_KEYS[key];
    if (note) {
      event.preventDefault();
      triggerStudioNote(note);
      return;
    }
    if (key === " ") {
      event.preventDefault();
      state.studioPlaying ? stopStudioSequence() : startStudioSequence();
      return;
    }
  }
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
installCentralAccountSync();
installRevenueCatSync();
ensureLottoMindAccountService().then((service) => { if (service) installCentralAccountSync(); });
