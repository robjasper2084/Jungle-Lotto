import { GRAVITY, GROUND_Y, WORLD } from "../config/constants.js";
import { ATTACKS } from "../config/moves.js";
import { drawSpriteFrame } from "../engine/assets.js";
import { approach, clamp, makeRect } from "../engine/math.js";

const MOTION_LOCKS = new Set([
  "LIGHT_PUNCH",
  "HEAVY_PUNCH",
  "LIGHT_KICK",
  "HEAVY_KICK",
  "AIR_ATTACK",
  "CROUCH_ATTACK",
  "COMBO_1",
  "COMBO_2",
  "SPECIAL_START",
  "SPECIAL_PROJECTILE",
  "SPECIAL_RECOVER",
  "SUPER_CHARGE",
  "SUPER_RELEASE",
  "THROW_GRAB",
  "THROW_FINISH",
  "HURT_LIGHT",
  "HURT_HEAVY",
  "KNOCKDOWN",
  "GET_UP",
  "TAUNT",
  "VICTORY",
  "DEFEAT"
]);

export class Fighter {
  constructor({ id, slot, config, assets, x, facing }) {
    this.id = id;
    this.slot = slot;
    this.config = config;
    this.assets = assets;
    this.x = x;
    this.y = GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.health = config.maxHealth;
    this.meter = 0;
    this.roundWins = 0;
    this.comboHits = 0;
    this.comboTimer = 0;
    this.motion = "IDLE";
    this.motionElapsed = 0;
    this.currentAttack = null;
    this.hitstun = 0;
    this.blockstun = 0;
    this.knockdown = 0;
    this.invulnerable = 0;
    this.specialCooldown = 0;
    this.superCooldown = 0;
    this.assistCooldowns = { assist1: 0, assist2: 0 };
    this.pendingProjectile = null;
    this.shieldTimer = 0;
    this.lastActions = {};
    this.moveHold = 0;
    this.lastMoveDir = 0;
    this.isKO = false;
  }

  resetRound(x, facing) {
    this.x = x;
    this.y = GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.health = this.config.maxHealth;
    this.meter = Math.max(0, Math.min(this.meter, 100));
    this.comboHits = 0;
    this.comboTimer = 0;
    this.currentAttack = null;
    this.hitstun = 0;
    this.blockstun = 0;
    this.knockdown = 0;
    this.invulnerable = 1.2;
    this.pendingProjectile = null;
    this.isKO = false;
    this.moveHold = 0;
    this.lastMoveDir = 0;
    this.setMotion("READY_STANCE", true);
  }

  get grounded() {
    return this.y >= GROUND_Y - 0.5;
  }

  get crouching() {
    return this.lastActions.down && this.grounded;
  }

  get hurtbox() {
    const h = this.crouching || this.motion === "BLOCK_LOW" ? 118 : 178;
    return makeRect(this.x, this.y, 76, h);
  }

  get activeAnimation() {
    return this.assets.animations[this.config.manifestKey]?.[this.motion] ?? this.assets.animations[this.config.manifestKey]?.IDLE;
  }

  setMotion(motion, force = false) {
    if (!force && this.motion === motion) return;
    this.motion = motion;
    this.motionElapsed = 0;
  }

  beginAttack(name, game) {
    const data = ATTACKS[name];
    if (!data || this.currentAttack || this.hitstun || this.blockstun || this.knockdown || this.isKO) return false;
    if (name === "special" && this.specialCooldown > 0) return false;
    if (name === "super" && (this.superCooldown > 0 || this.meter < data.cost)) return false;
    if (name === "super") {
      this.meter -= data.cost;
      game.audio.beep("super");
      game.flash = 0.45;
    }
    if (name === "special") this.specialCooldown = data.cooldown;
    if (name === "super") this.superCooldown = data.cooldown;
    const duration = (data.active?.[1] ?? data.startup + 0.18) + (data.recovery ?? 0.25);
    this.currentAttack = {
      name,
      data,
      elapsed: 0,
      duration,
      hitTargets: new Set(),
      spawned: false
    };
    this.setMotion(data.motion, true);
    if (data.startMotion) this.setMotion(data.startMotion, true);
    return true;
  }

  useAssist(slot, game) {
    if (this.assistCooldowns[slot] > 0 || this.isKO || this.knockdown) return;
    game.spawnAssist(this, slot);
  }

