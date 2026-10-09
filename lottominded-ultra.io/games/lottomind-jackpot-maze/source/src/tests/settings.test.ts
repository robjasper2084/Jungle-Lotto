import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, loadSettings, normalizeSettings, saveSettings } from '../services/settings';

afterEach(() => vi.unstubAllGlobals());

describe('saved settings', () => {
  it.each([null, 7, [], 'broken'])('falls back safely for malformed values: %j', value => {
    expect(normalizeSettings(value)).toEqual(defaultSettings);
  });

  it('clamps audio and rejects invalid presentation and speed values', () => {
    expect(normalizeSettings({ musicVolume: 9, effectsVolume: -2, hudScale: 'huge', gameSpeed: 900, reducedMotion: 'false' }))
      .toMatchObject({ musicVolume: 1, effectsVolume: 0, hudScale: 1, gameSpeed: 1, reducedMotion: false });
    expect(normalizeSettings({ musicVolume: NaN, effectsVolume: Infinity })).toMatchObject({ musicVolume: 0.36, effectsVolume: 0.72 });
  });

  it('keeps valid custom bindings and supplies missing defaults', () => {
    expect(normalizeSettings({ p1Bindings: { up: 'KeyI', down: null } }).p1Bindings)
      .toEqual({ ...defaultSettings.p1Bindings, up: 'KeyI' });
  });

  it('isolates fallback bindings between sessions', () => {
    const first = normalizeSettings(null);
    first.p1Bindings.up = 'KeyQ';
    expect(normalizeSettings(null).p1Bindings.up).toBe('KeyW');
  });

  it('continues when storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } });
    expect(loadSettings()).toEqual(defaultSettings);
    expect(() => saveSettings(defaultSettings)).not.toThrow();
  });
});
