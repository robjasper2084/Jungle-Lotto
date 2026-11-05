import { describe, expect, it } from 'vitest';
import { loadPlayerProgress, recordCompletedRun, selectCosmetic } from '../services/playerProgress';
import type { SavedResult } from '../types/game';

function storageMock() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }
  };
}

const result: SavedResult = {
  id: 'run-1', createdAt: '2026-07-16T12:00:00.000Z', level: 10, mode: 'pick3', main: [3, 7, 13],
  score: 30_000, villainEncounters: 4, powerUpsUsed: 7, missionsCompleted: 10, runVariant: 'daily'
};

describe('persistent player progress', () => {
  it('unlocks rewards from lifetime score, missions, completion, and Daily play', () => {
    const storage = storageMock();
    const recorded = recordCompletedRun(result, storage);
    expect(recorded.progress.unlocked).toEqual(expect.arrayContaining(['motorGold', 'riverIce', 'purple313', 'jackpotChrome']));
    expect(recorded.newUnlocks).toHaveLength(4);
  });

  it('only selects an unlocked cosmetic', () => {
    const storage = storageMock();
    expect(selectCosmetic('motorGold', storage).selected).toBe('classic');
    recordCompletedRun(result, storage);
    expect(selectCosmetic('motorGold', storage).selected).toBe('motorGold');
    expect(loadPlayerProgress(storage).selected).toBe('motorGold');
  });
});
