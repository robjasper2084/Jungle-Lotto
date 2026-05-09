export const PACK_ROOT = "../gothtechnology/assets/GOTHTECHNOLOGY_EXPANDED_SPRITE_PACK_V2";
export const LOCAL_ROOT = "assets";

export const ASSET_URLS = {
  manifest: `${PACK_ROOT}/manifests/GOTHTECHNOLOGY_expanded_motion_manifest.json`,
  logo: `${LOCAL_ROOT}/user-title/lottomind-live-logo.png`,
  titleBackdrop: `${LOCAL_ROOT}/user-title/gothtechnology-startup-bg.png`,
  background: `${LOCAL_ROOT}/user-stage/forest-fight-background.jpg`,
  farTrees: `${PACK_ROOT}/backgrounds/GOTHTECHNOLOGY_PARALLAX_FAR_TREES.png`,
  fog: `${PACK_ROOT}/backgrounds/GOTHTECHNOLOGY_FOG_OVERLAY_TRANSPARENT.png`,
  embers: `${PACK_ROOT}/backgrounds/GOTHTECHNOLOGY_EMBERS_OVERLAY_TRANSPARENT.png`,
  ground: `${LOCAL_ROOT}/user-ground/obsidian-rock-ground.png`,
  music: `${LOCAL_ROOT}/audio/lottomind-frequency.mp3`,
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
    owl: `${LOCAL_ROOT}/user-assists/ezra-owl-dive-clean.png`,
    raven: `${LOCAL_ROOT}/user-assists/kalyx-shadow-raven-clean.png`,
    nocturna: `${LOCAL_ROOT}/user-assists/nocturna-wraith-clean.png`
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
    spriteFacing: 1,
    motionFacing: {
      IDLE: -1,
      BLOCK_HIGH: -1
    },
    palette: "#f0a23b",
    accent: "#ffcf67",
    scale: 1.56,
    stableScale: 1.56,
    spriteFilter: "blur(0.22px) contrast(1.05) saturate(1.08)",
    motionVisualScale: {
      LIGHT_KICK: 1,
      HEAVY_KICK: 1.22
    },
    motionFrameScale: {
      LIGHT_KICK: [0.98, 1.22, 1.22, 0.96, 0.97, 1.22]
    },
    stageMargin: 196,
    speed: 392,
    runSpeed: 630,
    dashSpeed: 1080,
    jumpVelocity: -1005,
    motionTimeScale: 1.28,
    feel: {
      attackStartupScale: 0.68,
      attackRecoveryScale: 0.56,
      attackActiveScale: 0.86,
      inputBuffer: 0.18,
      groundAccel: 4200,
      groundDecel: 3600,
      airAccel: 1320,
      dashBrake: 1780,
      landingLag: 0.018
    },
    maxHealth: 1000,
    attackOverrides: {
      lightKick: {
        motion: "LIGHT_KICK",
        damage: 58,
        chip: 5,
        stun: 0.24,
        blockstun: 0.18,
        startup: 0.11,
        active: [0.11, 0.28],
        recovery: 0.22,
        reach: 108,
        width: 94,
        height: 64,
        y: -130,
        knockback: 215,
        level: "mid"
      }
    },
    assistNames: ["SHADOW RAVEN", "NOCTURNA WRAITH"],
    superName: "Shadow Roar",
    specialName: "Fire Slash"
  },
  MASTER_EZRA: {
    id: "MASTER_EZRA",
    name: "MASTER EZRA",
    title: "Blue Control",
    manifestKey: "MASTER_EZRA",
    spriteFacing: -1,
    palette: "#8bd4ff",
    accent: "#d8aa45",
    scale: 1.58,
    stableScale: 1.58,
    motionVisualScale: {
      LIGHT_PUNCH: 1.09,
      HEAVY_PUNCH: 1.09,
      COMBO_1: 1.08,
      COMBO_2: 1.08,
      SPECIAL_START: 1.14,
      SPECIAL_PROJECTILE: 1.12,
      SPECIAL_RECOVER: 1.12,
      THROW_GRAB: 1.09,
      THROW_FINISH: 1.09,
      LIGHT_KICK: 1.04,
      HEAVY_KICK: 1.08,
      AIR_ATTACK: 1.1,
      JUMP_START: 1.1,
      JUMP_RISE: 1.12,
      JUMP_PEAK: 1.12,
      JUMP_FALL: 1.1,
      LANDING: 1.06
    },
    speed: 360,
    runSpeed: 530,
    dashSpeed: 960,
    jumpVelocity: -995,
    motionTimeScale: 1.24,
    feel: {
      attackStartupScale: 0.7,
      attackRecoveryScale: 0.58,
      attackActiveScale: 0.88,
      inputBuffer: 0.18,
      groundAccel: 3850,
      groundDecel: 3300,
      airAccel: 1240,
      dashBrake: 1640,
      landingLag: 0.018
    },
    maxHealth: 1060,
    attackOverrides: {
      lightKick: {
        motion: "LIGHT_KICK",
        damage: 58,
        chip: 5,
        stun: 0.26,
        blockstun: 0.2,
        startup: 0.1,
        active: [0.1, 0.32],
        recovery: 0.22,
        reach: 138,
        width: 136,
        height: 82,
        y: -116,
        knockback: 210,
        level: "mid"
      },
      heavyKick: {
        motion: "HEAVY_KICK",
        damage: 104,
        chip: 10,
        stun: 0.38,
        blockstun: 0.28,
        startup: 0.16,
        active: [0.16, 0.42],
        recovery: 0.34,
        reach: 164,
        width: 154,
        height: 88,
        y: -118,
        knockback: 330,
        level: "mid"
      },
      airAttack: {
        motion: "AIR_ATTACK",
        damage: 82,
        chip: 5,
        stun: 0.32,
        blockstun: 0.24,
        startup: 0.09,
        active: [0.09, 0.38],
        recovery: 0.18,
        reach: 134,
        width: 140,
        height: 102,
        y: -138,
        knockback: 250,
        level: "high"
      }
    },
    motionRemap: {
      RUN_FORWARD: "WALK_FORWARD",
      RUN_BACK: "WALK_BACK",
      DASH_FORWARD: "WALK_FORWARD",
      DASH_BACK: "WALK_BACK"
    },
    assistNames: ["OWL COMPANION", "ARCANE GUARD"],
    superName: "Sky Judgment",
    specialName: "Blue Magic"
  }
};
