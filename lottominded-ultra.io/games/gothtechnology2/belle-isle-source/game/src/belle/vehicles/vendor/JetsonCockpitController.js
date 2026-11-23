/**
 * Visual cockpit adapter for the Jetson ONE Blender study.
 * Dependency injection keeps this module independent of a Three.js release.
 * This is visual control/telemetry presentation, not aircraft flight software.
 */

export const DEG = Math.PI / 180;

export const DEFAULT_DASH_THEME = Object.freeze({
  accent: '#a6d8e4', white: '#dfedf0', muted: '#7b9aa9',
  background: '#071016', headerBackground: '#13232c', label: 'INDUSTRIAL',
});

function resolveTheme(input = {}, previous = DEFAULT_DASH_THEME) {
  const result = { ...previous };
  for (const key of ['accent', 'white', 'muted', 'background', 'headerBackground']) {
    if (typeof input[key] === 'string' && /^#[0-9a-f]{6}$/i.test(input[key])) result[key] = input[key];
  }
  if (typeof input.label === 'string') result.label = input.label.slice(0, 28).toUpperCase();
  return result;
}

export const CONTROL_SPEC = Object.freeze({
  pitch:            { min: -1, max: 1, initial: 0 },
  roll:             { min: -1, max: 1, initial: 0 },
  yaw:              { min: -1, max: 1, initial: 0 },
  power:            { min: 0, max: 1, initial: 0 },
  battery_level:    { min: 0, max: 1, initial: 1 },
  battery_voltage_v:{ min: 0, max: 150, initial: 100 },
  flight_mode:      { min: 0, max: 3, initial: 0, integer: true },
  proximity_m:     { min: 0, max: 20, initial: 20 },
  seat_compression:{ min: 0, max: 1, initial: 0 },
  harness_locked:  { min: 0, max: 1, initial: 1 },
  harness_open:    { min: 0, max: 1, initial: 0 },
  rescue_pull:     { min: 0, max: 1, initial: 0 },
  kill_switch:     { min: 0, max: 1, initial: 0 },
  pedal_adjust:    { min: 0, max: 1, initial: 0 },
  attitude_pitch_deg: { min: -90, max: 90, initial: 0 },
  attitude_roll_deg: { min: -180, max: 180, initial: 0 },
  motor_fl_upper: { min: 0, max: 1, initial: 1 },
  motor_fl_lower: { min: 0, max: 1, initial: 1 },
  motor_fr_upper: { min: 0, max: 1, initial: 1 },
  motor_fr_lower: { min: 0, max: 1, initial: 1 },
  motor_rl_upper: { min: 0, max: 1, initial: 1 },
  motor_rl_lower: { min: 0, max: 1, initial: 1 },
  motor_rr_upper: { min: 0, max: 1, initial: 1 },
  motor_rr_lower: { min: 0, max: 1, initial: 1 },
});

export const DEFAULT_STATE = Object.freeze(
  Object.fromEntries(Object.entries(CONTROL_SPEC).map(([key, spec]) => [key, spec.initial])),
);

export const ROTOR_DIRECTIONS = Object.freeze({
  Rotor_FL_Upper: 1,
  Rotor_FL_Lower: -1,
  Rotor_FR_Upper: -1,
  Rotor_FR_Lower: 1,
  Rotor_RL_Upper: -1,
  Rotor_RL_Lower: 1,
  Rotor_RR_Upper: 1,
  Rotor_RR_Lower: -1,
});

export const ROTOR_POWER_CHANNELS = Object.freeze(Object.fromEntries(
  Object.keys(ROTOR_DIRECTIONS).map(name => [name, name.replace('Rotor_', 'motor_').toLowerCase()]),
));

const OPTIONAL_CONTROL_NODES = ['CTRL_Clip_L', 'CTRL_Clip_R'];
const CONTROL_NODES = [
  'CTRL_Stick_Pitch', 'CTRL_Stick_Roll', 'CTRL_Stick_Yaw', 'CTRL_Throttle',
  'CTRL_SeatBase', 'CTRL_Harness_L', 'CTRL_Harness_R', 'CTRL_Buckle',
  'CTRL_Rescue_Handle', 'CTRL_Kill_Switch', 'CTRL_Pedals', ...OPTIONAL_CONTROL_NODES,
];

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Partial updates preserve previous values. Strings, NaN and infinities are ignored. */
export function sanitizeState(input = {}, previous = DEFAULT_STATE) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const state = {};
  for (const [key, spec] of Object.entries(CONTROL_SPEC)) {
    const old = clamp(finite(previous?.[key], spec.initial), spec.min, spec.max);
    let value = clamp(finite(source[key], old), spec.min, spec.max);
    if (spec.integer) value = Math.round(value);
    state[key] = value;
  }
  return state;
}

