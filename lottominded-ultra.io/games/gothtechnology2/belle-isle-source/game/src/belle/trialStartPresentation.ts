import type {Scene, WebGLRenderer} from 'three';

type Timing = {
  now(): number;
  later(callback: () => void, milliseconds: number): ReturnType<typeof setTimeout>;
  cancelLater(handle: ReturnType<typeof setTimeout>): void;
  paint(callback: () => void): number;
  cancelPaint(handle: number): void;
};
const browserTiming: Timing = {
  now: () => performance.now(),
  later: (callback, milliseconds) => setTimeout(callback, milliseconds),
  cancelLater: handle => clearTimeout(handle),
  paint: callback => requestAnimationFrame(callback),
  cancelPaint: handle => cancelAnimationFrame(handle),
};
type Pending = {
  signal: AbortSignal;
  abort(): void;
  resolve(): void;
  reject(error: unknown): void;
  timer?: ReturnType<typeof setTimeout>;
  poll?: ReturnType<typeof setTimeout>;
  paint?: number;
  gl?: WebGL2RenderingContext;
  fence?: WebGLSync;
  submitted: boolean;
};

/** Presents one actual prepared starting-line frame before the race countdown.
 * During the three-second countdown that frame stays on the canvas while HTML
 * controls/countdown remain responsive. No clock, physics, input or quality is
 * altered. Ordinary scene drawing resumes on GO, exit, context loss or XR.
 * A nonblocking GPU fence prevents a queued draw from consuming the countdown.
 */
export class TrialStartPresentation {
  private readonly scene: Scene;
  private readonly countdown: () => boolean;
  private readonly timing: Timing;
  private readonly previousAfter: Scene['onAfterRender'];
  private readonly after: Scene['onAfterRender'];
  private renderer?: WebGLRenderer;
  private originalRender?: WebGLRenderer['render'];
  private wrappedRender?: WebGLRenderer['render'];
  private pending?: Pending;
  private held = false;
  private width = 0;
  private height = 0;
  private disposed = false;
  private evidence = {state: 'idle', submittedAtMs: 0, gpuReadyAtMs: 0, readyAtMs: 0, heldFrames: 0};

  constructor(scene: Scene, countdown: () => boolean, timing: Timing = browserTiming) {
    this.scene = scene; this.countdown = countdown; this.timing = timing;
    this.previousAfter = scene.onAfterRender;
    this.after = (...args) => {
      try { this.previousAfter.apply(scene, args); this.afterScene(args[0]); }
      catch (error) { this.fail(error); throw error; }
    };
    scene.onAfterRender = this.after;
  }

