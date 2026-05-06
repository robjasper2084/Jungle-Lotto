import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, ROUND_SECONDS } from "../config/constants.js";
import { drawSpriteFrame } from "../engine/assets.js";

const panel = (ctx, x, y, w, h, stroke = COLORS.gold) => {
  ctx.save();
  ctx.fillStyle = "rgba(4, 3, 3, 0.72)";
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "rgba(216, 170, 69, 0.25)";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

export const drawBar = (ctx, x, y, w, h, pct, color, back = "rgba(255,255,255,0.12)", flip = false) => {
  ctx.save();
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  const fill = Math.max(0, Math.min(1, pct)) * w;
  const gx = flip ? x + w - fill : x;
  const grad = ctx.createLinearGradient(gx, y, gx + fill, y);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "#fff2ba");
  ctx.fillStyle = grad;
  ctx.fillRect(gx, y, fill, h);
  ctx.strokeStyle = "rgba(255, 226, 150, 0.56)";
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
};

export const drawFightHud = (ctx, game) => {
  const [p1, p2] = game.fighters;
  panel(ctx, 28, 24, 502, 112);
  panel(ctx, 750, 24, 502, 112, COLORS.blue);
  drawBar(ctx, 52, 54, 450, 22, p1.health / p1.config.maxHealth, "#d84332");
  drawBar(ctx, 778, 54, 450, 22, p2.health / p2.config.maxHealth, "#d84332", "rgba(255,255,255,0.12)", true);
  drawBar(ctx, 52, 92, 292, 14, p1.meter / 100, "#4bb7ff");
  drawBar(ctx, 936, 92, 292, 14, p2.meter / 100, "#4bb7ff", "rgba(255,255,255,0.12)", true);

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.white;
  ctx.font = "700 21px Georgia";
  ctx.textAlign = "left";
  ctx.fillText(p1.config.name, 52, 37);
  ctx.fillStyle = COLORS.gold;
  ctx.font = "700 13px system-ui";
  ctx.fillText(p1.config.title.toUpperCase(), 52, 121);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.white;
  ctx.font = "700 21px Georgia";
  ctx.fillText(p2.config.name, 1228, 37);
  ctx.fillStyle = COLORS.blue;
  ctx.font = "700 13px system-ui";
  ctx.fillText(p2.config.title.toUpperCase(), 1228, 121);

  ctx.textAlign = "center";
  panel(ctx, 561, 18, 158, 98, COLORS.goldBright);
  ctx.fillStyle = COLORS.goldBright;
  ctx.font = "800 44px Georgia";
  ctx.fillText(String(Math.max(0, Math.ceil(game.roundTimer))).padStart(2, "0"), 640, 60);
  ctx.fillStyle = COLORS.white;
  ctx.font = "700 13px system-ui";
  ctx.fillText(`ROUND ${game.roundNumber}`, 640, 96);

  for (let i = 0; i < 2; i += 1) {
    ctx.fillStyle = i < p1.roundWins ? COLORS.goldBright : "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.arc(370 + i * 22, 99, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i < p2.roundWins ? COLORS.blue : "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.arc(910 - i * 22, 99, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255, 246, 211, 0.78)";
  ctx.font = "700 12px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`P1 MOTION: ${p1.motion}`, 36, 160);
  ctx.textAlign = "right";
  ctx.fillText(`P2 MOTION: ${p2.motion}`, 1244, 160);

  if (p1.comboHits >= 2) {
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = "800 28px Georgia";
    ctx.fillText(`${p1.comboHits} HIT COMBO`, 64, 208);
  }
  if (p2.comboHits >= 2) {
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.blue;
    ctx.font = "800 28px Georgia";
    ctx.fillText(`${p2.comboHits} HIT COMBO`, 1216, 208);
  }

  ctx.fillStyle = "rgba(255, 246, 211, 0.72)";
  ctx.font = "700 12px system-ui";
  ctx.textAlign = "center";
  const mode = `${game.training ? "TRAINING" : "ARCADE"} ${game.cpuEnabled ? "CPU EZRA" : "LOCAL 2P"} ${game.debug ? "DEBUG BOXES" : ""}`;
  ctx.fillText(mode, 640, 139);
  ctx.restore();
};

export const drawTitle = (ctx, game) => {
  drawBackdropGrade(ctx);
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.goldBright;
  ctx.shadowColor = COLORS.goldBright;
  ctx.shadowBlur = 18;
  ctx.font = "900 76px Georgia";
  ctx.fillText("GOTHTECHNOLOGY", CANVAS_WIDTH / 2, 190);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.blue;
  ctx.font = "700 20px system-ui";
  ctx.fillText("KALYX VS MASTER EZRA", CANVAS_WIDTH / 2, 236);
  drawMenuButton(ctx, 494, 318, 292, 54, "START");
  drawMenuButton(ctx, 494, 390, 292, 54, "TRAINING");
  drawMenuButton(ctx, 494, 462, 292, 54, game.cpuEnabled ? "CPU EZRA: ON" : "CPU EZRA: OFF");
  ctx.fillStyle = "rgba(255, 246, 211, 0.55)";
  ctx.font = "700 13px system-ui";
  ctx.fillText("Docs: public/gothtechnology-canvas/docs", CANVAS_WIDTH / 2, 650);
  ctx.restore();
};

export const drawLoading = (ctx, progress) => {
  drawBackdropGrade(ctx);
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.goldBright;
  ctx.font = "900 48px Georgia";
  ctx.fillText("GOTHTECHNOLOGY", CANVAS_WIDTH / 2, 292);
  drawBar(ctx, 390, 348, 500, 16, progress, COLORS.goldBright);
  ctx.fillStyle = COLORS.blue;
  ctx.font = "700 15px system-ui";
  ctx.fillText("LOADING CUSTOM ASSETS", CANVAS_WIDTH / 2, 388);
  ctx.restore();
};

export const drawCharacterSelect = (ctx, game) => {
  drawBackdropGrade(ctx);
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 42px Georgia";
  ctx.fillText("CHARACTER SELECT", 640, 86);
  drawDossierCard(ctx, 90, 128, 500, 420, "KALYX", "Fast rushdown / claws / fire slash", game.assets.images.dossierVespera, COLORS.gold);
  drawDossierCard(ctx, 690, 128, 500, 420, "MASTER EZRA", "Zoning control / blue magic / owl arc", game.assets.images.dossierMalach, COLORS.blue);
  drawMenuButton(ctx, 494, 594, 292, 54, "VERSUS");
  ctx.fillStyle = "rgba(255, 246, 211, 0.58)";
  ctx.font = "700 13px system-ui";
  ctx.fillText(game.cpuEnabled ? "MASTER EZRA CPU ENABLED" : "LOCAL TWO-PLAYER ENABLED", 640, 670);
  ctx.restore();
};

export const drawVersus = (ctx, game) => {
  drawBackdropGrade(ctx);
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.goldBright;
  ctx.font = "900 44px Georgia";
  ctx.fillText("VERSUS", 640, 122);
  const [p1, p2] = game.fighters;
  drawFighterPortrait(ctx, p1, 360, 572, 1.5);
  drawFighterPortrait(ctx, p2, 920, 572, 1.45);
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 34px Georgia";
  ctx.fillText("KALYX", 340, 210);
  ctx.fillText("MASTER EZRA", 920, 210);
  ctx.fillStyle = COLORS.blue;
  ctx.font = "700 18px system-ui";
  ctx.fillText("BEST OF THREE / 99 SECONDS", 640, 628);
  ctx.restore();
};

export const drawPause = (ctx, game) => {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  panel(ctx, 436, 204, 408, 284, COLORS.goldBright);
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.goldBright;
  ctx.font = "900 42px Georgia";
  ctx.fillText("PAUSED", 640, 280);
  ctx.fillStyle = COLORS.white;
  ctx.font = "700 16px system-ui";
  ctx.fillText(game.training ? "TRAINING MODE" : "ARCADE MATCH", 640, 336);
  ctx.fillText(game.cpuEnabled ? "CPU MASTER EZRA" : "LOCAL TWO-PLAYER", 640, 366);
  ctx.fillText(game.audio.muted ? "AUDIO MUTED" : "AUDIO ACTIVE", 640, 396);
  ctx.restore();
};

export const drawRoundMessage = (ctx, text, subtext = "") => {
  ctx.save();
  ctx.textAlign = "center";
  ctx.shadowColor = COLORS.goldBright;
  ctx.shadowBlur = 24;
  ctx.fillStyle = COLORS.goldBright;
  ctx.font = "900 74px Georgia";
  ctx.fillText(text, 640, 324);
  ctx.shadowBlur = 0;
  if (subtext) {
    ctx.fillStyle = COLORS.white;
    ctx.font = "700 22px system-ui";
    ctx.fillText(subtext, 640, 370);
  }
  ctx.restore();
};

export const drawMenuButton = (ctx, x, y, w, h, label) => {
  panel(ctx, x, y, w, h, COLORS.gold);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.goldBright;
  ctx.font = "900 22px Georgia";
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.restore();
};

const drawDossierCard = (ctx, x, y, w, h, name, subtitle, img, color) => {
  panel(ctx, x, y, w, h, color);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 14, y + 14, w - 28, h - 96, 6);
  ctx.clip();
  ctx.globalAlpha = 0.86;
  if (img) ctx.drawImage(img, x + 14, y - 20, w - 28, h + 70);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(x + 14, y + h - 82, w - 28, 64);
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = "left";
  ctx.font = "900 28px Georgia";
  ctx.fillText(name, x + 32, y + h - 50);
  ctx.fillStyle = color;
  ctx.font = "700 14px system-ui";
  ctx.fillText(subtitle.toUpperCase(), x + 32, y + h - 25);
  ctx.restore();
};

