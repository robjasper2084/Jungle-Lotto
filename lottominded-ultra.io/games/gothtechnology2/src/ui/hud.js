import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, ROUND_SECONDS } from "../config/constants.js";
import { FIGHTERS } from "../config/assets.js?v=future-hud20-cpu-select";
import { GAME_MODES, ROSTER_CARD_LAYOUT, ROSTER_IDS, STAGES } from "../config/content.js?v=future-hud20-cpu-select";
import { drawSpriteFrame } from "../engine/assets.js?v=future-hud20-cpu-select";

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

const FUTURE = {
  cyan: "#67e8ff",
  red: "#ff405d",
  amber: "#ffc857",
  white: "#eefaff",
  muted: "#78909c",
  line: "rgba(103, 232, 255, 0.18)",
  panel: "rgba(4, 10, 15, 0.94)"
};

const HUD_FONT = '"Arial Narrow", "Segoe UI", system-ui, sans-serif';
const HUD_MONO = 'Consolas, "Courier New", monospace';

const angularPath = (ctx, x, y, w, h, cut = 14) => {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
};

const drawAngularPanel = (ctx, x, y, w, h, fill, stroke, lineWidth = 1.5, cut = 14) => {
  ctx.save();
  angularPath(ctx, x, y, w, h, cut);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
};

const drawFutureBackdrop = (ctx) => {
  ctx.save();
  ctx.fillStyle = "#020509";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const field = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  field.addColorStop(0, "rgba(255, 64, 93, 0.1)");
  field.addColorStop(0.36, "rgba(5, 12, 18, 0.18)");
  field.addColorStop(0.68, "rgba(5, 12, 18, 0.18)");
  field.addColorStop(1, "rgba(103, 232, 255, 0.1)");
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.strokeStyle = FUTURE.line;
  ctx.lineWidth = 1;
  for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= CANVAS_HEIGHT; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.018)";
  for (let y = 1; y < CANVAS_HEIGHT; y += 4) ctx.fillRect(0, y, CANVAS_WIDTH, 1);
  ctx.fillStyle = FUTURE.red;
  ctx.fillRect(0, 0, 4, CANVAS_HEIGHT);
  ctx.fillStyle = FUTURE.cyan;
  ctx.fillRect(CANVAS_WIDTH - 4, 0, 4, CANVAS_HEIGHT);
  ctx.restore();
};

