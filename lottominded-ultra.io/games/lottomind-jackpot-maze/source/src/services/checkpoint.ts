import type { GameCheckpoint } from '../types/game';
import { LOTTERY_RULES } from '../config/lotteryRules';
import { gameStorage } from './storage';

const KEY = 'lottomind.jackpotMaze.checkpoint.v1';

function validCheckpoint(value: GameCheckpoint | null): value is GameCheckpoint {
  if (!value || value.version !== 1 || !Number.isInteger(value.world) || value.world < 0 || value.world >= 10) return false;
  const nonnegative = (number: unknown): number is number => typeof number === 'number' && Number.isFinite(number) && number >= 0;
  const pair = (items: unknown, valid: (item: unknown) => boolean) => Array.isArray(items) && items.length === 2 && items.every(valid);
  const rule = value.draw && Object.hasOwn(LOTTERY_RULES, value.draw.mode) ? LOTTERY_RULES[value.draw.mode] : null;
  if (!rule || !Array.isArray(value.draw.main) || value.draw.main.length !== rule.mainCount) return false;
  if (!value.draw.main.every(number => Number.isInteger(number) && number >= rule.mainMin && number <= rule.mainMax)) return false;
  if (rule.uniqueMain && new Set(value.draw.main).size !== rule.mainCount) return false;
  if (rule.special && (!Number.isInteger(value.draw.special) || value.draw.special! < rule.special.min || value.draw.special! > rule.special.max)) return false;
  const slots = rule.mainCount + (rule.special ? 1 : 0);
  if (typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt))) return false;
  if (!['solo', 'alternating', 'coop'].includes(value.playStyle) || ![0, 1].includes(value.activePlayer)) return false;
  if (value.runVariant !== undefined && !['classic', 'daily', 'timeAttack'].includes(value.runVariant)) return false;
  if (!pair(value.playerScores, nonnegative) || !pair(value.playerLives, number => nonnegative(number) && Number.isInteger(number))) return false;
  if (!pair(value.playerShields, item => typeof item === 'boolean') || typeof value.shielded !== 'boolean') return false;
  if (!Array.isArray(value.revealed) || value.revealed.length !== slots || !value.revealed.every(number => number === null || nonnegative(number))) return false;
  for (const key of ['score', 'lives', 'nextReveal', 'pellets', 'villainEncounters', 'powerUpsUsed'] as const) {
    if (!nonnegative(value[key]) || !Number.isInteger(value[key])) return false;
  }
  if (value.nextReveal > slots) return false;
  for (const key of ['bonusesCollected', 'worldCollected', 'bossHealth', 'bestCombo', 'eventsCompleted', 'missedBonuses', 'levelTimeRemainingMs', 'missionsCompleted'] as const) {
    if (value[key] !== undefined && !nonnegative(value[key])) return false;
  }
  for (const key of ['remainingHeartKeys', 'remainingPowerKeys', 'missionRewardsClaimed'] as const) {
    if (value[key] !== undefined && (!Array.isArray(value[key]) || !value[key]!.every(item => typeof item === 'string'))) return false;
  }
  if (value.levelGrades !== undefined && (!Array.isArray(value.levelGrades) || !value.levelGrades.every(grade => ['S', 'A', 'B', 'C'].includes(grade)))) return false;
  if (value.levelMissionStats !== undefined && (!value.levelMissionStats || !['hearts', 'portals', 'bonuses', 'villains', 'bestStreak'].every(key => nonnegative(value.levelMissionStats![key as keyof typeof value.levelMissionStats])))) return false;
  return true;
}

export function loadCheckpoint(storage: Pick<Storage, 'getItem'> = gameStorage): GameCheckpoint | null {
  try {
    const value = JSON.parse(storage.getItem(KEY) ?? 'null') as GameCheckpoint | null;
    return validCheckpoint(value) ? value : null;
  } catch { return null; }
}

export function saveCheckpoint(checkpoint: GameCheckpoint, storage: Pick<Storage, 'setItem'> = gameStorage): GameCheckpoint {
  storage.setItem(KEY, JSON.stringify(checkpoint));
  return checkpoint;
}

export function clearCheckpoint(storage: Pick<Storage, 'removeItem'> = gameStorage): void {
  storage.removeItem(KEY);
}
