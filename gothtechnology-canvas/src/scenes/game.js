import { ASSET_URLS, FIGHTERS } from "../config/assets.js?v=music-flow1";
import { ASSISTS, ATTACKS } from "../config/moves.js?v=music-flow1";
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, GROUND_Y, PHASE, ROUND_SECONDS, WORLD } from "../config/constants.js";
import { AssetLoader, drawSheetFrame } from "../engine/assets.js?v=music-flow1";
import { WebAudioBus } from "../engine/audio.js?v=music-flow1";
import { InputManager } from "../engine/input.js";
import { clamp, rectsOverlap } from "../engine/math.js";
import { applyHit, resolveMelee } from "../gameplay/combat.js?v=music-flow1";
import { SpriteEffect } from "../gameplay/effects.js";
import { Fighter } from "../gameplay/fighter.js?v=music-flow1";
import { AssistStrike, Projectile } from "../gameplay/projectiles.js?v=music-flow1";
import {
  drawCharacterSelect,
  drawDiagnostics,
  drawFightHud,
  drawLoading,
  drawPause,
  drawRoundMessage,
  drawTitle,
  drawVersus
} from "../ui/hud.js";

export class GothTechnologyGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.input = new InputManager(window);
    this.audio = new WebAudioBus(ASSET_URLS.music);
    this.assets = null;
    this.phase = PHASE.LOADING;
    this.loadingProgress = 0;
    this.cpuEnabled = true;
    this.training = false;
    this.player1Id = "MASTER_EZRA";
    this.player2Id = "KALYX";
    this.debug = false;
    this.roundNumber = 1;
    this.roundTimer = ROUND_SECONDS;
    this.roundMessageTimer = 0;
    this.matchWinner = null;
    this.playerEngaged = false;
    this.fighters = [];
    this.projectiles = [];
    this.assists = [];
    this.effects = [];
    this.playerEngaged = false;
    this.hitstop = 0;
    this.flash = 0;
    this.parallax = 0;
    this.lastTime = performance.now();
    this.menuHitAreas = [];
    this.cpuDecisionTimer = 0;
    this.cpuDecision = {};
    this.raf = 0;
    this.stopped = false;
    this.pendingFightMusic = false;
    this.audio.preloadMusic();
    this.audio.startMusic("menu");
    this.bindPointer();
  }

  async boot() {
    this.audio.startMusic("menu");
    this.assets = await new AssetLoader((progress) => {
      this.loadingProgress = progress;
      this.render();
    }).load();
    if (this.stopped) return;
    this.createFighters();
    this.phase = PHASE.TITLE;
    this.syncMusicForPhase();
    this.raf = requestAnimationFrame((time) => this.loop(time));
  }

  stop() {
    this.stopped = true;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  bindPointer() {
    this.canvas.addEventListener("pointerdown", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
      const y = ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
      this.audio.ensure();
      if (this.phase === PHASE.ROUND_END) {
        this.startRound();
        return;
      }
      if (this.phase === PHASE.MATCH_END) {
        this.phase = PHASE.TITLE;
        this.syncMusicForPhase();
        return;
      }
      const hit = this.menuHitAreas.find((area) => x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h);
      if (hit) hit.action();
      else if (this.phase === PHASE.TITLE) this.startMatch(false);
      else if (this.phase === PHASE.SELECT) this.startMatch(this.training);
    });
  }

  createFighters() {
    const p1Config = FIGHTERS[this.player1Id] ?? FIGHTERS.KALYX;
    const p2Config = FIGHTERS[this.player2Id] ?? FIGHTERS.MASTER_EZRA;
    this.fighters = [
      new Fighter({ id: p1Config.id, slot: 1, config: { ...p1Config }, assets: this.assets, x: 360, facing: 1 }),
      new Fighter({ id: p2Config.id, slot: 2, config: { ...p2Config }, assets: this.assets, x: 920, facing: -1 })
    ];
    this.fighters[0].resetRound(360, 1);
    this.fighters[1].resetRound(920, -1);
  }

  selectPlayer1(id) {
    this.player1Id = id;
    this.player2Id = id === "KALYX" ? "MASTER_EZRA" : "KALYX";
    this.createFighters();
    this.audio.beep("select");
  }

  startVersus() {
    this.phase = PHASE.VERSUS;
    this.roundMessageTimer = 1.35;
    this.audio.stopMusic({ reset: true });
    this.audio.beep("select");
  }

  startMatch(training = this.training) {
    this.training = training;
    this.roundNumber = 1;
    this.roundTimer = ROUND_SECONDS;
    this.matchWinner = null;
    this.fighters.forEach((f) => {
      f.roundWins = 0;
      f.meter = training ? 100 : 0;
    });
    this.audio.stopMusic({ reset: true });
    this.startRound();
  }

  startRound() {
    this.roundTimer = ROUND_SECONDS;
    this.projectiles = [];
    this.assists = [];
    this.effects = [];
    this.hitstop = 0;
    this.flash = 0;
    this.cpuDecisionTimer = 0;
    this.cpuDecision = {};
    this.fighters[0].resetRound(360, 1);
    this.fighters[1].resetRound(920, -1);
    if (this.training) {
      this.fighters[0].meter = 100;
      this.fighters[1].meter = 100;
    }
    this.phase = PHASE.FIGHT;
    this.roundMessageTimer = 0.72;
    this.pendingFightMusic = true;
    this.audio.stopMusic({ reset: true });
  }

  loop(time) {
    if (this.stopped) return;
    const dt = Math.min(1 / 45, (time - this.lastTime) / 1000 || 0);
    this.lastTime = time;
    this.update(dt);
    this.render();
    this.input.endFrame();
    this.raf = requestAnimationFrame((next) => this.loop(next));
  }

  update(dt) {
    this.handleGlobalInput();
    this.parallax += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.phase === PHASE.VERSUS) {
      this.roundMessageTimer -= dt;
      if (this.roundMessageTimer <= 0) this.startMatch(this.training);
      return;
    }
    if (this.phase !== PHASE.FIGHT) return;
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      return;
    }
    if (this.roundMessageTimer > 0) {
      this.roundMessageTimer = Math.max(0, this.roundMessageTimer - dt);
      if (this.roundMessageTimer <= 0 && this.pendingFightMusic) {
        this.pendingFightMusic = false;
        this.audio.startMusic("fight", { restart: true });
      }
      return;
    }
    if (!this.training) this.roundTimer = Math.max(0, this.roundTimer - dt);
    else {
      for (const fighter of this.fighters) {
        fighter.health = Math.min(fighter.config.maxHealth, fighter.health + dt * 42);
        fighter.meter = Math.min(100, fighter.meter + dt * 6);
      }
    }

    this.faceFighters();
    const p1Actions = this.input.actions(1);
    if (Object.values(p1Actions).some(Boolean)) this.playerEngaged = true;
    const p2Actions = this.cpuEnabled ? this.cpuActions(dt) : this.input.actions(2);

    this.fighters[0].update(dt, p1Actions, this.fighters[1], this);
    this.fighters[1].update(dt, p2Actions, this.fighters[0], this);

    resolveMelee(this.fighters[0], this.fighters[1], this);
    resolveMelee(this.fighters[1], this.fighters[0], this);

    this.projectiles.forEach((projectile) => projectile.update(dt, this));
    this.assists.forEach((assist) => assist.update(dt, this));
    this.effects.forEach((effect) => effect.update(dt, this));
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.assists = this.assists.filter((a) => !a.dead);
    this.effects = this.effects.filter((e) => !e.dead);

    this.keepFightersSeparated();
    this.faceFighters();
    this.checkRoundEnd();
  }

  handleGlobalInput() {
    if (this.input.consume("ui.mute")) this.audio.toggleMute();
    if (this.input.consume("ui.debug")) this.debug = !this.debug;
    if (this.input.consume("ui.cpu")) this.cpuEnabled = !this.cpuEnabled;
    if (this.input.consume("ui.training")) this.training = !this.training;
    if (this.input.consume("ui.reset")) this.startMatch(this.training);

    if (this.phase === PHASE.TITLE) {
      this.menuHitAreas = [
        { x: 494, y: 364, w: 292, h: 54, action: () => this.startMatch(false) },
        { x: 494, y: 432, w: 292, h: 54, action: () => this.startMatch(true) },
        { x: 494, y: 500, w: 292, h: 54, action: () => { this.cpuEnabled = !this.cpuEnabled; } }
      ];
      this.audio.startMusic("menu");
      if (this.input.consume("ui.confirm")) this.startMatch(false);
      return;
    }

    if (this.phase === PHASE.SELECT) {
      this.menuHitAreas = [
        { x: 90, y: 128, w: 500, h: 420, action: () => this.selectPlayer1("KALYX") },
        { x: 690, y: 128, w: 500, h: 420, action: () => this.selectPlayer1("MASTER_EZRA") },
        { x: 494, y: 594, w: 292, h: 54, action: () => this.startMatch(this.training) }
      ];
      if (this.input.consume("ui.confirm")) this.startMatch(this.training);
      if (this.input.consume("ui.back")) {
        this.phase = PHASE.TITLE;
        this.syncMusicForPhase();
      }
      return;
    }

    this.menuHitAreas = [];
    if (this.input.consume("ui.pause")) {
      this.phase = this.phase === PHASE.PAUSE ? PHASE.FIGHT : PHASE.PAUSE;
      this.audio.beep("select");
    }
    if ((this.phase === PHASE.ROUND_END || this.phase === PHASE.MATCH_END) && this.input.consume("ui.confirm")) {
      if (this.phase === PHASE.MATCH_END) {
        this.phase = PHASE.TITLE;
        this.syncMusicForPhase();
      }
      else this.startRound();
    }
    if (this.phase === PHASE.PAUSE && this.input.consume("ui.back")) this.phase = PHASE.FIGHT;
  }

  cpuActions(dt = 1 / 60) {
    const cpu = this.fighters[1];
    const player = this.fighters[0];
    const dist = player.x - cpu.x;
    const abs = Math.abs(dist);
    const actions = {};
    if (cpu.isKO || (!this.playerEngaged && this.roundTimer > ROUND_SECONDS - 12)) return actions;

    this.cpuDecisionTimer = Math.max(0, this.cpuDecisionTimer - dt);
    if (this.cpuDecisionTimer > 0) {
      return { ...this.cpuDecision };
    }

    const toward = dist > 0 ? "right" : "left";
    const away = dist > 0 ? "left" : "right";
    const margin = cpu.config.stageMargin ?? 0;
    const minX = WORLD.left + margin;
    const maxX = WORLD.right - margin;
    const nearLeftEdge = cpu.x <= minX + 18;
    const nearRightEdge = cpu.x >= maxX - 18;
    const holdMin = 220;
    const holdMax = 390;

    if (nearLeftEdge) actions.right = true;
    else if (nearRightEdge) actions.left = true;
    else if (abs > holdMax) actions[toward] = true;
    else if (abs < holdMin) actions[away] = true;

    if (player.currentAttack && abs < 168 && Math.random() < 0.035) {
      if (away === "left" && !nearLeftEdge) actions.left = true;
      if (away === "right" && !nearRightEdge) actions.right = true;
    }
    if (player.lastActions?.down && Math.random() < 0.025) actions.down = true;
    if (abs > 240 && Math.random() < 0.008) actions.special = true;
    if (cpu.meter >= 100 && abs > 190 && Math.random() < 0.004) actions.super = true;
    if (abs < 120 && Math.random() < 0.014) actions.lightKick = true;
    if (abs < 175 && Math.random() < 0.01) actions.heavyPunch = true;
    if (abs < 80 && Math.random() < 0.008) actions.throw = true;
    if (cpu.assistCooldowns.assist1 <= 0 && Math.random() < 0.003) actions.assist1 = true;
    this.cpuDecision = { ...actions };
    this.cpuDecisionTimer = 0.26;
    return actions;
  }

  keepFightersSeparated() {
    const [a, b] = this.fighters;
    const min = 126;
    const delta = b.x - a.x;
    if (delta < min) {
      const center = (a.x + b.x) / 2;
      const aMargin = a.config.stageMargin ?? 0;
      const bMargin = b.config.stageMargin ?? 0;
      const aMin = WORLD.left + aMargin;
      const aMax = WORLD.right - aMargin;
      const bMin = WORLD.left + bMargin;
      const bMax = WORLD.right - bMargin;
      a.x = clamp(center - min / 2, aMin, Math.min(aMax, bMax - min));
      b.x = clamp(a.x + min, Math.max(bMin, aMin + min), bMax);
      if (b.x - a.x < min) a.x = clamp(b.x - min, aMin, aMax);
      if (a.vx > 0) a.vx = Math.min(a.vx, 0);
      if (b.vx < 0) b.vx = Math.max(b.vx, 0);
    }
  }

  faceFighters() {
    const [a, b] = this.fighters;
    if (!a || !b) return;
    if (!a.isKO) a.facing = 1;
    if (!b.isKO) b.facing = -1;
  }

  checkRoundEnd() {
    const [p1, p2] = this.fighters;
    if (this.training) return;
    let winner = null;
    if (p1.health <= 0 && p2.health <= 0) winner = p1.health >= p2.health ? p1 : p2;
    else if (p1.health <= 0) winner = p2;
    else if (p2.health <= 0) winner = p1;
    else if (this.roundTimer <= 0) winner = p1.health >= p2.health ? p1 : p2;
    if (!winner) return;
    this.audio.beep("ko");
    winner.roundWins += 1;
    const loser = winner === p1 ? p2 : p1;
    winner.setMotion("VICTORY", true);
    loser.setMotion("DEFEAT", true);
    if (winner.roundWins >= 2) {
      this.matchWinner = winner;
      this.phase = PHASE.MATCH_END;
      this.audio.startMusic("menu");
    } else {
      this.roundNumber += 1;
      this.phase = PHASE.ROUND_END;
      this.audio.stopMusic({ reset: true });
    }
  }

  syncMusicForPhase() {
    if ([PHASE.LOADING, PHASE.TITLE, PHASE.SELECT, PHASE.MATCH_END].includes(this.phase)) {
      this.audio.startMusic("menu");
      return;
    }
    if (this.phase === PHASE.FIGHT) {
      this.audio.startMusic("fight");
      return;
    }
    if (this.phase === PHASE.VERSUS || this.phase === PHASE.ROUND_END) {
      this.audio.stopMusic({ reset: true });
    }
  }

  spawnProjectile(owner, name) {
    const attack = ATTACKS[name];
    const image = owner.id === "KALYX"
      ? this.assets.images[name === "super" ? "kalyxFireSlash" : "kalyxShadowClaw"]
      : this.assets.images[name === "super" ? "ezraOwlArc" : "ezraBlueBurst"];
    this.projectiles.push(new Projectile({
      owner,
      x: owner.x + owner.facing * 90,
      y: owner.y - (name === "super" ? 128 : 122),
      direction: owner.facing,
      attack,
      image,
      kind: name,
      color: owner.id === "KALYX" ? "#f2a13d" : "#9ed8ff"
    }));
    this.effects.push(new SpriteEffect({
      x: owner.x + owner.facing * 54,
      y: owner.y - 12,
      image: owner.id === "KALYX" ? this.assets.images.kalyxFireSlash : this.assets.images.ezraBlueBurst,
      duration: 0.38,
      scale: name === "super" ? 0.82 : 0.52,
      flip: owner.facing < 0
    }));
    this.audio.beep(name === "super" ? "super" : "special");
  }

  spawnAssist(owner, slot) {
    const spec = ASSISTS[owner.id]?.[slot];
    if (!spec) return;
    owner.assistCooldowns[slot] = spec.cooldown;
    const img = this.assets.images[spec.imageKey];
    const handSpawn = spec.spawn === "hand";
    if (spec.motion) owner.setMotion(spec.motion, true);
    const assist = new AssistStrike({
      owner,
      x: handSpawn ? owner.x + owner.facing * (spec.xOffset ?? 104) : owner.x - owner.facing * 200,
      y: owner.y + spec.yOffset,
      direction: owner.facing,
      spec,
      image: img
    });
    this.assists.push(assist);
    this.audio.beep("special");
  }

  resolveIncomingHit(attacker, defender, attack, meta) {
    applyHit(attacker, defender, attack, this, meta);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (this.phase === PHASE.LOADING) {
      drawLoading(ctx, this.loadingProgress);
      return;
    }

    if ([PHASE.TITLE, PHASE.SELECT, PHASE.VERSUS].includes(this.phase)) {
      this.drawBackground(ctx, true);
      if (this.phase === PHASE.TITLE) drawTitle(ctx, this);
      if (this.phase === PHASE.SELECT) drawCharacterSelect(ctx, this);
      if (this.phase === PHASE.VERSUS) drawVersus(ctx, this);
      return;
    }

    this.drawBackground(ctx, false);
    for (const assist of this.assists) assist.render(ctx);
    for (const projectile of this.projectiles) projectile.render(ctx);
    this.fighters[0].render(ctx, this.debug);
    this.fighters[1].render(ctx, this.debug);
    for (const effect of this.effects) effect.render(ctx);
    drawFightHud(ctx, this);
    if (this.roundMessageTimer > 0) {
      drawRoundMessage(ctx, `ROUND ${this.roundNumber}`, "FIGHT");
    }
    if (this.phase === PHASE.ROUND_END) {
      drawRoundMessage(ctx, "KO", "NEXT ROUND");
    }
    if (this.phase === PHASE.MATCH_END) {
      drawRoundMessage(ctx, `${this.matchWinner?.config.name ?? "FIGHTER"} WINS`, "MATCH COMPLETE");
    }
    if (this.phase === PHASE.PAUSE) drawPause(ctx, this);
    if (this.debug) drawDiagnostics(ctx, this);
    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash * 0.35;
      ctx.fillStyle = "#f8f1d4";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }
  }

  drawBackground(ctx, menuMode) {
    ctx.fillStyle = "#050403";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const titleBackdrop = this.assets?.images.titleBackdrop;
    const bg = menuMode && titleBackdrop ? titleBackdrop : this.assets?.images.background;
    const trees = this.assets?.images.farTrees;
    const fog = this.assets?.images.fog;
    const embers = this.assets?.images.embers;
    const ground = this.assets?.images.ground;
    const groundBandTop = GROUND_Y - 58;
    const groundTileTop = GROUND_Y - 54;
    const groundTileHeight = 214;
    if (bg) ctx.drawImage(bg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (trees) {
      const x = -((this.parallax * 10) % CANVAS_WIDTH);
      ctx.globalAlpha = menuMode ? 0.22 : 0.14;
      ctx.drawImage(trees, x, 72, CANVAS_WIDTH, 380);
      ctx.drawImage(trees, x + CANVAS_WIDTH, 72, CANVAS_WIDTH, 380);
      ctx.globalAlpha = 1;
    }
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, "rgba(0,0,0,0.74)");
    grad.addColorStop(0.35, menuMode ? "rgba(0,0,0,0.56)" : "rgba(0,0,0,0.16)");
    grad.addColorStop(0.76, "rgba(0,0,0,0.28)");
    grad.addColorStop(1, "rgba(0,0,0,0.76)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (fog) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const fogLayers = [
        { speed: 11, y: 88, h: 214, alpha: menuMode ? 0.22 : 0.16, scale: 1.14 },
        { speed: 24, y: 154, h: 284, alpha: menuMode ? 0.36 : 0.28, scale: 1 },
        { speed: -15, y: 234, h: 172, alpha: menuMode ? 0.18 : 0.2, scale: 1.28 }
      ];
      for (const layer of fogLayers) {
        const width = CANVAS_WIDTH * layer.scale;
        const drift = ((this.parallax * layer.speed) % width + width) % width;
        const x = -drift;
        ctx.globalAlpha = layer.alpha;
        ctx.drawImage(fog, x, layer.y, width, layer.h);
        ctx.drawImage(fog, x + width, layer.y, width, layer.h);
      }
      const time = this.parallax;
      for (let i = 0; i < 12; i += 1) {
        const x = ((i * 127 + time * (18 + (i % 3) * 8)) % (CANVAS_WIDTH + 180)) - 90;
        const y = 152 + (i % 5) * 36 + Math.sin(time * 0.8 + i) * 12;
        const r = 84 + (i % 4) * 34;
        const wisp = ctx.createRadialGradient(x, y, 0, x, y, r);
        wisp.addColorStop(0, menuMode ? "rgba(210, 222, 220, 0.09)" : "rgba(210, 226, 226, 0.075)");
        wisp.addColorStop(0.5, "rgba(140, 164, 166, 0.035)");
        wisp.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = wisp;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.7, r * 0.34, Math.sin(i) * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = "rgba(5, 4, 3, 0.22)";
    ctx.fillRect(0, groundBandTop, CANVAS_WIDTH, CANVAS_HEIGHT - groundBandTop);
    const groundShadow = ctx.createLinearGradient(0, GROUND_Y - 92, 0, GROUND_Y + 28);
    groundShadow.addColorStop(0, "rgba(0, 0, 0, 0)");
    groundShadow.addColorStop(0.42, "rgba(18, 15, 12, 0.18)");
    groundShadow.addColorStop(0.75, "rgba(7, 5, 4, 0.5)");
    groundShadow.addColorStop(1, "rgba(0, 0, 0, 0.9)");
    ctx.fillStyle = groundShadow;
    ctx.fillRect(0, GROUND_Y - 92, CANVAS_WIDTH, 128);
    if (ground) {
      const tileW = 640;
      for (let x = -((this.parallax * 28) % tileW); x < CANVAS_WIDTH + tileW; x += tileW) {
        ctx.drawImage(ground, x, groundTileTop, tileW, groundTileHeight);
      }
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      const soil = ctx.createLinearGradient(0, GROUND_Y - 34, 0, CANVAS_HEIGHT);
      soil.addColorStop(0, "rgba(58, 48, 38, 0.18)");
      soil.addColorStop(0.34, "rgba(18, 13, 9, 0.48)");
      soil.addColorStop(1, "rgba(0, 0, 0, 0.82)");
      ctx.fillStyle = soil;
      ctx.fillRect(0, GROUND_Y - 34, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y + 34);
      ctx.restore();
    } else {
      ctx.fillStyle = "#11100d";
      ctx.fillRect(0, groundBandTop, CANVAS_WIDTH, CANVAS_HEIGHT - groundBandTop);
    }
    if (!menuMode) {
      ctx.save();
      for (const fighter of this.fighters) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
        ctx.beginPath();
        ctx.ellipse(fighter.x, GROUND_Y + 6, 82, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(216, 170, 69, 0.08)";
        ctx.beginPath();
        ctx.ellipse(fighter.x + fighter.facing * 10, GROUND_Y + 4, 46, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(180, 154, 110, 0.18)";
      for (let i = 0; i < 22; i += 1) {
        const x = (i * 79 + 37) % CANVAS_WIDTH;
        const y = GROUND_Y + 8 + (i % 5) * 19;
        ctx.beginPath();
        ctx.ellipse(x, y, 4 + (i % 4) * 2, 1.4 + (i % 3), (i * 0.7) % Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (embers) {
      const x = -((this.parallax * 36) % CANVAS_WIDTH);
      ctx.globalAlpha = 0.26;
      ctx.drawImage(embers, x, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(embers, x + CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.globalAlpha = 1;
    }
    const lip = ctx.createLinearGradient(0, GROUND_Y - 3, CANVAS_WIDTH, GROUND_Y - 3);
    lip.addColorStop(0, "rgba(72, 58, 36, 0.1)");
    lip.addColorStop(0.5, "rgba(242, 212, 143, 0.28)");
    lip.addColorStop(1, "rgba(62, 50, 32, 0.1)");
    ctx.strokeStyle = lip;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 1);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y - 1);
    ctx.stroke();
  }

}
