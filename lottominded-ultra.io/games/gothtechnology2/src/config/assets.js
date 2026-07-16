export const PACK_ROOT = "assets/GOTHTECHNOLOGY_EXPANDED_SPRITE_PACK_V2";
export const LOCAL_ROOT = "assets";
export const MOTION_ASSET_VERSION = "future-hud20-cpu-select";

export const ASSET_URLS = {
  manifest: `${LOCAL_ROOT}/motion-atlases/motion-atlas-manifest.json?v=${MOTION_ASSET_VERSION}`,
  logo: `${LOCAL_ROOT}/user-title/lottomind-live-logo.webp?v=${MOTION_ASSET_VERSION}`,
  titleBackdrop: `${LOCAL_ROOT}/user-title/gothtechnology-gameplay-title.webp?v=${MOTION_ASSET_VERSION}`,
  menuBackdrop: `${LOCAL_ROOT}/user-stage/forest-fight-background.jpg`,
  gameTitles: {
    gothtechnology: `${LOCAL_ROOT}/user-title/gothtechnology-cover-start-bg.webp?v=${MOTION_ASSET_VERSION}`,
    robotRahbe: `${LOCAL_ROOT}/user-title/robot-rahbe-title-card.webp?v=${MOTION_ASSET_VERSION}`
  },
  rosterPortraits: {
    detroitLensNoir: `${LOCAL_ROOT}/user-roster/detroit-lens-noir-idle.webp?v=${MOTION_ASSET_VERSION}`
  },
  background: `${LOCAL_ROOT}/user-stage/forest-fight-background.jpg`,
  stages: {
    detroitMidnightMile: `${LOCAL_ROOT}/user-stage/detroit-midnight-mile.webp`,
    motorCityAssembly: `${LOCAL_ROOT}/user-stage/motor-city-assembly.webp`,
    detroitRiverfront: `${LOCAL_ROOT}/user-stage/detroit-riverfront.webp`,
    easternMarketAfterDark: `${LOCAL_ROOT}/user-stage/eastern-market-after-dark.webp`,
    michiganCentralConcourse: `${LOCAL_ROOT}/user-stage/michigan-central-concourse.webp`
  },
  farTrees: `${PACK_ROOT}/backgrounds/GOTHTECHNOLOGY_PARALLAX_FAR_TREES.webp`,
  fog: `${PACK_ROOT}/backgrounds/GOTHTECHNOLOGY_FOG_OVERLAY_TRANSPARENT.webp`,
  embers: `${PACK_ROOT}/backgrounds/GOTHTECHNOLOGY_EMBERS_OVERLAY_TRANSPARENT.webp`,
  ground: `${LOCAL_ROOT}/user-ground/obsidian-rock-ground.webp`,
  music: `${LOCAL_ROOT}/audio/lottomind-frequency-112.mp3`,
  fightMusic: `${LOCAL_ROOT}/audio/miracle-gold-reset-112.mp3`,
  effects: {
    hitSpark: `${PACK_ROOT}/effects/sheets/HIT_SPARK_GOLD_sheet.webp`,
    blockShield: `${PACK_ROOT}/effects/sheets/BLOCK_SHIELD_BLUE_sheet.webp`,
    dust: `${PACK_ROOT}/effects/sheets/DUST_RUN_TRAIL_sheet.webp`,
    kalyxFireSlash: `${PACK_ROOT}/effects/sheets/KALYX_FIRE_SLASH_sheet.webp`,
    kalyxShadowClaw: `${PACK_ROOT}/effects/sheets/KALYX_SHADOW_CLAW_PROJECTILE_sheet.webp`,
    ezraBlueBurst: `${PACK_ROOT}/effects/sheets/EZRA_BLUE_MAGIC_BURST_sheet.webp`,
    ezraOwlArc: `${PACK_ROOT}/effects/sheets/EZRA_OWL_ARC_PROJECTILE_sheet.webp`,
    smoke: `${PACK_ROOT}/effects/sheets/SMOKE_PUFF_sheet.webp`
  },
  assists: {
    owl: `${LOCAL_ROOT}/user-assists/ezra-owl-dive-clean.webp`,
    raven: `${LOCAL_ROOT}/user-assists/kalyx-shadow-raven-clean.webp`,
    nocturna: `${LOCAL_ROOT}/user-assists/nocturna-wraith-clean.webp`,
    boerboel: `${LOCAL_ROOT}/user-effects/detroit-boerboel-atlas.webp?v=${MOTION_ASSET_VERSION}`
  }
};