/** Blender (X,Y,Z) -> glTF/Three.js (X,Z,-Y), in metres. */
export function blenderVectorToGltf([x, y, z]) {
  return [x, z, y === 0 ? 0 : -y];
}

/** Pure visual pose calculation; angles in radians, translations in metres. */
export function computeControlTransforms(input = {}, previous = DEFAULT_STATE) {
  const state = sanitizeState(input, previous);
  const rotation = (axis, angle) => ({ axis: blenderVectorToGltf(axis), angle });
  const translation = (v) => blenderVectorToGltf(v);
  const transforms = {
    CTRL_Stick_Pitch: { rotation: rotation([1, 0, 0], state.pitch * 18 * DEG) },
    CTRL_Stick_Roll: { rotation: rotation([0, 1, 0], -state.roll * 18 * DEG) },
    CTRL_Stick_Yaw: { rotation: rotation([0, 0, 1], state.yaw * 25 * DEG) },
    CTRL_Throttle: { rotation: rotation([1, 0, 0], -state.power * 35 * DEG) },
    CTRL_SeatBase: { translation: translation([0, 0, -state.seat_compression * 0.022]) },
    CTRL_Harness_L: { rotation: rotation([0, 1, 0], state.harness_open * 65 * DEG) },
    CTRL_Harness_R: { rotation: rotation([0, 1, 0], -state.harness_open * 65 * DEG) },
    CTRL_Buckle: {
      rotation: rotation([0, 0, 1], state.harness_locked * 90 * DEG),
      translation: translation([0, -0.018 * (1 - state.harness_locked), 0]),
    },
    CTRL_Rescue_Handle: { translation: translation([0, -state.rescue_pull * 0.08, 0]) },
    CTRL_Kill_Switch: { rotation: rotation([1, 0, 0], state.kill_switch * 65 * DEG) },
    CTRL_Pedals: { translation: translation([0, -state.pedal_adjust * 0.12, 0]) },
    CTRL_Clip_L: { translation: translation([-0.035 * (1 - state.harness_locked), 0, 0]) },
    CTRL_Clip_R: { translation: translation([0.035 * (1 - state.harness_locked), 0, 0]) },
  };
  return { state, transforms };
}

export class JetsonCockpitController {
  /**
   * @param {object} THREE Imported Three.js namespace.
   * @param {object} scene Loaded glTF scene/Object3D containing the named rig.
   * @param {object} options Optional canvas, initialState, bindState, visual RPM.
   * bindState describes the state already baked into the captured transforms.
   * Default: null for the supplied GLB's zero-offset bind export. A non-null
   * bindState can adapt a different export that already contains a posed state.
   */
  constructor(THREE, scene, options = {}) {
    if (!THREE?.Vector3 || !THREE?.Quaternion || !scene?.getObjectByName) {
      throw new TypeError('Pass a Three.js namespace and a loaded scene with getObjectByName().');
    }
    this.THREE = THREE;
    this.scene = scene;
    this.options = options;
    this.PilotID = typeof options.PilotID === 'string' ? options.PilotID : 'professional';
    this.LiveryID = typeof options.LiveryID === 'string' ? options.LiveryID : 'industrial';
    this.theme = resolveTheme(options.theme);
    this._disposed = false;
    this._nodes = new Map();
    this._neutral = new Map();
    this._initialState = sanitizeState(options.initialState);
    this.state = { ...this._initialState };
    this._bindTransforms = options.bindState == null
      ? {} : computeControlTransforms(options.bindState).transforms;
    this.visualRpm = 0;
    this.visualRpmTarget = 0;
    this.rotorRpm = Object.fromEntries(Object.keys(ROTOR_DIRECTIONS).map(name => [name, 0]));
    this.rotorRpmTargets = { ...this.rotorRpm };
    this._rotorPhases = { ...this.rotorRpm };
    this._maxRpm = clamp(finite(options.rotorMaxRpm, 240), 0, 20000);
    this._response = clamp(finite(options.rotorResponse, 6), 0, 100);
    this._modeNames = Array.isArray(options.flightModes) && options.flightModes.length === 4
      ? options.flightModes.map(String) : ['SAFE', 'ARMED', 'FLIGHT', 'LAND'];
    this._axis = new THREE.Vector3();
    this._delta = new THREE.Vector3();
    this._rotation = new THREE.Quaternion();
    const required = ['CTRL_Cockpit', ...CONTROL_NODES.filter(n => !OPTIONAL_CONTROL_NODES.includes(n)),
      ...Object.keys(ROTOR_DIRECTIONS), 'Dash_Dynamic_Surface'];
    const missing = [];
    for (const name of [...required, ...OPTIONAL_CONTROL_NODES]) {
      const node = scene.getObjectByName(name);
      if (!node) { if (required.includes(name)) missing.push(name); continue; }
      this._nodes.set(name, node);
      this._neutral.set(name, { position: node.position.clone(), quaternion: node.quaternion.clone() });
    }
    if (missing.length && options.strict !== false) {
      throw new Error(`Cockpit rig is missing named nodes: ${missing.join(', ')}`);
    }
    this.missingNodes = Object.freeze(missing);
    const cockpit = this._nodes.get('CTRL_Cockpit');
    this._originalCockpitData = {};
    this._originalVariantData = {};
    if (cockpit) {
      cockpit.userData ??= {};
      for (const key of Object.keys(CONTROL_SPEC)) {
        this._originalCockpitData[key] = {
          existed: Object.hasOwn(cockpit.userData, key), value: cockpit.userData[key],
        };
      }
      for (const key of ['PilotID', 'LiveryID']) {
        this._originalVariantData[key] = { existed: Object.hasOwn(cockpit.userData, key), value: cockpit.userData[key] };
        cockpit.userData[key] = this[key];
      }
    }
    this.canvas = null;
    this.context = null;
    this._texture = null;
    this._displayMaterial = null;
    this._originalDisplayMaterial = null;
    this._gauges = scene.getObjectByName('Dash_Gauges');
    this._originalGaugeVisibility = this._gauges?.visible;
    if (options.renderDisplay !== false) this._setupDisplay(options);
    this.update(this._initialState, 0);
  }

