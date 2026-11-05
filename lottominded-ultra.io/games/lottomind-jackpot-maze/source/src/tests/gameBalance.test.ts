import { describe, expect, it } from 'vitest';
import { BOSS_RECOVERY_MS, DETROIT_LEVELS, HEART_BASE_SCORE, HEART_GRID_SPACING, HEART_SIZE, LEVEL_ONE_HEART_CAP, MIND_COIN_FRIGHTENED_MS, VILLAIN_RECOVERY_MS, VILLAIN_WAVES, heartGridSpacingForLevel, villainCountForLevel } from '../config/gameBalance';

describe('Mind Coin villain recovery balance', () => {
  it('defines a generous vulnerable and recovery window for every Detroit map', () => {
    expect(MIND_COIN_FRIGHTENED_MS).toHaveLength(DETROIT_LEVELS.length);
    expect(VILLAIN_RECOVERY_MS).toHaveLength(DETROIT_LEVELS.length);
    expect(Math.min(...MIND_COIN_FRIGHTENED_MS)).toBeGreaterThanOrEqual(10000);
    expect(Math.min(...VILLAIN_RECOVERY_MS)).toBeGreaterThanOrEqual(10000);
    expect(BOSS_RECOVERY_MS).toBeGreaterThanOrEqual(9000);
  });

  it('ramps difficulty gradually instead of cutting timers abruptly', () => {
    for (let level = 1; level < DETROIT_LEVELS.length; level += 1) {
      expect(MIND_COIN_FRIGHTENED_MS[level - 1] - MIND_COIN_FRIGHTENED_MS[level]).toBeLessThanOrEqual(250);
      expect(VILLAIN_RECOVERY_MS[level - 1] - VILLAIN_RECOVERY_MS[level]).toBeLessThanOrEqual(250);
    }
  });
});

describe('classic maze-chase rhythm', () => {
  it('alternates patrol and chase before ending in a lasting chase', () => {
    expect(VILLAIN_WAVES.map(wave => wave.tactic)).toEqual([
      'scatter', 'chase', 'scatter', 'chase', 'scatter', 'chase', 'scatter', 'chase'
    ]);
    expect(VILLAIN_WAVES.slice(0, -1).every(wave => Number.isFinite(wave.durationMs))).toBe(true);
    expect(VILLAIN_WAVES.at(-1)?.durationMs).toBe(Number.POSITIVE_INFINITY);
  });

  it('keeps hearts readable but frequent enough to guide each corridor', () => {
    expect(HEART_GRID_SPACING).toBe(3);
    expect(heartGridSpacingForLevel(0)).toBe(5);
    expect(heartGridSpacingForLevel(1)).toBe(5);
    expect(heartGridSpacingForLevel(9)).toBe(3);
    expect(HEART_SIZE).toBe(20);
    expect(HEART_BASE_SCORE).toBeGreaterThanOrEqual(20);
    expect(LEVEL_ONE_HEART_CAP).toBe(60);
  });

  it('teaches four villains before Jackpot Patrol joins on level three', () => {
    expect(villainCountForLevel(0)).toBe(4);
    expect(villainCountForLevel(1)).toBe(4);
    expect(villainCountForLevel(2)).toBe(5);
    expect(villainCountForLevel(9)).toBe(5);
  });
});
