/**
 * The sole legacy minimap owner keeps its clearRect and cached-image blit native
 * and immediate. Only its bounded foreground paints may wait while cinematic
 * CSS hides it. Producers run synchronously once; packets contain no producers,
 * world objects, images, Path2D, gradients, or patterns.
 *
 * This is the original minimap's finite command surface, not a Canvas emulator.
 * Its paths begin explicitly, successful saves balance, fonts are fixed system
 * fonts, and it has no clipping or post-construction backing-size writer.
 */
const fields = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font', 'textAlign'] as const;
type Field = typeof fields[number];
type Value = number | string | boolean | number[];
type Command = {method: string; args: Value[]} | {field: Field; value: string | number};
type Entry = {fields: Record<Field, string | number>; transform: number[]; dash: number[]};
type Packet = {entry: Entry; commands: Command[]; depth: number; pathStarted: boolean};
const paints = new Set(['fill', 'stroke', 'fillRect', 'fillText', 'strokeText']);
const methods = new Set([...paints, 'beginPath', 'moveTo', 'lineTo', 'closePath', 'arc', 'ellipse', 'save', 'restore', 'translate', 'rotate', 'setLineDash']);
const fonts = new Set(['12px system-ui', 'bold 10px system-ui', 'bold 11px system-ui']);
const MAX_COMMANDS = 8192, MAX_DASH = 16, MAX_TEXT = 128, MAX_DEPTH = 16;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function createLegacyMinimapForeground(native: CanvasRenderingContext2D, maxCommands = MAX_COMMANDS) {
  if (!Number.isInteger(maxCommands) || maxCommands < 1 || maxCommands > MAX_COMMANDS) throw new RangeError('Minimap command bound');
  const canvas = native.canvas, width = canvas.width, height = canvas.height;
  let pending: Packet | null = null, current: Packet | null = null, disposed = false;
  let disabled = width !== 420 || height !== 290 ||
    ['isContextLost', 'getTransform', 'setTransform', 'getLineDash'].some(name => typeof Reflect.get(native, name, native) !== 'function');
  const invoke = (name: string, args: readonly unknown[] = []): unknown => Reflect.apply(Reflect.get(native, name, native), native, args);
  const lost = () => { pending = null; current = null; disabled = true; };
  canvas.addEventListener('contextlost', lost); canvas.addEventListener('contextrestored', lost);
  function intact() {
    if (canvas.width !== width || canvas.height !== height ||
      (typeof native.isContextLost === 'function' && native.isContextLost())) { lost(); return false; }
    return true;
  }
  function entry(): Entry | null {
    const state = Object.fromEntries(fields.map(key => [key, native[key]])) as Entry['fields'];
    if (fields.some(key => typeof state[key] !== 'string' && !finite(state[key]))) return null;
    if (typeof state.fillStyle !== 'string' || typeof state.strokeStyle !== 'string' ||
      typeof state.font !== 'string' || fields.some(key => typeof state[key] === 'string' && (state[key] as string).length > MAX_TEXT)) return null;
    const m = native.getTransform(), transform = [m.a, m.b, m.c, m.d, m.e, m.f], dash = native.getLineDash();
    if (!transform.every(finite) || dash.length > MAX_DASH || !dash.every(finite)) return null;
    return {fields: state, transform, dash: dash.slice()};
  }
  function replay(packet: Packet) {
    // Native state/path operations already ran during capture. Isolate replay
    // from that terminal state and from the original save stack. The default
    // path is not saved by save(): its final contents come from exact replay.
    let depth = 0;
    native.save();
    try {
      for (const key of fields) Reflect.set(native, key, packet.entry.fields[key], native);
      invoke('setTransform', packet.entry.transform); native.setLineDash(packet.entry.dash);
      for (const command of packet.commands) {
        if ('field' in command) { Reflect.set(native, command.field, command.value, native); continue; }
        if (command.method === 'restore') {
          if (depth) { native.restore(); depth--; }
          continue;
        }
        invoke(command.method, command.args);
        if (command.method === 'save') depth++;
      }
    } finally {
      while (depth > 0) { native.restore(); depth--; }
      native.restore();
    }
  }
  function materialize() {
    if (!intact()) return;
    const packet = pending; pending = null;
    if (packet) replay(packet);
  }
  function immediateRemainder() {
    disabled = true;
    const prefix = current; current = null;
    materialize();
    if (prefix && intact()) replay(prefix);
  }
  function methodAllowed(name: string, args: unknown[], packet: Packet): args is Value[] {
    const numbers = (n: number) => args.length === n && args.every(finite);
    switch (name) {
      case 'beginPath': return args.length === 0;
      case 'closePath': return packet.pathStarted && args.length === 0;
      case 'save': return args.length === 0 && packet.depth < MAX_DEPTH;
      case 'restore': return args.length === 0 && packet.depth > 0;
      case 'moveTo': case 'lineTo': return packet.pathStarted && numbers(2);
      case 'translate': return numbers(2);
      case 'rotate': return numbers(1);
      case 'arc': return packet.pathStarted && (numbers(5) || (args.length === 6 && args.slice(0, 5).every(finite) && typeof args[5] === 'boolean'));
      case 'ellipse': return packet.pathStarted && (numbers(7) || (args.length === 8 && args.slice(0, 7).every(finite) && typeof args[7] === 'boolean'));
      case 'fill': case 'stroke': return packet.pathStarted && args.length === 0;
      case 'fillRect': return numbers(4);
      case 'fillText': case 'strokeText': return args.length === 3 && typeof args[0] === 'string' && args[0].length <= MAX_TEXT && args.slice(1).every(finite);
      case 'setLineDash': {
        const dash = args[0];
        if (args.length !== 1 || !Array.isArray(dash) || dash.length > MAX_DASH) return false;
        for (let i = 0; i < dash.length; i++) {
          const property = Object.getOwnPropertyDescriptor(dash, String(i));
          if (!property || !('value' in property) || !finite(property.value)) return false;
        }
        return true;
      }
      default: return false;
    }
  }
  function fieldAllowed(name: PropertyKey, value: unknown): name is Field {
    if (name === 'fillStyle' || name === 'strokeStyle') return typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);
    if (name === 'lineWidth' || name === 'globalAlpha') return finite(value);
    if (name === 'font') return typeof value === 'string' && fonts.has(value);
    if (name === 'textAlign') return typeof value === 'string' && ['left', 'right', 'center', 'start', 'end'].includes(value);
    return false;
  }
  const wrappers = new Map<PropertyKey, (...args: unknown[]) => unknown>();
  const context: CanvasRenderingContext2D = new Proxy(native, {
    get(target, key) {
      if (!current) materialize();
      const value: unknown = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (!methods.has(String(key))) {
        if (current) immediateRemainder();
        // No unbounded cache of arbitrary methods and no unknown operation in
        // a packet. Argument evaluation and the native call still occur once.
        return function(this: unknown, ...args: unknown[]) {
          return Reflect.apply(value, this === context ? native : this, args);
        };
      }
      let wrapped = wrappers.get(key);
      if (!wrapped) {
        wrapped = function(this: unknown, ...args: unknown[]) {
          if (this !== context) return Reflect.apply(value, this, args);
          const packet = current, name = String(key);
          if (!packet) return Reflect.apply(value, native, args);
          if (packet.commands.length >= maxCommands || !methodAllowed(name, args, packet)) {
            immediateRemainder(); return Reflect.apply(value, native, args);
          }
          const copied = args.map(arg => Array.isArray(arg) ? arg.slice() : arg) as Value[];
          if (!paints.has(name)) {
            const result = Reflect.apply(value, native, args);
            packet.commands.push({method: name, args: copied});
            if (name === 'save') packet.depth++;
            if (name === 'restore') packet.depth--;
            if (name === 'beginPath') packet.pathStarted = true;
            return result;
          }
          packet.commands.push({method: name, args: copied});
          return undefined;
        };
        wrappers.set(key, wrapped);
      }
      return wrapped;
    },
    set(target, key, value) {
      const packet = current;
      if (!packet) { materialize(); return Reflect.set(target, key, value, target); }
      if (packet.commands.length >= maxCommands || !fieldAllowed(key, value)) {
        immediateRemainder(); return Reflect.set(target, key, value, target);
      }
      const accepted = Reflect.set(target, key, value, target);
      if (accepted) packet.commands.push({field: key, value: value as string | number});
      return accepted;
    }
  });
  return {
    materialize,
    // Called only AFTER the owner's full 420x290 native clearRect returns at
    // identity transform with no clip, BEFORE its original drawImage. This is
    // not a generic partial-clear notification. A failing blit cannot revive
    // old markers. The source has no unowned backing-size or clip writer.
    backgroundCleared() { pending = null; if (current) { current = null; disabled = true; } },
    draw(hidden: boolean, producer: (context: CanvasRenderingContext2D) => void) {
      materialize();
      if (!hidden || disabled || disposed || !intact()) { producer(native); return; }
      const initial = entry();
      if (!initial) { disabled = true; producer(native); return; }
      current = {entry: initial, commands: [], depth: 0, pathStarted: false};
      try { producer(context); }
      catch (error) {
        // Preserve the producer's own exception, with its successful paint
        // prefix materialized. The producer is never called a second time.
        try { immediateRemainder(); } finally { throw error; }
      }
      if (!intact()) return;
      if (current?.depth) { immediateRemainder(); return; }
      pending = current; current = null;
    },
    dispose() {
      if (disposed) return;
      materialize(); disabled = true; disposed = true;
      canvas.removeEventListener('contextlost', lost); canvas.removeEventListener('contextrestored', lost);
    }
  };
}