const drawFutureButton = (ctx, x, y, w, h, kicker, label, tone) => {
  drawAngularPanel(ctx, x, y, w, h, "rgba(3, 9, 13, 0.96)", tone, 2, 12);
  ctx.save();
  ctx.fillStyle = tone;
  ctx.fillRect(x + 16, y + 13, 4, h - 26);
  ctx.textAlign = "left";
  ctx.fillStyle = FUTURE.muted;
  ctx.font = `800 10px ${HUD_MONO}`;
  ctx.fillText(kicker, x + 34, y + 21);
  ctx.fillStyle = FUTURE.white;
  let fontSize = 20;
  ctx.font = `900 ${fontSize}px ${HUD_FONT}`;
  while (fontSize > 13 && ctx.measureText(label).width > w - 58) {
    fontSize -= 1;
    ctx.font = `900 ${fontSize}px ${HUD_FONT}`;
  }
  ctx.fillText(label, x + 34, y + 46);
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.moveTo(x + w - 28, y + h / 2 - 8);
  ctx.lineTo(x + w - 18, y + h / 2);
  ctx.lineTo(x + w - 28, y + h / 2 + 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawSelectionTarget = (ctx, x, y, w, h, role, fighterName, active, tone) => {
  drawAngularPanel(
    ctx,
    x,
    y,
    w,
    h,
    active ? "rgba(7, 25, 32, 0.98)" : "rgba(2, 8, 12, 0.88)",
    active ? tone : "rgba(126, 160, 174, 0.42)",
    active ? 2 : 1,
    8
  );
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = active ? tone : FUTURE.muted;
  ctx.font = `900 11px ${HUD_MONO}`;
  ctx.fillText(role, x + 16, y + h / 2);
  ctx.fillStyle = active ? FUTURE.white : "rgba(238, 250, 255, 0.66)";
  let fontSize = 12;
  ctx.font = `900 ${fontSize}px ${HUD_FONT}`;
  while (fontSize > 9 && ctx.measureText(fighterName).width > w - 92) {
    fontSize -= 1;
    ctx.font = `900 ${fontSize}px ${HUD_FONT}`;
  }
  ctx.fillText(fighterName, x + 76, y + h / 2);
  ctx.fillStyle = active ? tone : FUTURE.muted;
  ctx.fillRect(x + w - 28, y + h / 2 - 1, 12, 2);
  ctx.restore();
};

const drawTitleAction = (ctx, x, y, w, h, index, label, tone) => {
  drawAngularPanel(ctx, x, y, w, h, "rgba(2, 8, 12, 0.84)", tone, 1.5, 10);
  ctx.save();
  ctx.fillStyle = tone;
  ctx.fillRect(x + 14, y + 10, 3, h - 20);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = FUTURE.muted;
  ctx.font = `800 10px ${HUD_MONO}`;
  ctx.fillText(index, x + 28, y + h / 2);
  ctx.fillStyle = FUTURE.white;
  ctx.font = `900 18px ${HUD_FONT}`;
  ctx.fillText(label, x + 68, y + h / 2);
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.moveTo(x + w - 28, y + h / 2 - 6);
  ctx.lineTo(x + w - 18, y + h / 2);
  ctx.lineTo(x + w - 28, y + h / 2 + 6);
  ctx.closePath();
  ctx.fill();
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
  const hudScale = Math.max(0.8, Math.min(1, Number(game.settings?.hudScale) || 1));
  ctx.save();
  if (hudScale !== 1) {
    ctx.translate(CANVAS_WIDTH / 2, 0);
    ctx.scale(hudScale, hudScale);
    ctx.translate(-CANVAS_WIDTH / 2, 0);
  }
  if (game.settings?.highContrast) {
    ctx.fillStyle = "rgba(0,0,0,0.88)";
    ctx.fillRect(18, 12, CANVAS_WIDTH - 36, 144);
  }
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

  if (game.debug) {
    ctx.fillStyle = "rgba(255, 246, 211, 0.78)";
    ctx.font = "700 12px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`P1 MOTION: ${p1.motion}`, 36, 160);
    ctx.textAlign = "right";
    ctx.fillText(`P2 MOTION: ${p2.motion}`, 1244, 160);
  } else if (game.rewardStatusTimer > 0 && game.rewardStatus) {
    ctx.fillStyle = COLORS.blue;
    ctx.font = "800 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(game.rewardStatus, 640, 160);
  }

  if (p1.comboHits >= 2) {
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = "800 28px Georgia";
    ctx.fillText(`${p1.comboHits} HIT COMBO`, 64, 208);
    ctx.font = "800 15px system-ui";
    ctx.fillText(`${Math.round(p1.comboDamage ?? 0)} DAMAGE`, 66, 232);
  }
  if (p2.comboHits >= 2) {
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.blue;
    ctx.font = "800 28px Georgia";
    ctx.fillText(`${p2.comboHits} HIT COMBO`, 1216, 208);
    ctx.font = "800 15px system-ui";
    ctx.fillText(`${Math.round(p2.comboDamage ?? 0)} DAMAGE`, 1214, 232);
  }

  ctx.fillStyle = "rgba(255, 246, 211, 0.72)";
  ctx.font = "700 12px system-ui";
  ctx.textAlign = "center";
  const opponentMode = game.training
    ? `DUMMY ${game.trainingDummyMode.toUpperCase()}`
    : (game.cpuEnabled ? `CPU ${game.cpuDifficulty.toUpperCase()} ${p2.config.name}` : "LOCAL 2P");
  const mode = `${GAME_MODES[game.gameMode]?.label || "VERSUS"} ${opponentMode} ${game.debug ? "DEBUG BOXES" : ""}`;
  ctx.fillText(mode, 640, 139);
  if (game.training) {
    panel(ctx, 386, game.showFrameData ? 548 : 612, 508, game.showFrameData ? 148 : 72, COLORS.blue);
    ctx.fillStyle = COLORS.white;
    ctx.font = "800 12px system-ui";
    const seconds = (game.trainingRecording.length / 60).toFixed(1);
    ctx.fillText(`DUMMY ${game.trainingDummyMode.toUpperCase()}   RECORDING ${seconds}s`, 640, game.showFrameData ? 594 : 632);
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = "900 15px system-ui";
    ctx.fillText(`INPUT ${game.inputLog?.slice(0, 5).join("  /  ") ?? "READY"}`, 640, game.showFrameData ? 620 : 660);
    if (game.showFrameData) {
      const attack = p1.currentAttack?.data;
      const frame = p1.getMotionFrameIndex();
      const active = attack?.activeFrames?.includes(frame);
      ctx.fillStyle = active ? "#8ff0a4" : COLORS.white;
      ctx.font = "800 12px ui-monospace, Consolas, monospace";
      ctx.fillText(`${p1.motion}  FRAME ${frame + 1}  ${active ? "ACTIVE" : "INACTIVE"}`, 640, 646);
      ctx.fillStyle = COLORS.blue;
      ctx.fillText(attack ? `START ${attack.startup?.toFixed(2) ?? "-"}  ACTIVE ${attack.active?.map((value) => value.toFixed(2)).join("-") ?? "-"}  REC ${attack.recovery?.toFixed(2) ?? "-"}` : "READY STATE", 640, 670);
      const readout = game.trainingReadout;
      if (readout) {
        ctx.fillStyle = readout.outcome === "hit" ? "#8ff0a4" : COLORS.goldBright;
        ctx.fillText(`${readout.outcome.toUpperCase()}  ADV ${readout.advantageFrames >= 0 ? "+" : ""}${readout.advantageFrames}F  DAMAGE ${Math.round(readout.damage)}  SCALE ${Math.round(readout.comboScale * 100)}%`, 640, 694);
      }
    }
  }
  ctx.restore();
  ctx.restore();
};

export const drawTitle = (ctx, game) => {
  ctx.save();
  ctx.fillStyle = "rgba(2, 7, 11, 0.82)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, 126);
  ctx.fillStyle = FUTURE.red;
  ctx.fillRect(28, 30, 280, 2);
  ctx.fillStyle = FUTURE.cyan;
  ctx.fillRect(972, 30, 280, 2);
  ctx.fillStyle = FUTURE.muted;
  ctx.font = `800 10px ${HUD_MONO}`;
  ctx.textAlign = "left";
  ctx.fillText("LM-84 // DETROIT COMBAT NETWORK", 28, 22);
  ctx.textAlign = "right";
  ctx.fillText("3 FIGHTERS // 6 ARENAS // LINK READY", 1252, 22);
  ctx.textAlign = "center";
  ctx.fillStyle = FUTURE.white;
  ctx.shadowColor = "rgba(103, 232, 255, 0.42)";
  ctx.shadowBlur = 18;
  ctx.font = `900 54px ${HUD_FONT}`;
  ctx.fillText("GOTHTECHNOLOGY", CANVAS_WIDTH / 2, 78);
  ctx.shadowBlur = 0;
  ctx.fillStyle = FUTURE.cyan;
  ctx.font = `800 12px ${HUD_MONO}`;
  ctx.fillText("MOTOR CITY COMBAT PROTOCOL", CANVAS_WIDTH / 2, 106);

  const footer = ctx.createLinearGradient(0, 504, 0, CANVAS_HEIGHT);
  footer.addColorStop(0, "rgba(2, 7, 11, 0)");
  footer.addColorStop(0.2, "rgba(2, 7, 11, 0.82)");
  footer.addColorStop(1, "rgba(2, 7, 11, 0.96)");
  ctx.fillStyle = footer;
  ctx.fillRect(0, 504, CANVAS_WIDTH, 216);
  drawTitleAction(ctx, 124, 552, 312, 46, "01", "VERSUS", FUTURE.red);
  drawTitleAction(ctx, 484, 552, 312, 46, "02", "ARCADE", FUTURE.amber);
  drawTitleAction(ctx, 844, 552, 312, 46, "03", "TRAINING", FUTURE.cyan);
  drawTitleAction(ctx, 124, 610, 312, 46, "04", "REPLAY", FUTURE.cyan);
  drawTitleAction(ctx, 484, 610, 312, 46, "05", "GAME SELECT", FUTURE.amber);
  drawTitleAction(ctx, 844, 610, 312, 46, "06", "SETTINGS", FUTURE.red);
  ctx.fillStyle = FUTURE.muted;
  ctx.font = `700 10px ${HUD_MONO}`;
  const cpuLabel = game.cpuEnabled ? `CPU ${game.cpuDifficulty.toUpperCase()}` : "LOCAL 2P";
  ctx.fillText(`${cpuLabel} // ${game.stats.matches} MATCHES // ${game.stats.wins} WINS // ${game.stats.arcadeClears} ARCADE CLEARS // ENTER TO DEPLOY`, CANVAS_WIDTH / 2, 692);
  ctx.restore();
};

export const drawGameSelect = (ctx, game, games) => {
  drawMenuCoverWash(ctx);
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 42px Georgia";
  ctx.fillText("GAME SELECT", 640, 88);
  ctx.fillStyle = COLORS.blue;
  ctx.font = "700 15px system-ui";
  ctx.fillText("CLICK A GAME OR PRESS LEFT / RIGHT, THEN ENTER", 640, 122);

  drawGameCard(ctx, 88, 154, 512, 396, games[0], game.gameSelectIndex === 0, "fighter", game.assets?.images?.[games[0].imageKey]);
  drawGameCard(ctx, 680, 154, 512, 396, games[1], game.gameSelectIndex === 1, "runGun", game.assets?.images?.[games[1].imageKey]);
  drawMenuButton(ctx, 494, 596, 292, 54, "BACK");
  ctx.restore();
};

const drawGameCard = (ctx, x, y, w, h, item, selected, variant, titleArt) => {
  const stroke = selected ? COLORS.goldBright : variant === "runGun" ? COLORS.blue : COLORS.gold;
  panel(ctx, x, y, w, h, stroke);
  const artX = x + 14;
  const artY = y + 14;
  const artW = w - 28;
  const artH = h - 112;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(artX, artY, artW, artH, 6);
  ctx.clip();
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, variant === "runGun" ? "#080b12" : "#0b0808");
  grad.addColorStop(0.56, variant === "runGun" ? "#101922" : "#15110c");
  grad.addColorStop(1, "#020202");
  ctx.fillStyle = grad;
  ctx.fillRect(artX, artY, artW, artH);
  if (titleArt?.complete && titleArt.naturalWidth > 0) {
    drawCoverImage(ctx, titleArt, artX, artY, artW, artH);
    const imageGrade = ctx.createLinearGradient(artX, artY, artX, artY + artH);
    imageGrade.addColorStop(0, "rgba(0,0,0,0.04)");
    imageGrade.addColorStop(0.72, "rgba(0,0,0,0.02)");
    imageGrade.addColorStop(1, "rgba(0,0,0,0.48)");
    ctx.fillStyle = imageGrade;
    ctx.fillRect(artX, artY, artW, artH);
  } else if (variant === "fighter") {
    drawFighterGameArt(ctx, x, y, w, h);
  } else {
    drawRunGunGameArt(ctx, x, y, w, h);
  }
  if (selected) {
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.fillRect(artX + 14, artY + 14, 96, 28);
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("SELECTED", artX + 62, artY + 33);
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.76)";
  ctx.fillRect(x + 14, y + h - 96, w - 28, 78);
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.goldBright;
  ctx.font = "900 14px system-ui";
  ctx.fillText(item.badge, x + 32, y + h - 70);
  ctx.fillStyle = COLORS.white;
  ctx.font = "900 29px Georgia";
  ctx.fillText(item.title, x + 32, y + h - 42);
  ctx.fillStyle = selected ? COLORS.goldBright : "rgba(255, 246, 211, 0.72)";
  ctx.font = "700 13px system-ui";
  ctx.fillText(item.subtitle.toUpperCase(), x + 32, y + h - 20);
  if (selected) {
    ctx.strokeStyle = COLORS.goldBright;
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
  }
  ctx.restore();
};

const drawFighterGameArt = (ctx, x, y, w, h) => {
  const baseY = y + 292;
  ctx.strokeStyle = "rgba(255, 214, 109, 0.2)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + 20 + i * 68, y + 26);
    ctx.lineTo(x - 30 + i * 68, baseY + 4);
    ctx.stroke();
  }
  drawMenuFighterSilhouette(ctx, x + 176, baseY, -1, COLORS.goldBright);
  drawMenuFighterSilhouette(ctx, x + 336, baseY, 1, COLORS.blue);
};