  getAttackBox() {
    const attack = this.currentAttack?.data;
    if (!attack) return null;
    const x = this.x + this.facing * (attack.reach ?? 90);
    return {
      x: x - (attack.width ?? 90) / 2,
      y: this.y + (attack.y ?? -120) - (attack.height ?? 70) / 2,
      w: attack.width ?? 90,
      h: attack.height ?? 70
    };
  }

  takeHit({ damage, stun, knockback, attackName, blocked, chipOnly }) {
    this.comboTimer = 0;
    if (blocked) {
      this.blockstun = stun;
      this.health = Math.max(1, this.health - damage);
      this.vx += knockback;
      this.setMotion(this.crouching ? "BLOCK_LOW" : "BLOCK_HIGH", true);
      return;
    }
    this.health = Math.max(0, this.health - damage);
    this.hitstun = stun;
    this.invulnerable = Math.max(this.invulnerable, 0.04);
    this.vx += knockback;
    this.setMotion(damage > 72 || attackName === "super" ? "HURT_HEAVY" : "HURT_LIGHT", true);
    if (damage >= 110 || this.health <= 0) {
      this.knockdown = this.health <= 0 ? 10 : 0.92;
      this.setMotion(this.health <= 0 ? "DEFEAT" : "KNOCKDOWN", true);
    }
    if (chipOnly) this.setMotion("BLOCK_HIGH", true);
  }

  update(dt, actions, opponent, game) {
    this.lastActions = actions;
    this.motionElapsed += dt;
    this.specialCooldown = Math.max(0, this.specialCooldown - dt);
    this.superCooldown = Math.max(0, this.superCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hitstun = Math.max(0, this.hitstun - dt);
    this.blockstun = Math.max(0, this.blockstun - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer === 0) this.comboHits = 0;
    for (const key of Object.keys(this.assistCooldowns)) {
      this.assistCooldowns[key] = Math.max(0, this.assistCooldowns[key] - dt);
    }

    if (!this.isKO && this.health <= 0) {
      this.isKO = true;
      this.currentAttack = null;
      this.setMotion("DEFEAT", true);
    }

    this.facing = opponent.x >= this.x ? 1 : -1;

    if (this.knockdown > 0 && !this.isKO) {
      this.knockdown = Math.max(0, this.knockdown - dt);
      if (this.knockdown === 0) {
        this.invulnerable = 0.7;
        this.setMotion("GET_UP", true);
      }
    }

    const locked = this.isKO || this.hitstun > 0 || this.blockstun > 0 || this.knockdown > 0;
    if (!locked) {
      if (actions.assist1) this.useAssist("assist1", game);
      if (actions.assist2) this.useAssist("assist2", game);
      if (actions.taunt) {
        this.currentAttack = { name: "taunt", data: { motion: "TAUNT" }, elapsed: 0, duration: 0.82, hitTargets: new Set() };
        this.meter = Math.min(100, this.meter + 4);
        this.setMotion("TAUNT", true);
      } else if (actions.throw) this.beginAttack("throw", game);
      else if (actions.super) this.beginAttack("super", game);
      else if (actions.special) this.beginAttack("special", game);
      else if (actions.heavyPunch) this.beginAttack("heavyPunch", game);
      else if (actions.heavyKick) this.beginAttack("heavyKick", game);
      else if (actions.lightPunch && actions.down) this.beginAttack("crouchAttack", game);
      else if (actions.lightKick && !this.grounded) this.beginAttack("airAttack", game);
      else if (actions.lightPunch && actions.lightKick) this.beginAttack("combo2", game);
      else if (actions.lightPunch) this.beginAttack("lightPunch", game);
      else if (actions.lightKick) this.beginAttack("lightKick", game);
    }

    if (this.currentAttack) {
      this.currentAttack.elapsed += dt;
      const { name, data } = this.currentAttack;
      if ((name === "special" || name === "super") && !this.currentAttack.spawned && this.currentAttack.elapsed >= data.startup) {
        this.currentAttack.spawned = true;
        this.setMotion(data.motion, true);
        game.spawnProjectile(this, name);
      }
      if (this.currentAttack.elapsed >= this.currentAttack.duration) {
        if (data.recoverMotion) this.setMotion(data.recoverMotion, true);
        this.currentAttack = null;
      }
    }

    const canMove = !locked && !this.currentAttack;
    let desired = 0;
    if (canMove) {
      const left = actions.left ? -1 : 0;
      const right = actions.right ? 1 : 0;
      desired = left + right;
      if (desired !== 0 && desired === this.lastMoveDir) this.moveHold += dt;
      else this.moveHold = 0;
      this.lastMoveDir = desired;
      if (actions.up && this.grounded) {
        this.vy = this.config.jumpVelocity;
        this.y -= 1;
        this.setMotion("JUMP_START", true);
        game.audio.beep("select");
      }
      if (actions.dash && desired !== 0) {
        this.vx = desired * this.config.dashSpeed;
        this.setMotion(desired === this.facing ? "DASH_FORWARD" : "DASH_BACK", true);
      } else if (desired !== 0) {
        const movingForward = desired === this.facing;
        const running = this.moveHold > 0.32;
        const speed = running ? this.config.runSpeed : this.config.speed;
        this.vx = desired * speed;
        if (running) this.setMotion(movingForward ? "RUN_FORWARD" : "RUN_BACK");
        else this.setMotion(movingForward ? "WALK_FORWARD" : "WALK_BACK");
      } else {
        this.moveHold = 0;
        this.lastMoveDir = 0;
        this.vx = approach(this.vx, 0, dt * 1800);
      }

      const away = opponent.x > this.x ? actions.left : actions.right;
      if (away && desired === 0) {
        this.setMotion(actions.down ? "BLOCK_LOW" : "BLOCK_HIGH");
      } else if (actions.down && this.grounded) {
        this.setMotion("CROUCH_IDLE");
      } else if (Math.abs(this.vx) < 10 && this.grounded && !MOTION_LOCKS.has(this.motion)) {
        this.setMotion("IDLE");
      }
    } else {
      this.vx = approach(this.vx, 0, dt * 1200);
    }

    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, WORLD.left, WORLD.right);
    if (this.y >= GROUND_Y) {
      if (!this.grounded && !this.currentAttack && !locked) this.setMotion("LANDING", true);
      this.y = GROUND_Y;
      this.vy = 0;
    } else if (!locked && !this.currentAttack) {
      if (this.vy < -90) this.setMotion("JUMP_RISE");
      else if (this.vy > 90) this.setMotion("JUMP_FALL");
      else this.setMotion("JUMP_PEAK");
    }
  }

