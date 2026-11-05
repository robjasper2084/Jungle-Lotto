import type {TrialCourse, TrialPoint} from './trialRules.ts';

export type TrialDeviation = {offCourse: boolean; horizontal: number; vertical: number};

/** Distance to the authored route, with a narrower return boundary to avoid HUD chatter. */
export function trialDeviation(course: TrialCourse, actor: TrialPoint, wasOffCourse = false): TrialDeviation {
  const flying = course.vehicle === 'hoverbike';
  const horizontalLimit = flying ? 22 : 7;
  const verticalLimit = flying ? 9 : Infinity;
  let best = Infinity, horizontal = Infinity, vertical = Infinity;
  const path = course.path.length > 1 ? course.path : [course.start, ...course.gates];
  for (let index = 1; index < path.length; index++) {
    const a = path[index - 1], b = path[index];
    const dx = b.x - a.x, dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((actor.x - a.x) * dx + (actor.z - a.z) * dz) / lengthSquared)) : 0;
    const lateral = Math.hypot(actor.x - a.x - dx * t, actor.z - a.z - dz * t);
    const height = Math.abs(actor.y - (a.y + (b.y - a.y) * t));
    const score = (lateral / horizontalLimit) ** 2 + (height / verticalLimit) ** 2;
    if (score < best) { best = score; horizontal = lateral; vertical = height; }
  }
  return {offCourse: Number.isFinite(best) && best > (wasOffCourse ? .72 ** 2 : 1), horizontal, vertical};
}