const drawMenuFighterSilhouette = (ctx, x, y, facing, color) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.fillStyle = "rgba(0,0,0,0.9)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -116, 42, 72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -198, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(30, -150);
  ctx.lineTo(94, -166);
  ctx.lineTo(102, -150);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-18, -52);
  ctx.lineTo(-44, 0);
  ctx.moveTo(24, -52);
  ctx.lineTo(58, 0);
  ctx.stroke();
  ctx.restore();
};

const drawRunGunGameArt = (ctx, x, y, w, h) => {
  const horizon = y + 116;
  ctx.fillStyle = "rgba(139, 212, 255, 0.14)";
  for (let i = 0; i < 8; i += 1) ctx.fillRect(x + 40 + i * 58, horizon + i % 2 * 12, 34, 120);
  ctx.fillStyle = "#15110c";
  ctx.fillRect(x + 14, y + 272, w - 28, 36);
  ctx.fillStyle = COLORS.gold;
  for (let i = 0; i < 12; i += 1) ctx.fillRect(x + 28 + i * 42, y + 286, 18, 4);
  ctx.save();
  ctx.translate(x + 170, y + 272);
  ctx.fillStyle = "#050403";
  ctx.strokeStyle = COLORS.goldBright;
  ctx.lineWidth = 3;
  ctx.fillRect(-28, -92, 48, 78);
  ctx.strokeRect(-28, -92, 48, 78);
  ctx.beginPath();
  ctx.arc(-4, -116, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = COLORS.blue;
  ctx.beginPath();
  ctx.moveTo(18, -72);
  ctx.lineTo(96, -82);
  ctx.stroke();
  ctx.fillStyle = COLORS.blue;
  ctx.fillRect(98, -88, 18, 10);
  ctx.restore();
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = "rgba(255, 214, 109, 0.9)";
    ctx.beginPath();
    ctx.arc(x + 326 + i * 46, y + 190 + i % 2 * 30, 15, 0, Math.PI * 2);
    ctx.fill();
  }
};

