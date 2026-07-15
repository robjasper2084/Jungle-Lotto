export const ROSTER_IDS = ["KALYX", "MASTER_EZRA", "DETROIT_LENS", "KALYX_ECLIPSE", "EZRA_ASCENDANT"];

export const ROSTER_CARD_LAYOUT = [
  { x: 44, y: 108, w: 368, h: 184 },
  { x: 456, y: 108, w: 368, h: 184 },
  { x: 868, y: 108, w: 368, h: 184 },
  { x: 250, y: 310, w: 368, h: 184 },
  { x: 662, y: 310, w: 368, h: 184 }
];

export const GAME_MODES = {
  versus: { label: "VERSUS", roundsToWin: 2 },
  arcade: { label: "ARCADE", roundsToWin: 2 },
  survival: { label: "SURVIVAL", roundsToWin: 1 },
  challenge: { label: "CHALLENGE", roundsToWin: 1 },
  training: { label: "TRAINING", roundsToWin: 0 },
  replay: { label: "REPLAY", roundsToWin: 2 }
};

export const STAGES = [
  {
    id: "forest-ruin",
    name: "FOREST RUIN",
    backgroundKey: "background",
    legacyLayers: true,
    grade: ["rgba(0,0,0,0.72)", "rgba(0,0,0,0.16)", "rgba(0,0,0,0.78)"],
    fogAlpha: 0.2,
    emberAlpha: 0.18
  },
  {
    id: "ember-gate",
    name: "EMBER GATE",
    backgroundKey: "background",
    legacyLayers: true,
    grade: ["rgba(34,8,2,0.62)", "rgba(84,26,5,0.12)", "rgba(18,3,0,0.8)"],
    fogAlpha: 0.1,
    emberAlpha: 0.38
  },
  {
    id: "moon-shrine",
    name: "MOON SHRINE",
    backgroundKey: "background",
    legacyLayers: true,
    grade: ["rgba(2,12,30,0.58)", "rgba(18,52,76,0.12)", "rgba(1,5,18,0.82)"],
    fogAlpha: 0.34,
    emberAlpha: 0.08
  },
  {
    id: "detroit-midnight-mile",
    name: "DETROIT MIDNIGHT MILE",
    backgroundKey: "detroitMidnightMile",
    legacyLayers: false,
    grade: ["rgba(2,9,22,0.2)", "rgba(30,72,96,0.04)", "rgba(0,2,8,0.58)"],
    fogAlpha: 0.08,
    emberAlpha: 0.03
  },
  {
    id: "motor-city-assembly",
    name: "MOTOR CITY ASSEMBLY",
    backgroundKey: "motorCityAssembly",
    legacyLayers: false,
    grade: ["rgba(3,12,16,0.18)", "rgba(80,16,12,0.035)", "rgba(0,3,5,0.62)"],
    fogAlpha: 0.06,
    emberAlpha: 0.14
  },
  {
    id: "detroit-riverfront",
    name: "DETROIT RIVERFRONT",
    backgroundKey: "detroitRiverfront",
    legacyLayers: false,
    grade: ["rgba(3,10,24,0.12)", "rgba(28,60,86,0.025)", "rgba(0,3,10,0.42)"],
    fogAlpha: 0.04,
    emberAlpha: 0.01
  },
  {
    id: "eastern-market-after-dark",
    name: "EASTERN MARKET AFTER DARK",
    backgroundKey: "easternMarketAfterDark",
    legacyLayers: false,
    grade: ["rgba(4,7,18,0.18)", "rgba(82,22,18,0.035)", "rgba(0,2,8,0.52)"],
    fogAlpha: 0.07,
    emberAlpha: 0.04
  },
  {
    id: "michigan-central-concourse",
    name: "MICHIGAN CENTRAL CONCOURSE",
    backgroundKey: "michiganCentralConcourse",
    legacyLayers: false,
    grade: ["rgba(20,9,3,0.08)", "rgba(80,48,28,0.02)", "rgba(4,2,1,0.38)"],
    fogAlpha: 0.025,
    emberAlpha: 0.01
  }
];

export const ARCADE_LADDER = ["MASTER_EZRA", "KALYX_ECLIPSE", "DETROIT_LENS", "EZRA_ASCENDANT", "KALYX"];

