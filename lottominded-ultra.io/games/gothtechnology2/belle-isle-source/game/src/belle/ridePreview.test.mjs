import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {build} from 'esbuild';
import * as THREE from 'three';

// Execute the production factory. Browser surfaces and asynchronous asset
// providers are substituted; scene, geometry, material and clone code stay real.
const require = createRequire(import.meta.url);
const compiled = await build({
  entryPoints: [fileURLToPath(new URL('./ridePreview.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'cjs', packages: 'external',
  external: ['./cadillacRide.ts', './vehicles/models.ts'],
  write: false, logLevel: 'error',
});
const factoryScript = new Script(compiled.outputFiles[0].text, {filename: 'ridePreview.factory.cjs'});

function fixture({contextUnavailable = false, rendererError, disposeError, reducedMotion = false, pickerHeight = 200} = {}) {
  const canvases = [], frames = new Map(), tasks = new Map(), eventTargets = [], observers = new Set();
  const renderers = [], rendererAttempts = [], geometries = [], materials = [], contextRequests = [], requests = [];
  const contextEvents = {acquired: 0, losses: 0};
  const context = {
    getExtension(name) {
      assert.equal(name, 'WEBGL_lose_context');
      return {loseContext() { contextEvents.losses++; }};
    },
  };
  let nextFrame = 0, nextTask = 0, now = 100, scroll = 0;
  const target = object => {
    const listeners = new Map();
    object.addEventListener = (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    };
    object.removeEventListener = (type, listener) => listeners.get(type)?.delete(listener);
    object.emit = type => { for (const listener of listeners.get(type) ?? []) listener(); };
    object.listenerCount = () => [...listeners.values()].reduce((sum, entries) => sum + entries.size, 0);
    object.listeners = listeners;
    eventTargets.push(object);
    return object;
  };
  const classList = () => {
    const names = new Set();
    return {add: name => names.add(name), remove: name => names.delete(name), contains: name => names.has(name)};
  };
  const rect = (left, top, width, height) => ({left, top, right: left + width, bottom: top + height, width, height});
  const slots = Array.from({length: 5}, (_, index) => ({
    attributes: new Map(),
    getBoundingClientRect() { return rect(index % 2 * 250, Math.floor(index / 2) * 220 - scroll, 230, 166); },
    setAttribute(name, value) { this.attributes.set(name, value); },
  }));
  const inputs = slots.map((_, index) => ({checked: index === 1}));
  const labels = slots.map((slot, index) => ({
    classList: classList(), querySelector: selector => selector === 'input' ? inputs[index] : slot,
  }));
  const row = target({
    append(canvas) { canvases.push(canvas); },
    querySelectorAll(selector) { return selector === 'label' ? labels : selector === '.ride-preview-slot' ? slots : []; },
    getBoundingClientRect() { return rect(0, -scroll, 480, 660); },
  });
  const picker = {parentElement: null, clientLeft: 0, clientTop: 0, clientWidth: 480, clientHeight: pickerHeight,
    style: {overflowX: 'auto', overflowY: 'auto'}, getBoundingClientRect() { return rect(0, 0, 480, this.clientHeight); }};
  const host = {querySelector: () => row, parentElement: picker};
  const document = target({
    hidden: false,
    createElement() {
      const canvas = {
        className: '', setAttribute() {}, width: 0, height: 0,
        getContext(name, attributes) {
          contextRequests.push({name, attributes});
          if (contextUnavailable) return null;
          contextEvents.acquired++;
          return context;
        },
        remove() { const index = canvases.indexOf(canvas); if (index !== -1) canvases.splice(index, 1); },
      };
      return canvas;
    },
  });
  const media = target({matches: reducedMotion});
  const window = target({innerWidth: 1000, innerHeight: 800, matchMedia: () => media});
  class Renderer {
    disposeCount = 0;
    contextLossCount = 0;
    renders = [];
    clears = 0;
    constructor(options) { rendererAttempts.push(options); if (rendererError) throw rendererError; this.canvas = options.canvas; renderers.push(this); }
    setPixelRatio() {}
    setSize(width, height) { this.canvas.width = width; this.canvas.height = height; }
    setScissorTest() {}
    setClearColor() {}
    clear() { this.clears++; }
    setViewport(...values) { this.viewport = values; }
    setScissor(...values) { this.scissor = values; }
    render(scene, camera) { this.renders.push({scene, camera, viewport: [...this.viewport], scissor: [...this.scissor]}); }
    dispose() { this.disposeCount++; if (disposeError) throw disposeError; }
    forceContextLoss() { this.contextLossCount++; }
  }
  class StageGeometry extends THREE.CylinderGeometry {
    disposeCount = 0;
    constructor(...args) { super(...args); geometries.push(this); this.addEventListener('dispose', () => this.disposeCount++); }
  }
  class StageMaterial extends THREE.MeshStandardMaterial {
    disposeCount = 0;
    constructor(...args) { super(...args); materials.push(this); this.addEventListener('dispose', () => this.disposeCount++); }
  }
  class ResizeObserver {
    constructor(callback) { this.callback = callback; observers.add(this); }
    observe() {}
    disconnect() { observers.delete(this); }
  }
  const request = (vehicle, choice, options) => new Promise((resolve, reject) => requests.push({vehicle, choice, options, resolve, reject}));
  const module = {exports: {}};
  factoryScript.runInNewContext({
    module, exports: module.exports,
    require: name => name === 'three'
      ? {...THREE, WebGLRenderer: Renderer, CylinderGeometry: StageGeometry, MeshStandardMaterial: StageMaterial}
      : name === './cadillacRide.ts' ? {cadillacModel: () => request('cadillac')}
      : name === './vehicles/models.ts' ? {createVehicleModel: (choice, options) => request(choice.vehicle, choice, options)}
      : require(name),
    document, window, ResizeObserver, AbortController, getComputedStyle: element => element.style,
    performance: {now: () => now},
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback) { const id = ++nextTask; tasks.set(id, callback); return id; },
    clearTimeout(id) { tasks.delete(id); },
  }, {timeout: 1000});
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return {create: module.exports.createRidePreview, host, canvases, frames, tasks, observers, eventTargets,
    document, window, media,
    labels, slots, inputs, picker, row, requests, renderers, rendererAttempts, geometries, materials, context, contextRequests, contextEvents,
    tick(milliseconds = 50) { now += milliseconds; const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(now); },
    async runWork() { const callbacks = [...tasks.values()]; tasks.clear(); for (const callback of callbacks) callback(); await settle(); },
    scrollTo(value) { scroll = value; document.emit('scroll'); },
    setReduced(value) { media.matches = value; media.emit('change'); },
    setHidden(value) { document.hidden = value; document.emit('visibilitychange'); },
    settle,
  };
}

function assertReleased(fixture) {
  assert.equal(fixture.canvases.length, 0, 'the preview canvas must leave the DOM');
  assert.equal(fixture.frames.size, 0, 'no preview animation remains scheduled');
  assert.equal(fixture.eventTargets.reduce((sum, target) => sum + target.listenerCount(), 0), 0, 'preview listeners must be removed');
  assert.equal(fixture.tasks.size, 0, 'no preview model task remains scheduled');
  assert.equal(fixture.observers.size, 0, 'preview resize observers must be disconnected');
  assert.equal(fixture.contextRequests.length, 1, 'cleanup must never request another context');
  assert.equal(fixture.contextEvents.losses, fixture.contextEvents.acquired ? 1 : 0, 'only the acquired preview context is released, exactly once');
  for (const renderer of fixture.renderers) {
    assert.equal(renderer.disposeCount, 1);
    assert.equal(renderer.contextLossCount, 0, 'direct context ownership must not also call renderer.forceContextLoss');
  }
  for (const resource of [...fixture.geometries, ...fixture.materials]) assert.equal(resource.disposeCount, 1);
}

test('an unavailable preview context takes the static fallback before constructing Three renderer', {timeout: 2000}, () => {
  const f = fixture({contextUnavailable: true});
  assert.throws(() => f.create(f.host, new THREE.Group(), async () => new THREE.Group()), /Ride preview unavailable: a WebGL2 context could not be created/);
  assert.equal(f.rendererAttempts.length, 0, 'the optional fallback must not invoke Three renderer initialization');
  assert.equal(f.contextEvents.acquired, 0);
  assertReleased(f);
});

test('renderer constructor failure releases its acquired context and preserves the original error', {timeout: 2000}, () => {
  const error = new Error('Renderer initialization failed');
  const f = fixture({rendererError: error});
  assert.throws(() => f.create(f.host, new THREE.Group(), async () => new THREE.Group()), caught => caught === error);
  assert.equal(f.rendererAttempts.length, 1);
  assert.equal(f.rendererAttempts[0].context, f.context);
  assert.equal(f.contextEvents.acquired, 1);
  assert.equal(f.renderers.length, 0);
  assertReleased(f);
});

test('wheel setup failure releases the already-created preview renderer and stage', {timeout: 2000}, () => {
  const error = new Error('Wheel clone failed');
  const f = fixture();
  const wheel = {clone() { throw error; }};
  assert.throws(() => f.create(f.host, wheel, async () => new THREE.Group()), caught => caught === error);
  assert.equal(f.renderers.length, 1);
  assert.equal(f.geometries.length, 1);
  assert.equal(f.materials.length, 1);
  assertReleased(f);
});

test('a cleanup failure cannot replace the initialization error or skip other cleanup', {timeout: 2000}, () => {
  const error = new Error('Wheel clone failed');
  const f = fixture({disposeError: new Error('Renderer already lost its context')});
  assert.throws(() => f.create(f.host, {clone() { throw error; }}, async () => new THREE.Group()), caught => caught === error);
  assertReleased(f);
});

test('normal preview disposal is idempotent, ignores late loads and preserves borrowed assets', {timeout: 2000}, async () => {
  const f = fixture();
  const geometry = new THREE.BoxGeometry(1, 1, 1), texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({map: texture});
  const borrowedDisposals = {geometry: 0, material: 0, texture: 0};
  geometry.addEventListener('dispose', () => borrowedDisposals.geometry++);
  material.addEventListener('dispose', () => borrowedDisposals.material++);
  texture.addEventListener('dispose', () => borrowedDisposals.texture++);
  const wheel = new THREE.Group(); wheel.add(new THREE.Mesh(geometry, material));
  let resolveBike, bikeClones = 0;
  const bike = new THREE.Group(), cloneBike = bike.clone.bind(bike);
  bike.clone = (...args) => { bikeClones++; return cloneBike(...args); };
  const pendingBike = new Promise(resolve => { resolveBike = resolve; });
  const preview = f.create(f.host, wheel, () => pendingBike);
  assert.equal(f.contextRequests[0].name, 'webgl2');
  assert.deepEqual({...f.contextRequests[0].attributes}, {
    alpha: true, depth: true, stencil: false, antialias: true,
    premultipliedAlpha: true, preserveDrawingBuffer: false,
    powerPreference: 'low-power', failIfMajorPerformanceCaveat: false,
  });
  assert.equal(f.rendererAttempts[0].context, f.context, 'the renderer must use the already-acquired context');
  assert.equal(f.canvases.length, 1);
  assert.equal(f.document.listeners.get('visibilitychange').size, 1);
  assert.equal(f.labels[0].classList.contains('preview-ready'), true);
  preview.setActive(true);
  assert.equal(f.frames.size, 1);
  f.tick();await f.runWork();
  const queuedFrame = [...f.frames.values()][0];
  preview.dispose();
  preview.dispose();
  preview.setActive(true);
  queuedFrame(200); // Even a callback already queued before cancellation stays inert.
  resolveBike(bike);
  await Promise.resolve();
  await Promise.resolve();
  assertReleased(f);
  assert.equal(bikeClones, 0, 'a resolved bike must not rebuild a disposed preview');
  assert.equal(f.labels.some(label => label.classList.contains('preview-ready')), false);
  assert.deepEqual(borrowedDisposals, {geometry: 0, material: 0, texture: 0});
});

function trackedSource(name) {
  const root = new THREE.Group();root.name = name;
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  const clone = root.clone.bind(root);
  let clones = 0, disposals = 0;
  root.clone = (...args) => { clones++; return clone(...args); };
  return {root, get clones() { return clones; }, get disposals() { return disposals; }, dispose() { disposals++; }};
}

test('opening loads only visible cards, defers work until after the first draw and does not render clipped cards', async () => {
  const f = fixture();let bikeRequests = 0;
  const bike = trackedSource('visible-bike');
  const preview = f.create(f.host, new THREE.Group(), async () => { bikeRequests++; return bike.root; });
  assert.equal(bikeRequests, 0);
  assert.equal(f.requests.length, 0, 'constructing the chooser must not start offscreen vehicle preparation');
  preview.setActive(true);
  assert.equal(bikeRequests, 0);
  f.tick();
  assert.equal(bikeRequests, 0, 'the first draw must yield before beginning cached model work');
  assert.equal(f.renderers[0].renders.length, 2, 'only the first two cards intersect the chooser');
  assert.equal(f.tasks.size, 1);
  await f.runWork();
  assert.equal(bikeRequests, 1);
  assert.equal(f.requests.length, 0, 'Jetson, CORLEO and Cadillac remain outside the clipping area');
  assert.equal(bike.clones, 0, 'a downloaded source must wait for an active visible draw');
  f.tick();
  assert.equal(bike.clones, 1);
  assert.equal(f.labels[1].classList.contains('preview-ready'), true);
  assert.equal(f.slots[1].attributes.get('data-status'), 'Loading 3D preview');
  assert.equal(f.tasks.size, 0);
  preview.dispose();assertReleased(f);
});

test('visible selected cards have priority and only one model preparation is pending', async () => {
  const f = fixture({pickerHeight: 420});let bikeRequests = 0;
  f.inputs.forEach((input, index) => input.checked = index === 3);
  const preview = f.create(f.host, new THREE.Group(), async () => { bikeRequests++; return new THREE.Group(); });
  preview.setActive(true);f.tick();await f.runWork();
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].vehicle, 'corleo', 'selected CORLEO is visible and takes the first preparation slot');
  assert.equal(f.requests[0].options.preview, true);
  assert.equal(f.requests[0].options.signal.aborted, false);
  f.tick();await f.runWork();
  assert.equal(bikeRequests, 0);
  assert.equal(f.requests.length, 1, 'other visible cards must wait while a model is pending');
  const corleo = trackedSource('selected-corleo');f.requests[0].resolve(corleo);await f.settle();
  f.tick();await f.runWork();
  assert.equal(corleo.clones, 1);
  assert.equal(bikeRequests, 1, 'the next visible card proceeds when the selected model settles');
  assert.equal(f.requests.some(request => request.vehicle === 'cadillac'), false);
  preview.dispose();assert.equal(corleo.disposals, 1);assertReleased(f);
});

