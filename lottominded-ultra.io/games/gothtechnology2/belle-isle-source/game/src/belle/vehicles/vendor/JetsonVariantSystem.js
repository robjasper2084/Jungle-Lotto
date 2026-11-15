/** Modular visual variants for the Jetson cockpit. No aircraft flight model. */

const frozen = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(frozen); Object.freeze(value);
  }
  return value;
};

export const LIVERIES = frozen({
  industrial: {
    id: 'industrial', label: 'Standard Industrial', family: 'Standard Industrial',
    description: 'Brushed silver with matte carbon accents',
    paint: '#aeb8c1', metalness: 0.88, roughness: 0.34, clearcoat: 0.16,
    clearcoatRoughness: 0.32, normalStrength: 0.12, trim: '#cbdce2', trimIntensity: 0.35,
    dashboard: { accent: '#a6d8e4', background: '#071016', headerBackground: '#13232c', label: 'INDUSTRIAL' },
    textureFolder: 'Textures/Liveries/StandardIndustrial', massKg: 0,
  },
  sport_red: {
    id: 'sport_red', label: 'Sport / Racing Red', family: 'Sport Edition',
    description: 'Gloss racing red with illuminated trim',
    paint: '#cc1832', metalness: 0.42, roughness: 0.19, clearcoat: 1,
    clearcoatRoughness: 0.12, normalStrength: 0, trim: '#ff5264', trimIntensity: 2.4,
    dashboard: { accent: '#ff7182', background: '#140a10', headerBackground: '#2d121c', label: 'SPORT RED' },
    textureFolder: 'Textures/Liveries/SportEdition', massKg: 0,
  },
  sport_blue: {
    id: 'sport_blue', label: 'Sport / Electric Blue', family: 'Sport Edition',
    description: 'Gloss electric blue with illuminated trim',
    paint: '#087eea', metalness: 0.42, roughness: 0.19, clearcoat: 1,
    clearcoatRoughness: 0.12, normalStrength: 0, trim: '#54cfff', trimIntensity: 2.4,
    dashboard: { accent: '#65d5ff', background: '#06111e', headerBackground: '#0b2940', label: 'SPORT BLUE' },
    textureFolder: 'Textures/Liveries/SportEdition', massKg: 0,
  },
});

export const PILOTS = frozen({
  professional: {
    id: 'professional', label: 'The Professional',
    description: 'Tactical flight gear', massKg: 80, localCgBlender: [0, -0.10, 0.20],
    file: 'Pilot_Professional.glb', skeletonProfile: 'JetsonPilot_SeatedHumanoid_v1',
  },
  maverick: {
    id: 'maverick', label: 'The Maverick',
    description: 'Aerodynamic flight suit', massKg: 80, localCgBlender: [0, -0.10, 0.20],
    file: 'Pilot_Maverick.glb', skeletonProfile: 'JetsonPilot_SeatedHumanoid_v1',
  },
});

export const VARIANT_PRESETS = frozen({
  professional: { label: 'The Professional', PilotID: 'professional', LiveryID: 'industrial' },
  maverick: { label: 'The Maverick', PilotID: 'maverick', LiveryID: 'sport_blue' },
});

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const finite = (n, fallback) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const cloneData = value => JSON.parse(JSON.stringify(value));

function requireVector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(`${label} must contain three finite numbers.`);
  }
  return value.slice();
}

function requireMass(value, label, positive = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive ? value <= 0 : value < 0)) {
    throw new TypeError(`${label} must be a finite ${positive ? 'positive' : 'nonnegative'} number.`);
  }
  return value;
}

export function validateSelection(selection, previous = { PilotID: 'professional', LiveryID: 'industrial' }) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
    throw new TypeError('Select a { PilotID, LiveryID } object.');
  }
  const PilotID = own(selection, 'PilotID') ? selection.PilotID : previous.PilotID;
  const LiveryID = own(selection, 'LiveryID') ? selection.LiveryID : previous.LiveryID;
  if (!own(PILOTS, PilotID) || typeof PilotID !== 'string') throw new RangeError(`Unknown PilotID: ${String(PilotID)}`);
  if (!own(LIVERIES, LiveryID) || typeof LiveryID !== 'string') throw new RangeError(`Unknown LiveryID: ${String(LiveryID)}`);
  return { PilotID, LiveryID };
}

/**
 * Gameplay mass policy, in the aircraft's local coordinates. Seat compression and
 * cosmetic animation do not silently alter the physics body's reference mass.
 * Supply measured values through massModel when connecting a real simulator.
 */
