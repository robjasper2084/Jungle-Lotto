import { describe, expect, it } from 'vitest';
import { BONUS_TIERS, STREET_BONUSES, STREET_BONUS_ORDER, STREET_BONUS_SPAWN_INTERVAL_MS, STREET_BONUS_SPEED_TILES_PER_SECOND, bonusTierForSpawn } from '../config/streetBonuses';

describe('Detroit street bonuses', () => {
  it('cycles through three distinct collectible perks', () => {
    expect(STREET_BONUS_ORDER).toEqual(['cash', 'ticket', 'scratch']);
    expect(new Set(STREET_BONUS_ORDER.map(kind => STREET_BONUSES[kind].effect)).size).toBe(3);
  });

  it('gives every bonus a visible asset, reward, and timed effect', () => {
    for (const kind of STREET_BONUS_ORDER) {
      const bonus = STREET_BONUSES[kind];
      expect(bonus.texture).toMatch(/^bonus/);
      expect(bonus.score).toBeGreaterThan(0);
      expect(bonus.durationMs).toBeGreaterThanOrEqual(8000);
    }
  });

  it('runs moving bonus drops on a thirty-second cycle', () => {
    expect(STREET_BONUS_SPAWN_INTERVAL_MS).toBe(30_000);
    expect(STREET_BONUS_SPEED_TILES_PER_SECOND).toBeGreaterThan(0);
  });

  it('deterministically distributes bronze, silver, and gold rarity tiers', () => {
    const first = Array.from({ length: 80 }, (_, index) => bonusTierForSpawn(index % 10, index, 313_777));
    const second = Array.from({ length: 80 }, (_, index) => bonusTierForSpawn(index % 10, index, 313_777));
    expect(first).toEqual(second);
    expect(new Set(first)).toEqual(new Set(['bronze', 'silver', 'gold']));
    expect(BONUS_TIERS.gold.scoreMultiplier).toBeGreaterThan(BONUS_TIERS.silver.scoreMultiplier);
    expect(BONUS_TIERS.silver.durationMultiplier).toBeGreaterThan(BONUS_TIERS.bronze.durationMultiplier);
  });
});
