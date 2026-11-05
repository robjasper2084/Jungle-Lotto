import { describe, expect, it } from 'vitest';
import { EMPTY_MISSION_STATS, evaluateDetroitMissions, missionDefinitions } from '../config/detroitMissions';

describe('Detroit district missions', () => {
  it('assigns three distinct short goals to every map', () => {
    for (let level = 0; level < 10; level += 1) {
      const definitions = missionDefinitions(level);
      expect(definitions).toHaveLength(3);
      expect(new Set(definitions.map(mission => mission.stat)).size).toBe(3);
      expect(definitions.every(mission => mission.reward >= 500)).toBe(true);
    }
  });

  it('caps visible progress and marks reached targets complete', () => {
    const initial = evaluateDetroitMissions(0, EMPTY_MISSION_STATS);
    expect(initial.every(mission => !mission.complete)).toBe(true);
    const complete = evaluateDetroitMissions(0, { hearts: 99, portals: 99, bonuses: 99, villains: 99, bestStreak: 99 });
    expect(complete.every(mission => mission.complete && mission.current === mission.target)).toBe(true);
  });
});
