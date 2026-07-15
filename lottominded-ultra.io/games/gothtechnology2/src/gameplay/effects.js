import { drawSheetFrame } from "../engine/assets.js";

export class SpriteEffect {
  constructor({ x, y, image, cellW = 256, cellH = 256, frames = 8, duration = 0.42, scale = 1, flip = false, alpha = 1 }) {
    this.x = x;
    this.y = y;
    this.image = image;
    this.cellW = cellW;
    this.cellH = cellH;
    this.frames = frames;
    this.duration = duration;
    this.scale = scale;
    this.flip = flip;
    this.alpha = alpha;
    this.age = 0;
    this.dead = false;
  }

  update(dt) {
    this.age += dt;
    this.dead = this.age >= this.duration;
  }

  render(ctx) {
    const t = Math.min(0.999, this.age / this.duration);
    const frame = Math.floor(t * this.frames);
    if (!drawSheetFrame(ctx, this.image, frame, this.cellW, this.cellH, this.x, this.y, {
      scale: this.scale,
      flip: this.flip,
      alpha: this.alpha * (1 - Math.max(0, t - 0.72) / 0.28)
    })) {
      ctx.save();
      ctx.globalAlpha = this.alpha * (1 - t);
      ctx.fillStyle = "#ffd66d";
      ctx.beginPath();
      ctx.arc(this.x, this.y - 70, 18 + 38 * t, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export class AttachedSpriteEffect extends SpriteEffect {
  constructor({ owner, offsetX = 0, offsetY = -120, ...options }) {
    super({ x: owner.x, y: owner.y, ...options });
    this.owner = owner;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  update(dt) {
    this.x = this.owner.x + this.owner.facing * this.offsetX;
    this.y = this.owner.y + this.offsetY;
    this.flip = this.owner.facing < 0;
    super.update(dt);
  }
}

export class AttachedImageEffect {
  constructor({ owner, image, offsetX = 70, offsetY = -150, duration = 0.56, scale = 0.24, alpha = 1, rotation = -0.08 }) {
    this.owner = owner;
    this.image = image;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.duration = duration;
    this.scale = scale;
    this.alpha = alpha;
    this.rotation = rotation;
    this.age = 0;
    this.dead = false;
  }

  update(dt) {
    this.age += dt;
    this.dead = this.age >= this.duration || !this.owner;
  }

  render(ctx) {
    if (!this.image || !this.owner) return;
    const t = Math.min(1, this.age / this.duration);
    const fade = 1 - Math.max(0, t - 0.72) / 0.28;
    const pulse = 1 + Math.sin(t * Math.PI) * 0.045;
    const width = this.image.width * this.scale * pulse;
    const height = this.image.height * this.scale * pulse;
    ctx.save();
    ctx.translate(
      this.owner.x + this.owner.facing * this.offsetX,
      this.owner.y + this.offsetY
    );
    if (this.owner.facing < 0) ctx.scale(-1, 1);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = this.alpha * fade;
    ctx.shadowColor = "rgba(231, 195, 106, 0.72)";
    ctx.shadowBlur = 18;
    ctx.drawImage(this.image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }
}

export class FloatingText {
  constructor(text, x, y, color = "#ffd66d") {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.age = 0;
    this.dead = false;
  }

  update(dt) {
    this.age += dt;
    this.y -= dt * 42;
    this.dead = this.age > 0.8;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = 1 - this.age / 0.8;
    ctx.fillStyle = this.color;
    ctx.font = "700 24px Georgia";
    ctx.textAlign = "center";
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}
