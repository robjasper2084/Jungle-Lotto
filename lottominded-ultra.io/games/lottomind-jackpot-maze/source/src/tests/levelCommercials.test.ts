import { describe, expect, it } from 'vitest';
import { LEVEL_COMMERCIALS, commercialForCompletedLevel, shouldShowCommercialAfterLevel } from '../config/levelCommercials';

describe('between-level Detroit broadcasts', () => {
  it('rotates both commercials across the every-two-level breaks', () => {
    expect(LEVEL_COMMERCIALS).toHaveLength(2);
    expect(commercialForCompletedLevel(1)).toBe(LEVEL_COMMERCIALS[0]);
    expect(commercialForCompletedLevel(3)).toBe(LEVEL_COMMERCIALS[1]);
    expect(commercialForCompletedLevel(5)).toBe(LEVEL_COMMERCIALS[0]);
    expect(commercialForCompletedLevel(7)).toBe(LEVEL_COMMERCIALS[1]);
  });

  it('shows a broadcast after levels two, four, six, and eight only', () => {
    expect(Array.from({ length: 9 }, (_, index) => shouldShowCommercialAfterLevel(index))).toEqual([
      false, true, false, true, false, true, false, true, false
    ]);
  });

  it('uses optimized MP4 clips with lightweight WebP posters', () => {
    for (const commercial of LEVEL_COMMERCIALS) {
      expect(commercial.file.endsWith('.mp4')).toBe(true);
      expect(commercial.poster.endsWith('.webp')).toBe(true);
    }
  });
});