export const MOTION_PLAYBACK = {
  KALYX: {
    WALK_FORWARD: [0, 1, 2, 3, 4, 5],
    WALK_BACK: [0, 1, 2, 3, 4, 5],
    RUN_FORWARD: [1, 2, 3, 4, 3, 2],
    RUN_BACK: [1, 2, 3, 4, 3, 2],
    DASH_FORWARD: [0, 1, 2, 3, 4, 5],
    DASH_BACK: [0, 1, 2, 3, 4, 5],
    JUMP_START: [0, 1, 2, 3],
    JUMP_RISE: [0, 1, 2, 3, 4],
    JUMP_PEAK: [0, 1, 2, 3],
    JUMP_FALL: [0, 1, 2, 3],
    LANDING: [2, 3, 4, 5],
    KNOCKDOWN: [0, 1, 3, 4, 2, 5]
  },
  MASTER_EZRA: {
    WALK_FORWARD: [0, 1, 2, 3, 4, 5],
    WALK_BACK: [0, 1, 2, 3, 4, 5],
    RUN_FORWARD: [1, 2, 3, 4, 3, 2],
    RUN_BACK: [1, 2, 3, 4, 3, 2],
    DASH_FORWARD: [0, 1, 2, 3, 4, 5],
    DASH_BACK: [0, 1, 2, 3, 4, 5],
    JUMP_START: [0, 1],
    JUMP_RISE: [0, 1, 2],
    JUMP_PEAK: [0, 1],
    JUMP_FALL: [0, 1, 2, 3],
    LANDING: [1, 0, 4, 5]
  },
  DETROIT_LENS_NOIR: {
    WALK_FORWARD: [0, 1, 2, 3, 4, 5],
    WALK_BACK: [0, 1, 2, 3, 4, 5],
    RUN_FORWARD: [0, 1, 2, 3, 4, 5],
    RUN_BACK: [0, 1, 2, 3, 4, 5],
    DASH_FORWARD: [0, 1, 2, 3, 4, 5],
    DASH_BACK: [0, 1, 2, 3, 4, 5],
    JUMP_START: [0, 1, 2, 3],
    JUMP_RISE: [0, 1, 2, 3, 4],
    JUMP_PEAK: [0, 1, 2, 3],
    JUMP_FALL: [0, 1, 2, 3, 4],
    LANDING: [0, 1, 2, 3, 4, 5]
  }
};

