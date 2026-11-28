import * as T from 'three';
import { visibleSceneryMatrices } from '@digital-static/ridecore';
import { GLTFLoader } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/compressedGLTFLoader.ts';
import { buildMackStudio } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/mackStudio.ts';
import { toLocal } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/geo-profile.ts';
import { LOTTO_SHOP, lottoCoordinates, lottoMap } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/lottoShopSite.ts';
import { PENNY_SHOP, pennyMap } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/pennyShopSite.ts';
import { destinationLayout } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/destinationLayout.ts';
import { CITY } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/geography.ts';
import { registerRetailShell, registerDestinationCollision } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/tagSceneryCollisions.ts';
import { storefrontDetails } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/storefrontDetails.ts';
import { useThinDisplayGlass } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/displayGlass.ts';
import { addPhotographyExhibition } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/photographyExhibition.ts';
import { addPennyAdvertisements } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/pennyWayfinding.ts';
import { RetailVisitors } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/retailVisitors.ts';
import { batchStaticGroup } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/static-batch.ts';
import { interiorVisibility, interiorVisitorsVisible } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/interiorBudget.ts';
import { STUDIO_SCREEN_WALLS } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/mediaSources.ts';
import type { DetroitWorld } from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/world.ts';

type Focus = { x: number; z: number };
type CatalogProduct = { image: string; category: string };

/** Only view assembly is adapted from the pinned source store builders.
 * No auction, account, checkout, iframe or source-game control class is imported.
 * Existing artwork, rooms, display geometry, lights and collision are retained.
 */
