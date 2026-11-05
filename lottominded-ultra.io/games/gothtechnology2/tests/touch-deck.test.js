import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLayout, stickDirections } from '../src/ui/touch-deck.js';

test('touch layouts reject unknown actions and clamp corrupted sizes and coordinates', () => {
  const defaults = [{ id: 'attack', label: 'Attack', action: 'punch', x: 80, y: 60, size: 56 }];
  const actions = [{ id: 'punch', label: 'Punch' }];
  assert.deepEqual(normalizeLayout([{ action: 'unknown', x: -800, y: 900, size: 3 }], defaults, actions),
    [{ ...defaults[0], x: 0, y: 100, size: 48 }]);
  assert.deepEqual(normalizeLayout(null, defaults, actions), defaults);
});

test('joystick deadzone avoids drift and supports cardinal maze turns and fighter diagonals', () => {
  assert.deepEqual(stickDirections(3, 2, 56), []);
  assert.deepEqual(stickDirections(40, -30, 56), ['right']);
  assert.deepEqual(stickDirections(40, -30, 56, true), ['right', 'up']);
  assert.deepEqual(stickDirections(-40, 4, 56, true), ['left']);
});