test('scrolling requests and renders newly visible cards exactly once with clipped scissors', async () => {
  const f = fixture({reducedMotion: true});let bikeRequests = 0;
  const preview = f.create(f.host, new THREE.Group(), async () => { bikeRequests++; return new THREE.Group(); });
  preview.setActive(true);f.tick();await f.runWork();f.tick();
  const renderer = f.renderers[0];
  assert.equal(f.frames.size, 0, 'reduced-motion previews do not keep submitting identical frames');
  const firstDrawCount = renderer.renders.length;
  f.tick();assert.equal(renderer.renders.length, firstDrawCount);
  f.scrollTo(220);f.tick();await f.runWork();
  assert.deepEqual(f.requests.map(request => request.vehicle), ['jetson']);
  const jetson = trackedSource('visible-jetson');f.requests[0].resolve(jetson);await f.settle();
  f.tick();await f.runWork();
  assert.deepEqual(f.requests.map(request => request.vehicle), ['jetson', 'corleo']);
  const corleo = trackedSource('visible-corleo');f.requests[1].resolve(corleo);await f.settle();f.tick();
  assert.equal(f.frames.size, 0);
  f.scrollTo(440);f.tick();await f.runWork();
  assert.deepEqual(f.requests.map(request => request.vehicle), ['jetson', 'corleo', 'cadillac']);
  const cadillac = trackedSource('visible-cadillac');f.requests[2].resolve(cadillac.root);await f.settle();f.tick();
  f.scrollTo(0);f.tick();await f.runWork();
  f.scrollTo(220);f.tick();await f.runWork();
  assert.equal(bikeRequests, 1);
  assert.equal(f.requests.length, 3, 'scrolling back reuses already prepared sources');
  assert.equal(jetson.clones, 1);assert.equal(corleo.clones, 1);assert.equal(cadillac.clones, 1);
  // A partly clipped card keeps its original camera viewport, but cannot draw
  // outside the intersection of the chooser and browser viewport.
  f.window.innerHeight = 100;f.window.emit('resize');f.tick();
  for (const rendered of renderer.renders.slice(-2)) {
    assert.equal(rendered.viewport[3], 166);
    assert.equal(rendered.scissor[3], 100);
  }
  preview.dispose();assertReleased(f);
});

