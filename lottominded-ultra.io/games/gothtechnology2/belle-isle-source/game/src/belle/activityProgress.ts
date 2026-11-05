export type ActivityMedal = 'bronze' | 'silver' | 'gold';
export type PhotoFrame = 'classic' | 'cyan' | 'violet' | 'gold';
export type ActivityRecord = {
  baseXp: number;
  medal: ActivityMedal;
  bestScore: number;
  bestSecondsByRide: Record<string, number>;
};
export type ActivityProfile = {
  version: 1;
  records: Record<string, ActivityRecord>;
  frame: PhotoFrame;
};
export const ACTIVITY_STORAGE_KEY = 'belle-isle-activities-v1';
export const PHOTO_FRAMES: {id: PhotoFrame; label: string; xp: number; color: string}[] = [
  {id: 'classic', label: 'Field notes', xp: 0, color: '#e4dcc5'},
  {id: 'cyan', label: 'River light', xp: 200, color: '#72decf'},
  {id: 'violet', label: 'Night studio', xp: 600, color: '#baa0f2'},
  {id: 'gold', label: 'Detroit gold', xp: 1000, color: '#e7bb73'},
];
const medalRank: Record<ActivityMedal, number> = {bronze: 0, silver: 1, gold: 2};
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const safeId = (value: string) => /^[a-z0-9][a-z0-9:_-]{0,95}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
export const emptyActivityProfile = (): ActivityProfile => ({version: 1, records: {}, frame: 'classic'});
export const activityMedal = (score: number): ActivityMedal => score >= 90 ? 'gold' : score >= 75 ? 'silver' : 'bronze';
export function activityXp(profile: ActivityProfile) {
  return Object.values(profile.records).reduce((total, record) => total + record.baseXp + medalRank[record.medal] * 10, 0);
}
export function activityTitle(xp: number) {
  return xp >= 1200 ? 'Digital Static Explorer' : xp >= 900 ? 'Island Regular' : xp >= 500 ? 'Field Creator' : xp >= 200 ? 'Island Scout' : 'New Explorer';
}
/** Progress is derived from completed content; replaying cannot mint another first-clear reward. */
export function completeActivity(profile: ActivityProfile, input: {
  id: string; baseXp: number; score: number; seconds?: number; ride?: string;
}): {profile: ActivityProfile; earnedXp: number; improved: boolean; medal: ActivityMedal} {
  if (!safeId(input.id) || !Number.isFinite(input.score) || !Number.isFinite(input.baseXp) || input.baseXp < 0) {
    throw new Error('Invalid activity completion');
  }
  const score = Math.round(Math.max(0, Math.min(100, input.score)));
  const medal = activityMedal(score);
  const previous = own(profile.records, input.id) ? profile.records[input.id] : undefined;
  const bestMedal = previous && medalRank[previous.medal] > medalRank[medal] ? previous.medal : medal;
  const times = {...previous?.bestSecondsByRide};
  if (input.ride && safeId(input.ride) && Number.isFinite(input.seconds) && input.seconds! >= 0) {
    const before = own(times, input.ride) ? times[input.ride] : Infinity;
    times[input.ride] = Math.min(before, input.seconds!);
  }
  const record: ActivityRecord = {
    baseXp: previous?.baseXp ?? Math.min(1000, Math.round(input.baseXp)),
    medal: bestMedal,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    bestSecondsByRide: times,
  };
  const next = {...profile, records: {...profile.records, [input.id]: record}};
  return {profile: next, earnedXp: activityXp(next) - activityXp(profile), improved: !previous || score > previous.bestScore, medal};
}
export function readActivityProfile(value: string | null): ActivityProfile {
  if (!value) return emptyActivityProfile();
  try {
    const parsed = JSON.parse(value);
    if (parsed?.version !== 1 || !parsed.records || typeof parsed.records !== 'object' || Array.isArray(parsed.records)) return emptyActivityProfile();
    const profile = emptyActivityProfile();
    for (const [id, raw] of Object.entries(parsed.records).slice(0, 100)) {
      const record = raw as ActivityRecord;
      if (!safeId(id) || !record || !Number.isFinite(record.baseXp) || !Number.isFinite(record.bestScore) || !own(medalRank, record.medal)) continue;
      const times: Record<string, number> = {};
      if (record.bestSecondsByRide && typeof record.bestSecondsByRide === 'object') {
        for (const [ride, seconds] of Object.entries(record.bestSecondsByRide).slice(0, 4)) {
          if (safeId(ride) && Number.isFinite(seconds) && seconds >= 0) times[ride] = seconds;
        }
      }
      profile.records[id] = {
        baseXp: Math.round(Math.max(0, Math.min(1000, record.baseXp))),
        bestScore: Math.round(Math.max(0, Math.min(100, record.bestScore))),
        medal: record.medal, bestSecondsByRide: times,
      };
    }
    const frame = PHOTO_FRAMES.find(frame => frame.id === parsed.frame && frame.xp <= activityXp(profile));
    profile.frame = frame?.id ?? 'classic';
    return profile;
  } catch { return emptyActivityProfile(); }
}
