import { describe, expect, it } from 'vitest';
import { DETROIT_EVENTS, DETROIT_EVENT_DURATION_MS, DETROIT_EVENT_INTERVAL_MS, eventForLevel } from '../config/detroitEvents';

describe('Detroit landmark events', () => {
  it('gives all ten levels a named event', () => {
    expect(DETROIT_EVENTS).toHaveLength(10);
    expect(new Set(DETROIT_EVENTS.map(event => event.name)).size).toBe(10);
    expect(DETROIT_EVENTS.every(event => event.callout.length > 12)).toBe(true);
  });

  it('runs on the audited 45 to 60 second cadence', () => {
    expect(DETROIT_EVENT_INTERVAL_MS).toBeGreaterThanOrEqual(45_000);
    expect(DETROIT_EVENT_INTERVAL_MS).toBeLessThanOrEqual(60_000);
    expect(DETROIT_EVENT_DURATION_MS).toBeGreaterThanOrEqual(5_000);
  });

  it('wraps level lookups safely', () => {
    expect(eventForLevel(10)).toEqual(DETROIT_EVENTS[0]);
    expect(eventForLevel(-1)).toEqual(DETROIT_EVENTS[9]);
  });
});