  _setupDisplay(options) {
    let canvas = options.canvas;
    if (!canvas && typeof options.createCanvas === 'function') canvas = options.createCanvas();
    if (!canvas && typeof document !== 'undefined') canvas = document.createElement('canvas');
    if (!canvas?.getContext) {
      throw new Error('A canvas is required for the live dashboard. Pass canvas/createCanvas or renderDisplay:false.');
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('The dashboard canvas must provide a 2D drawing context.');
    if (!this.THREE.CanvasTexture || !this.THREE.MeshBasicMaterial) {
      throw new Error('Three.js CanvasTexture and MeshBasicMaterial are required for the dashboard.');
    }
    canvas.width = 1024;
    canvas.height = 512;
    this.canvas = canvas;
    this.context = ctx;
    this._texture = new this.THREE.CanvasTexture(canvas);
    // glTF UV0 follows the exporter convention; avoid the usual canvas Y flip.
    this._texture.flipY = false;
    if (this.THREE.SRGBColorSpace !== undefined) this._texture.colorSpace = this.THREE.SRGBColorSpace;
    this._displayMaterial = new this.THREE.MeshBasicMaterial({ map: this._texture, toneMapped: false });
    const surface = this._nodes.get('Dash_Dynamic_Surface');
    if (surface) {
      this._originalDisplayMaterial = surface.material;
      surface.material = this._displayMaterial;
      if (this._gauges) this._gauges.visible = false;
    }
  }

  _applyControls(transforms) {
    for (const name of CONTROL_NODES) {
      const node = this._nodes.get(name);
      if (!node) continue;
      const base = this._neutral.get(name);
      const pose = transforms[name];
      const bind = this._bindTransforms[name];
      node.position.copy(base.position);
      node.quaternion.copy(base.quaternion);
      if (pose.translation) {
        const t = pose.translation;
        const b = bind?.translation ?? [0, 0, 0];
        this._delta.set(t[0] - b[0], t[1] - b[1], t[2] - b[2]);
        // Translation follows the object's captured local axes.
        this._delta.applyQuaternion(base.quaternion);
        node.position.add(this._delta);
      }
      if (pose.rotation) {
        const { axis, angle } = pose.rotation;
        this._axis.set(...axis);
        this._rotation.setFromAxisAngle(this._axis, angle - (bind?.rotation?.angle ?? 0));
        node.quaternion.multiply(this._rotation);
      }
      node.updateMatrix?.();
    }
  }

  /** Recolor the existing live texture; control state and texture identity stay intact. */
  setTheme(theme = {}, selection = {}) {
    if (this._disposed) throw new Error('This cockpit controller has been disposed.');
    this.theme = resolveTheme(theme, this.theme);
    for (const key of ['PilotID', 'LiveryID']) {
      if (typeof selection[key] === 'string') this[key] = selection[key];
    }
    const cockpit = this._nodes.get('CTRL_Cockpit');
    if (cockpit) Object.assign(cockpit.userData, { PilotID: this.PilotID, LiveryID: this.LiveryID });
    this._drawDisplay();
    return { ...this.theme };
  }

  /** Apply partial telemetry/control input; dt is elapsed seconds, clamped to 0–0.25. */
  update(input = {}, dt = 0) {
    if (this._disposed) throw new Error('This cockpit controller has been disposed.');
    const { state, transforms } = computeControlTransforms(input, this.state);
    this.state = state;
    this._applyControls(transforms);
    const cockpit = this._nodes.get('CTRL_Cockpit');
    if (cockpit) Object.assign(cockpit.userData, state);
    const delta = clamp(finite(dt, 0), 0, 0.25);
    const blend = this._response === 0 ? 1 : 1 - Math.exp(-this._response * delta);
    this._axis.set(0, 1, 0); // Blender local +Z -> glTF local +Y.
    let rpmSum = 0;
    let targetSum = 0;
    for (const [name, direction] of Object.entries(ROTOR_DIRECTIONS)) {
      const motorFactor = state[ROTOR_POWER_CHANNELS[name]];
      const target = this._maxRpm * state.power * motorFactor * (1 - state.kill_switch);
      this.rotorRpmTargets[name] = target;
      this.rotorRpm[name] += (target - this.rotorRpm[name]) * blend;
      this._rotorPhases[name] = (this._rotorPhases[name]
        + this.rotorRpm[name] * Math.PI * 2 / 60 * delta) % (Math.PI * 2);
      targetSum += target;
      rpmSum += this.rotorRpm[name];
      const node = this._nodes.get(name);
      if (!node) continue;
      const base = this._neutral.get(name);
      this._rotation.setFromAxisAngle(this._axis, direction * this._rotorPhases[name]);
      node.quaternion.copy(base.quaternion).multiply(this._rotation);
      node.updateMatrix?.();
    }
    this.visualRpmTarget = targetSum / Object.keys(ROTOR_DIRECTIONS).length;
    this.visualRpm = rpmSum / Object.keys(ROTOR_DIRECTIONS).length;
    this._drawDisplay();
    return { ...this.state };
  }

  /** Restore the exact captured local transforms, initial state and original custom properties. */
  reset() {
    if (this._disposed) return;
    for (const [name, base] of this._neutral) {
      const node = this._nodes.get(name);
      node.position.copy(base.position);
      node.quaternion.copy(base.quaternion);
      node.updateMatrix?.();
    }
    this.state = { ...this._initialState };
    this.visualRpm = 0;
    this.visualRpmTarget = 0;
    for (const name of Object.keys(ROTOR_DIRECTIONS)) {
      this.rotorRpm[name] = 0;
      this.rotorRpmTargets[name] = 0;
      this._rotorPhases[name] = 0;
    }
    const cockpit = this._nodes.get('CTRL_Cockpit');
    if (cockpit) {
      for (const [key, original] of Object.entries(this._originalCockpitData)) {
        if (original.existed) cockpit.userData[key] = original.value;
        else delete cockpit.userData[key];
      }
    }
    this._drawDisplay();
  }

  /** Restore scene state and dispose only the material/texture this adapter created. */
  dispose() {
    if (this._disposed) return;
    this.reset();
    const cockpit = this._nodes.get('CTRL_Cockpit');
    if (cockpit) {
      for (const [key, original] of Object.entries(this._originalVariantData)) {
        if (original.existed) cockpit.userData[key] = original.value;
        else delete cockpit.userData[key];
      }
    }
    const surface = this._nodes.get('Dash_Dynamic_Surface');
    if (surface && this._displayMaterial) surface.material = this._originalDisplayMaterial;
    if (this._gauges) this._gauges.visible = this._originalGaugeVisibility;
    this._displayMaterial?.dispose();
    this._texture?.dispose();
    this.context = null;
    this.canvas = null;
    this._disposed = true;
  }

  _drawDisplay() {
    const c = this.context;
    if (!c) return;
    const s = this.state;
    const W = 1024, H = 512;
    const cyan = this.theme.accent, white = this.theme.white, muted = this.theme.muted;
    const green = '#80efb1', red = '#ff6973', amber = '#ffcc78';
    const text = (label, x, y, size = 20, color = white, align = 'left', weight = 500) => {
      c.font = `${weight} ${size}px ui-monospace, Menlo, Consolas, monospace`;
      c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = color;
      c.fillText(String(label), x, y);
    };
    c.clearRect(0, 0, W, H);
    c.fillStyle = this.theme.background; c.fillRect(0, 0, W, H);
    c.fillStyle = this.theme.headerBackground; c.fillRect(0, 0, W, 60);
    text(this.theme.label + ' / ' + this.PilotID.toUpperCase(), 25, 31, 19, cyan, 'left', 700);
    const killed = s.kill_switch >= 1;
    text(killed ? 'MOTOR VISUAL OFF' : this._modeNames[s.flight_mode], 997, 31, 22,
      killed ? red : green, 'right', 700);

    // Attitude is separate telemetry; moving the stick does not fabricate attitude.
    c.save();
    c.beginPath(); c.rect(258, 90, 508, 294); c.clip();
    c.translate(512, 237 + s.attitude_pitch_deg * 3.3);
    c.rotate(-s.attitude_roll_deg * DEG);
    c.fillStyle = '#123c53'; c.fillRect(-600, -600, 1200, 600);
    c.fillStyle = '#28383b'; c.fillRect(-600, 0, 1200, 600);
    c.strokeStyle = cyan; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-600, 0); c.lineTo(600, 0); c.stroke();
    c.strokeStyle = '#9bb7c1'; c.lineWidth = 1;
    for (const y of [-90, -60, -30, 30, 60, 90]) {
      c.beginPath(); c.moveTo(-50, y); c.lineTo(-12, y); c.moveTo(12, y); c.lineTo(50, y); c.stroke();
    }
    c.restore();
    c.strokeStyle = white; c.lineWidth = 4;
    c.beginPath(); c.moveTo(409, 237); c.lineTo(475, 237); c.lineTo(487, 249);
    c.moveTo(537, 249); c.lineTo(549, 237); c.lineTo(615, 237); c.stroke();
    text('ATTITUDE', 512, 108, 12, cyan, 'center');
    text(`YAW ${s.yaw >= 0 ? '+' : ''}${Math.round(s.yaw * 100)}%`, 512, 365, 16, white, 'center');

    text('POWER', 127, 117, 18, muted, 'center');
    text(`${Math.round(s.power * 100)}%`, 127, 174, 51, white, 'center', 700);
    text(`${this.visualRpm.toFixed(0)} RPM`, 127, 229, 19, cyan, 'center');
    text('AVG. VISUAL ROTORS', 127, 258, 12, muted, 'center');
    text('BATTERY', 127, 319, 16, muted, 'center');
    text(`${Math.round(s.battery_level * 100)}%`, 127, 351, 28,
      s.battery_level < 0.15 ? red : s.battery_level < 0.3 ? amber : green, 'center', 700);

    text('PROXIMITY', 897, 117, 18, muted, 'center');
    text(`${s.proximity_m.toFixed(1)}m`, 897, 174, 44,
      s.proximity_m < 1 ? red : s.proximity_m < 3 ? amber : white, 'center', 700);
    text('INPUT DISTANCE', 897, 223, 12, muted, 'center');
    text('PACK VOLTAGE', 897, 319, 16, muted, 'center');
    text(`${s.battery_voltage_v.toFixed(1)}V`, 897, 351, 28, cyan, 'center', 700);

    c.fillStyle = this.theme.headerBackground; c.fillRect(25, 414, 974, 74);
    text(s.harness_locked >= 0.5 ? 'HARNESS LOCKED' : 'HARNESS OPEN', 44, 440, 16,
      s.harness_locked >= 0.5 ? green : amber);
    text(`SEAT ${Math.round(s.seat_compression * 100)}%`, 44, 466, 13, muted);
    text(`PEDALS ${Math.round(s.pedal_adjust * 100)}%`, 335, 440, 16, cyan);
    text(`RESCUE HANDLE ${Math.round(s.rescue_pull * 100)}%`, 335, 466, 13,
      s.rescue_pull > 0.5 ? amber : muted);
    text(killed ? 'KILL SWITCH ON' : s.kill_switch > 0 ? `KILL ${Math.round(s.kill_switch * 100)}%`
      : 'CONTROLS READY', 980, 441, 17,
      killed ? red : s.kill_switch > 0 ? amber : green, 'right', 700);
    text('VISUAL INTERFACE ONLY', 980, 467, 12, muted, 'right');
    this._texture.needsUpdate = true;
  }
}

export default JetsonCockpitController;
