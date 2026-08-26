export const STORAGE_KEY = "gothtechnology.keymap.v2";

export const DEFAULT_KEYMAP = Object.freeze({
  KeyA: "p1.left",
  KeyD: "p1.right",
  KeyW: "p1.up",
  KeyS: "p1.down",
  KeyJ: "p1.lightPunch",
  KeyU: "p1.heavyPunch",
  KeyK: "p1.lightKick",
  KeyI: "p1.heavyKick",
  KeyL: "p1.special",
  KeyO: "p1.super",
  KeyH: "p1.throw",
  KeyN: "p1.assist1",
  KeyM: "p1.assist2",
  KeyY: "p1.taunt",
  ShiftLeft: "p1.dash",
  ArrowLeft: "p2.left",
  ArrowRight: "p2.right",
  ArrowUp: "p2.up",
  ArrowDown: "p2.down",
  Slash: "p2.lightPunch",
  Period: "p2.heavyPunch",
  Semicolon: "p2.lightKick",
  Quote: "p2.heavyKick",
  BracketRight: "p2.special",
  Backslash: "p2.super",
  Comma: "p2.throw",
  Minus: "p2.assist1",
  Equal: "p2.assist2",
  BracketLeft: "p2.taunt",
  ShiftRight: "p2.dash",
  Enter: "ui.confirm",
  Space: "ui.confirm",
  Escape: "ui.back",
  KeyP: "ui.pause",
  KeyC: "ui.cpu",
  KeyT: "ui.training",
  KeyB: "ui.debug",
  KeyG: "ui.mute",
  KeyR: "ui.reset",
  KeyV: "ui.dummy",
  KeyF: "ui.record",
  KeyE: "ui.playback",
  KeyX: "ui.frameData"
});

const VALID_ACTIONS = new Set(Object.values(DEFAULT_KEYMAP));

export const normalizeKeymap = (saved) => {
  if (saved === null || typeof saved !== "object" || Array.isArray(saved)) return { ...DEFAULT_KEYMAP };
  return Object.fromEntries(Object.entries(saved).filter(([code, action]) => (
    typeof code === "string" && code.length > 0 && VALID_ACTIONS.has(action)
  )));
};

export const remapKey = (keymap, action, code) => {
  if (!VALID_ACTIONS.has(action) || typeof code !== "string" || code.length === 0) return null;
  const next = { ...keymap };
  const previousCodes = Object.entries(next)
    .filter(([, mappedAction]) => mappedAction === action)
    .map(([mappedCode]) => mappedCode);
  const previousCode = previousCodes[0] || null;
  const swappedAction = next[code] && next[code] !== action ? next[code] : null;
  for (const mappedCode of previousCodes) delete next[mappedCode];
  if (swappedAction && previousCode && previousCode !== code) next[previousCode] = swappedAction;
  next[code] = action;
  return { keymap: next, previousCode, swappedAction };
};

export const unbindKey = (keymap, action) => Object.fromEntries(
  Object.entries(keymap).filter(([, mappedAction]) => mappedAction !== action)
);

const isEditableTarget = (target) => {
  const tag = target?.tagName?.toLowerCase?.();
  return Boolean(target?.isContentEditable || ["button", "input", "select", "textarea"].includes(tag));
};

export const GAMEPAD_DEADZONE = 0.45;

const buttonPressed = (pad, index) => {
  const button = pad?.buttons?.[index];
  if (typeof button === "number") return button > 0.55;
  return Boolean(button?.pressed || (button?.value ?? 0) > 0.55);
};

const axisValue = (pad, index) => {
  const value = Number(pad?.axes?.[index] ?? 0);
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
};

export const gamepadActionsForPad = (pad, player = 1) => {
  const prefix = `p${player}`;
  const actions = new Set();
  const add = (active, action) => {
    if (active) actions.add(action);
  };
  const axisX = axisValue(pad, 0);
  const axisY = axisValue(pad, 1);
  const superChord = buttonPressed(pad, 4) && buttonPressed(pad, 5);
  add(axisX < -GAMEPAD_DEADZONE || buttonPressed(pad, 14), `${prefix}.left`);
  add(axisX > GAMEPAD_DEADZONE || buttonPressed(pad, 15), `${prefix}.right`);
  add(axisY < -GAMEPAD_DEADZONE || buttonPressed(pad, 12), `${prefix}.up`);
  add(axisY > GAMEPAD_DEADZONE || buttonPressed(pad, 13), `${prefix}.down`);
  add(buttonPressed(pad, 0), `${prefix}.lightPunch`);
  add(buttonPressed(pad, 1), `${prefix}.lightKick`);
  add(buttonPressed(pad, 2), `${prefix}.heavyPunch`);
  add(buttonPressed(pad, 3), `${prefix}.heavyKick`);
  add(buttonPressed(pad, 4) && !superChord, `${prefix}.assist1`);
  add(buttonPressed(pad, 5) && !superChord, `${prefix}.assist2`);
  add(buttonPressed(pad, 6), `${prefix}.throw`);
  add(buttonPressed(pad, 7), `${prefix}.special`);
  add(buttonPressed(pad, 8) || superChord, `${prefix}.super`);
  add(buttonPressed(pad, 9), "ui.pause");
  add(buttonPressed(pad, 10), `${prefix}.dash`);
  add(buttonPressed(pad, 11), `${prefix}.taunt`);
  return actions;
};

