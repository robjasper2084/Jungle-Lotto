import * as T from 'three';
import { ParkTerrain } from './terrain.ts';
import { SWOOP_TO_BELLE_MATRIX } from './geo.ts';
import { buildPreviewRetail } from './swoopRetail.ts';
import { waitForVendorPosters } from './staticVendorMedia.ts';
import { setPreviewTrafficFocus, clearPreviewTrafficFocus, type TrafficObserver } from './swoopTrafficFocus.ts';
import { createOwnedSceneRoot, disposeOwnedScene, SceneVisibilityUnion } from './ownedScene.ts';
import { sourceCompanionObstacles } from './companionBridge.ts';
import { DistrictViewHolds, type DistrictFrameView as FrameView, type PreparedDistrictView } from './swoopViewHolds.ts';
import { SwoopStageError, describeSwoopLoadError } from './swoopLoadError.ts';
import { registerSwoopTextureRoot } from './sourceTextureWarmup.ts';
import { createSourceLighting } from './sourceLighting.ts';
import { buildScenery } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/scenery.ts';
import { buildFreestylePark } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/freestylePark.ts';
import { NatureWorld } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/natureWorld.ts';
import { cherryTreeSites } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/treePlacement.ts';
import { MAP_ORIGIN, toLocal, toMap } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/geo-profile.ts';
import { loadActors, TrafficView } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/actors.ts';
import { MapPhotographers } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/mapPhotographers.ts';
import { AmbientCyclistPacks, cyclistCircuit } from '../../../lottominded-ultra.io/games/gothtechnology2/ride-core/src/ambientCyclists.ts';
import { routePosition } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/districtView.ts';
import { InteractiveWater } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/interactiveWater.ts';
import { RouteAmbience, cutEffectPatches } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/routeAmbience.ts';
import { warmFirstView } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/warmFirstView.ts';
import { createGroundSample } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/terrain.ts';
import { windTime } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/windMotion.ts';
import { SPOTS, LENGTH } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/world.ts';
import type { TrafficState } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/world.ts';
import type { RidePose } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/controller.ts';

export type SwoopPreviewSettings = { drawDistance: string; renderQuality: 'detailed'; reducedMotion: string };
type PreviewGlobal = typeof globalThis & { __dequindrePreviewSettings?: SwoopPreviewSettings };
type ActorData = Awaited<ReturnType<typeof loadActors>>;
type LocalPoint = { x: number; y: number; z: number; speed: number };
type MapPoint = { x: number; z: number };
type ViewScratch = {
  frame: number;
  rider: LocalPoint;
  camera: LocalPoint;
  mapRider: MapPoint;
  mapCamera: MapPoint;
  observer: TrafficObserver;
  previousX: number;
  previousZ: number;
  previousTime?: number;
};
const compareObservers = (a: TrafficObserver, b: TrafficObserver) => a.id.localeCompare(b.id);

export interface SwoopDistrictOptions {
  scene: T.Scene;
  renderer: T.WebGLRenderer;
  terrain: ParkTerrain;
  status: (message: string) => void;
  applyAssets?: (root: T.Object3D) => void;
  /** The host can share its original Swoop actors without decoding them twice. */
  actorData?: ActorData;
  /** Build all source visuals and collision before the host may traverse them.
   * The caller attaches the returned root after final host footprint masking.
   * The supplied scene remains the render/warm scene in either mode.
   */
  deferAttachment?: boolean;
}

const SOURCE_REVISION = '893f769838166e6e35624b7b979ed5cbb8414507';
const assembledWorlds = new WeakSet<object>();
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** Assemble the complete original map under one host-controlled scene root.
 * Source main.ts, source renderer, controls, accounts and animation loop are
 * deliberately absent. The isolated Vite adapter keeps source files unchanged.
 */