export async function buildPreviewRetail(scene: T.Scene, world: DetroitWorld, status: (message: string) => void) {
  const loader = new GLTFLoader();
  const sharedResources = new Set<unknown>();
  const protect = (root: T.Object3D, texturesOnly = false) => root.traverse(object => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh) return;
    if (!texturesOnly) sharedResources.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!texturesOnly) sharedResources.add(material);
      for (const value of Object.values(material)) if ((value as T.Texture)?.isTexture) sharedResources.add(value);
    }
  });

  status('Preparing Mack studio and its original yard collision…');
  const studio = await buildMackStudio(scene, world);
  addIdleStudioScreens(studio.building);
  addIdleCabinet(studio.building, -9, 20.65, Math.PI, 'wave', '2084 Static Wave');
  addIdleCabinet(studio.building, -10.4, 20.65, Math.PI, 'rahbe', 'Robot RAHBE · Vault Rush');

  status('Preparing LottoMind and Penny Exchange map interiors…');
  const lotto = (await loader.loadAsync('/__swoop-assets__/exports/atwater/lottomind-store.glb?v=street-entry-20261003')).scene;
  const lottoAt = toLocal(LOTTO_SHOP.x, LOTTO_SHOP.floor, LOTTO_SHOP.z);
  lotto.position.set(lottoAt.x, lottoAt.y, lottoAt.z);
  lotto.rotation.y = LOTTO_SHOP.heading;
  lotto.name = 'LottoMind Mack Avenue virtual store';
  visibleSceneryMatrices(lotto);
  scene.add(lotto);
  lotto.traverse(object => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh) return;
    mesh.receiveShadow = true;
    mesh.castShadow = !(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(material => material.transparent);
  });
  registerRetailShell(world, 'lotto');
  const glass = new T.MeshPhysicalMaterial({ color: 0xe5eee4, transparent: true, opacity: .10, roughness: .17, metalness: .10, depthWrite: false, side: T.DoubleSide });
  for (const u of [-4.05, 4.05]) {
    const pane = new T.Mesh(new T.PlaneGeometry(5.15, 2.85), glass);
    pane.position.set(u, 1.58, 9.48);
    lotto.add(pane);
  }
  for (const u of [-3.5, 3.5]) {
    const light = new T.PointLight(0xffecd0, 55, 15, 2);
    light.position.set(u, 3.75, 0);
    lotto.add(light);
  }
  await storefrontDetails(lotto, world, true);

  const penny = (await loader.loadAsync('/__swoop-assets__/exports/atwater/penny-exchange.glb')).scene;
  const pennyMapAt = pennyMap(0, 0);
  const pennyAt = toLocal(pennyMapAt.x, PENNY_SHOP.floor, pennyMapAt.z);
  penny.position.set(pennyAt.x, pennyAt.y, pennyAt.z);
  penny.rotation.y = PENNY_SHOP.heading;
  penny.name = 'Penny Exchange / connected LottoMind building';
  visibleSceneryMatrices(penny);
  scene.add(penny);
  penny.traverse(object => { if (object instanceof T.Mesh) object.castShadow = object.receiveShadow = true; });
  useThinDisplayGlass(penny);
  registerRetailShell(world, 'penny');
  for (const v of [-5, 5]) {
    const light = new T.PointLight(0xffe5c9, 60, 15, 2);
    light.position.set(0, 3.7, v);
    penny.add(light);
  }
  const footprint = CITY.buildings.find(building => building.id === PENNY_SHOP.osmId);
  if (!footprint) throw new Error('Penny Exchange original mapped footprint is missing');
  const upper = new T.ExtrudeGeometry(new T.Shape(footprint.points.map(([x, z]) => {
    const point = lottoCoordinates(x, z);
    return new T.Vector2(point.u - PENNY_SHOP.u, -point.v);
  })), { depth: 5.6, bevelEnabled: false });
  upper.rotateX(-Math.PI / 2);
  upper.translate(0, 4.3, 0);
  penny.add(new T.Mesh(upper, new T.MeshStandardMaterial({ color: 0x7c6457, roughness: .9 })));
  const catalogResponse = await fetch('/__swoop-assets__/exports/boutique/catalog.json');
  if (!catalogResponse.ok) throw new Error('Original merchandise display art manifest could not load');
  const products = await catalogResponse.json() as CatalogProduct[];
  const art = await Promise.all(products.slice(0, 8).map(product => new T.TextureLoader().loadAsync('/__swoop-assets__/exports/boutique/' + product.image)));
  for (const [i, texture] of art.entries()) {
    texture.colorSpace = T.SRGBColorSpace;
    const side = i < 4 ? -1 : 1, v = [-6, -2, 2, 6][i % 4];
    const frame = new T.Mesh(new T.BoxGeometry(.08, 1.8, 1.4), new T.MeshStandardMaterial({ color: 0xc6ad68, metalness: .65, roughness: .4 }));
    frame.position.set(side * 3.83, 2.55, v);
    const face = new T.Mesh(new T.PlaneGeometry(1.30, 1.7), new T.MeshBasicMaterial({ map: texture }));
    face.position.set(side * 3.775, 2.55, v);
    face.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    penny.add(frame, face);
  }
  for (const side of [-1, 1]) for (const u of [-2.8, 0, 2.8]) {
    const window = new T.Mesh(new T.PlaneGeometry(1.55, 2.1), new T.MeshStandardMaterial({ color: 0x253942, metalness: .35, roughness: .26 }));
    window.position.set(u, 7.4, side * 9.415);
    if (side < 0) window.rotation.y = Math.PI;
    penny.add(window);
  }
  const advertisements = await addPennyAdvertisements(scene, penny, world, products);
  protect(await addPhotographyExhibition(penny, 'penny'), true);
  const kiosk = (await loader.loadAsync('/__swoop-assets__/exports/atwater/lotto-game-kiosk.glb')).scene;
  kiosk.name = 'LottoMind playable game kiosk';
  kiosk.position.set(3.4, 0, 5.25);
  lotto.add(kiosk);
  addIdleCabinet(lotto, 3.4, 5.25, 0, 'wave', '2084 Static Wave · LottoMind game kiosk');
  const kioskMap = lottoMap(3.4, 5.25);
  world.addBox({ x: kioskMap.x, y: LOTTO_SHOP.floor + .8, z: kioskMap.z, hx: .64, hy: .8, hz: .55, yaw: -LOTTO_SHOP.heading, kind: 'retail game kiosk' });

  status('Preparing the Serengeti gallery and GothTechnology showroom…');
  const rooms: { building: T.Group; visitors: RetailVisitors; store: boolean }[] = [];
  for (const store of [false, true]) {
    const layout = destinationLayout(store), building = new T.Group();
    building.name = store ? 'GothTech enclosed showroom' : 'Serengeti enclosed gallery';
    building.position.set(layout.local.x, layout.local.y, layout.local.z);
    building.rotation.y = layout.heading;
    building.scale.setScalar(layout.scale);
    visibleSceneryMatrices(building);
    const depth = layout.foundationDepth / layout.scale;
    const skirt = new T.Mesh(new T.BoxGeometry(18, depth, 17), new T.MeshStandardMaterial({ color: 0x343934, roughness: .9 }));
    skirt.position.set(0, -depth / 2, -1.5);
    skirt.receiveShadow = true;
    building.add(skirt);
    scene.add(building);
    const data = await loader.loadAsync(store ? '/__swoop-assets__/exports/boutique/GothTechnology-Store.glb?v=retail-polish-20261003' : '/__swoop-assets__/exports/gallery/Serengeti-Galleries.glb?v=production-studio-20261003');
    data.scene.traverse(object => {
      if (object instanceof T.Mesh) object.castShadow = object.receiveShadow = true;
      if (/^(Roof|Crown|Gothic Gothic|Forecourt|Entry canopy|Canopy|Bronze facade fin|Icosphere|Facade vertical joint)/.test(object.name.replace(/_/g, ' '))) object.visible = false;
    });
    building.add(data.scene);
    if (!store) protect(await addPhotographyExhibition(building, 'serengeti'), true);
    else {
      const display = (await loader.loadAsync('/__swoop-assets__/exports/boutique/innovation-floor-hoodie-display.glb')).scene;
      display.name = 'Innovation Floor · navy hoodie';
      display.position.set(3.1, 0, -5.54);
      display.traverse(object => { if (object instanceof T.Mesh) object.castShadow = object.receiveShadow = true; });
      building.add(display);
      for (const x of [-5, 0, 5]) {
        const light = new T.PointLight(0xffe6c9, 38, 11, 2);
        light.position.set(x, 3.8, -1.5);
        building.add(light);
      }
    }
    batchStaticGroup(building, { opaqueOnly: true });
    const visitors = new RetailVisitors(store);
    visibleSceneryMatrices(visitors.root);
    building.add(visitors.root);
    await visitors.load();
    protect(visitors.root);
    registerDestinationCollision(world, store);
    if (store) addIdleCabinet(building, 2.35, -4.7, 0, 'underground', 'ROBOT RAHBE: Underground');
    rooms.push({ building, visitors, store });
  }
  world.step();

  return {
    sharedResources,
    counts: { studio: 1, lotto: 1, penny: 1, rooms: rooms.length, visitors: rooms.reduce((sum, room) => sum + room.visitors.count, 0), cabinets: 4, wallScreens: STUDIO_SCREEN_WALLS.length },
    update(focus: readonly Focus[], dt: number) {
      const closest = (point: Focus) => focus.reduce((best, value) => Math.hypot(value.x - point.x, value.z - point.z) < Math.hypot(best.x - point.x, best.z - point.z) ? value : best, focus[0]);
      if (!focus.length) return;
      // Each building uses its nearest active view; one camera can never hide
      // a room or its visitors while another camera is looking inside it.
      const studioFocus = closest(studio.building.position);
      studio.update(studioFocus.x, studioFocus.z);
      lotto.visible = focus.some(point => Math.hypot(point.x - lottoAt.x, point.z - lottoAt.z) < 250);
      penny.visible = focus.some(point => Math.hypot(point.x - pennyAt.x, point.z - pennyAt.z) < 250);
      const advertFocus = closest(advertisements.sign.position);
      advertisements.update(advertFocus.x, advertFocus.z);
      for (const room of rooms) {
        const distance = Math.min(...focus.map(point => Math.hypot(point.x - room.building.position.x, point.z - room.building.position.z)));
        room.building.visible = interiorVisibility(distance, room.building.visible);
        room.visitors.root.visible = room.building.visible && interiorVisitorsVisible(distance, room.visitors.root.visible);
        if (room.visitors.root.visible) room.visitors.update(dt);
      }
    },
  };
}

