import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe('session storage fallback', () => {
  it('retains writes and removals when persistent storage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => 'old checkpoint',
      setItem() { throw new Error('quota'); },
      removeItem() { throw new Error('blocked'); }
    });
    const { gameStorage, isStorageUnavailable } = await import('../services/storage');
    gameStorage.setItem('progress', 'new progress');
    expect(gameStorage.getItem('progress')).toBe('new progress');
    gameStorage.removeItem('checkpoint');
    expect(gameStorage.getItem('checkpoint')).toBeNull();
    expect(isStorageUnavailable()).toBe(true);
  });

  it('falls back when accessing localStorage itself is prohibited', async () => {
    vi.stubGlobal('localStorage', undefined);
    const { gameStorage } = await import('../services/storage');
    expect(gameStorage.getItem('missing')).toBeNull();
    gameStorage.setItem('progress', 'session');
    expect(gameStorage.getItem('progress')).toBe('session');
  });

  it('uses persistent storage normally when it is available', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    });
    const { gameStorage, isStorageUnavailable } = await import('../services/storage');
    gameStorage.setItem('progress', 'saved');
    expect(values.get('progress')).toBe('saved');
    expect(gameStorage.getItem('progress')).toBe('saved');
    gameStorage.removeItem('progress');
    expect(values.has('progress')).toBe(false);
    expect(isStorageUnavailable()).toBe(false);
  });
});