test('closing parks late sources, cancels queued work and reopens without duplicate requests', async () => {
  const f = fixture({reducedMotion: true});let resolveBike, bikeRequests = 0;
  const pending = new Promise(resolve => { resolveBike = resolve; });
  const bike = trackedSource('parked-bike');
  const preview = f.create(f.host, new THREE.Group(), () => { bikeRequests++; return pending; });
  preview.setActive(true);f.tick();
  preview.setActive(false);await f.runWork();
  assert.equal(bikeRequests, 0, 'closing before dispatch cancels optional loading');
  preview.setActive(true);f.tick();await f.runWork();
  assert.equal(bikeRequests, 1);
  preview.setActive(false);resolveBike(bike.root);await f.settle();
  assert.equal(bike.clones, 0, 'late completed sources are not cloned behind a closed chooser');
  assert.equal(f.frames.size, 0);assert.equal(f.tasks.size, 0);
  preview.setActive(true);f.tick();await f.runWork();
  assert.equal(bike.clones, 1);assert.equal(bikeRequests, 1);
  preview.dispose();assertReleased(f);
});

test('reduced motion and hidden documents wake only for an actual visible change', async () => {
  const f = fixture();
  const preview = f.create(f.host, new THREE.Group(), async () => new THREE.Group());
  preview.setActive(true);f.tick();await f.runWork();f.tick();
  assert.equal(f.frames.size, 1);
  f.setReduced(true);f.tick();assert.equal(f.frames.size, 0);
  f.window.emit('resize');assert.equal(f.frames.size, 1);f.tick();assert.equal(f.frames.size, 0);
  f.scrollTo(220);f.tick();assert.equal(f.tasks.size, 1);
  f.setHidden(true);await f.runWork();assert.equal(f.requests.length, 0);
  assert.equal(f.frames.size, 0);assert.equal(f.tasks.size, 0);
  f.setHidden(false);f.tick();await f.runWork();assert.equal(f.requests[0].vehicle, 'jetson');
  preview.dispose();
  const late = trackedSource('disposed-jetson');f.requests[0].resolve(late);await f.settle();
  assert.equal(late.disposals, 1);assert.equal(late.clones, 0);
  assertReleased(f);
});

