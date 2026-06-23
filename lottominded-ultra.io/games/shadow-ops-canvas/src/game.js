(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = 1280;
  const H = 720;
  const STEP = 1 / 60;
  const GRAVITY = 2350;
  const WORLD_W = 6500;
  const GATE_X = 4280;
  const BOSS_START_X = 5000;
  const EXTRACTION_X = 6180;
  const STORAGE_KEY = "lottomind-vault-run-save-v1";
  const SETTINGS_KEY = "lottomind-vault-run-settings-v1";
  const DEBUG = new URLSearchParams(window.location.search).has("debug");
  const ACTIVE_STORAGE_KEY = DEBUG ? `${STORAGE_KEY}-debug` : STORAGE_KEY;

  const ASSETS = {
    backplate: "./assets/backgrounds/higgsfield-soul-location-backplate.png",
    foreground: "./assets/backgrounds/higgsfield-soul-location-foreground-ground.png",
    level1Bg: "./assets/levels/level1_bg_far.webp",
    level2Bg: "./assets/levels/level2_bg_far.webp",
    level3Bg: "./assets/levels/level3_bg_far.webp",
    level1Tiles: "./assets/levels/platform_tiles_level1.png",
    level2Tiles: "./assets/levels/platform_tiles_level2.png",
    level3Tiles: "./assets/levels/platform_tiles_level3.png",
    bossCanopy: "./assets/bosses/canopy_drone_queen.png",
    bossForge: "./assets/bosses/jackpot_forge_titan.png",
    bossMidas: "./assets/bosses/midas_heartcore_overlord.png",
    levelFrame: "./assets/ui/level_card_frame.png",
    bossFrame: "./assets/ui/boss_health_frame.png",
    victoryBadge: "./assets/ui/final_victory_badge.png",
    hero: "./assets/hero/lottomind-hero-main.png",
    player: "./assets/mascot/lottomind-mascot-runner-atlas.png",
    enemy: "../gothtechnology2/assets/GOTHTECHNOLOGY_EXPANDED_SPRITE_PACK_V2/characters/KALYX/runtime_atlas_user/KALYX_RUNTIME_ATLAS.png"
  };

  const LEVELS = [
    {
      id: 1,
      title: "NEON JUNGLE VAULT",
      shortName: "Neon Jungle",
      theme: "jungle",
      width: 6500,
      gateX: 4280,
      bossStartX: 5000,
      extractionX: 6180,
      boss: "canopyDroneQueen",
      bossName: "Canopy Drone Queen",
      bossImage: "bossCanopy",
      background: "level1Bg",
      tiles: "level1Tiles",
      objective: "Collect 3 jungle vault keys",
      music: { pulse: 110, boss: 82 },
      palette: { platform: "#171217", trim: "#ffd66d", glow: "#a522ff" },
      platforms: [
        [0, 620, 1380, 34, "entry"],
        [1500, 620, 960, 34, "conduit"],
        [2550, 620, 1080, 34, "canopy"],
        [3740, 620, 960, 34, "causeway"],
        [4800, 620, 1700, 34, "chamber"],
        [930, 500, 300, 28, "upper"],
        [1700, 455, 330, 28, "upper"],
        [2260, 500, 360, 28, "upper"],
        [2870, 470, 430, 28, "upper"],
        [3560, 482, 340, 28, "upper"],
        [3950, 420, 290, 28, "upper"],
        [4480, 505, 320, 28, "upper"],
        [5350, 485, 420, 28, "boss"]
      ],
      spawns: [
        ["crawler", 720, 620],
        ["drone", 1160, 405],
        ["turret", 1380, 490],
        ["shield", 1980, 620],
        ["crawler", 2380, 620],
        ["drone", 2810, 385],
        ["turret", 3140, 500],
        ["shield", 3520, 620],
        ["crawler", 3840, 620],
        ["drone", 4070, 390],
        ["shield", 4680, 620],
        ["turret", 4860, 515]
      ],
      shardRows: [[420, 510, 4], [1010, 438, 4], [1580, 548, 5], [2270, 438, 4], [2740, 548, 5], [3180, 445, 4], [3780, 548, 5], [4520, 450, 4], [5200, 545, 5]],
      keys: [[1110, 438], [3060, 410], [4080, 360]],
      bonuses: [["health", 2140, 548], ["health", 4710, 548], ["overdrive", 3340, 548]],
      hazards: [
        { type: "floor", x: 1810, y: 620, w: 230, h: 36, cycle: 2.7, active: 0.72, phase: 0.1 },
        { type: "floor", x: 3625, y: 620, w: 250, h: 36, cycle: 2.4, active: 0.65, phase: 1.1 }
      ]
    },
    {
      id: 2,
      title: "GOLDEN CIRCUIT FOUNDRY",
      shortName: "Circuit Foundry",
      theme: "foundry",
      width: 7200,
      gateX: 4850,
      bossStartX: 5580,
      extractionX: 6900,
      boss: "jackpotForgeTitan",
      bossName: "Jackpot Forge Titan",
      bossImage: "bossForge",
      background: "level2Bg",
      tiles: "level2Tiles",
      objective: "Collect 3 forge keys",
      music: { pulse: 138, boss: 74 },
      palette: { platform: "#1c1510", trim: "#ffce55", glow: "#ff4f9a" },
      platforms: [
        [0, 620, 1100, 34, "entry"],
        [1250, 620, 820, 34, "conveyor", { conveyor: 90 }],
        [2220, 585, 780, 34, "forge"],
        [3200, 620, 1080, 34, "conveyor", { conveyor: -75 }],
        [4440, 620, 780, 34, "gate"],
        [5400, 620, 1800, 34, "chamber"],
        [820, 478, 280, 28, "upper"],
        [1560, 430, 330, 28, "upper"],
        [2440, 455, 330, 28, "upper"],
        [3040, 380, 320, 28, "moving", { move: { axis: "y", amp: 76, speed: 1.1 } }],
        [3690, 470, 380, 28, "upper"],
        [4260, 405, 300, 28, "upper"],
        [5950, 468, 460, 28, "boss"]
      ],
      spawns: [
        ["crawler", 640, 620],
        ["shield", 1320, 620],
        ["turret", 1780, 430],
        ["drone", 2240, 360],
        ["shield", 2740, 585],
        ["turret", 3280, 380],
        ["shield", 3860, 620],
        ["drone", 4260, 390],
        ["turret", 4740, 510],
        ["shield", 5240, 620],
        ["shield", 5480, 620],
        ["turret", 5820, 520]
      ],
      shardRows: [[360, 548, 5], [920, 418, 4], [1490, 548, 5], [2340, 395, 4], [3050, 320, 5], [3710, 410, 4], [4540, 548, 5], [6000, 405, 5]],
      keys: [[1680, 360], [3130, 312], [4490, 336]],
      bonuses: [["health", 2510, 520], ["overdrive", 3860, 400], ["health", 5360, 548]],
      hazards: [
        { type: "floor", x: 2100, y: 620, w: 180, h: 40, cycle: 2.2, active: 0.76, phase: 0.5 },
        { type: "laser", x: 2860, y: 350, w: 36, h: 270, cycle: 3.1, active: 0.9, phase: 1.4 },
        { type: "laser", x: 4150, y: 370, w: 36, h: 250, cycle: 2.8, active: 0.82, phase: 0.2 }
      ]
    },
    {
      id: 3,
      title: "ASTRAL VAULT CORE",
      shortName: "Astral Core",
      theme: "astral",
      width: 8000,
      gateX: 5480,
      bossStartX: 6260,
      extractionX: 7700,
      boss: "midasHeartcoreOverlord",
      bossName: "Midas Heartcore Overlord",
      bossImage: "bossMidas",
      background: "level3Bg",
      tiles: "level3Tiles",
      objective: "Collect 3 astral core keys",
      music: { pulse: 94, boss: 62 },
      palette: { platform: "#10111d", trim: "#ffd66d", glow: "#38dbff" },
      platforms: [
        [0, 620, 900, 34, "entry"],
        [1060, 575, 470, 30, "float"],
        [1650, 515, 360, 28, "float"],
        [2150, 620, 720, 34, "bridge"],
        [3060, 550, 360, 28, "moving", { move: { axis: "y", amp: 70, speed: 1.25 } }],
        [3600, 470, 370, 28, "float"],
        [4140, 620, 760, 34, "bridge"],
        [5040, 530, 420, 28, "float"],
        [5480, 620, 520, 34, "gate"],
        [6160, 620, 1840, 34, "chamber"],
        [640, 445, 300, 28, "float"],
        [2510, 430, 320, 28, "float"],
        [4580, 420, 350, 28, "float"],
        [6790, 452, 480, 28, "boss"]
      ],
      spawns: [
        ["crawler", 640, 620],
        ["drone", 1220, 380],
        ["turret", 1730, 515],
        ["shield", 2280, 620],
        ["drone", 2790, 360],
        ["shield", 3320, 550],
        ["turret", 3840, 470],
        ["crawler", 4270, 620],
        ["drone", 4670, 350],
        ["shield", 5120, 530],
        ["turret", 5580, 520],
        ["shield", 6020, 620],
        ["drone", 6300, 390]
      ],
      shardRows: [[360, 548, 5], [690, 382, 5], [1660, 455, 4], [2470, 370, 5], [3300, 490, 4], [4170, 548, 5], [4620, 360, 5], [5060, 470, 4], [6720, 392, 5]],
      keys: [[730, 372], [2620, 360], [4690, 345]],
      bonuses: [["overdrive", 1460, 510], ["health", 4070, 548], ["health", 5940, 548], ["overdrive", 6810, 392]],
      hazards: [
        { type: "laser", x: 2020, y: 390, w: 34, h: 230, cycle: 2.6, active: 0.72, phase: 0.4 },
        { type: "beam", x: 3500, y: 500, w: 420, h: 38, cycle: 3.4, active: 0.82, phase: 1.1 },
        { type: "floor", x: 4880, y: 620, w: 230, h: 40, cycle: 2.3, active: 0.68, phase: 1.6 }
      ]
    }
  ];

  const PLAYER_ROWS = {
    run: 0,
    runBack: 1,
    jump: 2,
    crouch: 3,
    shoot: 4,
    idle: 5
  };

  const dom = {
    loadingScreen: document.getElementById("loadingScreen"),
    titleScreen: document.getElementById("titleScreen"),
    pauseScreen: document.getElementById("pauseScreen"),
    settingsScreen: document.getElementById("settingsScreen"),
    resultsScreen: document.getElementById("resultsScreen"),
    loadBar: document.getElementById("loadBar"),
    loadText: document.getElementById("loadText"),
    hud: document.getElementById("hud"),
    bossHud: document.getElementById("bossHud"),
    objectiveChip: document.getElementById("objectiveChip"),
    hudTitle: document.getElementById("hudTitle"),
    levelText: document.getElementById("levelText"),
    hpHearts: document.getElementById("hpHearts"),
    livesText: document.getElementById("livesText"),
    scoreText: document.getElementById("scoreText"),
    comboText: document.getElementById("comboText"),
    shardText: document.getElementById("shardText"),
    keyText: document.getElementById("keyText"),
    overdriveBar: document.getElementById("overdriveBar"),
    bossBar: document.getElementById("bossBar"),
    bossName: document.getElementById("bossName"),
    bossPhase: document.getElementById("bossPhase"),
    resultKicker: document.getElementById("resultKicker"),
    resultTitle: document.getElementById("resultTitle"),
    resultCopy: document.getElementById("resultCopy"),
    resultScore: document.getElementById("resultScore"),
    resultTime: document.getElementById("resultTime"),
    resultKills: document.getElementById("resultKills"),
    resultAccuracy: document.getElementById("resultAccuracy"),
    resultDamage: document.getElementById("resultDamage"),
    resultCombo: document.getElementById("resultCombo"),
    resultRank: document.getElementById("resultRank"),
    resultBest: document.getElementById("resultBest"),
    soundToggle: document.getElementById("soundToggle"),
    musicToggle: document.getElementById("musicToggle"),
    motionToggle: document.getElementById("motionToggle"),
    touchToggle: document.getElementById("touchToggle")
  };

  const images = {};
  const assetKeys = Object.keys(ASSETS);
  let loadedAssets = 0;

  let mode = "loading";
  let modeBeforeSettings = "title";
  let run = null;
  let lastTime = performance.now();
  let accumulator = 0;
  let pulseTimer = 0;
  let audioCtx = null;

  const defaults = {
    sound: true,
    music: false,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    touch: window.matchMedia("(pointer: coarse)").matches
  };

  const settings = {
    ...defaults,
    ...readJSON(SETTINGS_KEY, {})
  };

  let bestWasSanitized = false;
  const best = sanitizeBest({
    score: 0,
    fastest: 0,
    highestUnlocked: 1,
    ...readJSON(ACTIVE_STORAGE_KEY, {})
  });
  if (bestWasSanitized) writeJSON(STORAGE_KEY, best);

  const keyboardDown = new Set();
  const keyboardPressed = new Set();
  const keyboardReleased = new Set();
  const touchDown = new Set();
  const touchPressed = new Set();
  const touchReleased = new Set();
  let padDown = new Set();
  let padPressed = new Set();
  let padReleased = new Set();

  const pointer = {
    x: W * 0.75,
    y: H * 0.5,
    activeUntil: 0
  };

  const keyMap = new Map([
    ["ArrowLeft", "left"],
    ["KeyA", "left"],
    ["ArrowRight", "right"],
    ["KeyD", "right"],
    ["ArrowUp", "up"],
    ["KeyW", "up"],
    ["ArrowDown", "down"],
    ["KeyS", "down"],
    ["Space", "jump"],
    ["KeyZ", "fire"],
    ["KeyJ", "fire"],
    ["KeyX", "dash"],
    ["KeyK", "dash"],
    ["ShiftLeft", "dash"],
    ["ShiftRight", "dash"],
    ["KeyE", "overdrive"],
    ["KeyC", "overdrive"],
    ["KeyQ", "overdrive"],
    ["KeyL", "overdrive"],
    ["KeyO", "overdrive"],
    ["Enter", "start"],
    ["Escape", "pause"],
    ["KeyP", "pause"],
    ["KeyM", "settings"]
  ]);

  const colors = {
    gold: "#ffd66d",
    orange: "#f4a82f",
    cream: "#fff3d1",
    pink: "#ff4f9a",
    purple: "#a522ff",
    cyan: "#38dbff",
    red: "#ff7043",
    green: "#8dff9b"
  };

  for (const key of assetKeys) {
    const image = new Image();
    image.onload = image.onerror = () => {
      loadedAssets += 1;
      updateLoading();
      if (loadedAssets >= assetKeys.length && mode === "loading") {
        setMode("title");
      }
    };
    image.src = ASSETS[key];
    images[key] = image;
  }

  applySettings();
  bindInputs();
  if (DEBUG) installDebugPanel();
  updateLoading();
  requestAnimationFrame(loop);

  function readJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") || fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local storage can be unavailable in hardened browsers. The game still runs.
    }
  }

  function sanitizeBest(record) {
    if (!DEBUG && record.fastest && record.fastest < 15) {
      record.fastest = 0;
      if (record.score <= 5000) record.score = 0;
      bestWasSanitized = true;
    }
    return record;
  }

  function bindInputs() {
    window.addEventListener("keydown", (event) => {
      const code = normalizeKey(event);
      const action = keyMap.get(code);
      if (!action) return;
      if (!keyboardDown.has(action)) keyboardPressed.add(action);
      keyboardDown.add(action);
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(code)) {
        event.preventDefault();
      }
      if (action === "start" && mode === "title") startRun();
      if (action === "pause" && mode === "playing") pauseRun();
      else if (action === "pause" && mode === "paused") resumeRun();
    });

    window.addEventListener("keyup", (event) => {
      const action = keyMap.get(normalizeKey(event));
      if (!action) return;
      keyboardDown.delete(action);
      keyboardReleased.add(action);
    });

    window.addEventListener("blur", () => {
      if (mode === "playing") pauseRun();
    });

    canvas.addEventListener("pointermove", (event) => {
      const point = canvasPoint(event);
      pointer.x = point.x;
      pointer.y = point.y;
      pointer.activeUntil = performance.now() + 2800;
    });

    canvas.addEventListener("pointerdown", (event) => {
      initAudio();
      const point = canvasPoint(event);
      pointer.x = point.x;
      pointer.y = point.y;
      pointer.activeUntil = performance.now() + 2800;
      if (mode === "playing" && event.pointerType !== "touch") {
        touchAction("fire", true);
      }
    });

    canvas.addEventListener("pointerup", () => {
      touchAction("fire", false);
    });

    document.querySelectorAll("[data-touch]").forEach((button) => {
      const action = button.dataset.touch;
      const down = (event) => {
        event.preventDefault();
        initAudio();
        touchAction(action, true);
      };
      const up = (event) => {
        event.preventDefault();
        touchAction(action, false);
      };
      button.addEventListener("pointerdown", down);
      button.addEventListener("pointerup", up);
      button.addEventListener("pointercancel", up);
      button.addEventListener("pointerleave", up);
    });

    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        initAudio();
        handleAction(button.dataset.action);
      });
    });

    dom.soundToggle.addEventListener("change", () => updateSetting("sound", dom.soundToggle.checked));
    dom.musicToggle.addEventListener("change", () => updateSetting("music", dom.musicToggle.checked));
    dom.motionToggle.addEventListener("change", () => updateSetting("reducedMotion", dom.motionToggle.checked));
    dom.touchToggle.addEventListener("change", () => updateSetting("touch", dom.touchToggle.checked));
  }

  function installDebugPanel() {
    document.body.classList.add("debug-mode");
    const panel = document.createElement("div");
    panel.className = "debug-panel";
    panel.innerHTML = `
      <button type="button" data-debug="keys">Keys</button>
      <button type="button" data-debug="boss">Boss</button>
      <button type="button" data-debug="sentinel">Defeat</button>
      <button type="button" data-debug="victory">Victory</button>
    `;
    document.querySelector(".game-shell").appendChild(panel);
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-debug]");
      if (!button) return;
      runDebugAction(button.dataset.debug);
    });
  }

  function runDebugAction(action) {
    if (!run || mode === "title" || mode === "results") startRun();
    run.introTimer = 0;
    run.levelCompleteTimer = 0;
    const p = run.player;
    if (action === "keys") {
      run.keys = 3;
      run.gateOpen = true;
      p.x = gateX(run) + 170;
      p.y = 620 - p.standingH;
      p.checkpointX = p.x;
      p.checkpointY = p.y;
      setObjective(run, "Debug: vault gate open", 2);
    }
    if (action === "boss") {
      run.keys = 3;
      run.gateOpen = true;
      p.x = bossStartX(run) + 120;
      p.y = 620 - p.standingH;
      p.checkpointX = p.x;
      p.checkpointY = p.y;
      updateProgression(run);
      setObjective(run, "Debug: boss chamber", 2);
    }
    if (action === "sentinel") {
      if (!run.boss) {
        p.x = bossStartX(run) + 120;
        updateProgression(run);
      }
      if (run.boss && run.boss.hp > 0) defeatBoss(run);
    }
    if (action === "victory") {
      if (!run.bossDefeated) {
        if (!run.boss) {
          p.x = bossStartX(run) + 120;
          updateProgression(run);
        }
        if (run.boss) defeatBoss(run);
      }
      p.x = extractionX(run) + 30;
      if (run.levelIndex < LEVELS.length - 1) completeLevel(run);
      else finishRun(true);
    }
    updateCamera(run);
  }

  function normalizeKey(event) {
    if (event.code && event.code !== "Unidentified") return event.code;
    if (event.key === " ") return "Space";
    if (/^[a-z]$/i.test(event.key)) return `Key${event.key.toUpperCase()}`;
    return event.key || "";
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H
    };
  }

  function touchAction(action, down) {
    if (down) {
      if (!touchDown.has(action)) touchPressed.add(action);
      touchDown.add(action);
    } else {
      touchDown.delete(action);
      touchReleased.add(action);
    }
  }

  function handleAction(action) {
    if (action === "start") startRun();
    if (action === "resume") resumeRun();
    if (action === "pause") pauseRun();
    if (action === "restart") startRun();
    if (action === "title") setMode("title");
    if (action === "settings") openSettings();
    if (action === "close-settings") closeSettings();
  }

  function updateSetting(key, value) {
    settings[key] = value;
    writeJSON(SETTINGS_KEY, settings);
    applySettings();
  }

  function applySettings() {
    dom.soundToggle.checked = settings.sound;
    dom.musicToggle.checked = settings.music;
    dom.motionToggle.checked = settings.reducedMotion;
    dom.touchToggle.checked = settings.touch;
    document.body.classList.toggle("touch-hidden", !settings.touch);
    document.body.classList.toggle("touch-forced", settings.touch);
  }

  function updateLoading() {
    const percent = assetKeys.length ? Math.round((loadedAssets / assetKeys.length) * 100) : 100;
    dom.loadBar.style.width = `${percent}%`;
    dom.loadText.textContent = loadedAssets >= assetKeys.length ? "Vault grid online." : `Preparing assets ${percent}%`;
  }

  function setMode(next) {
    mode = next;
    dom.loadingScreen.classList.toggle("is-hidden", next !== "loading");
    dom.titleScreen.classList.toggle("is-hidden", next !== "title");
    dom.pauseScreen.classList.toggle("is-hidden", next !== "paused");
    dom.settingsScreen.classList.toggle("is-hidden", next !== "settings");
    dom.resultsScreen.classList.toggle("is-hidden", next !== "results");
    dom.hud.classList.toggle("is-hidden", !(next === "playing" || next === "paused" || next === "settings"));
    updateHUD();
  }

  function openSettings() {
    modeBeforeSettings = mode === "playing" ? "paused" : mode;
    if (mode === "playing") modeBeforeSettings = "paused";
    setMode("settings");
  }

  function closeSettings() {
    setMode(modeBeforeSettings || "title");
  }

  function startRun() {
    run = createRun();
    setMode("playing");
    pulseTimer = 0;
    playTone(420, 0.08, "triangle", 0.05);
    playTone(720, 0.10, "sine", 0.035);
  }

  function pauseRun() {
    if (!run || mode !== "playing") return;
    setMode("paused");
  }

  function resumeRun() {
    if (!run) return;
    setMode("playing");
  }

  function createRun() {
    const state = {
      time: 0,
      campaignTime: 0,
      levelIndex: 0,
      level: LEVELS[0],
      levelTime: 0,
      introTimer: 2.6,
      levelCompleteTimer: 0,
      nextLevelIndex: null,
      cameraX: 0,
      platforms: [],
      enemies: [],
      playerShots: [],
      enemyShots: [],
      hazards: [],
      levelHazards: [],
      particles: [],
      pickups: [],
      gateOpen: false,
      gatePulse: 0,
      boss: null,
      bossDefeated: false,
      extractionOpen: false,
      objective: "Collect 3 vault keys",
      objectiveTimer: 4,
      keys: 0,
      shards: 0,
      levelResults: [],
      combo: 0,
      comboTimer: 0,
      stats: {
        score: 0,
        kills: 0,
        shotsFired: 0,
        shotsHit: 0,
        damageTaken: 0,
        maxCombo: 0
      },
      player: {
        x: 118,
        y: 620 - 118,
        w: 56,
        h: 118,
        standingH: 118,
        crouchH: 76,
        vx: 0,
        vy: 0,
        facing: 1,
        hp: 3,
        maxHp: 3,
        lives: 3,
        grounded: false,
        coyote: 0,
        jumpBuffer: 0,
        fireCd: 0,
        dashCd: 0,
        dashTime: 0,
        dashX: 1,
        dashY: 0,
        invuln: 0,
        overdrive: 0,
        overdriveTime: 0,
        checkpointX: 118,
        checkpointY: 620 - 118,
        crouching: false,
        action: "idle",
        aim: { x: 1, y: 0 },
        trail: []
      }
    };

    loadLevel(state, 0, true);
    return state;
  }

  function loadLevel(state, index, fresh = false) {
    const level = LEVELS[index] || LEVELS[0];
    const p = state.player;
    state.levelIndex = index;
    state.level = level;
    state.levelTime = 0;
    state.introTimer = fresh ? 2.8 : 2.35;
    state.levelCompleteTimer = 0;
    state.nextLevelIndex = null;
    state.cameraX = 0;
    state.platforms = buildPlatforms(level);
    state.pickups = buildPickups(level);
    state.enemies = level.spawns.map(([type, x, groundY]) => makeEnemy(type, x, groundY));
    state.playerShots = [];
    state.enemyShots = [];
    state.hazards = [];
    state.levelHazards = level.hazards.map((hazard) => ({ ...hazard, pulse: 0, hitCd: 0 }));
    state.particles = [];
    state.gateOpen = false;
    state.gatePulse = 0;
    state.boss = null;
    state.bossDefeated = false;
    state.extractionOpen = false;
    state.objective = level.objective;
    state.objectiveTimer = 4;
    state.keys = 0;
    state.shards = 0;
    state.combo = 0;
    state.comboTimer = 0;
    p.x = 118;
    p.y = 620 - p.standingH;
    p.vx = 0;
    p.vy = 0;
    p.hp = p.maxHp;
    p.facing = 1;
    p.invuln = fresh ? 0 : 1.2;
    p.overdrive = fresh ? p.overdrive : Math.max(p.overdrive, 42);
    p.overdriveTime = 0;
    p.checkpointX = p.x;
    p.checkpointY = p.y;
    p.crouching = false;
    p.trail = [];
    playTone(360 + level.id * 80, 0.10, "triangle", 0.04);
    addBurst(state, p.x + 28, p.y + 80, colors.gold, 24, 220);
  }

  function buildPlatforms(level) {
    return level.platforms.map(([x, y, w, h, kind, options]) => platform(x, y, w, h, kind, options || {}));
  }

  function platform(x, y, w, h, kind, options = {}) {
    const plat = { x, y, baseX: x, baseY: y, w, h, kind, ...options };
    if (plat.move) {
      plat.move.phase = plat.move.phase || Math.random() * Math.PI * 2;
    }
    return plat;
  }

  function buildPickups(level) {
    const pickups = [];
    for (const [x, y, count] of level.shardRows) {
      for (let i = 0; i < count; i += 1) {
        pickups.push({ type: "shard", x: x + i * 54, y, r: 15, taken: false, bob: i * 0.6 });
      }
    }
    level.keys.forEach(([x, y], index) => pickups.push({ type: "key", x, y, r: 22, taken: false, bob: index * 1.4 }));
    level.bonuses.forEach(([type, x, y], index) => pickups.push({ type, x, y, r: 20, taken: false, bob: index * 0.7 }));
    return pickups;
  }

  function worldWidth(state) {
    return state?.level?.width || WORLD_W;
  }

  function gateX(state) {
    return state?.level?.gateX || GATE_X;
  }

  function bossStartX(state) {
    return state?.level?.bossStartX || BOSS_START_X;
  }

  function extractionX(state) {
    return state?.level?.extractionX || EXTRACTION_X;
  }

  function makeEnemy(type, x, groundY) {
    const base = {
      id: Math.random().toString(36).slice(2),
      type,
      x,
      y: groundY,
      w: 70,
      h: 70,
      vx: 0,
      vy: 0,
      facing: -1,
      hp: 2,
      maxHp: 2,
      cd: 0.5 + Math.random() * 0.8,
      hurt: 0,
      telegraph: 0,
      damageCd: 0,
      dead: false,
      baseY: groundY,
      phase: Math.random() * Math.PI * 2
    };
    if (type === "crawler") {
      base.w = 74;
      base.h = 54;
      base.hp = 2;
      base.maxHp = 2;
      base.y = groundY - base.h;
    }
    if (type === "drone") {
      base.w = 78;
      base.h = 54;
      base.hp = 2;
      base.maxHp = 2;
      base.y = groundY;
      base.baseY = groundY;
    }
    if (type === "shield") {
      base.w = 78;
      base.h = 104;
      base.hp = 5;
      base.maxHp = 5;
      base.y = groundY - base.h;
    }
    if (type === "turret") {
      base.w = 82;
      base.h = 68;
      base.hp = 4;
      base.maxHp = 4;
      base.y = groundY - base.h;
    }
    return base;
  }

  function loop(now) {
    const frameDt = Math.min(0.08, (now - lastTime) / 1000);
    lastTime = now;
    pollGamepad();
    accumulator += frameDt;
    while (accumulator >= STEP) {
      update(STEP);
      accumulator -= STEP;
    }
    render();
    updateHUD();
    clearPressed();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (mode === "title") {
      if (actionPressed("start") || actionPressed("fire")) startRun();
      if (actionPressed("settings")) openSettings();
      return;
    }

    if (mode === "paused") {
      if (actionPressed("pause") || actionPressed("start")) resumeRun();
      if (actionPressed("settings")) openSettings();
      return;
    }

    if (mode === "results") {
      if (actionPressed("start") || actionPressed("fire")) startRun();
      return;
    }

    if (mode !== "playing" || !run) return;

    if (actionPressed("pause")) {
      pauseRun();
      return;
    }
    if (actionPressed("settings")) {
      openSettings();
      return;
    }

    run.time += dt;
    run.campaignTime = run.time;
    run.levelTime += dt;
    updatePulseMusic(dt);
    if (run.introTimer > 0) {
      run.introTimer -= dt;
      updateParticles(run, dt);
      updateCamera(run);
      return;
    }
    if (run.levelCompleteTimer > 0) {
      run.levelCompleteTimer -= dt;
      updateParticles(run, dt);
      if (run.levelCompleteTimer <= 0) {
        if (run.nextLevelIndex !== null) loadLevel(run, run.nextLevelIndex);
        else finishRun(true);
      }
      updateCamera(run);
      return;
    }
    updatePlatforms(run, dt);
    updatePlayer(run, dt);
    updateGate(run, dt);
    updatePickups(run, dt);
    updateEnemies(run, dt);
    updateBoss(run, dt);
    updateProjectiles(run, dt);
    updateLevelHazards(run, dt);
    updateHazards(run, dt);
    updateParticles(run, dt);
    updateProgression(run);
    updateCamera(run);
  }

  function pollGamepad() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    const next = new Set();
    const pad = pads[0];
    if (pad) {
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      if (ax < -0.35) next.add("left");
      if (ax > 0.35) next.add("right");
      if (ay < -0.45) next.add("up");
      if (ay > 0.45) next.add("down");
      const buttons = pad.buttons || [];
      if (buttons[0]?.pressed || buttons[12]?.pressed) next.add("jump");
      if (buttons[2]?.pressed || buttons[7]?.pressed) next.add("fire");
      if (buttons[1]?.pressed || buttons[5]?.pressed) next.add("dash");
      if (buttons[3]?.pressed || buttons[4]?.pressed) next.add("overdrive");
      if (buttons[9]?.pressed) next.add("start");
      if (buttons[8]?.pressed) next.add("pause");
      if (buttons[13]?.pressed) next.add("down");
      if (buttons[14]?.pressed) next.add("left");
      if (buttons[15]?.pressed) next.add("right");
    }
    padPressed = new Set([...next].filter((action) => !padDown.has(action)));
    padReleased = new Set([...padDown].filter((action) => !next.has(action)));
    padDown = next;
  }

  function actionDown(action) {
    return keyboardDown.has(action) || touchDown.has(action) || padDown.has(action);
  }

  function actionPressed(action) {
    return keyboardPressed.has(action) || touchPressed.has(action) || padPressed.has(action);
  }

  function actionReleased(action) {
    return keyboardReleased.has(action) || touchReleased.has(action) || padReleased.has(action);
  }

  function clearPressed() {
    keyboardPressed.clear();
    keyboardReleased.clear();
    touchPressed.clear();
    touchReleased.clear();
    padPressed.clear();
    padReleased.clear();
  }

  function updatePlatforms(state, dt) {
    for (const plat of state.platforms) {
      if (!plat.move) continue;
      const wave = Math.sin(state.levelTime * plat.move.speed + plat.move.phase) * plat.move.amp;
      const oldY = plat.y;
      const oldX = plat.x;
      if (plat.move.axis === "y") plat.y = plat.baseY + wave;
      else plat.x = plat.baseX + wave;
      plat.dx = plat.x - oldX;
      plat.dy = plat.y - oldY;
      const p = state.player;
      if (p.grounded && p.y + p.h <= oldY + 10 && p.x + p.w > plat.x && p.x < plat.x + plat.w) {
        p.x += plat.dx;
        p.y += plat.dy;
      }
    }
  }

  function updateLevelHazards(state, dt) {
    const pbox = playerBox(state.player);
    for (const hazard of state.levelHazards) {
      hazard.hitCd = Math.max(0, (hazard.hitCd || 0) - dt);
      const active = isLevelHazardActive(state, hazard);
      if (!active || hazard.hitCd > 0) continue;
      if (overlap(pbox, levelHazardBox(hazard))) {
        hazard.hitCd = 0.8;
        takeDamage(state, hazard.type === "laser" || hazard.type === "beam" ? 2 : 1, hazard.x);
      }
    }
  }

  function isLevelHazardActive(state, hazard) {
    const t = (state.levelTime + (hazard.phase || 0)) % hazard.cycle;
    return t < hazard.active;
  }

  function isLevelHazardWarning(state, hazard) {
    const t = (state.levelTime + (hazard.phase || 0)) % hazard.cycle;
    return t < hazard.active + 0.45;
  }

  function levelHazardBox(hazard) {
    if (hazard.type === "floor") {
      return { x: hazard.x, y: hazard.y - hazard.h, w: hazard.w, h: hazard.h };
    }
    return { x: hazard.x, y: hazard.y, w: hazard.w, h: hazard.h };
  }

  function updatePlayer(state, dt) {
    const p = state.player;
    const left = actionDown("left");
    const right = actionDown("right");
    const moving = Number(right) - Number(left);
    const wantsCrouch = actionDown("down") && p.grounded && p.dashTime <= 0;
    const oldBottom = p.y + p.h;

    p.crouching = wantsCrouch;
    p.h = wantsCrouch ? p.crouchH : p.standingH;
    p.y = oldBottom - p.h;

    p.fireCd = Math.max(0, p.fireCd - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.overdriveTime = Math.max(0, p.overdriveTime - dt);
    p.aim = getAim(state);
    p.trail.forEach((trail) => trail.t += dt);
    p.trail = p.trail.filter((trail) => trail.t < trail.life);

    if (moving !== 0) p.facing = moving > 0 ? 1 : -1;
    if (p.aim.x > 0.2) p.facing = 1;
    if (p.aim.x < -0.2) p.facing = -1;

    if (actionPressed("jump")) p.jumpBuffer = 0.13;
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    p.coyote = p.grounded ? 0.12 : Math.max(0, p.coyote - dt);

    if (p.jumpBuffer > 0 && (p.grounded || p.coyote > 0) && !p.crouching) {
      p.vy = -850;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      addBurst(state, p.x + p.w * 0.5, p.y + p.h, colors.cyan, 8, 180);
      playTone(560, 0.07, "square", 0.04);
    }

    if (actionReleased("jump") && p.vy < -250) p.vy *= 0.48;

    if (actionPressed("dash") && p.dashCd <= 0) {
      p.dashCd = 0.72;
      p.dashTime = 0.16;
      p.invuln = Math.max(p.invuln, 0.22);
      p.dashX = Math.abs(p.aim.x) > 0.18 ? Math.sign(p.aim.x) : p.facing;
      p.dashY = p.aim.y < -0.45 && !p.grounded ? -0.25 : 0;
      addBurst(state, p.x + p.w * 0.5, p.y + p.h * 0.55, colors.purple, 18, 340);
      playTone(180, 0.05, "sawtooth", 0.05);
    }

    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.vx = p.dashX * 820;
      p.vy = Math.min(p.vy, p.dashY * 520);
      if (!settings.reducedMotion) {
        p.trail.push({
          x: p.x,
          y: p.y,
          h: p.h,
          facing: p.facing,
          t: 0,
          life: 0.18
        });
      }
    } else {
      const max = p.crouching ? 120 : 360;
      const accel = p.grounded ? 2500 : 1450;
      const friction = p.grounded ? 2200 : 760;
      if (moving !== 0 && !p.crouching) p.vx = approach(p.vx, moving * max, accel * dt);
      else p.vx = approach(p.vx, 0, friction * dt);
      p.vy += GRAVITY * dt;
    }

    movePlayer(state, dt);

    if (actionDown("fire") && p.fireCd <= 0) firePlayerShot(state);
    if (actionPressed("overdrive") && p.overdrive >= 100) activateOverdrive(state);

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    if (p.y > H + 160) {
      takeDamage(state, 3, p.x - 60);
      respawnPlayer(state);
    }

    p.action = p.crouching ? "crouch" : "idle";
    if (!p.grounded) p.action = "jump";
    else if (Math.abs(p.vx) > 24) p.action = "run";
    if (p.fireCd > 0.05) p.action = "shoot";
  }

  function movePlayer(state, dt) {
    const p = state.player;
    p.x += p.vx * dt;
    p.x = clamp(p.x, 8, worldWidth(state) - p.w - 10);

    const gx = gateX(state);
    if (!state.gateOpen && p.x + p.w > gx && p.x < gx + 88 && p.y + p.h > 330) {
      p.x = gx - p.w;
      p.vx = Math.min(0, p.vx);
      if (state.keys < 3) setObjective(state, "Gate locked: collect 3 vault keys", 1.4);
    }

    const prevY = p.y;
    p.y += p.vy * dt;
    p.grounded = false;
    for (const plat of state.platforms) {
      if (p.vy >= 0 && p.x + p.w > plat.x + 4 && p.x < plat.x + plat.w - 4) {
        const prevBottom = prevY + p.h;
        const nextBottom = p.y + p.h;
        if (prevBottom <= plat.y + 6 && nextBottom >= plat.y) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.grounded = true;
          if (plat.conveyor) {
            p.x = clamp(p.x + plat.conveyor * dt, 8, worldWidth(state) - p.w - 10);
          }
          if (plat.kind === "float" && actionPressed("jump")) {
            p.vy = -860;
            addBurst(state, p.x + p.w * 0.5, p.y + p.h, colors.cyan, 14, 260);
          }
        }
      }
    }
  }

  function getAim(state) {
    const p = state.player;
    const pointerFresh = performance.now() < pointer.activeUntil && mode === "playing";
    if (pointerFresh) {
      const worldX = pointer.x + state.cameraX;
      const dx = worldX - (p.x + p.w * 0.5);
      const dy = pointer.y - (p.y + p.h * 0.48);
      const length = Math.hypot(dx, dy) || 1;
      return { x: dx / length, y: dy / length };
    }

    let x = 0;
    let y = 0;
    if (actionDown("left")) x -= 1;
    if (actionDown("right")) x += 1;
    if (actionDown("up")) y -= 1;
    if (actionDown("down") && !p.grounded) y += 1;
    if (y !== 0 && x === 0) return { x: 0, y };
    if (x === 0) x = p.facing;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  function firePlayerShot(state) {
    const p = state.player;
    const speed = p.overdriveTime > 0 ? 1040 : 900;
    const strong = p.overdriveTime > 0;
    const muzzleX = p.x + p.w * 0.5 + p.aim.x * 38;
    const muzzleY = p.y + (p.crouching ? p.h * 0.42 : p.h * 0.46) + p.aim.y * 16;
    state.playerShots.push({
      x: muzzleX,
      y: muzzleY,
      vx: p.aim.x * speed,
      vy: p.aim.y * speed,
      w: strong ? 38 : 30,
      h: strong ? 26 : 20,
      life: 1.15,
      damage: strong ? 2 : 1,
      pierce: strong,
      hitIds: new Set()
    });
    p.fireCd = strong ? 0.075 : 0.15;
    state.stats.shotsFired += 1;
    addBurst(state, muzzleX, muzzleY, colors.pink, strong ? 7 : 4, 120);
    playTone(strong ? 920 : 740, 0.045, "triangle", strong ? 0.045 : 0.032);
  }

  function activateOverdrive(state) {
    const p = state.player;
    p.overdrive = 0;
    p.overdriveTime = 4.2;
    p.invuln = Math.max(p.invuln, 0.6);
    addBurst(state, p.x + p.w * 0.5, p.y + p.h * 0.45, colors.pink, 44, 620);
    state.enemies.forEach((enemy) => {
      if (Math.abs(enemy.x - p.x) < 620) damageEnemy(state, enemy, 2, true);
    });
    if (state.boss && Math.abs(state.boss.x - p.x) < 820) damageBoss(state, 4, true);
    setObjective(state, "Heartburst Overdrive online", 1.4);
    playTone(240, 0.1, "sawtooth", 0.06);
    playTone(960, 0.16, "sine", 0.04);
  }

  function updateGate(state, dt) {
    state.gatePulse += dt;
    const gx = gateX(state);
    if (!state.gateOpen && state.keys >= 3 && state.player.x + state.player.w > gx - 90) {
      state.gateOpen = true;
      state.player.checkpointX = gx + 210;
      state.player.checkpointY = 620 - state.player.standingH;
      setObjective(state, "Vault gate open: push to the chamber", 3);
      addBurst(state, gx + 44, 430, colors.gold, 60, 520);
      playTone(320, 0.12, "triangle", 0.06);
      playTone(640, 0.18, "sine", 0.04);
    }
  }

  function updatePickups(state, dt) {
    const pbox = playerBox(state.player);
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      pickup.bob += dt * 3;
      const box = { x: pickup.x - pickup.r, y: pickup.y - pickup.r, w: pickup.r * 2, h: pickup.r * 2 };
      if (overlap(pbox, box)) collectPickup(state, pickup);
    }
  }

  function collectPickup(state, pickup) {
    pickup.taken = true;
    if (pickup.type === "shard") {
      state.shards += 1;
      addScore(state, 45);
      state.player.overdrive = clamp(state.player.overdrive + 4, 0, 100);
      addBurst(state, pickup.x, pickup.y, colors.cyan, 10, 180);
      playTone(1100, 0.035, "sine", 0.025);
    }
    if (pickup.type === "key") {
      state.keys += 1;
      addScore(state, 500);
      state.player.overdrive = clamp(state.player.overdrive + 18, 0, 100);
      setObjective(state, state.keys >= 3 ? "All keys secured: open the vault gate" : `Vault key secured ${state.keys}/3`, 2.4);
      addBurst(state, pickup.x, pickup.y, colors.gold, 28, 340);
      playTone(520, 0.08, "triangle", 0.045);
      playTone(960, 0.12, "sine", 0.035);
    }
    if (pickup.type === "health") {
      state.player.hp = clamp(state.player.hp + 1, 0, state.player.maxHp);
      addBurst(state, pickup.x, pickup.y, colors.pink, 18, 260);
      playTone(700, 0.08, "sine", 0.035);
    }
    if (pickup.type === "overdrive") {
      state.player.overdrive = 100;
      setObjective(state, "Overdrive charged", 1.7);
      addBurst(state, pickup.x, pickup.y, colors.purple, 24, 320);
      playTone(420, 0.08, "sawtooth", 0.045);
    }
  }

  function updateEnemies(state, dt) {
    const p = state.player;
    const pbox = playerBox(p);
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      enemy.hurt = Math.max(0, enemy.hurt - dt);
      enemy.damageCd = Math.max(0, enemy.damageCd - dt);
      enemy.cd -= dt;
      enemy.facing = p.x + p.w * 0.5 < enemy.x + enemy.w * 0.5 ? -1 : 1;

      if (enemy.type === "crawler") updateCrawler(state, enemy, dt);
      if (enemy.type === "drone") updateDrone(state, enemy, dt);
      if (enemy.type === "shield") updateShield(state, enemy, dt);
      if (enemy.type === "turret") updateTurret(state, enemy, dt);

      if (enemy.damageCd <= 0 && overlap(pbox, enemyBox(enemy))) {
        enemy.damageCd = 0.85;
        takeDamage(state, enemy.type === "shield" ? 2 : 1, enemy.x);
      }
    }
    state.enemies = state.enemies.filter((enemy) => !enemy.dead && enemy.x > state.cameraX - 260);
  }

  function updateCrawler(state, enemy, dt) {
    const p = state.player;
    const distance = p.x - enemy.x;
    enemy.vx = clamp(distance * 1.1, -135, 135);
    enemy.x += enemy.vx * dt;
    enemy.y = snapEnemyToGround(state, enemy, enemy.y);
    if (enemy.cd <= 0 && Math.abs(distance) < 380) {
      enemy.cd = 1.4;
      enemy.vx += enemy.facing * 240;
    }
  }

  function updateDrone(state, enemy, dt) {
    enemy.x += Math.sin(state.time * 1.8 + enemy.phase) * 20 * dt;
    enemy.y = enemy.baseY + Math.sin(state.time * 2.4 + enemy.phase) * 24;
    if (enemy.telegraph > 0) {
      enemy.telegraph -= dt;
      if (enemy.telegraph <= 0) {
        fireEnemyShot(state, enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.72, state.player.x + state.player.w * 0.5, state.player.y + 54, 430, colors.purple, 1);
      }
    } else if (enemy.cd <= 0 && Math.abs(enemy.x - state.player.x) < 620) {
      enemy.telegraph = 0.38;
      enemy.cd = 1.55 + Math.random() * 0.5;
    }
  }

  function updateShield(state, enemy, dt) {
    const p = state.player;
    const distance = p.x - enemy.x;
    enemy.vx = clamp(distance * 0.72, -92, 92);
    enemy.x += enemy.vx * dt;
    enemy.y = snapEnemyToGround(state, enemy, enemy.y);
    if (enemy.cd <= 0 && Math.abs(distance) < 180) {
      enemy.cd = 1.15;
      fireEnemyShot(state, enemy.x + enemy.w * 0.5, enemy.y + 50, p.x + p.w * 0.5, p.y + 62, 360, colors.orange, 1);
    }
  }

  function updateTurret(state, enemy, dt) {
    if (enemy.telegraph > 0) {
      enemy.telegraph -= dt;
      if (enemy.telegraph <= 0) {
        const p = state.player;
        fireEnemyShot(state, enemy.x + enemy.w * 0.5, enemy.y + 28, p.x + p.w * 0.5, p.y + 64, 520, colors.red, 1);
      }
    } else if (enemy.cd <= 0 && Math.abs(enemy.x - state.player.x) < 760) {
      enemy.telegraph = 0.55;
      enemy.cd = 1.85;
    }
  }

  function snapEnemyToGround(state, enemy, currentY) {
    const center = enemy.x + enemy.w * 0.5;
    let best = 620;
    for (const plat of state.platforms) {
      if (center > plat.x && center < plat.x + plat.w && plat.y <= best) best = plat.y;
    }
    return approach(currentY, best - enemy.h, 18);
  }

  function updateProjectiles(state, dt) {
    for (const shot of state.playerShots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;

      for (const enemy of state.enemies) {
        if (enemy.dead || shot.hitIds.has(enemy.id)) continue;
        if (overlap(projectileBox(shot), enemyBox(enemy))) {
          shot.hitIds.add(enemy.id);
          state.stats.shotsHit += 1;
          const blocked = enemy.type === "shield" && enemy.facing !== Math.sign(shot.vx || state.player.facing) && state.player.overdriveTime <= 0;
          if (blocked) {
            addBurst(state, shot.x, shot.y, colors.gold, 10, 160);
            shot.life = 0;
            playTone(230, 0.045, "square", 0.03);
          } else {
            damageEnemy(state, enemy, shot.damage, state.player.overdriveTime > 0);
            if (!shot.pierce) shot.life = 0;
          }
          break;
        }
      }

      if (state.boss && state.boss.hp > 0 && overlap(projectileBox(shot), bossBox(state.boss)) && !shot.hitIds.has("boss")) {
        shot.hitIds.add("boss");
        state.stats.shotsHit += 1;
        damageBoss(state, shot.damage, state.player.overdriveTime > 0);
        if (!shot.pierce) shot.life = 0;
      }
    }

    for (const shot of state.enemyShots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (overlap(projectileBox(shot), playerBox(state.player))) {
        shot.life = 0;
        takeDamage(state, shot.damage || 1, shot.x);
      }
    }

    state.playerShots = state.playerShots.filter((shot) => shot.life > 0 && shot.x > state.cameraX - 180 && shot.x < state.cameraX + W + 220 && shot.y > -120 && shot.y < H + 160);
    state.enemyShots = state.enemyShots.filter((shot) => shot.life > 0 && shot.x > state.cameraX - 220 && shot.x < state.cameraX + W + 260 && shot.y > -140 && shot.y < H + 180);
  }

  function damageEnemy(state, enemy, amount, overdriveHit = false) {
    enemy.hp -= amount;
    enemy.hurt = 0.16;
    addBurst(state, enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.45, overdriveHit ? colors.pink : colors.cyan, 12, 220);
    if (enemy.hp <= 0) {
      enemy.dead = true;
      state.stats.kills += 1;
      state.player.overdrive = clamp(state.player.overdrive + 8, 0, 100);
      addCombo(state, 1);
      addScore(state, 220 + state.combo * 28);
      spawnDrop(state, enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.55);
      playTone(130, 0.05, "sawtooth", 0.04);
    } else {
      playTone(510, 0.035, "triangle", 0.03);
    }
  }

  function spawnDrop(state, x, y) {
    if (Math.random() < 0.22 && state.player.hp < state.player.maxHp) {
      state.pickups.push({ type: "health", x, y, r: 18, taken: false, bob: 0 });
    } else {
      for (let i = 0; i < 3; i += 1) {
        state.pickups.push({ type: "shard", x: x + (i - 1) * 24, y: y - 20 - i * 8, r: 12, taken: false, bob: i });
      }
    }
  }

  function fireEnemyShot(state, x, y, targetX, targetY, speed, color, damage) {
    const dx = targetX - x;
    const dy = targetY - y;
    const length = Math.hypot(dx, dy) || 1;
    state.enemyShots.push({
      x,
      y,
      vx: (dx / length) * speed,
      vy: (dy / length) * speed,
      w: 28,
      h: 20,
      life: 2.5,
      color,
      damage
    });
    addBurst(state, x, y, color, 5, 140);
  }

  function updateBoss(state, dt) {
    if (!state.boss) return;
    const boss = state.boss;
    if (boss.hp <= 0) return;

    boss.time += dt;
    boss.hurt = Math.max(0, boss.hurt - dt);
    boss.shieldTime = Math.max(0, boss.shieldTime - dt);
    boss.telegraph = Math.max(0, boss.telegraph - dt);
    boss.y = boss.baseY + Math.sin(boss.time * boss.floatSpeed) * boss.floatAmp;

    const nextPhase = boss.hp <= boss.maxHp * 0.33 ? 3 : boss.hp <= boss.maxHp * 0.66 ? 2 : 1;
    if (nextPhase !== boss.phase) {
      boss.phase = nextPhase;
      boss.attackCd = 0.35;
      boss.telegraph = 0.9;
      boss.shieldTime = boss.kind === "canopyDroneQueen" ? 0.5 : 1.1;
      setObjective(state, `${boss.name} phase ${boss.phase}`, 2);
      addBurst(state, boss.x + boss.w * 0.5, boss.y + boss.h * 0.5, colors.purple, 46, 480);
      playTone(110 - boss.phase * 10, 0.18, "sawtooth", 0.045);
    }

    boss.attackCd -= dt;
    boss.shieldCycle -= dt;
    if (boss.shieldCycle <= 0 && boss.kind !== "canopyDroneQueen") {
      boss.shieldCycle = boss.kind === "jackpotForgeTitan" ? 5.2 : 6.2;
      boss.shieldTime = 1.25;
    }

    if (boss.attackCd <= 0) {
      bossAttack(state, boss);
    }

    if (boss.kind === "midasHeartcoreOverlord" && boss.phase === 3) {
      state.player.overdrive = clamp(state.player.overdrive + dt * 13, 0, 100);
    }

    if (overlap(playerBox(state.player), bossBox(boss))) {
      takeDamage(state, 2, boss.x);
    }
  }

  function bossAttack(state, boss) {
    if (boss.kind === "jackpotForgeTitan") {
      bossAttackForge(state, boss);
      return;
    }
    if (boss.kind === "midasHeartcoreOverlord") {
      bossAttackMidas(state, boss);
      return;
    }
    bossAttackCanopy(state, boss);
  }

  function bossAttackCanopy(state, boss) {
    const p = state.player;
    const speed = boss.phase === 3 ? 470 : 410;
    if (boss.phase === 1) {
      boss.attackName = "Aimed Violet Bolts";
      for (let i = -1; i <= 1; i += 1) {
        fireEnemyShot(state, boss.x + 42, boss.y + 88 + i * 24, p.x + p.w * 0.5, p.y + 58 + i * 18, speed, colors.purple, 1);
      }
      boss.attackCd = 1.45;
    } else if (boss.phase === 2) {
      boss.attackName = "Drone Bloom";
      summonMinion(state, boss);
      summonMinion(state, boss);
      floorHazard(state, p.x + p.w * 0.5 - 80, 160);
      fireEnemyShot(state, boss.x + 34, boss.y + 122, p.x + p.w * 0.5, p.y + 42, speed, colors.orange, 1);
      boss.attackCd = 1.25;
    } else {
      boss.attackName = "Heart Core Sweep";
      for (let i = -2; i <= 2; i += 1) {
        state.enemyShots.push({
          x: boss.x + 44,
          y: boss.y + 116,
          vx: -520,
          vy: i * 72,
          w: 30,
          h: 20,
          life: 1.8,
          color: i === 0 ? colors.pink : colors.purple,
          damage: 1
        });
      }
      floorHazard(state, p.x - 70, 140);
      floorHazard(state, p.x + 150, 120);
      boss.attackCd = 1.02;
    }
  }

  function bossAttackForge(state, boss) {
    const p = state.player;
    if (boss.phase === 1) {
      boss.attackName = "Jackpot Ground Slam";
      boss.telegraph = 0.35;
      state.enemyShots.push(makeShockwave(boss.x + 28, 594, -520));
      state.enemyShots.push(makeShockwave(boss.x + 72, 594, -390));
      floorHazard(state, p.x - 65, 130);
      boss.attackCd = 1.55;
      return;
    }
    if (boss.phase === 2) {
      boss.attackName = "Shielded Mine Launch";
      boss.shieldTime = 0.85;
      for (let i = 0; i < 3; i += 1) {
        state.enemyShots.push({
          x: boss.x + 44,
          y: boss.y + 120 - i * 28,
          vx: -360 - i * 60,
          vy: -120 + i * 95,
          w: 32,
          h: 32,
          life: 2.0,
          color: i === 1 ? colors.gold : colors.purple,
          damage: 1
        });
      }
      boss.attackCd = 1.35;
      return;
    }
    boss.attackName = "Core Triple Spread";
    boss.shieldTime = 0.35;
    for (let i = -1; i <= 1; i += 1) {
      fireEnemyShot(state, boss.x + 64, boss.y + 142, p.x + p.w * 0.5, p.y + 48 + i * 72, 500, i === 0 ? colors.pink : colors.orange, 1);
    }
    state.levelHazards.forEach((hazard) => {
      if (hazard.type === "laser") hazard.phase = (hazard.phase + 0.55) % hazard.cycle;
    });
    boss.attackCd = 1.05;
  }

  function bossAttackMidas(state, boss) {
    const p = state.player;
    if (boss.phase === 1) {
      boss.attackName = "Guardian Core";
      for (let i = -1; i <= 1; i += 1) {
        fireEnemyShot(state, boss.x + 90, boss.y + 112 + i * 34, p.x + p.w * 0.5, p.y + 50, 400, colors.pink, 1);
      }
      floorHazard(state, p.x - 100, 200);
      boss.attackCd = 1.45;
      return;
    }
    if (boss.phase === 2) {
      boss.attackName = "Lotto Storm";
      const cx = boss.x + boss.w * 0.4;
      const cy = boss.y + boss.h * 0.45;
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2 + boss.time;
        state.enemyShots.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * 260,
          vy: Math.sin(a) * 260,
          w: 24,
          h: 24,
          life: 2.1,
          color: i % 2 ? colors.gold : colors.purple,
          damage: 1
        });
      }
      summonMinion(state, boss);
      boss.shieldTime = 0.75;
      boss.attackCd = 1.65;
      return;
    }
    boss.attackName = "Overdrive Beam";
    for (let i = -2; i <= 2; i += 1) {
      fireEnemyShot(state, boss.x + 100, boss.y + 150 + i * 24, p.x + p.w * 0.5, p.y + 50 + i * 26, 560, i === 0 ? colors.pink : colors.cyan, 1);
    }
    floorHazard(state, p.x - 140, 280);
    state.hazards.push({ x: p.x - 60, y: 430, w: 420, h: 38, charge: 0.75, life: 1.55, hit: false, beam: true });
    boss.attackCd = boss.hp <= boss.maxHp * 0.16 ? 0.95 : 1.18;
  }

  function makeShockwave(x, y, vx) {
    return { x, y, vx, vy: 0, w: 78, h: 26, life: 2.3, color: colors.orange, damage: 1 };
  }

  function summonMinion(state, boss) {
    if (state.enemies.filter((enemy) => enemy.x > bossStartX(state) - 160).length > 5) return;
    const type = boss.kind === "midasHeartcoreOverlord" || boss.phase === 3 ? "drone" : "crawler";
    const x = boss.x - 450 - Math.random() * 160;
    const y = type === "drone" ? 420 : 620;
    state.enemies.push(makeEnemy(type, x, y));
  }

  function floorHazard(state, x, w) {
    state.hazards.push({
      x: clamp(x, bossStartX(state) - 120, worldWidth(state) - 360),
      y: 620,
      w,
      h: 48,
      charge: 0.55,
      life: 1.35,
      hit: false
    });
  }

  function damageBoss(state, amount, overdriveHit = false) {
    const boss = state.boss;
    if (!boss || boss.hp <= 0) return;
    if (boss.shieldTime > 0 && !overdriveHit) {
      addBurst(state, boss.x + 24, boss.y + boss.h * 0.48, colors.gold, 15, 220);
      playTone(180, 0.05, "square", 0.035);
      return;
    }
    boss.hp -= amount;
    boss.hurt = 0.18;
    addBurst(state, boss.x + boss.w * 0.34, boss.y + boss.h * 0.45, overdriveHit ? colors.pink : colors.cyan, 20, 300);
    playTone(380, 0.045, "triangle", 0.034);
    if (boss.hp <= 0) defeatBoss(state);
  }

  function defeatBoss(state) {
    const boss = state.boss;
    boss.hp = 0;
    state.bossDefeated = true;
    state.extractionOpen = true;
    addScore(state, 5000);
    addCombo(state, 3);
    addBurst(state, boss.x + boss.w * 0.5, boss.y + boss.h * 0.5, colors.gold, 90, 720);
    setObjective(state, "Sentinel down: reach the extraction portal", 4);
    playTone(180, 0.08, "sawtooth", 0.05);
    playTone(760, 0.16, "sine", 0.05);
  }

  function updateHazards(state, dt) {
    for (const hazard of state.hazards) {
      hazard.life -= dt;
      hazard.charge -= dt;
      const box = hazard.beam ? { x: hazard.x, y: hazard.y, w: hazard.w, h: hazard.h } : { x: hazard.x, y: hazard.y - hazard.h, w: hazard.w, h: hazard.h };
      if (hazard.charge <= 0 && !hazard.hit && overlap(playerBox(state.player), box)) {
        hazard.hit = true;
        takeDamage(state, hazard.beam ? 2 : 1, hazard.x);
      }
    }
    state.hazards = state.hazards.filter((hazard) => hazard.life > 0);
  }

  function updateParticles(state, dt) {
    for (const particle of state.particles) {
      particle.t += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 360 * dt;
    }
    state.particles = state.particles.filter((particle) => particle.t < particle.life);
  }

  function updateProgression(state) {
    const p = state.player;
    if (state.objectiveTimer > 0) state.objectiveTimer -= STEP;
    updateCheckpoints(state);

    if (!state.boss && state.gateOpen && p.x > bossStartX(state)) {
      state.boss = makeBoss(state);
      p.checkpointX = bossStartX(state) + 70;
      p.checkpointY = 620 - p.standingH;
      setObjective(state, `Defeat ${state.boss.name}`, 3.5);
      playTone(120, 0.12, "sawtooth", 0.055);
      playTone(70, 0.22, "triangle", 0.045);
    }

    if (state.extractionOpen && p.x + p.w * 0.5 > extractionX(state)) {
      completeLevel(state);
    }
  }

  function updateCheckpoints(state) {
    const p = state.player;
    const marks = [1500, 3000, Math.max(3600, gateX(state) - 420), bossStartX(state) + 70];
    for (const mark of marks) {
      if (p.x > mark && p.checkpointX < mark && (!state.boss || mark <= bossStartX(state) + 70)) {
        p.checkpointX = mark;
        p.checkpointY = 620 - p.standingH;
        if (state.objectiveTimer <= 0.3) setObjective(state, "Checkpoint synced", 1.4);
        addBurst(state, p.x + p.w * 0.5, p.y + p.h * 0.5, colors.cyan, 12, 160);
      }
    }
  }

  function makeBoss(state) {
    const level = state.level;
    const finalBoss = level.boss === "midasHeartcoreOverlord";
    const forgeBoss = level.boss === "jackpotForgeTitan";
    const w = finalBoss ? 370 : forgeBoss ? 310 : 260;
    const h = finalBoss ? 360 : forgeBoss ? 330 : 250;
    const maxHp = finalBoss ? 220 : forgeBoss ? 118 : 68;
    return {
      kind: level.boss,
      name: level.bossName,
      imageKey: level.bossImage,
      x: clamp(level.bossStartX + (finalBoss ? 820 : 850), level.bossStartX + 520, level.width - w - 130),
      y: finalBoss ? 235 : forgeBoss ? 292 : 290,
      baseY: finalBoss ? 235 : forgeBoss ? 292 : 290,
      w,
      h,
      hp: maxHp,
      maxHp,
      phase: 1,
      time: 0,
      hurt: 0,
      telegraph: 1.15,
      shieldTime: 0,
      shieldCycle: forgeBoss ? 3.2 : 4.8,
      attackCd: 1.2,
      attackName: finalBoss ? "Guardian Core" : forgeBoss ? "Ground Slam" : "Aimed Violet Bolts",
      floatAmp: forgeBoss ? 6 : 18,
      floatSpeed: forgeBoss ? 0.65 : 1.4
    };
  }

  function completeLevel(state) {
    if (state.levelCompleteTimer > 0) return;
    const finalLevel = state.levelIndex >= LEVELS.length - 1;
    state.levelResults.push({
      id: state.level.id,
      title: state.level.title,
      time: state.levelTime,
      score: state.stats.score,
      kills: state.stats.kills,
      combo: state.stats.maxCombo
    });
    best.highestUnlocked = Math.max(best.highestUnlocked || 1, finalLevel ? LEVELS.length : state.levelIndex + 2);
    if (state.stats.score > best.score) best.score = state.stats.score;
    writeJSON(ACTIVE_STORAGE_KEY, best);
    state.levelCompleteTimer = finalLevel ? 2.2 : 3.3;
    state.nextLevelIndex = finalLevel ? null : state.levelIndex + 1;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.overdrive = Math.max(state.player.overdrive, finalLevel ? state.player.overdrive : 100);
    setObjective(state, finalLevel ? "Final vault core defeated" : `${state.level.shortName} clear`, 2.8);
    addBurst(state, state.player.x + state.player.w * 0.5, state.player.y + 52, colors.gold, finalLevel ? 90 : 52, 620);
    playTone(finalLevel ? 180 : 260, 0.20, "triangle", 0.055);
    playTone(finalLevel ? 520 : 720, 0.18, "sine", 0.04);
  }

  function updateCamera(state) {
    const p = state.player;
    let target = p.x - 350;
    if (state.boss && !state.bossDefeated) target = clamp(target, bossStartX(state) - 220, worldWidth(state) - W);
    state.cameraX = approach(state.cameraX, clamp(target, 0, worldWidth(state) - W), 14);
  }

  function addScore(state, amount) {
    state.stats.score += Math.round(amount);
  }

  function addCombo(state, amount) {
    state.combo += amount;
    state.comboTimer = 3.1;
    state.stats.maxCombo = Math.max(state.stats.maxCombo, state.combo);
  }

  function setObjective(state, text, seconds) {
    state.objective = text;
    state.objectiveTimer = seconds;
  }

  function takeDamage(state, amount, sourceX) {
    const p = state.player;
    if (p.invuln > 0 || p.dashTime > 0 || p.overdriveTime > 0) return;
    p.hp -= amount;
    p.invuln = 1.05;
    state.combo = 0;
    state.comboTimer = 0;
    state.stats.damageTaken += amount;
    addBurst(state, p.x + p.w * 0.5, p.y + p.h * 0.55, colors.red, 24, 340);
    p.vx = sourceX < p.x ? 260 : -260;
    p.vy = -310;
    playTone(90, 0.08, "sawtooth", 0.05);

    if (p.hp <= 0) {
      p.lives -= 1;
      if (p.lives <= 0) {
        finishRun(false);
      } else {
        respawnPlayer(state);
      }
    }
  }

  function respawnPlayer(state) {
    const p = state.player;
    p.hp = p.maxHp;
    p.x = p.checkpointX;
    p.y = p.checkpointY;
    p.vx = 0;
    p.vy = 0;
    p.invuln = 1.6;
    p.dashTime = 0;
    p.crouching = false;
    setObjective(state, "Checkpoint restored", 1.5);
  }

  function finishRun(victory) {
    if (!run) return;
    const stats = run.stats;
    const elapsed = run.time;
    const accuracy = stats.shotsFired ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0;
    const rank = rankRun(victory, stats, elapsed, accuracy);
    if (stats.score > best.score) best.score = stats.score;
    if (victory && (!best.fastest || elapsed < best.fastest)) best.fastest = elapsed;
    if (victory) best.highestUnlocked = LEVELS.length;
    writeJSON(ACTIVE_STORAGE_KEY, best);

    dom.resultKicker.textContent = victory ? "Final Victory" : "Run Failed";
    dom.resultTitle.textContent = victory ? "Midas Heartcore Offline" : "Vault Overrun";
    dom.resultCopy.textContent = victory ? "LottoMind cleared all three vault sectors and escaped through the final portal." : "The vault reset at the last checkpoint. Replay to crack the route.";
    dom.resultScore.textContent = String(stats.score);
    dom.resultTime.textContent = formatTime(elapsed);
    dom.resultKills.textContent = String(stats.kills);
    dom.resultAccuracy.textContent = `${accuracy}%`;
    dom.resultDamage.textContent = String(stats.damageTaken);
    dom.resultCombo.textContent = String(stats.maxCombo);
    dom.resultRank.textContent = rank;
    dom.resultBest.textContent = best.fastest ? `${best.score} / ${formatTime(best.fastest)}` : String(best.score);
    setMode("results");
  }

  function rankRun(victory, stats, elapsed, accuracy) {
    let points = 0;
    if (victory) points += 4;
    if (stats.score >= 12000) points += 2;
    if (stats.maxCombo >= 12) points += 2;
    if (accuracy >= 55) points += 1;
    if (stats.damageTaken <= 4) points += 1;
    if (elapsed <= 210) points += 1;
    if (points >= 9) return "S";
    if (points >= 7) return "A";
    if (points >= 5) return "B";
    return victory ? "C" : "D";
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (mode === "loading") {
      drawLoadingCanvas();
      return;
    }
    if (!run) {
      drawTitleCanvas();
      return;
    }
    drawGame(run);
    if (mode === "title") drawTitleCanvas();
  }

  function drawLoadingCanvas() {
    ctx.fillStyle = "#030302";
    ctx.fillRect(0, 0, W, H);
    drawCover(images.hero, 0, 0, 0.5);
    ctx.fillStyle = "rgba(0,0,0,.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = colors.gold;
    ctx.font = "900 28px system-ui";
    ctx.fillText("LOADING SHADOW OPS", 470, 364);
  }

  function drawTitleCanvas() {
    if (!drawCover(images.hero, 0, 0, 1)) {
      drawBackground(0, 0);
    }
    const wash = ctx.createLinearGradient(0, 0, W, 0);
    wash.addColorStop(0, "rgba(0,0,0,.76)");
    wash.addColorStop(0.44, "rgba(0,0,0,.42)");
    wash.addColorStop(0.72, "rgba(0,0,0,.08)");
    wash.addColorStop(1, "rgba(0,0,0,.70)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGame(state) {
    drawBackground(state);
    ctx.save();
    ctx.translate(-state.cameraX, 0);
    drawPlatforms(state);
    drawGate(state);
    drawExtraction(state);
    drawPickups(state);
    drawLevelHazards(state);
    drawHazards(state);
    drawEnemyShots(state);
    drawPlayerShots(state);
    drawEnemies(state);
    drawBoss(state);
    drawParticles(state);
    drawPlayer(state);
    ctx.restore();
    if (state.objectiveTimer > 0) {
      dom.objectiveChip.textContent = state.objective;
      dom.objectiveChip.classList.remove("is-hidden");
    } else {
      dom.objectiveChip.classList.add("is-hidden");
    }
    drawLevelOverlay(state);
  }

  function drawBackground(stateOrCameraX, timeArg = 0) {
    const state = typeof stateOrCameraX === "object" ? stateOrCameraX : null;
    const cameraX = state ? state.cameraX : stateOrCameraX;
    const time = state ? state.time : timeArg;
    const bgKey = state?.level?.background;
    ctx.fillStyle = "#030302";
    ctx.fillRect(0, 0, W, H);
    if (bgKey && images[bgKey]) {
      drawCover(images[bgKey], -cameraX * 0.08, Math.sin(time * 0.22) * 2, 0.94);
    } else {
      drawCover(images.backplate, -cameraX * 0.08, 0, 0.88);
      drawCover(images.foreground, -cameraX * 0.18, Math.sin(time * 0.35) * 4, 0.96);
    }
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const amber = ctx.createRadialGradient(W * 0.78, H * 0.5, 20, W * 0.78, H * 0.5, 520);
    amber.addColorStop(0, "rgba(255, 112, 67, .12)");
    amber.addColorStop(0.42, "rgba(165, 34, 255, .10)");
    amber.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = amber;
    ctx.fillRect(0, 0, W, H);
    const vaultGlow = ctx.createRadialGradient(W * 0.46, H * 0.54, 30, W * 0.46, H * 0.54, 620);
    vaultGlow.addColorStop(0, "rgba(56, 219, 255, .10)");
    vaultGlow.addColorStop(0.36, "rgba(96, 62, 195, .10)");
    vaultGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = vaultGlow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, "rgba(0,0,0,.04)");
    shade.addColorStop(0.58, "rgba(0,0,0,.04)");
    shade.addColorStop(1, "rgba(0,0,0,.36)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
  }

  function drawLevelOverlay(state) {
    if (state.introTimer <= 0 && state.levelCompleteTimer <= 0) return;
    const intro = state.introTimer > 0;
    const t = intro ? state.introTimer : state.levelCompleteTimer;
    const alpha = clamp(t / 0.45, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(0,0,0,.56)";
    ctx.fillRect(0, 0, W, H);
    const frame = images.levelFrame;
    if (frame?.complete && frame.naturalWidth) {
      ctx.globalAlpha = alpha * 0.92;
      ctx.drawImage(frame, 185, 122, 910, 508);
    } else {
      ctx.strokeStyle = colors.gold;
      ctx.lineWidth = 4;
      roundedRect(250, 178, 780, 360, 10, false, true);
    }
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = colors.gold;
    ctx.font = "900 26px system-ui";
    ctx.fillText(intro ? `LEVEL ${state.level.id}` : "LEVEL COMPLETE", W * 0.5, 272);
    ctx.fillStyle = "#fff3d1";
    ctx.font = "900 48px system-ui";
    ctx.fillText(state.level.title, W * 0.5, 330);
    ctx.fillStyle = colors.pink;
    ctx.font = "800 24px system-ui";
    ctx.fillText(intro ? state.level.objective : state.nextLevelIndex === null ? "FINAL PORTAL OPENING" : `NEXT: ${LEVELS[state.nextLevelIndex].title}`, W * 0.5, 378);
    ctx.fillStyle = "rgba(255,243,209,.82)";
    ctx.font = "700 18px system-ui";
    const copy = intro ? `${state.level.bossName} guards the chamber.` : `Score ${String(state.stats.score).padStart(6, "0")}  |  Combo x${state.stats.maxCombo}  |  Time ${formatTime(state.time)}`;
    ctx.fillText(copy, W * 0.5, 426);
    if (!intro && state.nextLevelIndex === null && images.victoryBadge?.complete) {
      ctx.drawImage(images.victoryBadge, W * 0.5 - 62, 452, 124, 124);
    }
    ctx.restore();
  }

  function drawCover(image, xOffset, yOffset, alpha = 1) {
    if (!image.complete || !image.naturalWidth) return false;
    const scale = Math.max(W / image.naturalWidth, H / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    const baseY = (H - dh) / 2 + yOffset;
    let start = ((xOffset % dw) + dw) % dw;
    start = -start;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let x = start - dw; x < W + dw; x += dw) {
      ctx.drawImage(image, x, baseY, dw, dh);
    }
    ctx.restore();
    return true;
  }

  function drawPlatforms(state) {
    const palette = state.level?.palette || { platform: "#282024", trim: colors.gold, glow: colors.purple };
    for (const plat of state.platforms) {
      if (plat.x + plat.w < state.cameraX - 120 || plat.x > state.cameraX + W + 120) continue;
      const g = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h + 48);
      g.addColorStop(0, palette.platform);
      g.addColorStop(0.46, "#100c11");
      g.addColorStop(1, "#070608");
      ctx.fillStyle = g;
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h + 26);
      ctx.strokeStyle = "rgba(255,214,109,.72)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(plat.x, plat.y + 2);
      ctx.lineTo(plat.x + plat.w, plat.y + 2);
      ctx.stroke();
      if (plat.kind === "conveyor") {
        ctx.strokeStyle = colors.pink;
        ctx.lineWidth = 2;
        for (let x = plat.x + ((state.levelTime * Math.abs(plat.conveyor || 80)) % 52); x < plat.x + plat.w; x += 52) {
          ctx.beginPath();
          ctx.moveTo(x, plat.y + 14);
          ctx.lineTo(x + Math.sign(plat.conveyor || 1) * 22, plat.y + 14);
          ctx.stroke();
        }
      }
      if (plat.kind === "moving" || plat.kind === "float") {
        ctx.fillStyle = "rgba(56,219,255,.18)";
        ctx.fillRect(plat.x, plat.y + plat.h + 8, plat.w, 8);
      }
      ctx.strokeStyle = "rgba(255,214,109,.28)";
      ctx.lineWidth = 1;
      for (let x = plat.x + 28; x < plat.x + plat.w; x += 92) {
        ctx.strokeRect(x, plat.y + 10, 42, 12);
        ctx.beginPath();
        ctx.moveTo(x + 42, plat.y + 16);
        ctx.lineTo(Math.min(plat.x + plat.w, x + 78), plat.y + 16);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(122, 93, 42, .5)";
      for (let x = plat.x + 62; x < plat.x + plat.w; x += 180) {
        ctx.fillRect(x, plat.y + plat.h - 2, 8, 36);
        ctx.fillRect(x + 12, plat.y + plat.h + 10, 6, 25);
      }
    }
  }

  function drawGate(state) {
    const openLift = state.gateOpen ? 265 : 0;
    const pulse = 0.55 + Math.sin(state.gatePulse * 6) * 0.18;
    const gx = gateX(state);
    ctx.save();
    ctx.translate(gx, 330 - openLift);
    ctx.fillStyle = "rgba(6,5,8,.92)";
    ctx.fillRect(0, 0, 92, 292);
    ctx.strokeStyle = state.gateOpen ? colors.cyan : colors.gold;
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 6, 82, 282);
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = state.keys >= 3 ? colors.cyan : colors.pink;
    ctx.lineWidth = 3;
    for (let y = 38; y < 250; y += 42) {
      ctx.beginPath();
      ctx.moveTo(16, y);
      ctx.lineTo(44, y);
      ctx.lineTo(70, y + 18);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawExtraction(state) {
    if (!state.extractionOpen) return;
    const t = state.time;
    const x = extractionX(state);
    const y = 468;
    const g = ctx.createRadialGradient(x, y, 12, x, y, 118 + Math.sin(t * 4) * 8);
    g.addColorStop(0, "rgba(255,243,209,.95)");
    g.addColorStop(0.25, "rgba(255,79,154,.78)");
    g.addColorStop(0.58, "rgba(56,219,255,.34)");
    g.addColorStop(1, "rgba(86,28,180,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, 88, 132, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.gold;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y, 70 + Math.sin(t * 5) * 8, 112, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const y = pickup.y + Math.sin(pickup.bob) * 8;
      if (pickup.x < state.cameraX - 100 || pickup.x > state.cameraX + W + 100) continue;
      if (pickup.type === "shard") drawShard(pickup.x, y, pickup.r);
      if (pickup.type === "key") drawKey(pickup.x, y, pickup.r);
      if (pickup.type === "health") drawHeart(pickup.x, y, pickup.r, colors.pink);
      if (pickup.type === "overdrive") drawOverdrivePickup(pickup.x, y, pickup.r);
    }
  }

  function drawShard(x, y, r) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r * 2);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, colors.cyan);
    g.addColorStop(1, "rgba(56,219,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.cyan;
    ctx.strokeStyle = colors.cream;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.8, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.8, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawKey(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(255,214,109,.16)";
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.gold;
    ctx.lineWidth = 4;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, 0);
    ctx.lineTo(r * 0.6, 0);
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(0, r * 0.55);
    ctx.stroke();
    ctx.restore();
  }

  function drawHeart(x, y, r, color) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 1, x, y, r * 2.8);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.32, color);
    g.addColorStop(1, "rgba(255,79,154,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.strokeStyle = colors.cream;
    ctx.lineWidth = 2;
    ctx.beginPath();
    heartPath(x, y + r * 0.1, r * 0.72, 1);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawOverdrivePickup(x, y, r) {
    ctx.save();
    ctx.strokeStyle = colors.purple;
    ctx.fillStyle = "rgba(165,34,255,.24)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.gold;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - r);
    ctx.lineTo(x - r * 0.5, y + 2);
    ctx.lineTo(x + r * 0.12, y + 2);
    ctx.lineTo(x - 2, y + r);
    ctx.lineTo(x + r * 0.58, y - 2);
    ctx.lineTo(x - r * 0.08, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawLevelHazards(state) {
    for (const hazard of state.levelHazards) {
      const active = isLevelHazardActive(state, hazard);
      const warning = isLevelHazardWarning(state, hazard);
      const box = levelHazardBox(hazard);
      ctx.save();
      ctx.globalAlpha = active ? 0.95 : warning ? 0.62 : 0.22;
      if (hazard.type === "floor") {
        const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
        g.addColorStop(0, active ? "rgba(255,79,154,.74)" : "rgba(255,214,109,.25)");
        g.addColorStop(1, "rgba(165,34,255,.12)");
        ctx.fillStyle = g;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeStyle = active ? colors.pink : colors.gold;
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
      } else {
        ctx.fillStyle = active ? "rgba(255,79,154,.42)" : "rgba(255,214,109,.14)";
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeStyle = active ? colors.pink : colors.gold;
        ctx.lineWidth = hazard.type === "beam" ? 5 : 3;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        if (active) {
          ctx.globalCompositeOperation = "screen";
          ctx.fillStyle = "rgba(165,34,255,.24)";
          ctx.fillRect(box.x - 18, box.y - 18, box.w + 36, box.h + 36);
        }
      }
      ctx.restore();
    }
  }

  function drawHazards(state) {
    for (const hazard of state.hazards) {
      const active = hazard.charge <= 0;
      const y = hazard.beam ? hazard.y : hazard.y - hazard.h;
      ctx.fillStyle = active ? "rgba(255,79,154,.46)" : "rgba(255,214,109,.22)";
      ctx.fillRect(hazard.x, y, hazard.w, hazard.h);
      ctx.strokeStyle = active ? colors.pink : colors.gold;
      ctx.lineWidth = 3;
      ctx.strokeRect(hazard.x, y, hazard.w, hazard.h);
      if (active && !hazard.beam) {
        const g = ctx.createLinearGradient(0, hazard.y - 220, 0, hazard.y);
        g.addColorStop(0, "rgba(255,79,154,0)");
        g.addColorStop(1, "rgba(255,79,154,.44)");
        ctx.fillStyle = g;
        ctx.fillRect(hazard.x, hazard.y - 220, hazard.w, 220);
      }
    }
  }

  function drawPlayerShots(state) {
    for (const shot of state.playerShots) {
      const angle = Math.atan2(shot.vy, shot.vx);
      ctx.save();
      ctx.translate(shot.x, shot.y);
      ctx.rotate(angle);
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, shot.w);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, colors.pink);
      g.addColorStop(1, "rgba(255,79,154,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, shot.w, shot.h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.pink;
      ctx.strokeStyle = colors.cream;
      ctx.lineWidth = 2;
      ctx.beginPath();
      heartPath(0, 1, shot.h * 0.58, 1);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemyShots(state) {
    for (const shot of state.enemyShots) {
      const g = ctx.createRadialGradient(shot.x, shot.y, 1, shot.x, shot.y, 28);
      g.addColorStop(0, "#fff7cf");
      g.addColorStop(0.38, shot.color || colors.purple);
      g.addColorStop(1, "rgba(165,34,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shot.color || colors.purple;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(shot.x - Math.sign(shot.vx || 1) * 22, shot.y);
      ctx.lineTo(shot.x + Math.sign(shot.vx || 1) * 12, shot.y);
      ctx.stroke();
    }
  }

  function drawEnemies(state) {
    for (const enemy of state.enemies) {
      if (enemy.x + enemy.w < state.cameraX - 120 || enemy.x > state.cameraX + W + 120) continue;
      if (enemy.type === "crawler") drawCrawler(enemy, state.time);
      if (enemy.type === "drone") drawDrone(enemy, state.time);
      if (enemy.type === "shield") drawShield(enemy, state.time);
      if (enemy.type === "turret") drawTurret(enemy, state.time);
      drawEnemyHealth(enemy);
    }
  }

  function drawCrawler(enemy, time) {
    const bob = Math.sin(time * 12 + enemy.phase) * 3;
    ctx.save();
    ctx.translate(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.5 + bob);
    ctx.fillStyle = enemy.hurt > 0 ? "#ffffff" : "#121016";
    ctx.strokeStyle = colors.purple;
    ctx.lineWidth = 3;
    roundedRect(-36, -22, 72, 42, 8, true, true);
    ctx.fillStyle = colors.gold;
    ctx.fillRect(enemy.facing > 0 ? 8 : -20, -8, 18, 8);
    ctx.strokeStyle = "rgba(255,214,109,.72)";
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(i * 18, 16);
      ctx.lineTo(i * 34, 28);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDrone(enemy, time) {
    ctx.save();
    ctx.translate(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.5);
    ctx.fillStyle = enemy.hurt > 0 ? "#ffffff" : "#0f0d14";
    ctx.strokeStyle = enemy.telegraph > 0 ? colors.pink : colors.purple;
    ctx.lineWidth = 3;
    roundedRect(-30, -20, 60, 40, 8, true, true);
    ctx.fillStyle = colors.gold;
    ctx.fillRect(-12, -2, 24, 8);
    ctx.strokeStyle = colors.purple;
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.ellipse(i * 46, -18 + Math.sin(time * 9) * 3, 22, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i * 30, -6);
      ctx.lineTo(i * 46, -18);
      ctx.stroke();
    }
    if (enemy.telegraph > 0) {
      ctx.strokeStyle = "rgba(255,79,154,.7)";
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(0, 58);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShield(enemy, time) {
    const useAtlas = images.enemy.complete && images.enemy.naturalWidth;
    if (useAtlas) {
      drawAtlas(images.enemy, 16, Math.floor(time * 10) % 8, enemy.x + enemy.w * 0.5, enemy.y + enemy.h + 18, 0.62, enemy.facing > 0, enemy.hurt > 0 ? 0.55 : 0.88);
    }
    ctx.save();
    ctx.translate(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.55);
    ctx.scale(enemy.facing, 1);
    ctx.globalAlpha = useAtlas ? 0.9 : 1;
    if (!useAtlas) {
      ctx.fillStyle = enemy.hurt > 0 ? "#ffffff" : "#15121a";
      ctx.strokeStyle = colors.gold;
      ctx.lineWidth = 3;
      roundedRect(-24, -48, 48, 90, 8, true, true);
      ctx.fillStyle = colors.gold;
      ctx.fillRect(-10, -28, 20, 8);
    }
    ctx.strokeStyle = colors.purple;
    ctx.fillStyle = "rgba(165,34,255,.22)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-2, -40);
    ctx.lineTo(42, -22);
    ctx.lineTo(38, 32);
    ctx.lineTo(-2, 46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawTurret(enemy, time) {
    ctx.save();
    ctx.translate(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.5);
    ctx.fillStyle = enemy.hurt > 0 ? "#ffffff" : "#100d13";
    ctx.strokeStyle = enemy.telegraph > 0 ? colors.red : colors.gold;
    ctx.lineWidth = 3;
    roundedRect(-38, -28, 76, 56, 8, true, true);
    ctx.strokeStyle = colors.purple;
    ctx.beginPath();
    ctx.arc(0, 0, 18 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = colors.gold;
    ctx.fillRect(-46, -5, 22, 10);
    if (enemy.telegraph > 0) {
      ctx.strokeStyle = "rgba(255,112,67,.55)";
      ctx.beginPath();
      ctx.moveTo(-46, 0);
      ctx.lineTo(-480, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemyHealth(enemy) {
    if (enemy.hp >= enemy.maxHp) return;
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(enemy.x, enemy.y - 12, enemy.w, 5);
    ctx.fillStyle = enemy.type === "shield" ? colors.gold : colors.pink;
    ctx.fillRect(enemy.x, enemy.y - 12, enemy.w * Math.max(0, enemy.hp / enemy.maxHp), 5);
  }

  function drawBoss(state) {
    const boss = state.boss;
    if (!boss || boss.hp <= 0) return;
    const image = images[boss.imageKey];
    ctx.save();
    ctx.translate(boss.x + boss.w * 0.5, boss.y + boss.h * 0.5);
    const hurt = boss.hurt > 0;
    const glow = ctx.createRadialGradient(0, 0, 12, 0, 0, Math.max(boss.w, boss.h) * 0.72);
    glow.addColorStop(0, boss.phase === 3 ? "rgba(255,79,154,.34)" : "rgba(165,34,255,.24)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, boss.w * 0.72, boss.h * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    if (boss.telegraph > 0) {
      ctx.strokeStyle = `rgba(255,214,109,${0.2 + boss.telegraph * 0.45})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, 0, boss.w * (0.56 + boss.telegraph * 0.18), boss.h * (0.48 + boss.telegraph * 0.12), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (image?.complete && image.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = hurt ? 0.74 : 1;
      ctx.shadowColor = boss.phase === 3 ? colors.pink : colors.purple;
      ctx.shadowBlur = boss.phase === 3 ? 32 : 20;
      ctx.drawImage(image, -boss.w * 0.58, -boss.h * 0.58, boss.w * 1.16, boss.h * 1.16);
      ctx.restore();
      if (hurt) {
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(255,255,255,.34)";
        ctx.beginPath();
        ctx.ellipse(0, 0, boss.w * 0.52, boss.h * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
    } else {
      ctx.fillStyle = hurt ? "#ffffff" : "#0d0b12";
      ctx.strokeStyle = colors.gold;
      ctx.lineWidth = 5;
      roundedRect(-98, -112, 196, 214, 8, true, true);
      ctx.strokeStyle = colors.purple;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -36, 52, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (boss.shieldTime > 0) {
      ctx.strokeStyle = `rgba(56,219,255,${0.55 + Math.sin(state.time * 12) * 0.25})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(0, 0, boss.w * 0.58, boss.h * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,.52)";
    ctx.strokeStyle = "rgba(255,214,109,.58)";
    ctx.lineWidth = 2;
    roundedRect(-boss.w * 0.34, -boss.h * 0.64, boss.w * 0.68, 26, 4, true, true);
    ctx.fillStyle = boss.phase === 3 ? colors.pink : colors.gold;
    ctx.font = "800 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(boss.attackName || `Phase ${boss.phase}`, 0, -boss.h * 0.64 + 18);
    ctx.restore();
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      const a = 1 - particle.t / particle.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    const blinking = p.invuln > 0 && Math.floor(state.time * 18) % 2 === 0;
    if (blinking) return;
    for (const trail of p.trail) {
      const alpha = 0.24 * (1 - trail.t / trail.life);
      drawPlayerSprite(trail.x, trail.y, trail.h, p.action, trail.facing, alpha);
    }
    drawPlayerSprite(p.x, p.y, p.h, p.action, p.facing, 1);
  }

  function drawPlayerSprite(x, y, h, action, facing, alpha) {
    const image = images.player;
    if (image.complete && image.naturalWidth) {
      const row = action === "run" && facing < 0 ? PLAYER_ROWS.runBack : PLAYER_ROWS[action] ?? PLAYER_ROWS.idle;
      const frame = Math.floor((run?.time || 0) * (action === "idle" ? 5 : 12)) % 8;
      const scale = h < 100 ? 0.92 : 1.1;
      drawAtlas(image, row, frame, x + 28, y + h + 14, scale, action === "run" && facing < 0 ? false : facing < 0, alpha);
      return;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x + 28, y + h);
    ctx.scale(facing, 1);
    ctx.fillStyle = "#151018";
    ctx.strokeStyle = colors.gold;
    ctx.lineWidth = 3;
    roundedRect(-22, -h, 44, h, 8, true, true);
    ctx.fillStyle = colors.pink;
    ctx.fillRect(-16, -h + 24, 32, 10);
    ctx.strokeStyle = colors.purple;
    ctx.beginPath();
    ctx.moveTo(18, -h + 62);
    ctx.lineTo(48, -h + 58);
    ctx.stroke();
    ctx.restore();
  }

  function drawAtlas(image, row, frame, x, bottom, scale, flip, alpha) {
    const cellW = image.naturalWidth / 8;
    const rows = image === images.player ? 6 : Math.max(1, Math.round(image.naturalHeight / 256));
    const cellH = image.naturalHeight / rows;
    const pad = image === images.player ? 2 : 0;
    const sx = (frame % 8) * cellW + pad;
    const sy = Math.min(row, rows - 1) * cellH + pad;
    const sw = cellW - pad * 2;
    const sh = cellH - pad * 2;
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, bottom);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(image, sx, sy, sw, sh, -dw / 2, -dh, dw, dh);
    ctx.restore();
  }

  function updateHUD() {
    const playing = run && (mode === "playing" || mode === "paused" || mode === "settings");
    dom.hud.classList.toggle("is-hidden", !playing);
    if (!playing) {
      dom.bossHud.classList.add("is-hidden");
      dom.objectiveChip.classList.add("is-hidden");
      return;
    }
    const p = run.player;
    dom.hpHearts.innerHTML = "";
    for (let i = 0; i < p.maxHp; i += 1) {
      const span = document.createElement("span");
      span.className = `heart${i >= p.hp ? " is-empty" : ""}`;
      dom.hpHearts.appendChild(span);
    }
    dom.livesText.textContent = String(p.lives);
    dom.hudTitle.textContent = "LOTTOMIND VAULT RUN";
    dom.levelText.textContent = `${run.level.id} ${run.level.shortName}`;
    dom.scoreText.textContent = String(run.stats.score).padStart(6, "0");
    dom.comboText.textContent = `x${run.combo}`;
    dom.shardText.textContent = String(run.shards);
    dom.keyText.textContent = `${run.keys}/3`;
    dom.overdriveBar.style.width = `${p.overdrive}%`;

    if (run.boss && run.boss.hp > 0) {
      dom.bossHud.classList.remove("is-hidden");
      dom.bossName.textContent = run.boss.name;
      dom.bossBar.style.width = `${Math.max(0, (run.boss.hp / run.boss.maxHp) * 100)}%`;
      dom.bossPhase.textContent = `Phase ${run.boss.phase} - ${run.boss.attackName || "Charging"}`;
    } else {
      dom.bossHud.classList.add("is-hidden");
    }
  }

  function initAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new AudioContext();
      } catch {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function playTone(freq, duration, type = "sine", gainValue = 0.04) {
    if (!settings.sound || !audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(freq, now);
    osc.type = type;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function updatePulseMusic(dt) {
    if (!settings.music || !audioCtx || mode !== "playing") return;
    pulseTimer -= dt;
    if (pulseTimer <= 0) {
      pulseTimer = run?.boss && !run.bossDefeated ? 0.38 : 0.62;
      const mood = run?.level?.music || { pulse: 110, boss: 82 };
      playTone(run?.boss ? mood.boss : mood.pulse, 0.045, "triangle", 0.018);
    }
  }

  function addBurst(state, x, y, color, count, force) {
    if (settings.reducedMotion) count = Math.min(count, 8);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.25 + Math.random() * 0.75) * force;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        color,
        size: 3 + Math.random() * 5,
        t: 0,
        life: 0.28 + Math.random() * 0.36
      });
    }
  }

  function playerBox(p) {
    return {
      x: p.x + 8,
      y: p.y + 10,
      w: p.w - 16,
      h: p.h - 12
    };
  }

  function enemyBox(enemy) {
    return {
      x: enemy.x + 4,
      y: enemy.y + 4,
      w: enemy.w - 8,
      h: enemy.h - 6
    };
  }

  function bossBox(boss) {
    return {
      x: boss.x + 20,
      y: boss.y + 14,
      w: boss.w - 40,
      h: boss.h - 24
    };
  }

  function projectileBox(shot) {
    return {
      x: shot.x - shot.w * 0.5,
      y: shot.y - shot.h * 0.5,
      w: shot.w,
      h: shot.h
    };
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function heartPath(x, y, size, dir = 1) {
    const s = size;
    ctx.moveTo(x, y + s * 0.48);
    ctx.bezierCurveTo(x - dir * s * 1.1, y - s * 0.18, x - dir * s * 0.62, y - s * 1.12, x, y - s * 0.54);
    ctx.bezierCurveTo(x + dir * s * 0.62, y - s * 1.12, x + dir * s * 1.1, y - s * 0.18, x, y + s * 0.48);
  }

  function roundedRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function approach(value, target, amount) {
    if (value < target) return Math.min(target, value + amount);
    if (value > target) return Math.max(target, value - amount);
    return target;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
})();