  prepare(signal: AbortSignal): Promise<void> {
    if (this.disposed) return Promise.reject(Error('Starting-line presentation is disposed'));
    this.fail(new DOMException('Starting-line preparation replaced', 'AbortError'));
    this.held = false;
    this.evidence = {state: 'preparing', submittedAtMs: 0, gpuReadyAtMs: 0, readyAtMs: 0, heldFrames: 0};
    if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('Preparation cancelled', 'AbortError'));
    return new Promise((resolve, reject) => {
      const pending: Pending = {signal, resolve, reject, submitted: false, abort: () => {
        if (this.pending === pending) this.fail(signal.reason ?? new DOMException('Preparation cancelled', 'AbortError'));
      }};
      this.pending = pending;
      signal.addEventListener('abort', pending.abort, {once: true});
      // This new presentation phase is bounded; existing shader/test deadlines
      // and the original three-second race countdown are not extended.
      pending.timer = this.timing.later(() => {
        if (this.pending === pending) this.fail(Error('Starting-line presentation exceeded 45 seconds'));
      }, 45000);
    });
  }

  private afterScene(renderer: WebGLRenderer) {
    if (this.disposed || renderer.xr.isPresenting || renderer.getRenderTarget() !== null) return;
    if (this.renderer && this.renderer !== renderer) { this.fail(Error('Starting-line renderer changed')); return; }
    if (!this.renderer) this.attach(renderer);
    const pending = this.pending;
    if (!pending || pending.submitted) return;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (gl.isContextLost()) { this.fail(Error('Starting-line WebGL context lost')); return; }
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!fence) { this.fail(Error('Starting-line GPU fence unavailable')); return; }
    pending.gl = gl; pending.fence = fence; pending.submitted = true;
    this.width = renderer.domElement.width; this.height = renderer.domElement.height;
    this.held = true; this.evidence.submittedAtMs = this.timing.now();
    gl.flush();
    this.poll(pending);
  }

  private attach(renderer: WebGLRenderer) {
    this.renderer = renderer; this.originalRender = renderer.render;
    const original = renderer.render;
    this.wrappedRender = (scene, camera) => {
      const sameSurface = scene === this.scene && renderer.getRenderTarget() === null && !renderer.xr.isPresenting;
      const unchangedSize = renderer.domElement.width === this.width && renderer.domElement.height === this.height;
      const lost = renderer.getContext().isContextLost();
      if (lost) this.fail(Error('Starting-line WebGL context lost'));
      if (sameSurface && !lost && unchangedSize && this.held && (this.pending?.submitted || this.countdown())) {
        this.evidence.heldFrames++; return;
      }
      if (sameSurface && !this.pending && !this.countdown()) this.held = false;
      // A resize always gets a fresh real frame, never a blank retained surface.
      try { original.call(renderer, scene, camera); }
      catch (error) { this.fail(error); throw error; }
      if (sameSurface) { this.width = renderer.domElement.width; this.height = renderer.domElement.height; }
    };
    renderer.render = this.wrappedRender;
  }

  private poll(pending: Pending) {
    if (this.pending !== pending) return;
    const gl = pending.gl!, fence = pending.fence!;
    if (gl.isContextLost()) { this.fail(Error('Starting-line WebGL context lost')); return; }
    const result = gl.clientWaitSync(fence, 0, 0);
    if (result === gl.WAIT_FAILED) { this.fail(Error('Starting-line GPU fence failed')); return; }
    if (result === gl.TIMEOUT_EXPIRED) {
      pending.poll = this.timing.later(() => this.poll(pending), 16); return;
    }
    if (result !== gl.ALREADY_SIGNALED && result !== gl.CONDITION_SATISFIED) {
      this.fail(Error('Unexpected starting-line GPU fence result')); return;
    }
    gl.deleteSync(fence); pending.fence = undefined;
    this.evidence.gpuReadyAtMs = this.timing.now();
    // Give the compositor two opportunities to present the finished frame and
    // newly laid-out touch controls. This never manufactures an input event.
    pending.paint = this.timing.paint(() => {
      if (this.pending !== pending) return;
      pending.paint = this.timing.paint(() => {
        if (this.pending !== pending) return;
        this.cleanup(pending); this.pending = undefined;
        this.evidence.state = 'ready'; this.evidence.readyAtMs = this.timing.now();
        pending.resolve();
      });
    });
  }

  private cleanup(pending: Pending) {
    if (pending.timer !== undefined) this.timing.cancelLater(pending.timer);
    if (pending.poll !== undefined) this.timing.cancelLater(pending.poll);
    if (pending.paint !== undefined) this.timing.cancelPaint(pending.paint);
    if (pending.fence) { pending.gl?.deleteSync(pending.fence); pending.fence = undefined; }
    pending.signal.removeEventListener('abort', pending.abort);
  }

  private fail(error: unknown) {
    const pending = this.pending;
    this.held = false;
    if (!pending) return;
    this.pending = undefined; this.cleanup(pending); this.evidence.state = 'failed';
    pending.reject(error);
  }

  release() { this.fail(new DOMException('Starting-line presentation cancelled', 'AbortError')); this.held = false; }
  get snapshot() { return {...this.evidence, holding: this.held}; }
  dispose() {
    if (this.disposed) return;
    this.release(); this.disposed = true;
    if (this.scene.onAfterRender === this.after) this.scene.onAfterRender = this.previousAfter;
    if (this.renderer && this.renderer.render === this.wrappedRender && this.originalRender) this.renderer.render = this.originalRender;
  }
}