export function computeMassProperties(selection, massModel = {}) {
  const { PilotID, LiveryID } = validateSelection(selection);
  const pilot = { ...PILOTS[PilotID], ...(massModel.pilots?.[PilotID] ?? {}) };
  const vehicleMassKg = requireMass(massModel.vehicleMassKg ?? 115, 'vehicleMassKg', true);
  const pilotMassKg = requireMass(pilot.massKg, 'pilot.massKg');
  const vehicleCg = requireVector(massModel.vehicleCgBlender ?? [0, 0, 0.55], 'vehicleCgBlender');
  const socket = requireVector(massModel.socketPositionBlender ?? [0, 0.10, 0.47], 'socketPositionBlender');
  const pilotLocalCg = requireVector(pilot.localCgBlender, 'pilot.localCgBlender');
  const pilotCg = pilotLocalCg.map((v, i) => v + socket[i]);
  const liveryMassKg = requireMass(massModel.liveries?.[LiveryID]?.massKg ?? LIVERIES[LiveryID].massKg, 'livery.massKg');
  const liveryCg = requireVector(massModel.liveries?.[LiveryID]?.cgBlender ?? vehicleCg, 'livery.cgBlender');
  const massKg = vehicleMassKg + pilotMassKg + liveryMassKg;
  const cg = vehicleCg.map((v, i) =>
    (vehicleMassKg * v + pilotMassKg * pilotCg[i] + liveryMassKg * liveryCg[i]) / massKg);
  const centerOfMass = [cg[0], cg[2], cg[1] === 0 ? 0 : -cg[1]];
  return frozen({
    massKg, centerOfMass, centerOfMassBlender: cg,
    coordinateFrame: 'aircraft-local glTF: +Y up, metres',
    policy: 'Equal 80 kg pilots and cosmetic zero-mass liveries by default; numerical gameplay assumptions, not measured anatomy or flight validation.',
    referencePose: 'Seat socket bind pose; visual seat compression does not modify mass properties.',
    components: {
      vehicle: { massKg: vehicleMassKg, centerOfMassBlender: vehicleCg },
      pilot: { id: PilotID, massKg: pilotMassKg, localCgBlender: pilotLocalCg, centerOfMassBlender: pilotCg },
      livery: { id: LiveryID, massKg: liveryMassKg, centerOfMassBlender: liveryCg },
    },
  });
}

export function verifyVariantMassInvariance(massModel = {}, tolerance = 1e-9) {
  const combinations = [];
  for (const PilotID of Object.keys(PILOTS)) for (const LiveryID of Object.keys(LIVERIES)) {
    combinations.push({ PilotID, LiveryID, ...computeMassProperties({ PilotID, LiveryID }, massModel) });
  }
  const baseline = combinations[0];
  const maxMassDeltaKg = Math.max(...combinations.map(v => Math.abs(v.massKg - baseline.massKg)));
  const maxCgDeltaM = Math.max(...combinations.map(v => Math.hypot(...v.centerOfMass.map((n, i) => n - baseline.centerOfMass[i]))));
  return frozen({ passed: maxMassDeltaKg <= tolerance && maxCgDeltaM <= tolerance,
    combinations, maxMassDeltaKg, maxCgDeltaM, tolerance,
    scope: 'Mass-property arithmetic only; no dynamics, stability, collision or real aircraft testing.' });
}

function roleOf(node, material) {
  const explicit = material?.userData?.livery_role ?? material?.userData?.role
    ?? node?.userData?.livery_role ?? node?.userData?.role;
  if (['paint', 'trim', 'carbon', 'pilot_accent'].includes(explicit)) return explicit;
  const name = material?.name ?? '';
  if (/Livery_Paint|01 \| Pearl white ceramic paint/i.test(name)) return 'paint';
  if (/Livery_Trim|Sport_LED_Trim/i.test(name)) return 'trim';
  if (/Pilot_Accent|Pilot Accent/i.test(name)) return 'pilot_accent';
  if (/carbon/i.test(name)) return 'carbon';
  return null;
}

function visit(root, callback) {
  if (!root?.traverse) throw new TypeError('Expected a Three.js Object3D with traverse().');
  root.traverse(callback);
}

/**
 * Owns only its material clones, cloned pilot skeleton resources, and animation
 * mixer. Loaded templates, geometry, textures, the aircraft and physics adapter
 * remain caller-owned. Do not share one VariantSystem between aircraft instances.
 */
