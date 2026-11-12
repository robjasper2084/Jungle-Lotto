/** Visual-only idle heave. Metres and seconds; never owns a simulation pose. */
export const IDLE_HOVER = Object.freeze({
  amplitude: .05, frequencyHz: .65, windAmplitude: .008,
  windHzA: .11, windHzB: .173, settleSeconds: .4,
  enterRate: 3, exitRate: 10, viewRate: 8, firstPersonScale: .2,
  maxSpeed: .2, maxLift: .12, maxYawRate: .08,
  minHeight: .4, fullHeight: 1, maxDelta: .25, teleportDistance: 8,
});
const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const damp = (from: number, to: number, rate: number, dt: number) =>
  to + (from - to) * Math.exp(-rate * dt);
const smooth = (value: number) => { const t = clamp01(value); return t * t * (3 - 2 * t); };

export interface IdleHoverPose {
  x: number; y: number; z: number; heading: number; speed: number; lift: number;
}
export interface IdleHoverState {
  flying: boolean; landed: boolean; landing: boolean;
  collision: boolean; hazard: boolean; racing: boolean;
  running: boolean; reducedMotion: boolean; inputActive: boolean;
  height: number; firstPerson: boolean;
}
const MOVEMENT_KEYS = [
  'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyE', 'KeyQ', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyG', 'KeyR', 'KeyF',
] as const;
/** Raw intent matters even when opposite keys cancel or a gear suppresses drive. */
export function idleHoverInputActive(
  pressed: ReadonlySet<string>, stick: Readonly<{x: number; y: number}>,
  assistedLift: number, cruise: boolean, boost: boolean,
): boolean {
  if (!Number.isFinite(stick.x) || !Number.isFinite(stick.y) || !Number.isFinite(assistedLift)) return true;
  if (Math.abs(stick.x) > .06 || Math.abs(stick.y) > .06 || Math.abs(assistedLift) > .01 || cruise || boost) return true;
  for (const key of MOVEMENT_KEYS) if (pressed.has(key)) return true;
  return false;
}
/** All frequencies have integer cycles per 1000 s, so wrapping is continuous. */
export function idleHoverWave(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  const t = ((seconds % 1000) + 1000) % 1000;
  return IDLE_HOVER.amplitude * Math.sin(TAU * IDLE_HOVER.frequencyHz * t)
    + IDLE_HOVER.windAmplitude * (
      .6 * Math.sin(TAU * IDLE_HOVER.windHzA * t)
      + .4 * Math.sin(TAU * IDLE_HOVER.windHzB * t));
}
/** Per-ride clock advances only on accepted foreground updates, not wall time. */
export class HoverIdleMotion {
  private time = 0;
  private idleAge = 0;
  private weight = 0;
  private viewScale = IDLE_HOVER.firstPersonScale as number;
  private output = 0;
  private ready = false;
  private resync = false;
  private x = 0; private y = 0; private z = 0; private heading = 0;
  private eligible = false;
  get offsetY(): number { return this.output; }
  get strength(): number { return this.weight; }
  get isIdle(): boolean { return this.eligible; }
  reset(): number {
    this.time = this.idleAge = this.weight = this.output = 0;
    this.ready = this.resync = this.eligible = false;
    this.viewScale = IDLE_HOVER.firstPersonScale;
    return 0;
  }
  /** Keep the visible offset still; discard the first resumed delta. */
  suspend(): void { this.resync = true; }
  private seed(p: Readonly<IdleHoverPose>): void {
    this.x = p.x; this.y = p.y; this.z = p.z; this.heading = p.heading; this.ready = true;
  }
  update(seconds: number, p: Readonly<IdleHoverPose>, state: Readonly<IdleHoverState>): number {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)
      || !Number.isFinite(p.heading) || !Number.isFinite(p.speed) || !Number.isFinite(p.lift)
      || !Number.isFinite(state.height)) return this.reset();
    // Grounding, accessibility and competitive state take precedence over motion.
    if (!state.flying || state.landed || state.reducedMotion || state.racing) return this.reset();
    if (!state.running) { this.suspend(); return this.output; }
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > IDLE_HOVER.maxDelta) {
      this.suspend(); return this.output;
    }
    const dt = seconds;
    const distance = this.ready ? Math.hypot(p.x - this.x, p.y - this.y, p.z - this.z) : 0;
    if (distance > IDLE_HOVER.teleportDistance) { this.reset(); this.seed(p); return 0; }
    if (this.resync) { this.seed(p); this.resync = false; return this.output; }
    const horizontal = this.ready ? Math.hypot(p.x - this.x, p.z - this.z) / dt : 0;
    const vertical = this.ready ? Math.abs(p.y - this.y) / dt : 0;
    const yaw = this.ready ? Math.abs(Math.atan2(Math.sin(p.heading - this.heading), Math.cos(p.heading - this.heading))) / dt : 0;
    if (!this.ready) this.viewScale = state.firstPerson ? IDLE_HOVER.firstPersonScale : 1;
    this.seed(p);
    this.eligible = !state.inputActive && !state.landing && !state.collision && !state.hazard
      && state.height > IDLE_HOVER.minHeight
      && Math.max(Math.abs(p.speed), horizontal) < IDLE_HOVER.maxSpeed
      && Math.max(Math.abs(p.lift), vertical) < IDLE_HOVER.maxLift
      && yaw < IDLE_HOVER.maxYawRate;
    this.time = (this.time + dt) % 1000;
    if (this.eligible) {
      this.idleAge += dt;
      // Split the dwell boundary exactly, so 30/60/120 Hz share the same envelope.
      const fadeDt = Math.min(dt, Math.max(0, this.idleAge - IDLE_HOVER.settleSeconds));
      this.weight = damp(this.weight, 1, IDLE_HOVER.enterRate, fadeDt);
    } else {
      this.idleAge = 0;
      this.weight = damp(this.weight, 0, IDLE_HOVER.exitRate, dt);
    }
    if (this.weight < .00001) this.weight = 0;
    this.viewScale = damp(this.viewScale, state.firstPerson ? IDLE_HOVER.firstPersonScale : 1, IDLE_HOVER.viewRate, dt);
    const clearanceGain = smooth((state.height - IDLE_HOVER.minHeight) / (IDLE_HOVER.fullHeight - IDLE_HOVER.minHeight));
    this.output = this.weight === 0 || clearanceGain === 0 ? 0
      : idleHoverWave(this.time) * this.weight * this.viewScale * clearanceGain;
    return this.output;
  }
}
