import type { ControlBindings, ControlPreset } from '../types/game';
import { gameStorage } from './storage';

export interface GameSettings {
  reducedMotion: boolean;
  highContrast: boolean;
  screenShake: boolean;
  gameSpeed: number;
  muted: boolean;
  musicVolume: number;
  effectsVolume: number;
  p1Controls: ControlPreset;
  p2Controls: ControlPreset;
  tutorialSeen: boolean;
  haptics: boolean;
  p1Bindings: ControlBindings;
  p2Bindings: ControlBindings;
  hudScale: number;
}

const KEY = 'lottomind.jackpotMaze.settings.v1';
export const defaultSettings: GameSettings = {
  reducedMotion: false, highContrast: false, screenShake: true, gameSpeed: 1, muted: false,
  musicVolume: 0.36, effectsVolume: 0.72, p1Controls: 'wasd', p2Controls: 'arrows', tutorialSeen: false, haptics: true,
  p1Bindings: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', power: 'Space' },
  p2Bindings: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', power: 'Enter' },
  hudScale: 1
};

export function normalizeSettings(value: unknown): GameSettings {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<GameSettings> : {};
  const settings = { ...defaultSettings, p1Bindings: { ...defaultSettings.p1Bindings }, p2Bindings: { ...defaultSettings.p2Bindings } };
  for (const key of ['reducedMotion', 'highContrast', 'screenShake', 'muted', 'tutorialSeen', 'haptics'] as const) {
    if (typeof saved[key] === 'boolean') settings[key] = saved[key];
  }
  for (const key of ['musicVolume', 'effectsVolume', 'hudScale'] as const) {
    const number = saved[key];
    if (typeof number === 'number' && Number.isFinite(number)) {
      settings[key] = key === 'hudScale' ? Math.min(1.24, Math.max(0.8, number)) : Math.min(1, Math.max(0, number));
    }
  }
  if ([0.8, 1, 1.2].includes(saved.gameSpeed!)) settings.gameSpeed = saved.gameSpeed!;
  for (const key of ['p1Controls', 'p2Controls'] as const) {
    if (['wasd', 'arrows', 'ijkl'].includes(saved[key]!)) settings[key] = saved[key]!;
  }
  for (const key of ['p1Bindings', 'p2Bindings'] as const) {
    for (const action of ['up', 'down', 'left', 'right', 'power'] as const) {
      const code = saved[key]?.[action];
      if (typeof code === 'string' && /^[A-Za-z][A-Za-z0-9]{0,30}$/.test(code)) settings[key][action] = code;
    }
  }
  return settings;
}

export function loadSettings(): GameSettings {
  try {
    return normalizeSettings(JSON.parse(gameStorage.getItem(KEY) ?? '{}'));
  }
  catch { return normalizeSettings(null); }
}

export function saveSettings(settings: GameSettings): void {
  gameStorage.setItem(KEY, JSON.stringify(normalizeSettings(settings)));
}
