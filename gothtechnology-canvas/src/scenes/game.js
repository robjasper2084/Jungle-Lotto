import { ASSET_URLS, FIGHTERS } from "../config/assets.js";
import { ASSISTS, ATTACKS } from "../config/moves.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, GROUND_Y, PHASE, ROUND_SECONDS } from "../config/constants.js";
import { AssetLoader, drawSheetFrame } from "../engine/assets.js";
import { WebAudioBus } from "../engine/audio.js";
import { InputManager } from "../engine/input.js";
import { clamp, rectsOverlap } from "../engine/math.js";
import { applyHit, resolveMelee } from "../gameplay/combat.js";
import { SpriteEffect } from "../gameplay/effects.js";
import { Fighter } from "../gameplay/fighter.js";
import { AssistStrike, Projectile } from "../gameplay/projectiles.js";
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
    this.audio = new WebAudioBus();
    this.assets = null;
    this.phase = PHASE.LOADING;
    this.loadingProgress = 0;
    this.cpuEnabled = true;
    this.training = false;
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
    this.raf = 0;
    this.stopped = false;
    this.bindPointer();
  }

  async boot() {
    this.assets = await new AssetLoader((progress) => {
      this.loadingProgress = progress;
      this.render();
    }).load();
    if (this.stopped) return;
    this.createFighters();
    this.phase = PHASE.TITLE;
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
      if (this.phase === PHASE.ROUND_END) {
        this.startRound();
        return;
      }
      if (this.phase === PHASE.MATCH_END) {
        this.phase = PHASE.TITLE;
        return;
      }
      const hit = this.menuHitAreas.find((area) => x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h);
      if (hit) hit.action();
      this.audio.ensure();
    });
  }

  createFighters() {
    this.fighters = [
      new Fighter({ id: "KALYX", slot: 1, config: { ...FIGHTERS.KALYX }, assets: this.assets, x: 360, facing: 1 }),
      new Fighter({ id: "MASTER_EZRA", slot: 2, config: { ...FIGHTERS.MASTER_EZRA }, assets: this.assets, x: 920, facing: -1 })
    ];
    this.fighters[0].resetRound(360, 1);
    this.fighters[1].resetRound(920, -1);
  }

  startVersus() {
    this.phase = PHASE.VERSUS;
    this.roundMessageTimer = 1.35;
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
    this.startRound();
  }

  startRound() {
    this.roundTimer = ROUND_SECONDS;
    this.projectiles = [];
    this.assists = [];
    this.effects = [];
    this.hitstop = 0;
    this.flash = 0;
    this.fighters[0].resetRound(360, 1);
    this.fighters[1].resetRound(920, -1);
    if (this.training) {
      this.fighters[0].meter = 100;
      this.fighters[1].meter = 100;
    }
    this.phase = PHASE.FIGHT;
    this.roundMessageTimer = 1.2;
  }

  loop(time) {
    if (this.stopped) return;
    const dt = Math.min(1 / 30, (time - this.lastTime) / 1000 || 0);
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
      return;
    }
    if (!this.training) this.roundTimer = Math.max(0, this.roundTimer - dt);
    else {
      for (const fighter of this.fighters) {
        fighter.health = Math.min(fighter.config.maxHealth, fighter.health + dt * 42);
        fighter.meter = Math.min(100, fighter.meter + dt * 6);
      }
    }

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
        { x: 494, y: 318, w: 292, h: 54, action: () => (this.phase = PHASE.SELECT) },
        { x: 494, y: 390, w: 292, h: 54, action: () => { this.training = true; this.phase = PHASE.SELECT; } },
        { x: 494, y: 462, w: 292, h: 54, action: () => { this.cpuEnabled = !this.cpuEnabled; } }
      ];
      if (this.input.consume("ui.confirm")) this.phase = PHASE.SELECT;
      return;
    }

    if (this.phase === PHASE.SELECT) {
      this.menuHitAreas = [{ x: 494, y: 594, w: 292, h: 54, action: () => this.startVersus() }];
      if (this.input.consume("ui.confirm")) this.startVersus();
      if (this.input.consume("ui.back")) this.phase = PHASE.TITLE;
      return;
    }

    this.menuHitAreas = [];
    if (this.input.consume("ui.pause")) {
      this.phase = this.phase === PHASE.PAUSE ? PHASE.FIGHT : PHASE.PAUSE;
      this.audio.beep("select");
    }
    if ((this.phase === PHASE.ROUND_END || this.phase === PHASE.MATCH_END) && this.input.consume("ui.confirm")) {
      if (this.phase === PHASE.MATCH_END) this.phase = PHASE.TITLE;
      else this.startRound();
    }
    if (this.phase === PHASE.PAUSE && this.input.consume("ui.back")) this.phase = PHASE.FIGHT;
  }

  cpuActions() {
    const ezra = this.fighters[1];
    const kalyx = this.fighters[0];
    const dist = kalyx.x - ezra.x;
    const abs = Math.abs(dist);
    const actions = {};
    if (ezra.isKO) return actions;
    const away = dist > 0 ? "right" : "left";
    const toward = dist > 0 ? "left" : "right";
    if (ezra.health < kalyx.health - 160 && abs < 190) actions[away] = true;
    else if (abs > 370) actions[toward] = true;
    else if (abs < 126) actions[away] = true;
    if (!this.playerEngaged && this.roundTimer > ROUND_SECONDS - 12) return actions;
    if (kalyx.currentAttack && abs < 180 && Math.random() < 0.055) actions[away] = true;
    if (kalyx.lastActions?.down && Math.random() < 0.025) actions.down = true;
    if (abs > 240 && Math.random() < 0.008) actions.special = true;
    if (ezra.meter >= 100 && abs > 190 && Math.random() < 0.004) actions.super = true;
    if (abs < 120 && Math.random() < 0.014) actions.lightKick = true;
    if (abs < 175 && Math.random() < 0.01) actions.heavyPunch = true;
    if (abs < 80 && Math.random() < 0.008) actions.throw = true;
    if (ezra.assistCooldowns.assist1 <= 0 && Math.random() < 0.003) actions.assist1 = true;
    return actions;
  }

  keepFightersSeparated() {
    const [a, b] = this.fighters;
    const min = 62;
    const delta = b.x - a.x;
    if (Math.abs(delta) < min) {
      const push = (min - Math.abs(delta)) / 2;
      const dir = delta >= 0 ? 1 : -1;
      a.x -= push * dir;
      b.x += push * dir;
      a.x = clamp(a.x, 64, 1216);
      b.x = clamp(b.x, 64, 1216);
    }
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
    } else {
      this.roundNumber += 1;
      this.phase = PHASE.ROUND_END;
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
    const assist = new AssistStrike({
      owner,
      x: owner.x - owner.facing * 200,
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
    const bg = this.assets?.images.background;
    const trees = this.assets?.images.farTrees;
    const fog = this.assets?.images.fog;
    const embers = this.assets?.images.embers;
    const ground = this.assets?.images.ground;
    const stageTop = 72;
    const groundBandTop = GROUND_Y - 42;
    const groundTileTop = GROUND_Y - 23;
    const groundTileHeight = 164;
    if (bg) ctx.drawImage(bg, 0, stageTop, CANVAS_WIDTH, GROUND_Y - stageTop + 34);
    if (trees) {
      const x = -((this.parallax * 10) % CANVAS_WIDTH);
      ctx.globalAlpha = 0.72;
      ctx.drawImage(trees, x, 72, CANVAS_WIDTH, 380);
      ctx.drawImage(trees, x + CANVAS_WIDTH, 72, CANVAS_WIDTH, 380);
      ctx.globalAlpha = 1;
    }
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, "rgba(0,0,0,0.74)");
    grad.addColorStop(0.35, menuMode ? "rgba(0,0,0,0.56)" : "rgba(0,0,0,0.16)");
    grad.addColorStop(1, "rgba(0,0,0,0.84)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (fog) {
      const x = -((this.parallax * 22) % CANVAS_WIDTH);
      ctx.globalAlpha = 0.34;
      ctx.drawImage(fog, x, 170, CANVAS_WIDTH, 270);
      ctx.drawImage(fog, x + CANVAS_WIDTH, 170, CANVAS_WIDTH, 270);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(5, 4, 3, 0.92)";
    ctx.fillRect(0, groundBandTop, CANVAS_WIDTH, CANVAS_HEIGHT - groundBandTop);
    const groundShadow = ctx.createLinearGradient(0, GROUND_Y - 56, 0, GROUND_Y + 18);
    groundShadow.addColorStop(0, "rgba(0, 0, 0, 0)");
    groundShadow.addColorStop(0.62, "rgba(7, 5, 4, 0.78)");
    groundShadow.addColorStop(1, "rgba(0, 0, 0, 0.96)");
    ctx.fillStyle = groundShadow;
    ctx.fillRect(0, GROUND_Y - 56, CANVAS_WIDTH, 90);
    if (ground) {
      for (let x = -((this.parallax * 42) % 320); x < CANVAS_WIDTH + 320; x += 320) {
        ctx.drawImage(ground, x, groundTileTop, 320, groundTileHeight);
      }
    } else {
      ctx.fillStyle = "#11100d";
      ctx.fillRect(0, groundBandTop, CANVAS_WIDTH, CANVAS_HEIGHT - groundBandTop);
    }
    if (embers) {
      const x = -((this.parallax * 36) % CANVAS_WIDTH);
      ctx.globalAlpha = 0.26;
      ctx.drawImage(embers, x, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(embers, x + CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = "rgba(216, 170, 69, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 1);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y - 1);
    ctx.stroke();
  }
}
