import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { boardNodes } from "../../content/board";
import { detroitLandmarks, projectDetroit, streetPolylines } from "../../content/detroitGeo";
import type { GameState } from "../../engine/state";

const BOARD_WIDTH = 31;
const BOARD_DEPTH = 20;
const districtColors = [0x00b7d6, 0x3979ff, 0xb760ff, 0xff4db8, 0xff784d, 0xf2bd35, 0x6dd16f, 0xd5e4ef] as const;

function worldPosition(x: number, y: number, elevation = 0): THREE.Vector3 {
  return new THREE.Vector3((x - 50) * (BOARD_WIDTH / 92), elevation, (y - 37) * (BOARD_DEPTH / 69));
}

function boardPosition(nodeId: number, elevation = 0): THREE.Vector3 {
  const node = boardNodes[nodeId];
  return worldPosition(node.x, node.y, elevation);
}

function makeLabel(text: string, accent = "#fff1b5", width = 520): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 96;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "rgba(4, 5, 12, .88)";
  context.roundRect(2, 2, width - 4, 92, 22);
  context.fill();
  context.strokeStyle = accent;
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = accent;
  context.font = "700 31px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, width / 2, 48, width - 28);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(width / 150, 0.64, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function cylinderBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
  const delta = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 10), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  mesh.receiveShadow = true;
  return mesh;
}

export class DetroitBoard3D {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(43, 1, 0.1, 120);
  private readonly controls: OrbitControls;
  private readonly tokens = new Map<string, THREE.Object3D>();
  private readonly ventureBuildings = new Map<number, THREE.Group>();
  private state?: GameState;
  private frame = 0;
  readonly ready = true;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute("aria-label", "3D Detroit Fortune Grid map");
    this.renderer.domElement.setAttribute("role", "img");
    container.replaceChildren(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x03040a);
    this.scene.fog = new THREE.FogExp2(0x050713, 0.022);
    this.camera.position.set(0, 28, 12);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 11;
    this.controls.maxDistance = 42;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.35;
    this.controls.target.set(0, 0, 0);