export const CHALLENGES = [
  { id: "chain", name: "CHAIN REACTION", description: "LAND A 3-HIT COMBO", target: 3, event: "combo" },
  { id: "guard", name: "PERFECT DISCIPLINE", description: "PERFECT BLOCK TWICE", target: 2, event: "perfectBlock" },
  { id: "tech", name: "BREAK THE GRIP", description: "TECH A THROW", target: 1, event: "throwTech" },
  { id: "super", name: "FINAL JUDGMENT", description: "LAND A SUPER", target: 1, event: "superHit" }
];

const commonCommands = [
  { input: "BACK", name: "GUARD", detail: "Hold away. Add DOWN for low guard." },
  { input: "DASH", name: "BURST STEP", detail: "Dash button or double-tap a direction." },
  { input: "LP + HP", name: "CHAIN I", detail: "Fast two-hit route." },
  { input: "LP + LK", name: "CHAIN II", detail: "Low-to-mid route." },
  { input: "THROW / MOD+LP", name: "THROW / TECH", detail: "Use close; match an incoming throw to tech." },
  { input: "A1/A2 / MOD+LK/HK", name: "ASSISTS", detail: "Call an assist; each slot has its own cooldown." },
  { input: "TAUNT / MOD+SP", name: "TAUNT", detail: "Gain a small amount of meter while exposed." }
];

export const COMMAND_LISTS = {
  KALYX: {
    title: "SHADOW RUSHDOWN",
    passive: "Air dash once per jump. Forward dash briefly evades attacks.",
    commands: [
      ...commonCommands,
      { input: "DOWN + SP", name: "SHADOW STEP", detail: "Spend meter to cross through the opponent." },
      { input: "SP", name: "FIRE SLASH", detail: "Fast shadow-claw projectile." },
      { input: "MAX / MOD+HP", name: "SHADOW ROAR", detail: "Three-hit rushing super." }
    ]
  },
  MASTER_EZRA: {
    title: "BLUE CONTROL",
    passive: "Long perfect-guard window and stronger meter gain on defense.",
    commands: [
      ...commonCommands,
      { input: "DOWN + SP", name: "ARCANE PARRY", detail: "Spend meter to repel the next strike or projectile." },
      { input: "SP", name: "BLUE MAGIC", detail: "Slow, large control projectile." },
      { input: "MAX / MOD+HP", name: "SKY JUDGMENT", detail: "Heavy space-control super." }
    ]
  },
  DETROIT_LENS: {
    title: "DETROIT HERO",
    passive: "The Boerboel controls the ground while Guardian Intercept stops close pressure.",
    commands: [
      ...commonCommands,
      { input: "DOWN + SP", name: "GUARDIAN INTERCEPT", detail: "Spend meter to call a close Boerboel counter." },
      { input: "SP", name: "BOERBOEL RUSH", detail: "Send the Boerboel sprinting into a leap-and-bite attack." },
      { input: "MAX / MOD+HP", name: "RED-EYE EXPOSURE", detail: "Fire a three-hit ruby laser through the glasses." }
    ]
  },
  KALYX_ECLIPSE: {
    title: "ECLIPSE ASSASSIN",
    passive: "Faster air dash and extended rushdown cancels at lower health.",
    commands: [
      ...commonCommands,
      { input: "DOWN + SP", name: "ECLIPSE STEP", detail: "Cross through with longer invulnerability." },
      { input: "SP", name: "NIGHT CLAW", detail: "Very fast compact projectile." },
      { input: "MAX / MOD+HP", name: "TOTAL ECLIPSE", detail: "High-speed three-hit super." }
    ]
  },
  EZRA_ASCENDANT: {
    title: "ARCANE AEGIS",
    passive: "Parries cost less and successful defense restores more meter.",
    commands: [
      ...commonCommands,
      { input: "DOWN + SP", name: "AEGIS PARRY", detail: "Long defensive counter window." },
      { input: "SP", name: "OWL ORB", detail: "Large slow projectile with strong block pressure." },
      { input: "MAX / MOD+HP", name: "ASCENSION", detail: "Wide three-hit control super." }
    ]
  }
};

export const opponentFor = (playerId, offset = 0) => {
  const options = ROSTER_IDS.filter((id) => id !== playerId);
  return options[((offset % options.length) + options.length) % options.length];
};
