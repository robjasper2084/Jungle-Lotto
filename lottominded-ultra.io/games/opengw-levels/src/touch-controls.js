import { createTouchDeck } from '../../gothtechnology2/src/ui/touch-deck.js?v=galaxy-a16-performance-v1';

const controls = [
  { id: 'move', label: 'MOVE', stick: true, role: 'move', x: 18, landscapeX: 13, y: 74, size: 112 },
  { id: 'aim', label: 'AIM', stick: true, role: 'aim', x: 82, landscapeX: 87, y: 74, size: 104 },
  { id: 'fire-right', label: 'Right fire button', action: 'fire', x: 82, landscapeX: 88, y: 27, landscapeY: 34, size: 68 },
  { id: 'fire-left', label: 'Left fire button', action: 'fire', x: 18, landscapeX: 13, y: 27, landscapeY: 34, size: 52 },
  { id: 'bomb', label: 'Bomb button', action: 'bomb', x: 51, landscapeX: 71, y: 59, landscapeY: 58, size: 52 }
];

export function createStaticTouchControls({ host, onMenu, onEdit, onBomb, onMute }) {
  const input = { move: { x: 0, y: 0 }, moveHeld: false, aim: null, aimHeld: false, fire: false, autoFire: false };
  const deck = createTouchDeck({
    host, title: '2084 Static Wav touch controls', storageKey: '2084.staticWave.touch.layout.v1', style: 'battle', controls,
    actions: [
      { id: 'fire', label: 'Fire', short: 'FIRE', icon: 'Crosshair' },
      { id: 'bomb', label: 'Bomb', short: 'BOMB', icon: 'Bomb' },
      { id: 'autoFire', label: 'Auto fire', short: 'AUTO', icon: 'Target' },
      { id: 'pause', label: 'Pause', short: 'PAUSE', icon: 'Pause' },
      { id: 'mute', label: 'Mute sound', short: 'SOUND', icon: 'Volume2' }
    ],
    presets: [
      { id: 'thumbs', label: '2 fingers', controls },
      { id: 'claw3', label: '3 fingers', controls: controls.map(control => control.id === 'fire-left' ? { ...control, landscapeX: 25, landscapeY: 15 } : control) },
      { id: 'claw4', label: '4 fingers', controls: controls.map(control => control.id === 'fire-left' ? { ...control, landscapeX: 25, landscapeY: 15 } : control.id === 'fire-right' ? { ...control, landscapeX: 75, landscapeY: 18 } : control) }
    ],
    onPress(action) {
      if (action === 'fire') input.fire = true;
      else if (action === 'bomb') onBomb();
      else if (action === 'pause') onMenu();
      else if (action === 'mute') onMute();
      else if (action === 'autoFire') {
        input.autoFire = !input.autoFire;
        deck.root.querySelectorAll('[data-action="autoFire"]').forEach(node => node.setAttribute('aria-pressed', String(input.autoFire)));
      }
    },
    onRelease(action) { if (action === 'fire') input.fire = false; },
    onVector(role, vector, held) {
      if (role === 'move') { input.move = vector; input.moveHeld = held; }
      else { input.aimHeld = held; if (Math.hypot(vector.x, vector.y) > 0) input.aim = vector; }
    },
    onMenu, onEdit
  });
  return { deck, input, clear() {
    deck.clear(); input.move = { x: 0, y: 0 }; input.moveHeld = false;
    input.aimHeld = false; input.fire = false; input.autoFire = false;
    deck.root.querySelectorAll('[data-action="autoFire"]').forEach(node => node.setAttribute('aria-pressed', 'false'));
  } };
}

export function applyStaticTouchInput(command, input, lastAim) {
  if (input.moveHeld) command.move = input.move;
  if (input.aimHeld || input.fire || input.autoFire) {
    const aim = input.aim ?? lastAim;
    const length = aim ? Math.hypot(aim.x, aim.y) : 0;
    if (length) command.aim = { x: aim.x / length, y: aim.y / length };
    command.fire = command.fire || input.fire || input.autoFire;
  }
}