    this.addLights();
    this.addMapSurface();
    this.addStreetNetwork();
    this.addRoute();
    this.addLandmarks();
    this.addSpaces();
    this.resize();
    this.bindInput();
    this.renderer.setAnimationLoop(() => this.render());
  }

  private addLights() {
    this.scene.add(new THREE.HemisphereLight(0x9adfff, 0x160d21, 2.2));
    const sun = new THREE.DirectionalLight(0xffe7ae, 3.4);
    sun.position.set(-8, 18, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    this.scene.add(sun);
    const riverGlow = new THREE.PointLight(0x2edcff, 24, 30, 1.6);
    riverGlow.position.set(8, 5, 8);
    this.scene.add(riverGlow);
  }

  private addMapSurface() {
    const texture = new THREE.TextureLoader().load("./assets/art/detroit-fortune-grid-board.png");
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const surface = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_WIDTH, 0.35, BOARD_DEPTH),
      [
        new THREE.MeshStandardMaterial({ color: 0x0d1321, roughness: 0.78 }),
        new THREE.MeshStandardMaterial({ color: 0x0d1321, roughness: 0.78 }),
        new THREE.MeshStandardMaterial({ map: texture, color: 0x8195ad, roughness: 0.66, metalness: 0.08 }),
        new THREE.MeshStandardMaterial({ color: 0x080610 }),
        new THREE.MeshStandardMaterial({ color: 0x0d1321 }),
        new THREE.MeshStandardMaterial({ color: 0x0d1321 }),
      ],
    );
    surface.position.y = -0.28;
    surface.receiveShadow = true;
    this.scene.add(surface);

  }

  private addStreetNetwork() {
    const streetMaterial = new THREE.MeshStandardMaterial({ color: 0x46c6e5, emissive: 0x123f50, emissiveIntensity: 1.2, roughness: 0.7 });
    streetPolylines.forEach((street) => {
      const points = street.points.map((point) => {
        const projected = projectDetroit(point);
        return worldPosition(projected.x, projected.y, 0.03);
      });
      for (let index = 1; index < points.length; index += 1) this.scene.add(cylinderBetween(points[index - 1], points[index], 0.045, streetMaterial));
      const midpoint = points[Math.floor(points.length / 2)].clone();
      const label = makeLabel(street.name, "#8beeff", 360);
      label.scale.multiplyScalar(0.68);
      label.position.copy(midpoint).add(new THREE.Vector3(0, 0.48, 0));
      this.scene.add(label);
    });
  }

  private addRoute() {
    const shadowMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0712, roughness: 0.72 });
    const routeMaterial = new THREE.MeshStandardMaterial({ color: 0xf1c75b, emissive: 0x65430d, emissiveIntensity: 1.1, metalness: 0.42, roughness: 0.34 });
    for (let id = 0; id < boardNodes.length; id += 1) {
      const next = (id + 1) % boardNodes.length;
      const a = boardPosition(id, 0.12);
      const b = boardPosition(next, 0.12);
      this.scene.add(cylinderBetween(a, b, 0.1, shadowMaterial));
      this.scene.add(cylinderBetween(a.clone().setY(0.17), b.clone().setY(0.17), 0.045, routeMaterial));
    }
  }

  private addLandmarks() {
    detroitLandmarks.forEach((landmark) => {
      const projected = projectDetroit(landmark);
      const position = worldPosition(projected.x, projected.y, 0.18);
      const group = landmark.kind === "bridge" ? this.makeBridge(landmark.accent, landmark.height) : this.makeBuilding(landmark.kind, landmark.accent, landmark.height);
      group.position.copy(position);
      group.scale.setScalar(landmark.kind === "bridge" ? 0.7 : 0.5);
      this.scene.add(group);
      const label = makeLabel(landmark.name, landmark.kind === "stadium" ? "#ffffff" : "#fff1b5");
      label.scale.multiplyScalar(landmark.kind === "bridge" ? 0.55 : 0.45);
      label.position.copy(position).add(new THREE.Vector3(0, landmark.height * 0.72 + 0.75, 0));
      this.scene.add(label);
    });
  }

  private makeBuilding(kind: "tower" | "station" | "stadium" | "market" | "island", accent: number, height: number): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: accent, emissive: new THREE.Color(accent).multiplyScalar(0.16), emissiveIntensity: 0.8, metalness: 0.34, roughness: 0.47 });
    if (kind === "stadium") {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.28, height, 32, 1, true), material);
      const field = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x1b6d49, roughness: 0.9 }));
      field.position.y = height * 0.4;
      group.add(bowl, field);
    } else if (kind === "station") {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 1.25), material);
      base.position.y = 0.38;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.9, height, 0.82), material);
      tower.position.set(0.4, height / 2 + 0.55, 0);
      group.add(base, tower);
    } else if (kind === "market") {
      for (let index = -1; index <= 1; index += 1) {
        const shed = new THREE.Mesh(new THREE.BoxGeometry(0.7, height, 1.1), material);
        shed.position.set(index * 0.82, height / 2, 0);
        group.add(shed);
      }
    } else if (kind === "island") {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), material);
      group.add(dome);
    } else {
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.82, height, 0.82), material);
      core.position.y = height / 2;
      group.add(core);
      if (height > 5) {
        for (let index = 0; index < 4; index += 1) {
          const satellite = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, height * 0.58, 16), material);
          satellite.position.set(Math.cos(index * Math.PI / 2) * 0.75, height * 0.29, Math.sin(index * Math.PI / 2) * 0.75);
          group.add(satellite);
        }
      }
    }
    group.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
    return group;
  }

  private makeBridge(accent: number, height: number): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: accent, emissive: new THREE.Color(accent).multiplyScalar(0.22), emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.27 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 4.6), material);
    deck.position.y = 0.7;
    group.add(deck);
    [-1.1, 1.1].forEach((z) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.28, height, 0.28), material);
      tower.position.set(0, height / 2, z);
      group.add(tower);
      [-1, 1].forEach((side) => {
        const cableEnd = new THREE.Vector3(side * 0.95, 0.72, z + side * 1.1);
        group.add(cylinderBetween(new THREE.Vector3(0, height * 0.88, z), cableEnd, 0.025, material));
      });
    });
    group.rotation.y = -0.64;
    group.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
    return group;
  }

  private addSpaces() {
    boardNodes.forEach((node) => {
      const position = boardPosition(node.id, 0.34);
      const isVenture = node.kind === "venture";
      const districtIndex = isVenture ? Math.floor(node.ventureId! / 3) : 0;
      const material = new THREE.MeshStandardMaterial({
        color: isVenture ? districtColors[districtIndex] : node.kind === "hub" ? 0xf5c451 : 0x8f55d9,
        emissive: isVenture ? districtColors[districtIndex] : 0x4b2474,
        emissiveIntensity: 0.2,
        metalness: 0.42,
        roughness: 0.34,
      });
      const space = isVenture
        ? new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.62), material)
        : new THREE.Mesh(new THREE.CylinderGeometry(node.kind === "hub" ? 0.58 : 0.42, node.kind === "hub" ? 0.58 : 0.42, 0.25, 20), material);
      space.position.copy(position);
      space.castShadow = true;
      space.receiveShadow = true;
      this.scene.add(space);

      if (isVenture) {
        const buildings = new THREE.Group();
        buildings.position.copy(position).add(new THREE.Vector3(0, 0.18, 0));
        for (let level = 0; level < 4; level += 1) {
          const building = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.25 + level * 0.09, 0.14),
            new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x333333, emissiveIntensity: 0.5, metalness: 0.35 }),
          );
          building.position.set((level % 2 ? 1 : -1) * 0.16, 0.13 + level * 0.045, (level < 2 ? -1 : 1) * 0.16);
          building.visible = false;
          building.castShadow = true;
          buildings.add(building);
        }
        this.ventureBuildings.set(node.ventureId!, buildings);
        this.scene.add(buildings);
      }

      if (!isVenture) {
        const labelText = node.label;
        const label = makeLabel(labelText, "#fff1b5", 620);
        label.scale.multiplyScalar(0.42);
        label.position.copy(position).add(new THREE.Vector3(0, isVenture ? 0.75 : 0.92, 0));
        this.scene.add(label);
      }
    });
  }

  private bindInput() {
    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.container);
    window.addEventListener("keydown", (event) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;
      const amount = 0.7;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") this.controls.target.x -= amount;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") this.controls.target.x += amount;
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") this.controls.target.z -= amount;
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") this.controls.target.z += amount;
      if (event.key === "0") this.fitOverview();
    });
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.container.dataset.renderState = "recovering";
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => {
      this.container.dataset.renderState = "ready";
    });
  }

  private resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private render() {
    this.controls.update();
    this.tokens.forEach((token, id) => {
      if (id === "p1") token.rotation.y = Math.sin(performance.now() * 0.0015) * 0.08;
    });
    this.renderer.render(this.scene, this.camera);
  }

  fitOverview() {
    this.camera.position.set(0, 28, 12);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  followPlayer() {
    if (!this.state) return;
    const target = boardPosition(this.state.players[this.state.currentPlayer].nodeId, 0);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(new THREE.Vector3(0, 11, 8));
    this.controls.update();
  }

  setState(state: GameState) {
    this.state = state;
    boardNodes.forEach((node) => {
      if (node.kind !== "venture") return;
      const owner = state.players.find((player) => player.ventures[node.ventureId!]);
      const level = owner?.ventures[node.ventureId!] || 0;
      const group = this.ventureBuildings.get(node.ventureId!);
      group?.children.forEach((child, index) => {
        child.visible = index < level;
        if (child instanceof THREE.Mesh && owner) (child.material as THREE.MeshStandardMaterial).color.set(owner.color);
      });
    });

    state.players.forEach((player, index) => {
      let token = this.tokens.get(player.id);
      if (!token) {
        token = index === 0 ? this.makeMascotToken() : this.makePlayerToken(player.color, index + 1);
        this.tokens.set(player.id, token);
        this.scene.add(token);
      }
      token.position.copy(boardPosition(player.nodeId, 0.78 + index * 0.08));
    });
  }

  private makeMascotToken(): THREE.Object3D {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.18, 24), new THREE.MeshStandardMaterial({ color: 0xf5c451, metalness: 0.55, roughness: 0.28 }));
    base.position.y = 0.08;
    const texture = new THREE.TextureLoader().load("./assets/art/mascot/01.png");
    texture.colorSpace = THREE.SRGBColorSpace;
    const mascot = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false }));
    mascot.scale.set(1.4, 1.4, 1);
    mascot.position.y = 0.88;
    mascot.renderOrder = 30;
    group.add(base, mascot);
    return group;
  }

  private makePlayerToken(color: string, number: number): THREE.Object3D {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, metalness: 0.6, roughness: 0.25 });
    const token = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 20), material);
    token.position.y = 0.36;
    token.castShadow = true;
    const label = makeLabel(String(number), "#ffffff", 100);
    label.scale.set(0.42, 0.42, 1);
    label.position.y = 0.92;
    group.add(token, label);
    return group;
  }

  async animateRoute(playerId: string, route: number[], reduced: boolean) {
    const token = this.tokens.get(playerId);
    if (!token) return;
    for (const nodeId of route.slice(1)) {
      const destination = boardPosition(nodeId, token.position.y);
      if (reduced) {
        token.position.copy(destination);
        continue;
      }
      const start = token.position.clone();
      const duration = 230;
      await new Promise<void>((resolve) => {
        const began = performance.now();
        const step = (time: number) => {
          const progress = Math.min(1, (time - began) / duration);
          const eased = 0.5 - Math.cos(progress * Math.PI) / 2;
          token.position.lerpVectors(start, destination, eased);
          token.position.y = destination.y + Math.sin(progress * Math.PI) * 0.28;
          if (progress < 1) this.frame = requestAnimationFrame(step);
          else resolve();
        };
        this.frame = requestAnimationFrame(step);
      });
    }
  }
}