export const drawLoading = (ctx, progress, backdrop = null) => {
  if (backdrop?.complete && backdrop.naturalWidth > 0) drawCoverImage(ctx, backdrop);
  else drawBackdropGrade(ctx);
  drawMenuCoverWash(ctx);
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
  drawFutureBackdrop(ctx);
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(3, 8, 12, 0.92)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, 122);
  ctx.fillStyle = FUTURE.red;
  ctx.fillRect(32, 40, 292, 2);
  ctx.fillStyle = FUTURE.cyan;
  ctx.fillRect(956, 40, 292, 2);
  ctx.fillStyle = FUTURE.muted;
  ctx.font = `800 11px ${HUD_MONO}`;
  ctx.textAlign = "left";
  ctx.fillText("LM-84 // COMBAT NETWORK", 32, 28);
  ctx.textAlign = "right";
  ctx.fillText(`ARENA ${String(game.stageIndex + 1).padStart(2, "0")} // DETROIT GRID`, 1248, 28);
  ctx.textAlign = "center";
  ctx.fillStyle = FUTURE.white;
  ctx.font = `900 38px ${HUD_FONT}`;
  ctx.fillText("FIGHTER LINK", 640, 58);
  ctx.fillStyle = FUTURE.cyan;
  ctx.font = `800 13px ${HUD_MONO}`;
  ctx.fillText(`${GAME_MODES[game.gameMode]?.label || "VERSUS"} PROTOCOL // SELECT COMBATANT`, 640, 88);
  const opponentRole = game.training ? "DUMMY" : (game.cpuEnabled ? "CPU" : "P2");
  drawSelectionTarget(ctx, 352, 98, 272, 32, "P1", FIGHTERS[game.player1Id].name, game.selectTarget !== "p2", FUTURE.cyan);
  drawSelectionTarget(ctx, 656, 98, 272, 32, opponentRole, FIGHTERS[game.player2Id].name, game.selectTarget === "p2", FUTURE.red);
  for (const [index, layout] of ROSTER_CARD_LAYOUT.entries()) {
    const characterId = ROSTER_IDS[index];
    const config = FIGHTERS[characterId];
    const { x, y, w, h } = layout;
    const color = config.palette;
    const preview = { assets: game.assets, config };
    const selected = game.player1Id === characterId;
    const opponent = game.player2Id === characterId;
    drawCharacterCard(ctx, x, y, w, h, preview, config.name, config.title, selected, opponent, color, index);
    if (selected) drawSelectBadge(ctx, x + 48, y + 36, "P1", FUTURE.cyan);
    if (opponent) drawSelectBadge(ctx, x + w - 52, y + 36, game.training ? "DUMMY" : (game.cpuEnabled ? "CPU" : "P2"), FUTURE.red);
  }
  drawFutureButton(ctx, 330, 568, 292, 64, "ARENA SELECT", STAGES[game.stageIndex].name, FUTURE.amber);
  drawFutureButton(ctx, 658, 568, 292, 64, "MATCH COMMAND", "ENGAGE", FUTURE.red);
  ctx.fillStyle = FUTURE.muted;
  ctx.font = `700 11px ${HUD_MONO}`;
  ctx.textAlign = "center";
  ctx.fillText(`${game.selectTarget === "p2" ? opponentRole : "P1"} TARGET // CLICK FIGHTER // UP-DOWN SWITCH TARGET // ENTER TO DEPLOY`, 640, 658);
  if (game.motionLoadError || game.fightLoadError) {
    ctx.fillStyle = FUTURE.red;
    ctx.fillText("LINK FAILURE // SELECT VERSUS TO RETRY", 640, 687);
  } else if (!game.matchAssetsReady) {
    const progress = Math.round(((game.motionLoadingProgress + game.fightLoadingProgress) / 2) * 100);
    ctx.fillStyle = FUTURE.cyan;
    ctx.fillText(`SYNCING COMBAT ASSETS // ${progress}%`, 640, 687);
  } else {
    ctx.fillStyle = FUTURE.white;
    ctx.fillText(game.training ? "TRAINING TARGET ONLINE" : (game.cpuEnabled ? `HOSTILE LINK // ${FIGHTERS[game.player2Id].name} // ${game.cpuDifficulty.toUpperCase()}` : "LOCAL DUEL LINK // TWO CONTROLLERS READY"), 640, 687);
  }
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
  ctx.fillText(p1.config.name, 340, 210);
  ctx.fillText(p2.config.name, 920, 210);
  ctx.fillStyle = COLORS.blue;
  ctx.font = "700 18px system-ui";
  if (!game.matchAssetsReady) {
    const percent = Math.round(((game.motionLoadingProgress + game.fightLoadingProgress) / 2) * 100);
    ctx.fillText(`PREPARING FIGHTERS ${percent}%`, 640, 628);
  } else {
    ctx.fillText("BEST OF THREE / 99 SECONDS", 640, 628);
  }
  ctx.restore();
};

