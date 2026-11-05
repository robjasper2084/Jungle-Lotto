import { describe, expect, it } from 'vitest';
import { clearCheckpoint, loadCheckpoint, saveCheckpoint } from '../services/checkpoint';
import type { GameCheckpoint } from '../types/game';

function storageMock() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
}

const checkpoint: GameCheckpoint = {
  version: 1, savedAt: '2026-07-12T00:00:00.000Z', world: 4,
  draw: { mode: 'pick3', main: [1, 2, 3] }, playStyle: 'coop', score: 9400, activePlayer: 0,
  playerScores: [4900, 4500], playerLives: [2, 1], playerShields: [true, false],
  lives: 2, shielded: true, revealed: [1, null, null], nextReveal: 1, pellets: 42,
  villainEncounters: 3, powerUpsUsed: 2
};

describe('run checkpoints', () => {
  it.each([
    { version: 1, world: 0 },
    { ...checkpoint, world: 0.5 },
    { ...checkpoint, playerLives: null },
    { ...checkpoint, score: -1 },
    { ...checkpoint, draw: { mode: 'pick3', main: [99, 2, 3] } },
    { ...checkpoint, remainingHeartKeys: 'bad' },
    { ...checkpoint, levelMissionStats: {} },
    { ...checkpoint, revealed: [] },
    { ...checkpoint, levelGrades: 'S' }
  ])('ignores malformed saved data without crashing: %j', value => {
    expect(loadCheckpoint({ getItem: () => JSON.stringify(value) })).toBeNull();
  });

  it('saves and restores a valid level checkpoint', () => {
    const storage = storageMock();
    saveCheckpoint(checkpoint, storage);
    expect(loadCheckpoint(storage)).toEqual(checkpoint);
  });

  it('clears a saved run', () => {
    const storage = storageMock();
    saveCheckpoint(checkpoint, storage);
    clearCheckpoint(storage);
    expect(loadCheckpoint(storage)).toBeNull();
  });

  it('restores exact heart progress from the first level', () => {
    const storage = storageMock();
    const firstLevel = { ...checkpoint, world: 0, remainingHeartKeys: ['1,1', '4,1'], remainingPowerKeys: ['1,1'], worldCollected: 12 };
    saveCheckpoint(firstLevel, storage);
    expect(loadCheckpoint(storage)).toEqual(firstLevel);
  });

  it('rejects a completed run as resumable', () => {
    const storage = storageMock();
    saveCheckpoint({ ...checkpoint, world: 10 }, storage);
    expect(loadCheckpoint(storage)).toBeNull();
  });
});
