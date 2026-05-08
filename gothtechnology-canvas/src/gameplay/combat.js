import { rectsOverlap } from "../engine/math.js";
import { ATTACKS } from "../config/moves.js?v=fast-60feel1";
import { FloatingText, SpriteEffect } from "./effects.js";

export function resolveMelee(attacker, defender, game) {
  const attackState = attacker.currentAttack;
  if (!attackState || attackState.hitTargets.has(defender.id) || defender.invulnerable > 0 || defender.isKO) return;
  const attack = attackState.data;
  if (!attack.active) return;
  const elapsed = attackState.elapsed;
  if (elapsed < attack.active[0] || elapsed > attack.active[1]) return;
  const box = attacker.getAttackBox();
  if (!box || !rectsOverlap(box, defender.hurtbox)) return;
  attackState.hitTargets.add(defender.id);
  if (attackState.name === "throw" && Math.abs(attacker.x - defender.x) > 76) return;
  game.resolveIncomingHit(attacker, defender, attack, {
    box,
    projectile: false,
    level: attack.level,
    sourceName: attackState.name
  });
}

export function applyHit(attacker, defender, attack, game, meta = {}) {
  const isBlocked = defender.isBlocking(meta.level ?? attack.level, attacker);
  const comboScale = Math.max(0.52, 1 - Math.max(0, attacker.comboHits) * 0.1);
  const baseDamage = isBlocked ? attack.chip ?? 0 : Math.round((attack.damage ?? 50) * comboScale);
  const damage = Math.max(isBlocked ? 1 : 8, baseDamage);
  const stun = isBlocked ? attack.blockstun ?? 0.2 : attack.stun ?? 0.25;
  const direction = attacker.x < defender.x ? 1 : -1;
  const knockback = direction * (isBlocked ? (attack.knockback ?? 160) * 0.32 : attack.knockback ?? 180);

  defender.takeHit({
    damage,
    stun,
    knockback,
    attackName: meta.sourceName,
    blocked: isBlocked,
    chipOnly: isBlocked
  });

  attacker.meter = Math.min(100, attacker.meter + (attack.meter ?? 8));
  if (isBlocked) defender.meter = Math.min(100, defender.meter + 5);

  if (!isBlocked) {
    attacker.comboHits += 1;
    attacker.comboTimer = 1.25;
    game.hitstop = Math.max(game.hitstop, meta.sourceName === "super" ? 0.065 : 0.03);
    game.effects.push(new FloatingText(`${damage}`, defender.x, defender.y - 178, "#ffd66d"));
    game.effects.push(new SpriteEffect({
      x: meta.box?.x + (meta.box?.w ?? 0) / 2 || defender.x,
      y: meta.box?.y + 96 || defender.y - 120,
      image: game.assets.images.hitSpark,
      duration: 0.28,
      scale: meta.sourceName === "super" ? 0.68 : 0.42,
      flip: direction < 0
    }));
    game.audio.beep(meta.sourceName === "super" ? "super" : "hit");
  } else {
    game.effects.push(new FloatingText("BLOCK", defender.x, defender.y - 165, "#9ed8ff"));
    game.effects.push(new SpriteEffect({
      x: defender.x + direction * -28,
      y: defender.y - 22,
      image: game.assets.images.blockShield,
      duration: 0.28,
      scale: 0.48,
      flip: direction < 0
    }));
    game.audio.beep("block");
  }
}

export function attackFromName(name) {
  return ATTACKS[name];
}
