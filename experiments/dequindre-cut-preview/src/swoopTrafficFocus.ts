export type TrafficObserver = { id: string; x: number; z: number; speed: number; heading: number };
type Point = { x: number; z: number };
let observers: readonly TrafficObserver[] = [];
let interest: readonly Point[] = [];

/** Shared only by the isolated preview's adapted source world. Distances keep
 * the original thresholds; this supplies the union of all current view points.
 */
export function setPreviewTrafficFocus(drivers: readonly TrafficObserver[], views: readonly Point[]) {
  for (let i = 0; i < drivers.length; i++) if (!Number.isFinite(drivers[i].x) || !Number.isFinite(drivers[i].z)) throw new Error('Traffic focus must contain finite source-map coordinates');
  for (let i = 0; i < views.length; i++) if (!Number.isFinite(views[i].x) || !Number.isFinite(views[i].z)) throw new Error('Traffic focus must contain finite source-map coordinates');
  observers = drivers;
  interest = views;
}

export function clearPreviewTrafficFocus() { observers = []; interest = []; }

export function previewTrafficDistance(x: number, z: number, fallbackX: number, fallbackZ: number) {
  if (!interest.length) return Math.hypot(x - fallbackX, z - fallbackZ);
  let distance = Infinity;
  for (const point of interest) distance = Math.min(distance, Math.hypot(x - point.x, z - point.z));
  return distance;
}

export function previewTrafficObservers(x: number, z: number, intent: { speed: number; heading: number }): readonly TrafficObserver[] {
  return observers.length ? observers : [{ id: 'source-player', x, z, ...intent }];
}
