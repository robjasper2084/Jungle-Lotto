import type {TrialCourse, TrialVehicle} from './trialRules.ts';

export const TRIAL_STORAGE_KEY = 'belle-isle-trials-v1';
export type TrialStorage = {getItem(key: string): string | null; setItem(key: string, value: string): void};
export type TrialRecord = {courseId: string; vehicle: TrialVehicle; seconds: number; splits: number[]};
export type TrialRecordResult = {improved: boolean; saved: boolean; best: number | null};

const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9][a-z0-9:_-]{0,95}$/.test(id)
  && !['constructor', 'prototype', '__proto__'].includes(id);
const validVehicle = (vehicle: unknown): vehicle is TrialVehicle => vehicle === 'onewheel' || vehicle === 'hoverbike';
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
  && Number.isSafeInteger(Math.round(value * 100));
const keyOf = (course: Pick<TrialCourse, 'id' | 'vehicle'>) => `${course.vehicle}:${course.id}`;

function readSplits(value: unknown, seconds: number): number[] | null {
  if (!Array.isArray(value) || value.length > 512) return null;
  let previous = 0;
  const splits: number[] = [];
  for (const split of value) {
    if (!validTime(split) || split < previous || split > seconds + 1e-9) return null;
    splits.push(split); previous = split;
  }
  return splits;
}

function browserStorage(): TrialStorage | null {
  try { return globalThis.localStorage ?? null; }
  catch { return null; }
}

/** Device-local, versioned course records; no network or account rewards. */
export class TrialRecords {
  available = false;
  private storage: TrialStorage | null;
  private records = new Map<string, TrialRecord>();

  constructor(storage: TrialStorage | null = browserStorage()) {
    this.storage = storage;
    if (!storage) return;
    let value: string | null;
    try { value = storage.getItem(TRIAL_STORAGE_KEY); this.available = true; }
    catch { this.storage = null; return; }
    if (!value) return;
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1
        || !('records' in parsed) || !Array.isArray(parsed.records)) return;
      for (const raw of parsed.records.slice(0, 256)) {
        if (!raw || typeof raw !== 'object' || !validId(raw.courseId) || !validVehicle(raw.vehicle) || !validTime(raw.seconds)) continue;
        const record: TrialRecord = {courseId: raw.courseId, vehicle: raw.vehicle, seconds: raw.seconds,
          splits: readSplits(raw.splits, raw.seconds) ?? []};
        const key = keyOf({id: record.courseId, vehicle: record.vehicle});
        const previous = this.records.get(key);
        if (!previous || record.seconds < previous.seconds) this.records.set(key, record);
      }
    } catch { /* A malformed profile starts fresh; unrelated game saves are untouched. */ }
  }

  best(course: Pick<TrialCourse, 'id' | 'vehicle'>): number | null {
    return this.records.get(keyOf(course))?.seconds ?? null;
  }

  /** Save only a completed TrialRun. In-memory bests remain usable if storage fails. */
  save(course: TrialCourse, seconds: number, splits: number[] = []): TrialRecordResult {
    const before = this.best(course);
    const validSplits = readSplits(splits, seconds);
    if (!validId(course.id) || !validVehicle(course.vehicle) || !validTime(seconds) || validSplits === null
      || (validSplits.length > 0 && (validSplits.length !== course.gates.length
        || Math.abs(validSplits[validSplits.length - 1] - seconds) > 1e-7))) {
      return {improved: false, saved: false, best: before};
    }
    const improved = before === null || seconds < before;
    if (improved) this.records.set(keyOf(course), {courseId: course.id, vehicle: course.vehicle, seconds, splits: validSplits});
    let saved = false;
    if (this.storage) {
      try {
        this.storage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({version: 1, records: [...this.records.values()]}));
        saved = true; this.available = true;
      } catch { this.available = false; }
    }
    return {improved, saved, best: this.best(course)};
  }
}