export class JetsonVariantSystem {
  constructor(THREE, aircraft, options = {}) {
    if (!THREE?.AnimationMixer || !aircraft?.getObjectByName) {
      throw new TypeError('Pass the Three.js namespace and loaded aircraft Object3D.');
    }
    this.THREE = THREE;
    this.aircraft = aircraft;
    this.options = options;
    this._initialSelection = validateSelection({
      PilotID: options.PilotID ?? 'professional', LiveryID: options.LiveryID ?? 'industrial',
    });
    this.socket = aircraft.getObjectByName('Seat_Socket') ?? aircraft.getObjectByName('Pilot_Attach_Point');
    if (!this.socket) throw new Error('Aircraft has no Seat_Socket or Pilot_Attach_Point.');
    if (typeof options.cloneSkinned !== 'function') {
      throw new TypeError('Pass cloneSkinned: SkeletonUtils.clone so pilot bones remain instance-local.');
    }
    if (options.physicsAdapter && typeof options.physicsAdapter.applyMassProperties !== 'function') {
      throw new TypeError('physicsAdapter must implement applyMassProperties(properties).');
    }
    this.cockpitController = options.cockpitController ?? null;
    this._originalCockpitTheme = this.cockpitController ? {
      theme: { ...(this.cockpitController.theme ?? {}) },
      PilotID: this.cockpitController.PilotID, LiveryID: this.cockpitController.LiveryID,
    } : null;
    this._listeners = new Map();
    this.listenerErrors = [];
    this._disposed = false;
    this._selection = null;
    this._pilot = null;
    this._mass = null;
    this._request = 0;
    this._commitTail = Promise.resolve();
    this._materialRecords = [];
    this._materials = new Map();
    this._ownedMaterials = new Set();
    this._firstPerson = false;
    this._installMaterialInstances();
    this.ready = this.selectVariant(this._initialSelection).catch(error => {
      if (!this._selection) this.dispose();
      throw error;
    });
  }

  get selection() { return this._selection ? { ...this._selection } : null; }
  get pilotInstance() { return this._pilot?.root ?? null; }
  get massProperties() { return this._mass ? cloneData(this._mass) : null; }
  get firstPerson() { return this._firstPerson; }
  get disposed() { return this._disposed; }

  _installMaterialInstances() {
    visit(this.aircraft, node => {
      if (!node.isMesh || !node.material) return;
      const original = node.material;
      const array = Array.isArray(original) ? original : [original];
      let changed = false;
      const replacement = array.map(material => {
        const role = roleOf(node, material);
        if (!['paint', 'trim'].includes(role)) return material;
        const key = `${material.uuid ?? material.id}:${role}`;
        if (!this._materials.has(key)) {
          const clone = material.clone();
          clone.userData = { ...material.userData, livery_role: role, jetson_variant_material: true };
          this._materials.set(key, { material: clone, original: material, role });
          this._ownedMaterials.add(clone);
        }
        changed = true;
        return this._materials.get(key).material;
      });
      if (changed) {
        this._materialRecords.push({ node, original });
        node.material = Array.isArray(original) ? replacement : replacement[0];
      }
    });
    if (![...this._materials.values()].some(r => r.role === 'paint')) {
      this._restoreMaterials();
      throw new Error('No tagged Livery_Paint material was found on the aircraft.');
    }
  }

  _applyLivery(LiveryID, pilot = this._pilot) {
    const livery = LIVERIES[LiveryID];
    for (const { material, role } of this._materials.values()) {
      if (role === 'paint') {
        material.name = `Master_${livery.family.replaceAll(' ', '_')}_Paint`;
        material.color?.set(livery.paint);
        material.metalness = livery.metalness;
        material.roughness = livery.roughness;
        material.normalScale?.set(livery.normalStrength, livery.normalStrength);
        if ('clearcoat' in material) material.clearcoat = livery.clearcoat;
        if ('clearcoatRoughness' in material) material.clearcoatRoughness = livery.clearcoatRoughness;
      } else {
        material.name = `Master_${livery.family.replaceAll(' ', '_')}_Trim`;
        material.color?.set(livery.trim);
        material.emissive?.set(livery.trim);
        material.emissiveIntensity = livery.trimIntensity;
      }
    }
    for (const material of pilot?.accentMaterials ?? []) {
      material.color?.set(livery.trim);
      if (material.emissive) material.emissive.set(livery.trim);
      material.emissiveIntensity = LiveryID === 'industrial' ? 0.04 : 0.20;
    }
  }

  async _resolvePilot(PilotID) {
    let asset = typeof this.options.loadPilot === 'function'
      ? this.options.loadPilot(PilotID) : this.options.pilots?.[PilotID];
    if (typeof asset === 'function') asset = asset();
    asset = await asset;
    if (!asset?.scene?.traverse) throw new Error(`Pilot asset ${PilotID} has no loaded glTF scene.`);
    return asset;
  }

