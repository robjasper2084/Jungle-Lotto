import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PerformanceGovernor, qualitySettings, type Quality } from './governor';

/** Actual 3D architecture; never replace missing product models with flat lookalikes. */
export function mountScene(host: HTMLElement, quality: Quality, status: (text: string) => void) {
  const hero = host.closest<HTMLElement>('.hero')!;
  // Keep the complete poster, no WebGL allocation or missing-asset requests, until
  // both inspected product exports are supplied. An incomplete scene is not a product.
  if (!host.dataset.hoodieModel || !host.dataset.charmModel) {
    status('Static armory · product models pending');
    host.dataset.quality = 'fallback';
    return () => {};
  }
  const resources = new Set<{ dispose: () => void }>();
  const track = <T extends { dispose: () => void }>(resource: T) => { resources.add(resource); return resource; };
  const renderer = new THREE.WebGLRenderer({ antialias: quality === 'high', alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, qualitySettings[quality].dpr));
  renderer.setClearColor(0x050605);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x080a09, .035);
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 90);
  const governor = new PerformanceGovernor(quality);
  const stone = track(new THREE.MeshStandardMaterial({ color: 0x242623, roughness: .69, metalness: .28 }));
  const dark = track(new THREE.MeshStandardMaterial({ color: 0x0e1110, roughness: .38, metalness: .65 }));
  const brass = track(new THREE.MeshStandardMaterial({ color: 0xa98239, roughness: .31, metalness: .8 }));
  const glow = track(new THREE.MeshBasicMaterial({ color: 0xffd484 }));
  const box = track(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = track(new THREE.CylinderGeometry(1, 1, 1, 12));
  function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
    const object = new THREE.Mesh(geo, mat); object.position.set(x, y, z); object.scale.set(sx, sy, sz); scene.add(object); return object;
  }
  scene.add(new THREE.HemisphereLight(0xf4dcb1, 0x151d24, 2.2));
  const key = new THREE.DirectionalLight(0xffcf83, 4.3); key.position.set(3, 7, 7); scene.add(key);
  const fill = new THREE.DirectionalLight(0x8baab2, 1.1); fill.position.set(-4, 3, 4); scene.add(fill);
  const rear = new THREE.PointLight(0xe6ad52, 60, 28, 2); rear.position.set(0, 5, -8); scene.add(rear);
  mesh(box, dark, 0, -.22, -8, 26, .4, 50);
  // Shared geometries keep this long architectural perspective inexpensive.
  const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(-4, 5, 0), new THREE.Vector3(-4, 7, 0), new THREE.Vector3(-1.5, 8.7, 0), new THREE.Vector3(0, 9.6, 0));
  const arch = track(new THREE.TubeGeometry(curve, 28, .16, 6, false));
  const rib = track(new THREE.TubeGeometry(curve, 28, .026, 5, false));
  for (let i = 0; i < 7; i++) {
    const z = 2 - i * 5;
    for (const side of [-1, 1]) {
      mesh(cylinder, stone, side * 4.05, 2.5, z, .32, 5, .32);
      mesh(cylinder, brass, side * 4.05, .22, z, .52, .44, .52);
      mesh(cylinder, stone, side * 4.05, .6, z, .43, .23, .43);
      mesh(cylinder, brass, side * 4.05, 4.85, z, .49, .28, .49);
      const a = mesh(arch, stone, 0, 0, z); a.scale.x = side;
      const b = mesh(rib, brass, 0, -.08, z + .17); b.scale.x = side;
      mesh(box, glow, side * 3.77, 2.6, z + .2, .035, 3.45, .035);
      mesh(box, brass, side * 3.78, 2.6, z + .15, .12, 3.65, .11);
      mesh(box, stone, side * 6.2, 3, z - 2.4, 3.6, 6, .25);
    }
    mesh(box, brass, 0, .012, z, 8, .018, .025);
  }
  for (let i = -3; i <= 3; i++) mesh(box, brass, i * 1.35, .01, -12, .015, .012, 38);
  // Three solid plinths and stepped base, lit independently of the supplied artwork.
  mesh(box, stone, 0, .16, 0, 5.5, .32, 2.1);
  mesh(box, dark, -.65, .61, -.08, 2.6, .62, 1.55);
  mesh(box, brass, -.65, .93, -.08, 2.63, .028, 1.57);
  mesh(box, dark, 1.55, .55, .25, 1.4, .48, 1.3);
  mesh(box, brass, 1.55, .8, .25, 1.43, .026, 1.33);
  const plane = track(new THREE.PlaneGeometry(1, 1));
  const loader = new GLTFLoader();
  let disposed = false, raf = 0, visible = true, lost = false, last = 0, elapsed = 0, rendered = 0;
  let pointerX = 0, pointerY = 0, cameraX = 0, cameraY = 0, sceneProgress = 0;
  let imagesReady = 0;
  const productModel = (url: string, x: number, baseY: number, z: number, height: number) => {
    loader.load(url, gltf => {
      const object = gltf.scene;
      object.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        track(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          track(material); for (const value of Object.values(material)) if (value instanceof THREE.Texture) track(value);
        }
      });
      if (disposed) { resources.forEach(resource => resource.dispose()); return; }
      const bounds = new THREE.Box3().setFromObject(object), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const scale = height / Math.max(.001, size.y);
      object.scale.setScalar(scale); object.position.set(x - center.x * scale, baseY - bounds.min.y * scale, z - center.z * scale); scene.add(object);
      imagesReady++;
      if (imagesReady === 2) { host.dataset.ready = 'true'; hero.dataset.sceneReady = 'true'; status('3D cathedral · generated product concepts'); schedule(); }
      render();
    }, undefined, () => { if (!disposed) { host.dataset.ready = 'false'; hero.dataset.sceneReady = 'false'; status('Static armory / model unavailable'); } });
  };
  productModel(host.dataset.hoodieModel, -.65, .95, .18, 3.5);
  productModel(host.dataset.charmModel, 1.48, .83, .46, 2.25);
  const count = qualitySettings[quality].particles;
  const vertices = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { vertices[i * 3] = Math.sin(i * 53.1) * 5; vertices[i * 3 + 1] = .6 + (i % 17) * .37; vertices[i * 3 + 2] = 2 - (i % 19); }
  const dustGeometry = track(new THREE.BufferGeometry()); dustGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const dust = new THREE.Points(dustGeometry, track(new THREE.PointsMaterial({ color: 0xeacb86, size: .026, transparent: true, opacity: .55, depthWrite: false }))); scene.add(dust);
  // Low-cost translucent fog volumes: shader noise, no image download or postprocess chain.
  const mistMaterial = track(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv; uniform float time; void main(){float n=sin(vUv.x*18.0+time*.12)*sin(vUv.y*11.0-vUv.x*6.0+time*.07);float edge=sin(vUv.x*3.14159)*sin(vUv.y*3.14159);gl_FragColor=vec4(.51,.45,.32,edge*max(0.0,n+.5)*.055);}' }));
  const mist: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) mist.push(mesh(plane, mistMaterial, 0, .7 + i * .2, 1 - i * 4, 13, 2.3, 1));
  const isPaused = () => document.documentElement.dataset.cinemaPaused === 'true';
  const canRun = () => imagesReady === 2 && !disposed && !lost && visible && !document.hidden && !isPaused() && !document.querySelector('dialog[open]') && governor.quality !== 'fallback';
  function render() { if (!disposed && !lost) renderer.render(scene, camera); }
  const resize = () => {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(Math.max(1, width), Math.max(1, height), false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); updateCamera(1); render();
  };
  function updateCamera(delta: number) {
    const bounds = hero.getBoundingClientRect();
    sceneProgress = Math.max(0, Math.min(1, -bounds.top / Math.max(1, bounds.height)));
    const ease = 1 - Math.exp(-delta / 160);
    cameraX += (pointerX - cameraX) * ease; cameraY += (pointerY - cameraY) * ease;
    const approach = 1 - Math.pow(1 - Math.min(elapsed / 5, 1), 3);
    const mobile = camera.aspect < .8;
    camera.position.set(cameraX * .32 + sceneProgress * .18, 3.3 - cameraY * .16, (mobile ? 13.8 : 12.4) + (1 - approach) * 2.2 - sceneProgress * .6);
    camera.lookAt(0, mobile ? 3.6 : 3.35, 0);
  }
  function schedule() { cancelAnimationFrame(raf); last = 0; rendered = 0; if (canRun()) raf = requestAnimationFrame(frame); }
  function frame(now: number) {
    if (!canRun()) return;
    raf = requestAnimationFrame(frame);
    const interval = 1000 / qualitySettings[governor.quality].fps;
    if (rendered && now - rendered < interval - 1) return;
    const delta = last ? Math.min(now - last, 120) : interval; last = now; rendered = now; elapsed += delta / 1000;
    if (governor.sample(delta)) {
      quality = governor.quality; host.dataset.quality = quality;
      if (quality === 'fallback') { cancelAnimationFrame(raf); hero.dataset.sceneReady = 'false'; host.dataset.ready = 'false'; status('Static armory / performance safeguard'); return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio, qualitySettings[quality].dpr));
      dustGeometry.setDrawRange(0, Math.min(count, qualitySettings[quality].particles));
      if (quality === 'low') mist.forEach(object => object.visible = false);
    }
    updateCamera(delta); dust.rotation.y = Math.sin(elapsed * .05) * .04; dust.position.y = Math.sin(elapsed * .12) * .08;
    mistMaterial.uniforms.time.value = elapsed;
    render();
  }
  const aim = (event: PointerEvent) => { if (event.pointerType !== 'mouse' || isPaused()) return; const b = hero.getBoundingClientRect(); pointerX = (event.clientX - b.left) / b.width - .5; pointerY = (event.clientY - b.top) / b.height - .5; };
  const center = () => { pointerX = 0; pointerY = 0; };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; schedule(); }); visibilityObserver.observe(hero);
  const lostContext = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(raf); host.dataset.ready = 'false'; hero.dataset.sceneReady = 'false'; host.dataset.quality = 'fallback'; status('Static armory / graphics paused'); };
  hero.addEventListener('pointermove', aim); hero.addEventListener('pointerleave', center);
  renderer.domElement.addEventListener('webglcontextlost', lostContext);
  for (const event of ['visibilitychange', 'store:dialog', 'store:motion']) document.addEventListener(event, schedule);
  resize(); schedule();
  return () => {
    disposed = true; cancelAnimationFrame(raf); resizeObserver.disconnect(); visibilityObserver.disconnect();
    hero.removeEventListener('pointermove', aim); hero.removeEventListener('pointerleave', center);
    for (const event of ['visibilitychange', 'store:dialog', 'store:motion']) document.removeEventListener(event, schedule);
    renderer.domElement.removeEventListener('webglcontextlost', lostContext);
    resources.forEach(resource => resource.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    delete host.dataset.ready; delete hero.dataset.sceneReady;
  };
}