const drawSelectBadge = (ctx, x, y, label, tone = FUTURE.cyan) => {
  ctx.save();
  const width = label.length > 3 ? 88 : 58;
  drawAngularPanel(ctx, x - width / 2, y - 20, width, 30, "rgba(2, 7, 11, 0.98)", tone, 2, 7);
  ctx.fillStyle = tone;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 13px ${HUD_MONO}`;
  ctx.fillText(label, x, y - 5);
  ctx.restore();
};

export const drawPause = (ctx, game) => {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  panel(ctx, 344, 112, 592, 516, COLORS.goldBright);
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.goldBright;
  ctx.font = "900 42px Georgia";
  ctx.fillText("PAUSED", 640, 178);
  ctx.fillStyle = COLORS.white;
  ctx.font = "700 16px system-ui";
  ctx.fillText(game.training ? "TRAINING MODE" : "ARCADE MATCH", 640, 222);
  ctx.fillText(game.training ? `DUMMY ${game.trainingDummyMode.toUpperCase()}` : (game.cpuEnabled ? `CPU ${game.cpuDifficulty.toUpperCase()} ${game.fighters[1]?.config.name ?? "FIGHTER"}` : "LOCAL TWO-PLAYER / GAMEPADS READY"), 640, 250);
  ctx.fillText(game.audio.muted ? "AUDIO MUTED" : "AUDIO ACTIVE", 640, 278);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255, 246, 211, 0.9)";
  ctx.font = "800 14px system-ui";
  const moves = [
    "P1 MOVE: A/D    JUMP: W    CROUCH: S",
    "STRIKES: J / U / K / I    SPECIAL: L    SUPER: O",
    "THROW: H    ASSISTS: N / M    DASH: SHIFT    TAUNT: Y",
    game.cpuEnabled ? "GAMEPAD 1 READY    CONTROLS OPENS KEY REMAPPING" : "P2: ARROWS + RIGHT-SIDE KEYS OR GAMEPAD 2",
    "P OR ESC RESUMES    LIGHT > HEAVY > SPECIAL > SUPER"
  ];
  moves.forEach((line, index) => ctx.fillText(line, 414, 326 + index * 27));
  drawMenuButton(ctx, 454, 484, 172, 48, "RESUME");
  drawMenuButton(ctx, 654, 484, 172, 48, "CONTROLS");
  drawMenuButton(ctx, 454, 540, 172, 48, "RESTART");
  drawMenuButton(ctx, 654, 540, 172, 48, "TITLE");
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
  let fontSize = 22;
  ctx.font = `900 ${fontSize}px Georgia`;
  while (fontSize > 13 && ctx.measureText(label).width > w - 24) {
    fontSize -= 1;
    ctx.font = `900 ${fontSize}px Georgia`;
  }
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.restore();
};

const drawCharacterCard = (ctx, x, y, w, h, fighter, name, subtitle, selected, opponent, color, index) => {
  const tone = selected ? FUTURE.cyan : (opponent ? FUTURE.red : "rgba(126, 160, 174, 0.58)");
  drawAngularPanel(ctx, x, y, w, h, FUTURE.panel, tone, selected || opponent ? 2.5 : 1.25, 16);
  ctx.save();
  angularPath(ctx, x + 8, y + 8, w - 16, h - 100, 11);
  ctx.clip();
  const grade = ctx.createLinearGradient(x, y, x, y + h);
  grade.addColorStop(0, selected ? "#0b2029" : (opponent ? "#210b12" : "#081017"));
  grade.addColorStop(0.56, "#060b10");
  grade.addColorStop(1, "#020407");
  ctx.fillStyle = grade;
  ctx.fillRect(x + 8, y + 8, w - 16, h - 100);
  ctx.strokeStyle = "rgba(103, 232, 255, 0.1)";
  ctx.lineWidth = 1;
  for (let gx = x + 24; gx < x + w - 12; gx += 32) {
    ctx.beginPath();
    ctx.moveTo(gx, y + 8);
    ctx.lineTo(gx, y + h - 92);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let sy = y + 12; sy < y + h - 94; sy += 6) ctx.fillRect(x + 8, sy, w - 16, 1);
  ctx.fillStyle = selected ? "rgba(103, 232, 255, 0.12)" : (opponent ? "rgba(255, 64, 93, 0.1)" : "rgba(255,255,255,0.035)");
  ctx.fillRect(x + 8, y + h - 110, w - 16, 18);
  if (fighter) drawFighterPortrait(ctx, fighter, x + w / 2, y + h - 92, 0.82);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = "rgba(2, 6, 10, 0.98)";
  ctx.fillRect(x + 1, y + h - 94, w - 2, 93);
  ctx.fillStyle = tone;
  ctx.fillRect(x + 18, y + h - 83, 4, 62);
  ctx.textAlign = "left";
  ctx.fillStyle = FUTURE.muted;
  ctx.font = `800 10px ${HUD_MONO}`;
  ctx.fillText(`FTR-${String(index + 1).padStart(2, "0")} // ${selected ? "LINKED" : (opponent ? "HOSTILE" : "STANDBY")}`, x + 34, y + h - 70);
  ctx.fillStyle = FUTURE.white;
  let nameSize = 22;
  ctx.font = `900 ${nameSize}px ${HUD_FONT}`;
  while (nameSize > 15 && ctx.measureText(name).width > w - 54) {
    nameSize -= 1;
    ctx.font = `900 ${nameSize}px ${HUD_FONT}`;
  }
  ctx.fillText(name, x + 34, y + h - 43);
  ctx.fillStyle = color;
  ctx.font = `800 11px ${HUD_MONO}`;
  ctx.fillText(subtitle.toUpperCase(), x + 34, y + h - 22);
  ctx.fillStyle = tone;
  ctx.fillRect(x + w - 48, y + h - 34, 26, 3);
  ctx.restore();
};

