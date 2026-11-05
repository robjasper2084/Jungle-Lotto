import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {build} from 'esbuild';
import * as THREE from 'three';

// Execute the production factory. Only the browser renderer and small DOM
// surface are substituted; scene, geometry, material and clone code stay real.
const require = createRequire(import.meta.url);
const compiled = await build({
  entryPoints: [fileURLToPath(new URL('./ridePreview.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'cjs', packages: 'external',
  write: false, logLevel: 'error',
});
const factoryScript = new Script(compiled.outputFiles[0].text, {filename: 'ridePreview.factory.cjs'});

function fixture({contextUnavailable = false, rendererError, disposeError} = {}) {
  const canvases = [], frames = new Map(), visibilityListeners = new Set();
  const renderers = [], rendererAttempts = [], geometries = [], materials = [], contextRequests = [];
  const contextEvents = {acquired: 0, losses: 0};
  const context = {
    getExtension(name) {
      assert.equal(name, 'WEBGL_lose_context');
      return {loseContext() { contextEvents.losses++; }};
    },
  };
  let nextFrame = 0;
  const classList = () => {
    const names = new Set();
    return {add: name => names.add(name), remove: name => names.delete(name), contains: name => names.has(name)};
  };
  const labels = [0, 1].map(() => ({classList: classList(), querySelector: () => ({setAttribute() {}})}));
  const row = {
    append(canvas) { canvases.push(canvas); },
    querySelectorAll(selector) { return selector === 'label' ? labels : []; },
  };
  const host = {querySelector: () => row};
  const document = {
    hidden: false,
    createElement() {
      const canvas = {
        className: '', setAttribute() {},
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
    addEventListener(type, listener) { if (type === 'visibilitychange') visibilityListeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'visibilitychange') visibilityListeners.delete(listener); },
  };
  class Renderer {
    disposeCount = 0;
    contextLossCount = 0;
    constructor(options) { rendererAttempts.push(options); if (rendererError) throw rendererError; renderers.push(this); }
    setPixelRatio() {}
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
  const module = {exports: {}};
  factoryScript.runInNewContext({
    module, exports: module.exports,
    require: name => name === 'three'
      ? {...THREE, WebGLRenderer: Renderer, CylinderGeometry: StageGeometry, MeshStandardMaterial: StageMaterial}
      : require(name),
    document, window: {matchMedia: () => ({matches: false})}, performance: {now: () => 100},
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  }, {timeout: 1000});
  return {create: module.exports.createRidePreview, host, canvases, frames, visibilityListeners, labels, renderers, rendererAttempts, geometries, materials, context, contextRequests, contextEvents};
}

function assertReleased(fixture) {
  assert.equal(fixture.canvases.length, 0, 'the preview canvas must leave the DOM');
  assert.equal(fixture.frames.size, 0, 'no preview animation remains scheduled');
  assert.equal(fixture.visibilityListeners.size, 0, 'the preview visibility listener must be removed');
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
  assert.equal(f.visibilityListeners.size, 1);
  assert.equal(f.labels[0].classList.contains('preview-ready'), true);
  preview.setActive(true);
  assert.equal(f.frames.size, 1);
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