/** Exact source idle-screen geometry; interactive apps remain host-owned. */
function addIdleCabinet(parent: T.Object3D, u: number, v: number, angle: number, id: 'wave' | 'rahbe' | 'underground', name: string) {
  const root = new T.Group();
  root.name = name + ' / idle cabinet';
  root.position.set(u, 0, v);
  root.rotation.y = angle;
  parent.add(root);
  const poster = document.createElement('canvas');
  poster.width = 512; poster.height = 288;
  const ink = poster.getContext('2d')!;
  ink.fillStyle = '#081a18'; ink.fillRect(0, 0, 512, 288); ink.fillStyle = '#d6efbf'; ink.font = 'bold 28px sans-serif'; ink.textAlign = 'center';
  ink.fillText(name.includes('Underground') ? 'RAHBE: Underground' : name, 256, 105); ink.font = '22px sans-serif'; ink.fillText('PRESS PLAY / FREE PLAY', 256, 182);
  const idle = new T.CanvasTexture(poster); idle.colorSpace = T.SRGBColorSpace;
  const screen = new T.Mesh(new T.PlaneGeometry(.64, .36), new T.MeshBasicMaterial({ map: idle, toneMapped: false })); screen.position.set(0, 1.345, .306); root.add(screen);
  for (const x of id === 'wave' ? [-.20, .20] : [-.20]) {
    const stick = new T.Group(); stick.position.set(x, 1.028, .37);
    const shaft = new T.Mesh(new T.CylinderGeometry(.014, .014, .13, 12), new T.MeshStandardMaterial({ color: '#abbaba', metalness: .8, roughness: .3 })); shaft.position.y = .055;
    const knob = new T.Mesh(new T.SphereGeometry(.049, 16, 12), new T.MeshStandardMaterial({ color: x > 0 ? '#c5da5a' : '#d12e49', roughness: .4 })); knob.position.y = .135;
    stick.add(shaft, knob); root.add(stick);
  }
  for (const [index, x] of (id === 'wave' ? [-.045, .065] : [.12, .27]).entries()) {
    const button = new T.Mesh(new T.CylinderGeometry(.038, .04, .025, 16), new T.MeshStandardMaterial({ color: index === 0 ? '#e9ca66' : '#436cff', roughness: .4 })); button.position.set(x, 1.038, .37); root.add(button);
  }
}