test('a failed visible model keeps selection available and releases the preparation slot', async () => {
  const f = fixture({reducedMotion: true, pickerHeight: 420});
  f.inputs.forEach((input, index) => input.checked = index === 2);
  const preview = f.create(f.host, new THREE.Group(), async () => new THREE.Group());
  preview.setActive(true);f.tick();await f.runWork();
  assert.equal(f.requests[0].vehicle, 'jetson');
  f.requests[0].reject(new Error('optional preview unavailable'));await f.settle();
  assert.equal(f.labels[2].classList.contains('preview-unavailable'), true);
  assert.equal(f.slots[2].attributes.get('data-status'), 'Preview unavailable');
  assert.equal(f.inputs[2].checked, true, 'an optional preview failure does not change the chosen ride');
  f.tick();await f.runWork();f.tick();await f.runWork();
  assert.deepEqual(f.requests.map(request => request.vehicle), ['jetson', 'corleo']);
  preview.dispose();const corleo = trackedSource('late-corleo');f.requests[1].resolve(corleo);await f.settle();
  assert.equal(corleo.disposals, 1);assertReleased(f);
});


test('closing cancels unfinished authored preparation without treating it as a failed preview', async () => {
  const f = fixture({reducedMotion: true});
  const preview = f.create(f.host, new THREE.Group(), async () => new THREE.Group());
  f.scrollTo(220);preview.setActive(true);f.tick();await f.runWork();
  const request = f.requests[0];assert.equal(request.vehicle, 'jetson');
  preview.setActive(false);assert.equal(request.options.signal.aborted, true);
  const late = trackedSource('cancelled-jetson');request.resolve(late);await f.settle();
  assert.equal(late.clones, 0);assert.equal(late.disposals, 1);
  assert.equal(f.labels[2].classList.contains('preview-unavailable'), false);
  assert.equal(f.slots[2].attributes.get('data-status'), '');
  preview.setActive(true);f.tick();await f.runWork();
  assert.equal(f.requests[1].vehicle, 'jetson', 'reopening may prepare the cancelled card from its cached source');
  assert.equal(f.requests[1].options.signal.aborted, false);
  const ready = trackedSource('ready-jetson');f.requests[1].resolve(ready);await f.settle();f.tick();
  assert.equal(ready.clones, 1);
  preview.dispose();assert.equal(ready.disposals, 1);assertReleased(f);
});
