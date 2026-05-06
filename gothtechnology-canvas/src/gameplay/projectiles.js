import { drawSheetFrame } from "../engine/assets.js";
import { rectsOverlap } from "../engine/math.js";

export class Projectile {
  constructor({ owner, x, y, direction, attack, image, kind = "projectile", color = "#9ed8ff" }) {
    this.owner = owner;
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.attack = attack;
    this.image = image;
    this.kind = kind;
    this.color = color;
    this.speed = attack.speed ?? 520;
    this.radius = attack.radius ?? 34;
    this.age = 0;
    this.dead = false;
    this.hitIds = new Set();
  }

  get rect() {
    return {
      x: this.x - this.radius,
      y: this.y - this.radius,
      w: this.radius * 2,
      h: this.radius * 2
    };
  }

  update(dt, game) {
    this.age += dt;
    this.x += this.direction * this.speed * dt;
    if (this.x < -140 || this.x > 1420 || this.age > 3.2) this.dead = true;
    const target = game.fighters.find((fighter) => fighter.id !== this.owner.id);
    if (!target || target.isKO || this.hitIds.has(target.id)) return;
    if (rectsOverlap(this.rect, target.hurtbox)) {
      this.hitIds.add(target.id);
      game.resolveIncomingHit(this.owner, target, this.attack, {
        box: this.rect,
        projectile: true,
        level: this.attack.level ?? "mid",
        sourceName: this.kind
      });
      this.dead = true;
    }
  }

  render(ctx) {
    const frame = Math.floor(this.age * 18) % 8;
    const flip = this.direction < 0;
    if (!drawSheetFrame(ctx, this.image, frame, 256, 256, this.x, this.y + this.radius, {
      scale: this.radius / 78,
      flip,
      alpha: 0.95
    })) {
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.radius * 1.4, this.radius * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export class AssistStrike extends Projectile {
  constructor({ owner, x, y, direction, spec, image }) {
    super({
      owner,
      x,
      y,
      direction,
      image,
      kind: spec.name,
      color: owner.id === "KALYX" ? "#c08cff" : "#9ed8ff",
      attack: {
        damage: spec.damage,
        chip: 6,
        meter: 8,
        speed: spec.speed || 0,
        radius: Math.max(spec.hitbox.w, spec.hitbox.h) / 2,
        stun: 0.3,
        blockstun: 0.24,
        knockback: 280,
        level: "mid"
      }
    });
    this.spec = spec;
    this.startX = x;
  }

  update(dt, game) {
    if (this.spec.shield) {
      this.age += dt;
      this.owner.shieldTimer = Math.max(this.owner.shieldTimer, 0.5);
      if (this.age > 0.72) this.dead = true;
      return;
    }
    super.update(dt, game);
  }
}