export async function createSwoopDistrict(options: SwoopDistrictOptions) {
  const { scene, renderer, terrain, status } = options;
  const started = performance.now();
  const timings: Record<string, number> = {};
  const protectedResources = new Set<unknown>();
  let disposed = false, complete = false, failure = '';
  let visibleChunks = 0, lastTime: number | undefined, lastTraffic = -Infinity;
  const currentMapFocus: MapPoint[] = [];
  let updateMilliseconds = 0;
  let dormant = false, skippedDormantUpdates = 0;
  let retail: Awaited<ReturnType<typeof buildPreviewRetail>> | undefined;
  let scenery: Awaited<ReturnType<typeof buildScenery>> | undefined;
  let nature: NatureWorld | undefined;
  let ambience: RouteAmbience | undefined;
  let traffic: TrafficView | undefined;
  let photographers: MapPhotographers | undefined;
  let ambientPacks: AmbientCyclistPacks | undefined;
  let water: InteractiveWater | undefined;
  let atmosphere: T.Object3D | undefined;
  const waterCamera = new T.PerspectiveCamera();
  const viewScratch = new Map<string, ViewScratch>();
  const focus: ViewScratch[] = [];
  const localPoints: LocalPoint[] = [];
  const currentObservers: TrafficObserver[] = [];
  const singleView: FrameView[] = [];
  const mapTraffic: TrafficState[] = [];
  const trafficCenter = { x: 0, z: 0 };
  const waterRider = { x: 0, y: 0, z: 0 };
  const visibilityUnion = new SceneVisibilityUnion();
  const viewHolds = new DistrictViewHolds();
  let viewFrame = 0;
  let actors: ActorData | undefined;
  let world: ParkTerrain['sourceWorld'] | undefined;
  const ground = createGroundSample();
  const cameraPosition = new T.Vector3();
  const root = createOwnedSceneRoot(scene, {
    name: 'Complete Swoop Detroit district / isolated preview',
    matrix: SWOOP_TO_BELLE_MATRIX,
    deferAttachment: options.deferAttachment,
  });
  const unregisterTextureRoot = registerSwoopTextureRoot(root);
  const mapRoot = new T.Scene();
  mapRoot.name = 'Original Detroit cartographic frame';
  mapRoot.scale.x = -1;
  mapRoot.position.set(MAP_ORIGIN.x, -MAP_ORIGIN.y, -MAP_ORIGIN.z);
  root.add(mapRoot);
  root.updateWorldMatrix(true, true);
  const sourceLighting = createSourceLighting(scene, root);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const settings: SwoopPreviewSettings = { drawDistance: '600', renderQuality: 'detailed', reducedMotion: String(reduced.matches) };
  (globalThis as PreviewGlobal).__dequindrePreviewSettings = settings;
  const updateReduced = () => { settings.reducedMotion = String(reduced.matches); };
  reduced.addEventListener('change', updateReduced);

  async function stage<Value>(name: string, message: string, work: () => Promise<Value> | Value) {
    const before = performance.now();
    try {
      status(message);
      await yieldToBrowser();
      return await work();
    } catch (error) { throw new SwoopStageError(name, error); }
    finally { timings[name] = performance.now() - before; }
  }

  function protectAsset(root: T.Object3D) {
    root.traverse(object => {
      const mesh = object as T.Mesh;
      if (!mesh.isMesh) return;
      protectedResources.add(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        protectedResources.add(material);
        for (const value of Object.values(material)) if ((value as T.Texture)?.isTexture) protectedResources.add(value);
      }
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    unregisterTextureRoot();
    sourceLighting.dispose();
    reduced.removeEventListener('change', updateReduced);
    water?.dispose();
    clearPreviewTrafficFocus();
    visibilityUnion.clear();
    viewHolds.clear();
    viewScratch.clear();
    focus.length = localPoints.length = currentMapFocus.length = currentObservers.length = mapTraffic.length = singleView.length = 0;
    // ParkTerrain owns the source Rapier world. Its lifetime must extend past
    // view disposal until the host has stopped movement and ground queries.
    // Source cached visitor/photo assets and host-shared actors remain valid.
    for (const item of traffic?.items.values() ?? []) for (const mixer of item.mixers) { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); }
    disposeOwnedScene(root, protectedResources, actors && !options.actorData ? [...actors.values()].map(data => data.scene) : []);
  }

  try {
    await stage('physics', 'Preparing the complete original Cut terrain and collision…', () => terrain.prepareSwoop());
    world = terrain.sourceWorld;
    if (assembledWorlds.has(world)) throw new Error('This source physics world has already assembled a district. Reload with a fresh ParkTerrain before rebuilding.');
    assembledWorlds.add(world);
    // A repeatable session seed makes the preview evidence reproducible.
    world.randomizePeople(0x444354);
    await stage('freestylePark', 'Preparing the complete Freestyle Yard and access path…', () => buildFreestylePark(mapRoot, world!));
    const initialMap = { x: SPOTS[0].x, z: SPOTS[0].z };
    scenery = await stage('scenery', 'Loading the Cut, its city blocks, murals, parks and riverfront…', () => buildScenery(mapRoot, world!, true, initialMap, options.applyAssets));
    sourceLighting.registerSpots(mapRoot);
    atmosphere = mapRoot.getObjectByName('Subtle windborne atmosphere');
    const rawStreamUpdate = scenery.stream.update.bind(scenery.stream);
    // Source loaders retain one concurrency budget. Every view contributes to
    // the same preload/unload distance so one camera cannot evict another's art.
    scenery.stream.update = (points, radius) => rawStreamUpdate(currentMapFocus.length ? currentMapFocus : points, radius);
    await stage('allSourceStreamJobs', 'Preparing every source-map asset and its registered collision…', () => scenery!.stream.warm(world!.chunks, Number.POSITIVE_INFINITY));
    if (scenery.stream.status.errors) throw new Error('One or more original Swoop map assets failed to prepare');

    nature = await stage('nature', 'Restoring original cherry trees, robins and petals…', async () => {
      const anchors = cherryTreeSites((x, z) => world!.chunks.some(chunk => Math.abs(chunk.x - x) <= 50 && Math.abs(chunk.z - z) <= 50)).map(point => {
        const local = toLocal(point.x, 0, point.z);
        return { x: local.x, z: local.z, y: terrain.localTerrain.sampleGround(local.x, local.z, ground).height, scale: point.scale };
      });
      const instance = new NatureWorld(root, anchors, (x, z) => terrain.localTerrain.sampleGround(x, z, ground).height);
      await instance.load();
      if (!instance.loaded) throw new Error('Original nature assets failed: ' + instance.error);
      return instance;
    });
    ambience = new RouteAmbience(root, terrain.localTerrain, cutEffectPatches());
    retail = await stage('retail', 'Preparing the original Mack Avenue buildings and furnished interiors…', () => buildPreviewRetail(root, world!, status));
    retail.sharedResources.forEach(resource => protectedResources.add(resource));

    actors = await stage('actors', 'Preparing original pedestrians, cyclists and map photographers…', () => options.actorData ?? loadActors());
    if (options.actorData) for (const data of actors.values()) protectAsset(data.scene);
    traffic = new TrafficView(root, actors, terrain.localTerrain);
    photographers = new MapPhotographers(root, actors, terrain.localTerrain);
    ambientPacks = new AmbientCyclistPacks(root, actors, terrain.localTerrain, cyclistCircuit(Array.from({ length: 100 }, (_, i) => ({ ...routePosition(60 + i * (LENGTH - 120) / 99), width: 5 }))), 0x444354);
    world.crowdActors = () => [
      ...ambientPacks!.obstacles().map(actor => ({ ...actor, ...toMap(actor.x, actor.y, actor.z), vx: -actor.vx })),
      ...currentObservers.slice(1).map(observer => ({ id: 'preview-driver-' + observer.id, x: observer.x, z: observer.z, y: world!.sampleGround(observer.x, observer.z, createGroundSample()).height, radius: .52, height: 2.2, kind: 'rider', vx: Math.sin(observer.heading) * observer.speed, vz: Math.cos(observer.heading) * observer.speed })),
      ...sourceCompanionObstacles(),
    ];
    await stage('remainingAssets', 'Checking the last source-world images and bird animations…', async () => {
      await waitForVendorPosters();
      const deadline = performance.now() + 30_000;
      while (!scenery!.birds.loaded && !scenery!.birds.error && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
      if (!scenery!.birds.loaded) throw new Error('Original crow flock did not load: ' + (scenery!.birds.error || 'asset timeout'));
    });
    world.step();
    options.applyAssets?.(root);
    complete = true;
    timings.totalReady = performance.now() - started;
    status('Complete Dequindre Cut district prepared. Preview only.');
  } catch (error) {
    failure = describeSwoopLoadError(error instanceof SwoopStageError ? error : new SwoopStageError('assembly', error));
    timings.failedAt = performance.now() - started;
    dispose();
    throw new Error('Dequindre Cut district could not prepare: ' + failure, { cause: error });
  }

  /** Scratch lifetime is bounded by the current host view list (including its
   * short split-screen grace period). View order can change without resetting
   * motion or changing the deterministically selected source physics driver.
   */
  function prepareViews(time: number, views: readonly PreparedDistrictView[]) {
    viewFrame++;
    let observersChanged = false;
    for (let index = 0; index < views.length; index++) {
      const view = views[index], id = view.interestId ?? view.camera.uuid;
      let point = viewScratch.get(id);
      if (!point) {
        point = {
          frame: viewFrame,
          rider: { x: 0, y: 0, z: 0, speed: 0 },
          camera: { x: 0, y: 0, z: 0, speed: 0 },
          mapRider: { x: 0, z: 0 }, mapCamera: { x: 0, z: 0 },
          observer: { id, x: 0, z: 0, speed: 0, heading: 0 },
          previousX: 0, previousZ: 0,
        };
        viewScratch.set(id, point);
        if (!view.preparationOnly) {
          currentObservers.push(point.observer);
          observersChanged = true;
        }
      }
      point.frame = viewFrame;
      terrain.toSwoop(view.x, 0, view.z, point.rider);
      view.camera.getWorldPosition(cameraPosition);
      terrain.toSwoop(cameraPosition.x, cameraPosition.y, cameraPosition.z, point.camera);
      // Exact original toMap X/Z, written into stable stream-interest records.
      point.mapRider.x = MAP_ORIGIN.x - point.rider.x;
      point.mapRider.z = point.rider.z + MAP_ORIGIN.z;
      point.mapCamera.x = MAP_ORIGIN.x - point.camera.x;
      point.mapCamera.z = point.camera.z + MAP_ORIGIN.z;
      const observer = point.observer, mapped = point.mapRider;
      if (time !== point.previousTime) {
        const elapsed = point.previousTime === undefined ? 0 : time - point.previousTime;
        const dx = point.previousTime === undefined ? 0 : mapped.x - point.previousX;
        const dz = point.previousTime === undefined ? 0 : mapped.z - point.previousZ;
        const distance = Math.hypot(dx, dz);
        // A teleport is not a 3,000 m/s driver. Original encounter thresholds
        // and the source measured-speed safeguard remain unchanged.
        observer.speed = elapsed > 0 && elapsed <= .5 && distance <= 80 ? distance / elapsed : 0;
        if (distance > .001) observer.heading = Math.atan2(dx, dz);
        point.previousX = mapped.x;
        point.previousZ = mapped.z;
        point.previousTime = time;
      }
      observer.x = mapped.x;
      observer.z = mapped.z;
      focus[index] = point;
      localPoints[index * 2] = point.rider;
      localPoints[index * 2 + 1] = point.camera;
      currentMapFocus[index * 2] = point.mapRider;
      currentMapFocus[index * 2 + 1] = point.mapCamera;
    }
    focus.length = views.length;
    localPoints.length = currentMapFocus.length = views.length * 2;
    if (viewScratch.size > views.length) {
      for (const [id, point] of viewScratch) if (point.frame !== viewFrame) viewScratch.delete(id);
      let kept = 0;
      for (let i = 0; i < currentObservers.length; i++) {
        const observer = currentObservers[i];
        if (viewScratch.has(observer.id)) currentObservers[kept++] = observer;
      }
      currentObservers.length = kept;
      observersChanged = true;
    }
    // Existing records remain sorted as their coordinates change. A normal
    // frame does no observer allocation, rebuilding or sorting.
    if (observersChanged) currentObservers.sort(compareObservers);
  }

  function sourceIsNearby(radius: number) {
    for (let p = 0; p < currentMapFocus.length; p++) {
      const point = currentMapFocus[p];
      for (let c = 0; c < world!.chunks.length; c++) {
        const chunk = world!.chunks[c];
        if (Math.hypot(Math.max(0, Math.abs(chunk.x - point.x) - 50), Math.max(0, Math.abs(chunk.z - point.z) - 50)) <= radius) return true;
      }
    }
    return false;
  }

  /** Call once with every active view before rendering a split screen. */
  function updateViews(time: number, views: readonly FrameView[]) {
    if (disposed || !complete) return;
    updatePreparedViews(time, viewHolds.update(views));
  }

  function updatePreparedViews(time: number, views: readonly PreparedDistrictView[]) {
    if (disposed || !complete || !views.length) return;
    const before = performance.now();
    const dt = lastTime === undefined || time <= lastTime ? 0 : Math.min(.1, time - lastTime);
    lastTime = time;
    prepareViews(time, views);
    setPreviewTrafficFocus(currentObservers, currentMapFocus);
    const radius = Number(settings.drawDistance) + 240;
    const nearby = sourceIsNearby(radius);
    // The same live-view and held-target union controls shader-light residency.
    sourceLighting.setActive(nearby);
    if (!nearby && dormant) {
      skippedDormantUpdates++;
      updateMilliseconds = performance.now() - before;
      return;
    }
    // Run the first departure frame normally so old near-camera resources and
    // collision actors are cleared. Static distant scenery stays attached.
    dormant = !nearby;
    windTime.value = time;
    if (currentObservers.length && (time - lastTraffic >= 1 / 30 || time < lastTraffic)) {
      const physicsObserver = currentObservers[0];
      world!.rideIntent.speed = physicsObserver.speed;
      world!.rideIntent.heading = physicsObserver.heading;
      world!.updateTraffic(time, physicsObserver.x, physicsObserver.z);
      world!.step(true);
      lastTraffic = time;
    }

    // Source scenery changes visibility of tiled/instanced objects. For multiple
    // cameras keep the union of visibility, shadow flags and instance counts.
    // The common single-view path incurs no full-scene union traversal.
    const union = views.length > 1;
    if (union) visibilityUnion.begin();
    let count = 0;
    for (let index = 0; index < focus.length; index++) {
      const point = focus[index], mapped = point.mapRider;
      count = Math.max(count, scenery!.update(mapped.x, mapped.z, time));
      nature!.update(index === 0 ? dt : 0, point.rider, false, false, reduced.matches);
      ambientPacks!.update(index === 0 ? dt : 0, point.rider, nearby, false);
      if (union) visibilityUnion.include(root);
    }
    if (union) {
      visibilityUnion.apply();
      count = 0;
      for (let i = 0; i < mapRoot.children.length; i++) if (mapRoot.children[i].userData.center && mapRoot.children[i].visible) count++;
    }
    visibleChunks = count;
    // This source effect follows the observer. Constrain it to its own district
    // so it does not add another atmosphere layer to Belle Isle when dormant.
    if (atmosphere) atmosphere.visible = nearby && !reduced.matches;
    retail!.update(localPoints, dt);
    sourceLighting.prepare(views[0].camera);
    for (let i = 0; i < world!.traffic.length; i++) mapTraffic[i] = toLocalTraffic(world!.traffic[i], mapTraffic[i]);
    mapTraffic.length = world!.traffic.length;
    trafficCenter.x = trafficCenter.z = 0;
    for (let i = 0; i < localPoints.length; i++) {
      trafficCenter.x += localPoints[i].x / localPoints.length;
      trafficCenter.z += localPoints[i].z / localPoints.length;
    }
    let spread = 0;
    for (let i = 0; i < localPoints.length; i++) spread = Math.max(spread, Math.hypot(localPoints[i].x - trafficCenter.x, localPoints[i].z - trafficCenter.z));
    const trafficRadius = Number(settings.drawDistance) + spread;
    traffic!.update(mapTraffic, dt, trafficCenter, trafficRadius);
    photographers!.update(dt, localPoints, 200);
    ambience!.update(time, localPoints as RidePose[]);
    if (!water) { water = new InteractiveWater(renderer.domElement, waterCamera); water.register(mapRoot); }
    waterCamera.copy(views[0].camera as T.PerspectiveCamera, false);
    waterCamera.matrixWorld.copy(views[0].camera.matrixWorld);
    waterCamera.matrixWorldInverse.copy(views[0].camera.matrixWorldInverse);
    waterRider.x = views[0].x;
    waterRider.y = terrain.sampleGround(views[0].x, views[0].z, ground).height;
    waterRider.z = views[0].z;
    water.update(waterRider, dormant);
    updateMilliseconds = performance.now() - before;
  }

  function update(time: number, x: number, z: number, camera: T.Camera) {
    if (!singleView.length) singleView.push({ x, z, camera });
    else { singleView[0].x = x; singleView[0].z = z; singleView[0].camera = camera; }
    updateViews(time, singleView);
  }

  async function warm(camera: T.Camera, x?: number, z?: number, activeViews?: readonly FrameView[]) {
    if (disposed) throw new Error('This district view has been disposed');
    camera.getWorldPosition(cameraPosition);
    const px = x ?? cameraPosition.x, pz = z ?? cameraPosition.z;
    const local = terrain.toSwoop(px, 0, pz), mapped = toMap(local.x, 0, local.z);
    const release = viewHolds.hold({ x: px, z: pz, camera }, activeViews);
    const refresh = () => {
      if (disposed) throw new Error('This district view was disposed during travel preparation');
      updatePreparedViews(lastTime ?? 0, viewHolds.current());
    };
    try {
      // Publish the complete interest union before the first async yield. Every
      // normal host update includes it until the final GPU preparation settles.
      refresh();
      await stage('lastWarm', 'Preparing the destination district before entering…', async () => {
        if (disposed) throw new Error('This district view was disposed during travel preparation');
        await scenery!.stream.warm([mapped], Number(settings.drawDistance) + 100);
        refresh();
        sourceLighting.prepare(camera);
        await warmFirstView(renderer, scene, camera);
        if (disposed) throw new Error('This district view was disposed during travel preparation');
      });
    } finally { release(); }
  }

  function diagnostics() {
    let meshes = 0, visibleMeshes = 0, sourceTriangles = 0;
    root.traverse(object => { if ((object as T.Mesh).isMesh) meshes++; });
    root.traverseVisible(object => { if ((object as T.Mesh).isMesh) visibleMeshes++; });
    for (const chunk of world!.chunks) sourceTriangles += chunk.indices.length / 3;
    return {
      sourceRevision: SOURCE_REVISION,
      sourceRouteMetres: LENGTH,
      ready: complete && !disposed,
      disposed,
      error: failure || null,
      mapCoverage: {
        terrainChunks: world!.chunks.length,
        terrainTriangles: sourceTriangles,
        mappedBuildings: world!.buildingMeshes.length,
        geospatialMeshes: world!.geoMeshes.length,
        colliders: world!.physics.colliders.len(),
        sourceSpots: SPOTS.length,
        freestyleYard: true,
        ...scenery!.architecture,
      },
      nature: nature!.status,
      crowFlock: scenery!.birds,
      trees: scenery!.trees,
      grassClumps: scenery!.grassClumps,
      foodTrucks: scenery!.foodTrucks,
      rails: scenery!.rails,
      landmarks: scenery!.landmarks,
      routeArt: scenery!.routeArt,
      retail: retail!.counts,
      actors: { sourceTraffic: world!.traffic.length, activeTrafficModels: traffic!.items.size, mapPhotographers: 18, ambientCyclists: ambientPacks!.rides.reduce((sum, ride) => sum + ride.riders.length, 0), activeObservers: currentObservers.length },
      stream: scenery!.stream.status,
      lighting: sourceLighting.diagnostics(),
      rendering: { meshes, visibleMeshes, visibleChunks, updateMilliseconds, dormant, skippedDormantUpdates, pooledViewRecords: viewScratch.size, unionRecordsAllocated: visibilityUnion.allocatedRecords, pendingWarmTargets: viewHolds.pendingTargets, settings: { ...settings } },
      timings: { ...timings },
      lifecycle: 'One host renderer; original source collision remains resident; source tiles and owned art jobs use distance visibility and hysteresis. Terrain owns physics disposal.',
      unavailableInteractions: [
        'Source race/challenge menus and source multiplayer sessions',
        'Retail commerce, accounts, bids and redemption',
        'Embedded arcade games and movie/commercial playback',
        'Source community-ride invitation UI and companion controller (host-owned)',
      ],
    };
  }

  return { root, update, updateViews, dispose, diagnostics, warm };
}

function toLocalTraffic(actor: TrafficState, result: TrafficState = {} as TrafficState): TrafficState {
  const previousFall = result.fall;
  Object.assign(result, actor);
  result.x = MAP_ORIGIN.x - actor.x;
  result.y = actor.y - MAP_ORIGIN.y;
  result.z = actor.z - MAP_ORIGIN.z;
  result.heading = -actor.heading;
  // Reused records must clear optional fields when the corresponding source
  // actor changes. Fall poses remain private copies, never mutated source data.
  result.routeDistance = actor.routeDistance;
  result.direction = actor.direction;
  result.fallPhase = actor.fallPhase;
  if (actor.fall) {
    const fall = Object.assign(previousFall ?? {} as RidePose, actor.fall);
    fall.headingY = -actor.fall.headingY;
    fall.crashLateral = -actor.fall.crashLateral;
    fall.crashRoll = -actor.fall.crashRoll;
    fall.crashSide = -actor.fall.crashSide;
    fall.wheelCrashLateral = -actor.fall.wheelCrashLateral;
    fall.wheelCrashLean = -actor.fall.wheelCrashLean;
    result.fall = fall;
  } else result.fall = undefined;
  return result;
}