export const FIGHTERS = {
  KALYX: {
    id: "KALYX",
    name: "KALYX",
    title: "Shadow Rushdown",
    manifestKey: "KALYX",
    spriteFacing: 1,
    palette: "#c51f35",
    accent: "#ff5b68",
    costumePalette: "black-crimson",
    scale: 1.34,
    stableScale: 1.34,
    archetype: "rushdown",
    skillCost: 25,
    skillCooldown: 1.15,
    guardTapWindow: 0.11,
    perfectBlockMeterBonus: 9,
    airDash: true,
    stageMargin: 196,
    speed: 430,
    runSpeed: 720,
    dashSpeed: 1200,
    jumpVelocity: -1005,
    motionTimeScale: 1.48,
    motionDurations: {
      JUMP_START: 0.16,
      JUMP_RISE: 0.34,
      JUMP_PEAK: 0.12,
      JUMP_FALL: 0.38,
      LANDING: 0.22,
      DASH_FORWARD: 0.28,
      DASH_BACK: 0.32
    },
    motionTimeScales: {
      WALK_FORWARD: 2.2,
      WALK_BACK: 2.2,
      RUN_FORWARD: 1.72,
      RUN_BACK: 1.72
    },
    feel: {
      attackStartupScale: 0.58,
      attackRecoveryScale: 0.48,
      attackActiveScale: 0.9,
      inputBuffer: 0.18,
      groundAccel: 4800,
      groundDecel: 4200,
      airAccel: 1500,
      dashBrake: 2100,
      runThreshold: 0.24,
      crouchWalkScale: 0.42,
      landingLag: 0.12
    },
    maxHealth: 1000,
    attackOverrides: {
      lightPunch: {
        motion: "LIGHT_PUNCH",
        damage: 44,
        chip: 4,
        stun: 0.2,
        blockstun: 0.16,
        startup: 0.07,
        active: [0.07, 0.2],
        recovery: 0.16,
        reach: 105,
        width: 92,
        height: 58,
        y: -132,
        knockback: 165,
        level: "high"
      },
      heavyPunch: {
        motion: "HEAVY_PUNCH",
        damage: 88,
        chip: 8,
        stun: 0.33,
        blockstun: 0.24,
        startup: 0.13,
        active: [0.13, 0.32],
        recovery: 0.27,
        reach: 136,
        width: 126,
        height: 72,
        y: -134,
        knockback: 275,
        level: "high"
      },
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
      },
      heavyKick: {
        motion: "HEAVY_KICK",
        damage: 104,
        chip: 9,
        stun: 0.37,
        blockstun: 0.27,
        startup: 0.14,
        active: [0.14, 0.38],
        recovery: 0.3,
        reach: 150,
        width: 138,
        height: 88,
        y: -152,
        knockback: 330,
        level: "high"
      },
      crouchAttack: {
        motion: "CROUCH_ATTACK",
        damage: 58,
        chip: 5,
        stun: 0.25,
        blockstun: 0.2,
        startup: 0.09,
        active: [0.09, 0.28],
        recovery: 0.2,
        reach: 126,
        width: 118,
        height: 50,
        y: -68,
        knockback: 190,
        level: "low"
      },
      airAttack: {
        motion: "AIR_ATTACK",
        damage: 82,
        chip: 5,
        stun: 0.32,
        blockstun: 0.24,
        startup: 0.08,
        active: [0.08, 0.36],
        recovery: 0.17,
        reach: 130,
        width: 134,
        height: 104,
        y: -148,
        knockback: 250,
        level: "high"
      },
      special: {
        speed: 820,
        radius: 30,
        damage: 98,
        chip: 14,
        stun: 0.32,
        blockstun: 0.25
      },
      super: {
        speed: 980,
        radius: 66,
        damage: 236,
        knockback: 560
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
    spriteFacing: 1,
    palette: "#8bd4ff",
    accent: "#d8aa45",
    scale: 1.3,
    stableScale: 1.3,
    archetype: "control",
    skillCost: 15,
    skillCooldown: 0.9,
    guardTapWindow: 0.18,
    perfectBlockMeterBonus: 16,
    speed: 410,
    runSpeed: 670,
    dashSpeed: 1150,
    jumpVelocity: -995,
    motionTimeScale: 1.46,
    motionDurations: {
      JUMP_START: 0.14,
      JUMP_RISE: 0.28,
      JUMP_PEAK: 0.1,
      JUMP_FALL: 0.42,
      LANDING: 0.19,
      DASH_FORWARD: 0.3,
      DASH_BACK: 0.34
    },
    motionTimeScales: {
      WALK_FORWARD: 2.05,
      WALK_BACK: 2.05,
      RUN_FORWARD: 1.65,
      RUN_BACK: 1.65
    },
    feel: {
      attackStartupScale: 0.6,
      attackRecoveryScale: 0.5,
      attackActiveScale: 0.9,
      inputBuffer: 0.18,
      groundAccel: 4600,
      groundDecel: 4000,
      airAccel: 1450,
      dashBrake: 2000,
      runThreshold: 0.28,
      crouchWalkScale: 0.4,
      landingLag: 0.13
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
      },
      special: {
        speed: 560,
        radius: 44,
        damage: 88,
        chip: 18,
        stun: 0.38,
        blockstun: 0.31
      },
      super: {
        speed: 760,
        radius: 84,
        damage: 258,
        blockstun: 0.56,
        knockback: 480
      }
    },
    assistNames: ["OWL COMPANION", "ARCANE GUARD"],
    superName: "Sky Judgment",
    specialName: "Blue Magic"
  }
};

