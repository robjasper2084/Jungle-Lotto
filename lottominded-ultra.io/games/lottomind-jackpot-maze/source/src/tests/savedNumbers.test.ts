import { describe, expect, it } from 'vitest';
import { loadSavedResults, saveResult } from '../services/savedNumbers';
import type { SavedResult } from '../types/game';

class MemoryStorage {
  value: string | null = null;
  getItem() { return this.value; }
  setItem(_key: string, value: string) { this.value = value; }
}

describe('saved results', () => {
  it('saves and loads a result', () => {
    const storage = new MemoryStorage();
    const result: SavedResult = { id: '1', mode: 'pick3', main: [1, 1, 7], createdAt: '2026-01-01T00:00:00.000Z', level: 3, score: 777, villainEncounters: 2, powerUpsUsed: 1 };
    saveResult(result, storage);
    expect(loadSavedResults(storage)).toEqual([result]);
  });
});
