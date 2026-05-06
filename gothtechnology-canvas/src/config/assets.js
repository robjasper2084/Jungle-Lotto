export const PACK_ROOT = "../gothtechnology/assets/GOTHTECHNOLOGY_EXPANDED_SPRITE_PACK_V2";
export const LOCAL_ROOT = "assets";

export const ASSET_URLS = {
  manifest: `${PACK_ROOT}/manifests/GOTHTECHNOLOGY_expanded_motion_manifest.json`,
  background: `${LOCAL_ROOT}/user-stage/forest-fight-background.jpg`,
  farTrees: `${PACK_ROOT}/backgrounds/GOTHTECHNOLOGY_PARALLAX_FAR_TREES.png`,
  fog: `${PACK_ROOT}/backgrounds/GOTHTECHNOLOGY_FOG_OVERLAY_TRANSPARENT.png`,
  embers: `${PACK_ROOT}/backgrounds/GOTHTECHNOLOGY_EMBERS_OVERLAY_TRANSPARENT.png`,
  ground: `${LOCAL_ROOT}/user-ground/obsidian-rock-ground.png`,
  effects: {
    hitSpark: `${PACK_ROOT}/effects/sheets/HIT_SPARK_GOLD_sheet.png`,
    blockShield: `${PACK_ROOT}/effects/sheets/BLOCK_SHIELD_BLUE_sheet.png`,
    dust: `${PACK_ROOT}/effects/sheets/DUST_RUN_TRAIL_sheet.png`,
    kalyxFireSlash: `${PACK_ROOT}/effects/sheets/KALYX_FIRE_SLASH_sheet.png`,
    kalyxShadowClaw: `${PACK_ROOT}/effects/sheets/KALYX_SHADOW_CLAW_PROJECTILE_sheet.png`,
    ezraBlueBurst: `${PACK_ROOT}/effects/sheets/EZRA_BLUE_MAGIC_BURST_sheet.png`,
    ezraOwlArc: `${PACK_ROOT}/effects/sheets/EZRA_OWL_ARC_PROJECTILE_sheet.png`,
    emberOverlay: `${PACK_ROOT}/effects/sheets/EMBER_OVERLAY_sheet.png`,
    smoke: `${PACK_ROOT}/effects/sheets/SMOKE_PUFF_sheet.png`
  },
  assists: {
    owl: `${PACK_ROOT}/characters/OWL_COMPANION/sheets/OWL_COMPANION_DIVE_ATTACK_sheet.png`,
    raven: `${PACK_ROOT}/characters/SHADOW_RAVEN/sheets/SHADOW_RAVEN_DIVE_ATTACK_sheet.png`,
    nocturna: `${PACK_ROOT}/characters/NOCTURNA_ASSIST/sheets/NOCTURNA_ASSIST_SCREECH_ATTACK_sheet.png`
  },
  dossiers: {
    vespera: `${LOCAL_ROOT}/user-sheets/vespera-sheet.png`,
    nocturna: `${LOCAL_ROOT}/user-sheets/nocturna-sheet.png`,
    malach: `${LOCAL_ROOT}/user-sheets/malach-sheet.png`,
    morvane: `${LOCAL_ROOT}/user-sheets/morvane-sheet.png`,
    owl: `${LOCAL_ROOT}/user-sheets/owl-flight-sheet.png`,
    raven: `${LOCAL_ROOT}/user-sheets/shadow-raven-sheet.png`,
    wraith: `${LOCAL_ROOT}/user-sheets/wraith-flight-sheet.png`,
    bats: `${LOCAL_ROOT}/user-sheets/bat-swarm-sheet.png`,
    effects: `${LOCAL_ROOT}/user-sheets/flying-effects-sheet.png`
  }
};

export const FIGHTERS = {
  KALYX: {
    id: "KALYX",
    name: "KALYX",
    title: "Shadow Rushdown",
    manifestKey: "KALYX",
    palette: "#f0a23b",
    accent: "#ffcf67",
    scale: 1.56,
    speed: 330,
    runSpeed: 470,
    dashSpeed: 760,
    jumpVelocity: -880,
    maxHealth: 1000,
    assistNames: ["SHADOW RAVEN", "NOCTURNA WRAITH"],
    superName: "Shadow Roar",
    specialName: "Fire Slash"
  },
  MASTER_EZRA: {
    id: "MASTER_EZRA",
    name: "MASTER EZRA",
    title: "Blue Control",
    manifestKey: "MASTER_EZRA",
    palette: "#8bd4ff",
    accent: "#d8aa45",
    scale: 1.5,
    speed: 250,
    runSpeed: 365,
    dashSpeed: 620,
    jumpVelocity: -790,
    maxHealth: 1060,
    assistNames: ["OWL COMPANION", "ARCANE GUARD"],
    superName: "Sky Judgment",
    specialName: "Blue Magic"
  }
};