FIGHTERS.DETROIT_LENS_NOIR = {
  id: "DETROIT_LENS_NOIR",
  name: "DETROIT LENS NOIR",
  title: "Midnight Guardian",
  manifestKey: "DETROIT_LENS_NOIR",
  spriteFacing: 1,
  palette: "#9ca3ad",
  accent: "#df4d4d",
  costumePalette: "black-black",
  rosterPortraitKey: "detroitLensNoirPortrait",
  scale: 1.31,
  stableScale: 1.31,
  archetype: "precision",
  skillCost: 20,
  skillCooldown: 1.05,
  precisionRangeMeterBonus: 4,
  guardTapWindow: 0.14,
  perfectBlockMeterBonus: 12,
  stageMargin: 120,
  speed: 420,
  runSpeed: 690,
  dashSpeed: 1160,
  jumpVelocity: -1000,
  motionTimeScale: 1.46,
  motionDurations: {
    JUMP_START: 0.15,
    JUMP_RISE: 0.31,
    JUMP_PEAK: 0.11,
    JUMP_FALL: 0.4,
    LANDING: 0.2,
    DASH_FORWARD: 0.29,
    DASH_BACK: 0.33
  },
  motionTimeScales: {
    WALK_FORWARD: 2.08,
    WALK_BACK: 2.08,
    RUN_FORWARD: 1.68,
    RUN_BACK: 1.68
  },
  feel: {
    attackStartupScale: 0.59,
    attackRecoveryScale: 0.5,
    attackActiveScale: 0.92,
    inputBuffer: 0.19,
    groundAccel: 4650,
    groundDecel: 4100,
    airAccel: 1460,
    dashBrake: 2050,
    runThreshold: 0.27,
    crouchWalkScale: 0.41,
    landingLag: 0.12
  },
  maxHealth: 1010,
  attackOverrides: {
    lightPunch: { damage: 46, reach: 98, knockback: 160 },
    heavyPunch: { damage: 92, reach: 142, width: 126, knockback: 285 },
    lightKick: { damage: 54, reach: 112, knockback: 185 },
    heavyKick: { damage: 100, reach: 154, width: 142, knockback: 320 },
    crouchAttack: { damage: 64, reach: 132, width: 122, knockback: 205 },
    airAttack: { damage: 78, reach: 126, width: 130, knockback: 235 },
    special: {
      speed: 760,
      radius: 66,
      damage: 104,
      chip: 12,
      stun: 0.46,
      blockstun: 0.3,
      cooldown: 1.08,
      knockback: 310,
      level: "mid"
    },
    super: {
      speed: 1540,
      radius: 38,
      damage: 276,
      chip: 48,
      stun: 0.72,
      blockstun: 0.54,
      knockback: 500,
      multiHit: 3,
      hitInterval: 0.07
    }
  },
  assistNames: ["FLASH DRONE", "FRAME GUARD"],
  superName: "Red-Eye Exposure",
  specialName: "Boerboel Rush"
};
