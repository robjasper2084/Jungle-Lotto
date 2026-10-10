import { describe, expect, it } from 'vitest';
import { LOTTERY_RULES } from '../config/lotteryRules';
import { generateFromRule, generateLotteryDraw } from '../services/secureRandom';

describe('secure lottery generation', () => {
  it('returns exactly three Pick 3 digits and allows repeated digits', () => {
    const draw = generateLotteryDraw('pick3');
    expect(draw.main).toHaveLength(3);
    expect(draw.main.every(value => value >= 0 && value <= 9)).toBe(true);
    const repeated = generateFromRule(LOTTERY_RULES.pick3, { getRandomValues: array => { (array as unknown as Uint32Array)[0] = 4; return array; }, randomUUID: crypto.randomUUID, subtle: crypto.subtle } as Crypto);
    expect(repeated.main).toEqual([4, 4, 4]);
  });

  it('returns exactly four Pick 4 digits', () => {
    const draw = generateLotteryDraw('pick4');
    expect(draw.main).toHaveLength(4);
    expect(draw.main.every(value => value >= 0 && value <= 9)).toBe(true);
  });

  it.each([
    ['megaMillions', 70, 24],
    ['powerball', 69, 26]
  ] as const)('%s returns sorted unique in-range main and special balls', (mode, maxMain, maxSpecial) => {
    for (let index = 0; index < 100; index += 1) {
      const draw = generateLotteryDraw(mode);
      expect(draw.main).toHaveLength(5);
      expect(new Set(draw.main).size).toBe(5);
      expect(draw.main).toEqual([...draw.main].sort((a, b) => a - b));
      expect(draw.main.every(value => value >= 1 && value <= maxMain)).toBe(true);
      expect(draw.special).toBeGreaterThanOrEqual(1);
      expect(draw.special).toBeLessThanOrEqual(maxSpecial);
    }
  });

  it('rejects impossible unique configurations with a clear error', () => {
    expect(() => generateFromRule({ ...LOTTERY_RULES.megaMillions, mainCount: 8, mainMin: 1, mainMax: 3 })).toThrow('unique main number range');
  });
});