export class InputManager {
  constructor(target = window) {
    this.target = target;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.gamepadHeld = new Set();
    this.gamepadSlots = [null, null];
    this.touchPointers = new Map();
    this.touchBindings = [];
    this.lastTap = new Map();
    this.dashWindow = 0.24;
    this.keymap = this.loadKeymap();

    this.keydownHandler = (event) => this.onKey(event, true);
    this.keyupHandler = (event) => this.onKey(event, false);
    this.blurHandler = () => this.clear();
    this.visibilityHandler = () => {
      if (document.hidden) this.clear();
    };
    this.pointerUpHandler = (event) => this.releaseTouchPointer(event.pointerId);
    this.pointerCancelHandler = (event) => this.releaseTouchPointer(event.pointerId);

    target.addEventListener("keydown", this.keydownHandler, { passive: false });
    target.addEventListener("keyup", this.keyupHandler, { passive: false });
    target.addEventListener("blur", this.blurHandler);
    document.addEventListener("visibilitychange", this.visibilityHandler);
    window.addEventListener("pointerup", this.pointerUpHandler);
    window.addEventListener("pointercancel", this.pointerCancelHandler);
    this.bindTouchControls();
  }

  loadKeymap() {
    try {
      const saved = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || "null");
      return normalizeKeymap(saved);
    } catch {
      // Invalid or blocked storage falls back to the built-in bindings.
    }
    return { ...DEFAULT_KEYMAP };
  }

  saveKeymap() {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.keymap));
    } catch {
      // Remapping still works for the current session when storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent("gothtechnology:keymap-changed"));
  }

  getBinding(action) {
    return Object.entries(this.keymap).find(([, mappedAction]) => mappedAction === action)?.[0] || "Unbound";
  }

  getActionForCode(code) {
    return this.keymap[code] || null;
  }

  rebind(action, code) {
    const result = remapKey(this.keymap, action, code);
    if (!result) return false;
    this.clear();
    this.keymap = result.keymap;
    this.lastRebind = result;
    this.saveKeymap();
    return true;
  }

  unbind(action) {
    if (!VALID_ACTIONS.has(action)) return false;
    this.clear();
    this.keymap = unbindKey(this.keymap, action);
    this.saveKeymap();
    return true;
  }

  resetBindings() {
    this.clear();
    this.keymap = { ...DEFAULT_KEYMAP };
    this.saveKeymap();
  }

  onKey(event, isDown) {
    if (isEditableTarget(event.target)) return;
    const action = this.keymap[event.code];
    if (!action) return;
    event.preventDefault();
    if (isDown) this.press(action);
    else this.release(action);
  }

  bindTouchControls() {
    document.querySelectorAll("[data-touch]").forEach((button) => {
      const action = button.getAttribute("data-touch");
      const hold = (event) => {
        event.preventDefault();
        try {
          button.setPointerCapture?.(event.pointerId);
        } catch {
          // Pointer capture is best-effort; release guards still clean up.
        }
        this.touchPointers.set(event.pointerId, action);
        button.dataset.held = "true";
        this.press(action);
      };
      const release = (event) => {
        event.preventDefault();
        try {
          if (button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
        } catch {
          // Some mobile browsers throw if capture was already released.
        }
        this.touchPointers.delete(event.pointerId);
        button.dataset.held = "false";
        this.release(action);
      };
      const blockContextMenu = (event) => event.preventDefault();
      for (const eventName of ["pointerdown"]) button.addEventListener(eventName, hold);
      for (const eventName of ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"]) {
        button.addEventListener(eventName, release);
      }
      button.addEventListener("contextmenu", blockContextMenu);
      this.touchBindings.push({ button, hold, release, blockContextMenu });
    });
  }

  assignGamepads(rawPads = Array.from(navigator.getGamepads?.() || [])) {
    const connected = rawPads
      .map((pad, browserIndex) => pad && pad.connected !== false
        ? { pad, index: Number.isInteger(pad.index) ? pad.index : browserIndex }
        : null)
      .filter(Boolean);
    const connectedByIndex = new Map(connected.map((entry) => [entry.index, entry.pad]));
    this.gamepadSlots = this.gamepadSlots.map((index) => connectedByIndex.has(index) ? index : null);
    const assigned = new Set(this.gamepadSlots.filter((index) => index !== null));
    for (const entry of connected) {
      if (assigned.has(entry.index)) continue;
      const openSlot = this.gamepadSlots.indexOf(null);
      if (openSlot < 0) break;
      this.gamepadSlots[openSlot] = entry.index;
      assigned.add(entry.index);
    }
    return this.gamepadSlots.map((index, playerIndex) => index === null ? null : ({
      player: playerIndex + 1,
      index,
      pad: connectedByIndex.get(index)
    }));
  }

  getGamepadStatus() {
    return this.assignGamepads().filter(Boolean).map(({ player, index, pad }) => ({
      player,
      index,
      id: String(pad?.id || "STANDARD CONTROLLER"),
      mapping: String(pad?.mapping || "unknown")
    }));
  }

  pollGamepads() {
    const nextHeld = new Set();
    for (const assignment of this.assignGamepads()) {
      if (!assignment?.pad) continue;
      for (const action of gamepadActionsForPad(assignment.pad, assignment.player)) nextHeld.add(action);
    }

    for (const action of nextHeld) {
      if (!this.gamepadHeld.has(action)) {
        this.pressed.add(action);
        this.trackDirectionalTap(action);
      }
    }
    for (const action of this.gamepadHeld) {
      if (!nextHeld.has(action)) this.released.add(action);
    }
    this.gamepadHeld = nextHeld;
  }

  trackDirectionalTap(action) {
    if (!action.endsWith(".left") && !action.endsWith(".right")) return;
    const now = performance.now() / 1000;
    const last = this.lastTap.get(action) ?? -10;
    if (now - last < this.dashWindow) this.pressed.add(action.replace(/\.(left|right)$/, ".dashTap"));
    this.lastTap.set(action, now);
  }

  press(action) {
    if (!this.down.has(action)) {
      this.pressed.add(action);
      this.trackDirectionalTap(action);
    }
    this.down.add(action);
  }

  release(action) {
    if (this.down.has(action)) this.released.add(action);
    this.down.delete(action);
  }

  clear() {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
    this.gamepadHeld.clear();
    this.releaseTouchButtons();
  }

  releaseTouchButtons() {
    this.touchPointers.clear();
    document.querySelectorAll("[data-touch]").forEach((button) => {
      button.dataset.held = "false";
      const action = button.getAttribute("data-touch");
      if (action) this.down.delete(action);
    });
  }

  releaseTouchPointer(pointerId) {
    const action = this.touchPointers.get(pointerId);
    if (!action) return;
    this.touchPointers.delete(pointerId);
    this.release(action);
    document.querySelectorAll(`[data-touch="${action}"]`).forEach((button) => {
      button.dataset.held = "false";
    });
  }

  isDown(action) {
    return this.down.has(action) || this.gamepadHeld.has(action);
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  consume(action) {
    const hit = this.pressed.has(action);
    this.pressed.delete(action);
    return hit;
  }

  actions(player) {
    const p = `p${player}`;
    const modifier = this.isDown(`${p}.modifier`);
    const lightPunch = this.consume(`${p}.lightPunch`);
    const heavyPunch = this.consume(`${p}.heavyPunch`);
    const lightKick = this.consume(`${p}.lightKick`);
    const heavyKick = this.consume(`${p}.heavyKick`);
    const special = this.consume(`${p}.special`);
    return {
      left: this.isDown(`${p}.left`),
      right: this.isDown(`${p}.right`),
      up: this.isDown(`${p}.up`),
      down: this.isDown(`${p}.down`),
      lightPunch: !modifier && lightPunch,
      heavyPunch: !modifier && heavyPunch,
      lightKick: !modifier && lightKick,
      heavyKick: !modifier && heavyKick,
      special: !modifier && special,
      super: this.consume(`${p}.super`) || (modifier && heavyPunch),
      throw: this.consume(`${p}.throw`) || (modifier && lightPunch),
      assist1: this.consume(`${p}.assist1`) || (modifier && lightKick),
      assist2: this.consume(`${p}.assist2`) || (modifier && heavyKick),
      taunt: this.consume(`${p}.taunt`) || (modifier && special),
      dash: this.consume(`${p}.dash`) || this.consume(`${p}.dashTap`)
    };
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }

  destroy() {
    this.clear();
    this.target.removeEventListener("keydown", this.keydownHandler);
    this.target.removeEventListener("keyup", this.keyupHandler);
    this.target.removeEventListener("blur", this.blurHandler);
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    window.removeEventListener("pointerup", this.pointerUpHandler);
    window.removeEventListener("pointercancel", this.pointerCancelHandler);
    for (const { button, hold, release, blockContextMenu } of this.touchBindings) {
      button.removeEventListener("pointerdown", hold);
      for (const eventName of ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"]) {
        button.removeEventListener(eventName, release);
      }
      button.removeEventListener("contextmenu", blockContextMenu);
    }
    this.touchBindings = [];
    this.gamepadSlots = [null, null];
  }
}