const drawFighterPortrait = (ctx, fighter, x, y, scale) => {
  const anim = fighter.assets.animations[fighter.config.manifestKey]?.IDLE;
  if (anim) {
    const frame = Math.floor(performance.now() / 140) % anim.frames.length;
    drawSpriteFrame(ctx, anim, frame, x, y, {
      scale,
      flip: fighter.config.id === "MASTER_EZRA",
      alpha: 0.96
    });
    return frame;
  }
};

export const drawBackdropGrade = (ctx) => {
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, "#090908");
  grad.addColorStop(0.52, "#11100d");
  grad.addColorStop(1, "#020202");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
};

export const drawDiagnostics = (ctx, game) => {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(16, 606, 370, 82);
  ctx.fillStyle = COLORS.blue;
  ctx.font = "700 12px ui-monospace, Consolas, monospace";
  ctx.textAlign = "left";
  const lines = [
    `phase=${game.phase} hitstop=${game.hitstop.toFixed(2)} projectiles=${game.projectiles.length} effects=${game.effects.length}`,
    `p1 hp=${Math.round(game.fighters[0].health)} meter=${Math.round(game.fighters[0].meter)} cd=${game.fighters[0].specialCooldown.toFixed(1)}`,
    `p2 hp=${Math.round(game.fighters[1].health)} meter=${Math.round(game.fighters[1].meter)} cd=${game.fighters[1].specialCooldown.toFixed(1)}`
  ];
  lines.forEach((line, i) => ctx.fillText(line, 28, 628 + i * 18));
  ctx.restore();
};