const drawFighterPortrait = (ctx, fighter, x, y, scale) => {
  const anim = fighter.assets.animations[fighter.config.manifestKey]?.IDLE;
  if (anim) {
    const frame = Math.floor(performance.now() / 140) % anim.frames.length;
    drawSpriteFrame(ctx, anim, frame, x, y, {
      scale,
      flip: fighter.config.manifestKey === "MASTER_EZRA",
      alpha: 0.96,
      filter: fighter.config.renderFilter ?? "none"
    });
    return frame;
  }
  const portrait = fighter.assets.images[fighter.config.rosterPortraitKey];
  if (portrait?.naturalWidth > 0) {
    const width = portrait.naturalWidth * scale;
    const height = portrait.naturalHeight * scale;
    ctx.drawImage(portrait, x - width / 2, y - height, width, height);
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

const drawCoverImage = (ctx, image, x = 0, y = 0, width = CANVAS_WIDTH, height = CANVAS_HEIGHT) => {
  const scale = Math.max(width / image.width, height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
};

const drawMenuCoverWash = (ctx) => {
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, "rgba(0,0,0,0.38)");
  grad.addColorStop(0.42, "rgba(0,0,0,0.18)");
  grad.addColorStop(0.74, "rgba(0,0,0,0.42)");
  grad.addColorStop(1, "rgba(0,0,0,0.78)");
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