function addIdleStudioScreens(building: T.Object3D) {
  for (const [i, wall] of STUDIO_SCREEN_WALLS.entries()) {
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const ink = canvas.getContext('2d')!;
    ink.fillStyle = '#091c1a'; ink.fillRect(0, 0, 1280, 720); ink.strokeStyle = '#b79d56'; ink.lineWidth = 5; ink.strokeRect(28, 28, 1224, 664);
    ink.fillStyle = '#dece93'; ink.font = '28px sans-serif'; ink.fillText('GOTHTECH  /  2000 MACK', 80, 125); ink.fillStyle = '#f0efe2'; ink.font = 'bold 64px sans-serif'; ink.fillText(i ? 'STREAM WALL' : 'CINEMA WALL', 80, 310);
    ink.font = '30px sans-serif'; ink.fillStyle = '#b9ccbd'; ink.fillText(i ? 'Public live demo · or connect your HLS stream' : 'City in Motion / Detroit mini movie', 80, 385); ink.fillText('Press Play in Wall screens', 80, 565);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(new T.PlaneGeometry(wall.width, wall.height), new T.MeshBasicMaterial({ map: texture, toneMapped: false }));
    mesh.name = wall.id + ' wall playback'; mesh.position.set(wall.u, wall.y, wall.v); mesh.rotation.y = wall.angle; building.add(mesh);
  }
}