  _makePilot(asset, PilotID) {
    const root = this.options.cloneSkinned(asset.scene);
    if (!root || root === asset.scene || !root.traverse) {
      throw new Error('cloneSkinned must return a new Object3D hierarchy.');
    }
    const record = { root, PilotID, asset, materials: new Set(), accentMaterials: new Set(),
      skeletons: new Set(), hiddenNodes: [], mixer: null, clip: null };
    const sourceSkeletons = new Set();
    visit(asset.scene, node => { if (node.isSkinnedMesh) sourceSkeletons.add(node.skeleton); });
    const allNodes = new Set(); visit(root, node => allNodes.add(node));
    const materialClones = new Map();
    let skinnedCount = 0;
    try {
      visit(root, node => {
        if (node.isSkinnedMesh) {
          skinnedCount++;
          if (!node.skeleton || sourceSkeletons.has(node.skeleton)
            || !node.skeleton.bones.every(bone => allNodes.has(bone))) {
            throw new Error('Pilot clone contains shared or external bones; use SkeletonUtils.clone.');
          }
          record.skeletons.add(node.skeleton);
        }
        if (node.userData?.first_person_hidden) {
          record.hiddenNodes.push({ node, visible: node.visible });
        }
        if (!node.isMesh || !node.material) return;
        const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
        const copies = sourceMaterials.map(original => {
          if (roleOf(node, original) !== 'pilot_accent') return original;
          if (!materialClones.has(original)) {
            const copy = original.clone();
            copy.userData = { ...original.userData };
            materialClones.set(original, copy); record.materials.add(copy);
          }
          const copy = materialClones.get(original);
          record.accentMaterials.add(copy);
          return copy;
        });
        node.material = Array.isArray(node.material) ? copies : copies[0];
      });
      if (!skinnedCount) throw new Error(`Pilot ${PilotID} contains no skeletal mesh.`);
      root.name = `Pilot_Instance_${PilotID}`;
      root.userData = { ...root.userData, PilotID, jetson_pilot_instance: true };
      root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1);
      record.mixer = new this.THREE.AnimationMixer(root);
      const clips = Array.isArray(asset.animations) ? asset.animations : [];
      record.clip = clips.find(c => c.name === 'Pilot_Seated_Idle') ?? clips[0] ?? null;
      if (record.clip) record.mixer.clipAction(record.clip).play();
      this._applyFirstPerson(record);
      return record;
    } catch (error) {
      this._disposePilot(record); throw error;
    }
  }

  _disposePilot(record) {
    if (!record) return;
    record.mixer?.stopAllAction(); record.mixer?.uncacheRoot(record.root);
    for (const { node, visible } of record.hiddenNodes) node.visible = visible;
    record.root.removeFromParent?.();
    for (const material of record.materials) material.dispose();
    for (const skeleton of record.skeletons) skeleton.dispose?.();
    record.materials.clear(); record.skeletons.clear();
  }

  _applyFirstPerson(record = this._pilot) {
    for (const { node, visible } of record?.hiddenNodes ?? []) node.visible = this._firstPerson ? false : visible;
  }

  setFirstPerson(enabled) {
    if (this._disposed) throw new Error('Variant system has been disposed.');
    this._firstPerson = Boolean(enabled); this._applyFirstPerson();
    return this._firstPerson;
  }

  /**
   * Resolve/prepare asynchronously; only the newest request may commit. Repeating
   * the current selection is a no-op. The supplied event is emitted after commit.
   */
  async selectVariant(partial = {}) {
    if (this._disposed) throw new Error('Variant system has been disposed.');
    const selection = validateSelection(partial, this._selection ?? this._initialSelection);
    const request = ++this._request;
    if (this._selection && selection.PilotID === this._selection.PilotID
      && selection.LiveryID === this._selection.LiveryID) {
      return { committed: false, unchanged: true, selection: this.selection };
    }
    const mass = computeMassProperties(selection, this.options.massModel);
    let candidate = null;
    try {
      if (selection.PilotID !== this._selection?.PilotID) {
        const asset = await this._resolvePilot(selection.PilotID);
        if (this._disposed || request !== this._request) return { committed: false, superseded: true, selection: this.selection };
        candidate = this._makePilot(asset, selection.PilotID);
      } else await Promise.resolve();
    } catch (error) {
      this._disposePilot(candidate);
      if (this._disposed || request !== this._request) return { committed: false, superseded: true, selection: this.selection };
      throw error;
    }
    const commit = async () => {
      if (this._disposed || request !== this._request) {
        this._disposePilot(candidate); return { committed: false, superseded: true, selection: this.selection };
      }
      const oldPilot = this._pilot, oldSelection = this._selection, oldMass = this._mass;
      const newPilot = candidate ?? oldPilot;
      let physicsApplied = false;
      try {
        if (this.options.physicsAdapter) {
          await this.options.physicsAdapter.applyMassProperties(cloneData(mass)); physicsApplied = true;
          if (this._disposed || request !== this._request) {
            if (oldMass) await this.options.physicsAdapter.applyMassProperties(cloneData(oldMass));
            this._disposePilot(candidate);
            return { committed: false, superseded: true, selection: this.selection };
          }
        }
        this._applyLivery(selection.LiveryID, newPilot);
        this.cockpitController?.setTheme?.(LIVERIES[selection.LiveryID].dashboard, selection);
        if (candidate) this.socket.add(candidate.root);
        this._pilot = newPilot; this._selection = frozen({ ...selection }); this._mass = mass;
        if (candidate && oldPilot) this._disposePilot(oldPilot);
      } catch (error) {
        this._disposePilot(candidate);
        if (oldSelection) {
          this._applyLivery(oldSelection.LiveryID, oldPilot);
          try { this.cockpitController?.setTheme?.(LIVERIES[oldSelection.LiveryID].dashboard, oldSelection); } catch {}
        }
        if (physicsApplied && oldMass) {
          try { await this.options.physicsAdapter.applyMassProperties(cloneData(oldMass)); } catch (rollbackError) {
            error.rollbackError = rollbackError;
          }
        }
        throw error;
      }
      const detail = frozen({ ...selection,
        selection: { ...selection }, previous: oldSelection ? { ...oldSelection } : null,
        presetMatches: Object.entries(VARIANT_PRESETS)
          .filter(([, p]) => p.PilotID === selection.PilotID && p.LiveryID === selection.LiveryID)
          .map(([id]) => id),
        livery: cloneData(LIVERIES[selection.LiveryID]), pilot: cloneData(PILOTS[selection.PilotID]),
        massProperties: cloneData(mass), theme: cloneData(LIVERIES[selection.LiveryID].dashboard), physicsApplied });
      this._emit('OnVariantChanged', detail);
      return { committed: true, selection: this.selection, detail };
    };
    const result = this._commitTail.then(commit);
    this._commitTail = result.catch(() => {});
    return result;
  }

  /** Advance only the pilot animation. Call cockpit.update(input,dt) separately. */
  update(dt = 0) {
    if (this._disposed) return;
    this._pilot?.mixer?.update(clamp(finite(dt, 0), 0, 0.25));
  }

  addEventListener(type, callback, options = {}) {
    if (!callback || (typeof callback !== 'function' && typeof callback.handleEvent !== 'function')) return;
    const entries = this._listeners.get(type) ?? new Map();
    entries.set(callback, { once: Boolean(options.once) }); this._listeners.set(type, entries);
  }
  removeEventListener(type, callback) { this._listeners.get(type)?.delete(callback); }

  _emit(type, detail) {
    const event = Object.freeze({ type, detail, target: this });
    const safeCall = callback => {
      try { callback(); } catch (error) {
        this.listenerErrors.push(error);
        try { this.options.onError?.(error, { phase: 'variant-listener' }); } catch {}
      }
    };
    for (const [callback, options] of this._listeners.get(type) ?? []) {
      if (options.once) this.removeEventListener(type, callback);
      safeCall(() => typeof callback === 'function' ? callback(event) : callback.handleEvent(event));
    }
    if (type === 'OnVariantChanged' && typeof this.options.onVariantChanged === 'function') {
      safeCall(() => this.options.onVariantChanged(detail));
    }
  }

  _restoreMaterials() {
    for (const { node, original } of this._materialRecords) node.material = original;
    for (const material of this._ownedMaterials) material.dispose();
    this._materialRecords.length = 0; this._ownedMaterials.clear(); this._materials.clear();
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true; ++this._request;
    this._disposePilot(this._pilot); this._pilot = null;
    this._restoreMaterials();
    if (this._originalCockpitTheme && !this.cockpitController?._disposed) {
      try {
        const { theme, PilotID, LiveryID } = this._originalCockpitTheme;
        this.cockpitController.setTheme?.(theme, { PilotID, LiveryID });
      } catch {}
    }
    this._listeners.clear();
  }
}

export default JetsonVariantSystem;