  isBlocking(incomingLevel, attacker) {
    if (this.currentAttack || this.hitstun || this.knockdown || this.isKO) return false;
    if (this.shieldTimer > 0) return true;
    const away = attacker.x > this.x ? this.lastActions.left : this.lastActions.right;
    if (!away) return false;
    if (incomingLevel === "throw") return false;
    if (incomingLevel === "low") return Boolean(this.lastActions.down);
    if (incomingLevel === "high") return !this.lastActions.down;
    return true;
  }

  render(ctx, debug = false) {
    const anim = this.activeAnimation;
    let frameIndex = 0;
    if (anim?.frames?.length) {
      const duration = anim.frames.reduce((sum, frame) => sum + (frame.duration_ms ?? 85), 0) / 1000;
      const loop = !MOTION_LOCKS.has(this.motion) || this.motion === "DEFEAT" || this.motion === "VICTORY";
      const time = loop ? this.motionElapsed % duration : Math.min(this.motionElapsed, duration - 0.001);
      let acc = 0;
      for (let i = 0; i < anim.frames.length; i += 1) {
        acc += (anim.frames[i].duration_ms ?? 85) / 1000;
        if (time <= acc) {
          frameIndex = i;
          break;
        }
      }
    }
    const pulse = this.invulnerable > 0 && Math.floor(this.invulnerable * 18) % 2 === 0 ? 0.72 : 1;
    drawSpriteFrame(ctx, anim, frameIndex, this.x, this.y + 14, {
      scale: this.config.scale,
      flip: this.facing < 0,
      alpha: pulse
    });

    if (this.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(158, 216, 255, 0.72)";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#9ed8ff";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - 105, 58, 92, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (debug) {
      const hurt = this.hurtbox;
      ctx.save();
      ctx.strokeStyle = "rgba(95, 205, 255, 0.85)";
      ctx.strokeRect(hurt.x, hurt.y, hurt.w, hurt.h);
      const attack = this.getAttackBox();
      if (attack) {
        ctx.strokeStyle = "rgba(255, 214, 109, 0.9)";
        ctx.strokeRect(attack.x, attack.y, attack.w, attack.h);
      }
      ctx.restore();
    }
  }
}
