import { touchIcon } from './touch-icons.js?v=galaxy-a16-performance-v1';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const copy = (value) => JSON.parse(JSON.stringify(value));

export function normalizeLayout(saved, defaults, actions) {
  const valid = new Set(actions.map(action => action.id));
  return defaults.map((control, index) => {
    const candidate = saved?.[index] || {};
    const number = (key, low, high) => Number.isFinite(candidate[key]) ? clamp(candidate[key], low, high) : control[key];
    return { ...control, x: number('x', 0, 100), y: number('y', 0, 100),
      size: number('size', control.stick ? 96 : 48, control.stick ? 148 : 88),
      ...(Number.isFinite(candidate.opacity) ? { opacity: clamp(candidate.opacity, 0.35, 1) } : {}),
      action: !control.stick && valid.has(candidate.action) ? candidate.action : control.action };
  });
}

export function stickDirections(x, y, radius, diagonal = false) {
  if (Math.hypot(x, y) < radius * 0.2) return [];
  if (!diagonal) return [Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up')];
  const directions = [];
  if (Math.abs(x) > Math.abs(y) * 0.48) directions.push(x > 0 ? 'right' : 'left');
  if (Math.abs(y) > Math.abs(x) * 0.48) directions.push(y > 0 ? 'down' : 'up');
  return directions;
}

// A DOM-only deck also works inside the React game without owning game state.
export function createTouchDeck({ host, storageKey, actions, controls, onPress, onRelease,
  onMove, onVector, onEdit, onMenu, presets = [], style = 'classic', diagonal = false, title = 'Touch controls' }) {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* Session defaults. */ }
  if (typeof stored !== 'object' || Array.isArray(stored)) stored = {};
  const orientation = () => innerWidth > innerHeight ? 'landscape' : 'portrait';
  let mode = orientation();
  const orientControls = (items) => items.map(control => ({ ...control,
    x: mode === 'landscape' ? control.landscapeX ?? control.x : control.x,
    y: mode === 'landscape' ? control.landscapeY ?? control.y : control.y }));
  const defaults = () => orientControls(controls);
  let layout = normalizeLayout(stored[mode], defaults(), actions);
  let opacity = Number.isFinite(stored.opacity) ? clamp(stored.opacity, 0.35, 1) : 0.85;
  let floating = stored.floating !== undefined ? stored.floating === true : style === 'battle';
  let editing = false;
  let selected = 0;
  let backup;
  let active = true;
  let opener = null;
  const pointers = new Map();
  const keyboard = new Map();
  const listeners = [];
  const listen = (element, type, handler, options) => {
    element.addEventListener(type, handler, options);
    listeners.push(() => element.removeEventListener(type, handler, options));
  };
  const el = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const root = el('div', `touch-deck${style === 'battle' ? ' td-battle' : ''}`);
  const stage = el('div', 'td-stage');
  stage.setAttribute('aria-label', title);
  const customize = el('button', 'td-customize', 'Layout');
  if (style === 'battle') { customize.replaceChildren(touchIcon('Settings2')); customize.title = 'Customize controls'; }
  customize.type = 'button';
  customize.setAttribute('aria-label', 'Customize touch controls');
  const dialog = el('dialog', `td-editor${style === 'battle' ? ' td-battle-editor' : ''}`);
  dialog.setAttribute('aria-label', `${title} layout editor`);
  const toolbar = el('div', 'td-toolbar');
  const heading = el('strong', '', 'CONTROL LAYOUT');
  const status = el('span', 'td-status');
  status.setAttribute('role', 'status');
  const select = el('select', '');
  select.setAttribute('aria-label', 'Selected control');
  const actionSelect = el('select', '');
  actionSelect.setAttribute('aria-label', 'Assigned action');
  actions.forEach(action => actionSelect.add(new Option(action.label, action.id)));
  const slider = (label, min, max, step) => {
    const wrap = el('label', 'td-field', label);
    const input = el('input', '');
    input.type = 'range'; input.min = min; input.max = max; input.step = step;
    input.setAttribute('aria-label', label); wrap.append(input); return { wrap, input };
  };
  const size = slider('Size', '48', '148', '2');
  const fade = slider('Opacity', '35', '100', '5');
  const x = slider('Horizontal position', '0', '100', '1');
  const y = slider('Vertical position', '0', '100', '1');
  const button = (label, handler) => {
    const item = el('button', '', label); item.type = 'button'; listen(item, 'click', handler); return item;
  };
  const footer = el('div', 'td-editor-actions');
  toolbar.append(heading, select, actionSelect, size.wrap, fade.wrap, x.wrap, y.wrap);
  if (style === 'battle') {
    const presetSelect = el('select', 'td-preset');
    presetSelect.setAttribute('aria-label', 'Control preset');
    presetSelect.add(new Option('Custom layout', 'custom'));
    presets.forEach(preset => presetSelect.add(new Option(preset.label, preset.id)));
    listen(presetSelect, 'change', () => {
      const chosen = presets.find(preset => preset.id === presetSelect.value);
      if (!chosen) return;
      clear(); layout = normalizeLayout(null, orientControls(chosen.controls), actions); refresh();
    });
    const joystick = el('select', '');
    joystick.setAttribute('aria-label', 'Joystick mode');
    joystick.add(new Option('Floating joystick', 'floating'));
    joystick.add(new Option('Fixed joystick', 'fixed'));
    joystick.value = floating ? 'floating' : 'fixed';
    listen(joystick, 'change', () => { clear(); floating = joystick.value === 'floating'; });
    toolbar.append(presetSelect, joystick);
  }
  footer.append(button('Right handed', () => preset(false)), button('Left handed', () => preset(true)),
    button('Reset', () => { preset(false); opacity = 0.85; refresh(); }),
    button('Cancel', () => close(false)), button('Save layout', () => close(true)), status);
  dialog.append(toolbar, footer);
  root.append(stage, customize); host.append(root, dialog);
  if (onMenu) {
    const menu = button('Menu', () => { clear(); onMenu(); });
    if (style === 'battle') { menu.replaceChildren(touchIcon('Pause')); menu.title = 'Pause / resume'; }
    menu.className = 'td-customize td-menu';
    menu.setAttribute('aria-label', 'Open pause menu'); root.append(menu);
  }
  const starts = [];
  const nodes = controls.map((control, index) => {
    const item = el('button', control.stick ? 'td-control td-stick' : 'td-control td-action');
    item.type = 'button'; item.dataset.control = control.id;
    const caption = el('span', 'td-caption');
    if (control.stick) item.append(el('span', 'td-stick-thumb'));
    item.append(caption); stage.append(item);
    select.add(new Option(control.label, String(index)));
    const start = event => {
      if ((!active && !editing) || event.button > 0) return;
      event.preventDefault();
      if ([...pointers.values()].some(pointer => pointer.index === index)) return;
      try { item.setPointerCapture(event.pointerId); } catch { /* Global release remains available. */ }
      pointers.set(event.pointerId, { index, action: layout[index].action });
      if (editing) { selected = index; refresh(); return; }
      item.dataset.held = 'true';
      if (control.stick && control.role !== 'aim' && floating) {
        const rect = item.getBoundingClientRect();
        const bounds = stage.getBoundingClientRect(); const half = rect.width / 2 + 4;
        const origin = { x: clamp(event.clientX, bounds.left + half, bounds.right - half), y: clamp(event.clientY, bounds.top + half, bounds.bottom - half) };
        pointers.get(event.pointerId).origin = origin;
        item.style.setProperty('--float-x', `${origin.x - rect.left - rect.width / 2}px`);
        item.style.setProperty('--float-y', `${origin.y - rect.top - rect.height / 2}px`);
      }
      if (control.stick) moveStick(event, index);
      else onPress(layout[index].action);
    };
    starts.push(start); listen(item, 'pointerdown', start);
    listen(item, 'pointermove', event => {
      const pointer = pointers.get(event.pointerId);
      if (!pointer || pointer.index !== index) return;
      event.preventDefault();
      if (editing) {
        const rect = stage.getBoundingClientRect();
        layout[index].x = clamp((event.clientX - rect.left) / rect.width * 100, 0, 100);
        layout[index].y = clamp((event.clientY - rect.top) / rect.height * 100, 0, 100);
        refresh();
      } else if (control.stick) moveStick(event, index);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(item, type, event => release(event.pointerId));
    listen(item, 'keydown', event => {
      if (editing && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
        event.preventDefault(); selected = index;
        const field = event.code === 'ArrowLeft' || event.code === 'ArrowRight' ? 'x' : 'y';
        layout[index][field] = clamp(layout[index][field] + (event.code === 'ArrowLeft' || event.code === 'ArrowUp' ? -2 : 2), 0, 100);
        refresh();
      } else if (!editing && active && ['Space', 'Enter'].includes(event.code) && !event.repeat && !control.stick) {
        event.preventDefault(); keyboard.set(event.code, layout[index].action); onPress(layout[index].action);
      }
    });
    listen(item, 'click', event => {
      if (editing) { selected = index; refresh(); }
      else if (event.detail === 0 && active && !control.stick) { onPress(layout[index].action); onRelease(layout[index].action); }
    });
    listen(item, 'contextmenu', event => event.preventDefault());
    return item;
  });
  if (style === 'battle') {
    const movement = el('div', 'td-move-surface');
    movement.setAttribute('aria-hidden', 'true'); stage.prepend(movement);
    const moveIndex = controls.findIndex(control => control.stick && control.role !== 'aim');
    listen(movement, 'pointerdown', event => {
      if (!floating || editing || !active || moveIndex < 0) return;
      starts[moveIndex](event);
    });
  }
  function moveStick(event, index) {
    const item = nodes[index]; const rect = item.getBoundingClientRect();
    const origin = pointers.get(event.pointerId)?.origin;
    const dx = event.clientX - (origin?.x ?? rect.left + rect.width / 2);
    const dy = event.clientY - (origin?.y ?? rect.top + rect.height / 2);
    const radius = rect.width / 2; const distance = Math.hypot(dx, dy);
    const scale = distance > radius * 0.55 ? radius * 0.55 / distance : 1;
    item.style.setProperty('--thumb-x', `${dx * scale}px`);
    item.style.setProperty('--thumb-y', `${dy * scale}px`);
    if (onVector) {
      const strength = distance < radius * 0.2 ? 0 : Math.min(1, distance / (radius * 0.65));
      onVector(controls[index].role || 'move', { x: distance ? dx / distance * strength : 0, y: distance ? dy / distance * strength : 0 }, true);
    }
    onMove?.(controls[index].player || 0, stickDirections(dx, dy, radius, diagonal));
  }
  function release(id) {
    const pointer = pointers.get(id); if (!pointer) return;
    pointers.delete(id); const node = nodes[pointer.index];
    node.dataset.held = 'false';
    node.style.setProperty('--thumb-x', '0px'); node.style.setProperty('--thumb-y', '0px');
    node.style.setProperty('--float-x', '0px'); node.style.setProperty('--float-y', '0px');
    if (!editing) {
      if (controls[pointer.index].stick) {
        onMove?.(controls[pointer.index].player || 0, []);
        onVector?.(controls[pointer.index].role || 'move', { x: 0, y: 0 }, false);
      } else if (![...pointers.values()].some(other => other.action === pointer.action) && ![...keyboard.values()].includes(pointer.action)) onRelease(pointer.action);
    }
  }
  function clear() { [...pointers.keys()].forEach(release); for (const action of new Set(keyboard.values())) onRelease(action); keyboard.clear(); }
  function refresh() {
    const rect = stage.getBoundingClientRect();
    layout.forEach((control, index) => {
      const node = nodes[index]; const action = actions.find(action => action.id === control.action);
      node.style.width = `${control.size}px`; node.style.height = `${control.size}px`;
      const half = control.size / 2 + 4;
      node.style.left = `${clamp(rect.width * control.x / 100, half, Math.max(half, rect.width - half))}px`;
      node.style.top = `${clamp(rect.height * control.y / 100, half, Math.max(half, rect.height - half))}px`;
      node.style.opacity = editing ? '1' : String(control.opacity ?? opacity);
      node.dataset.action = control.action || '';
      node.setAttribute('aria-label', control.stick ? control.label : action?.label || control.label);
      node.querySelector('.td-caption').textContent = control.stick ? control.label : action?.short || action?.label || control.label;
      node.title = control.stick ? control.label : action?.label || control.label;
      if (style === 'battle' && !control.stick && node.dataset.icon !== (action?.icon || '')) {
        node.querySelector('svg')?.remove(); node.dataset.icon = action?.icon || '';
        const icon = touchIcon(action?.icon);
        if (icon) node.prepend(icon);
      }
      node.dataset.selected = String(editing && index === selected);
      node.disabled = !active && !editing;
    });
    if (editing) {
      select.value = String(selected); actionSelect.disabled = Boolean(layout[selected].stick);
      actionSelect.value = layout[selected].action || '';
      size.input.min = layout[selected].stick ? '96' : '48'; size.input.max = layout[selected].stick ? '148' : '88';
      size.input.value = String(layout[selected].size); fade.input.value = String((layout[selected].opacity ?? opacity) * 100);
      x.input.value = String(layout[selected].x); y.input.value = String(layout[selected].y);
    }
  }
  function preset(left) {
    clear(); layout = defaults().map(control => ({ ...control, x: left ? 100 - control.x : control.x })); refresh();
  }
  function open() {
    if (editing) return;
    clear(); backup = { layout: copy(layout), opacity, floating }; editing = true;
    opener = document.activeElement;
    const joystick = dialog.querySelector('[aria-label="Joystick mode"]');
    if (joystick) joystick.value = floating ? 'floating' : 'fixed';
    const presetSelect = dialog.querySelector('.td-preset');
    if (presetSelect) presetSelect.value = 'custom';
    onEdit(true); dialog.showModal(); stage.classList.add('td-editing');
    dialog.append(stage); refresh(); select.focus();
  }
  function close(save) {
    clear();
    if (save) {
      stored[mode] = copy(layout); stored.opacity = opacity; stored.floating = floating;
      try { localStorage.setItem(storageKey, JSON.stringify(stored)); status.textContent = 'Layout saved'; }
      catch { status.textContent = 'Applied for this session'; }
    } else { layout = backup.layout; opacity = backup.opacity; floating = backup.floating; }
    editing = false; stage.classList.remove('td-editing'); root.prepend(stage); dialog.close();
    onEdit(false); refresh();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    else customize.focus();
  }
  listen(customize, 'click', open);
  listen(dialog, 'cancel', event => { event.preventDefault(); close(false); });
  listen(select, 'change', () => { selected = Number(select.value); refresh(); });
  listen(actionSelect, 'change', () => { layout[selected].action = actionSelect.value; refresh(); });
  listen(size.input, 'input', () => { layout[selected].size = Number(size.input.value); refresh(); });
  listen(fade.input, 'input', () => { if (style === 'battle') layout[selected].opacity = Number(fade.input.value) / 100; else opacity = Number(fade.input.value) / 100; refresh(); });
  listen(window, 'pointerup', event => release(event.pointerId));
  listen(window, 'pointercancel', event => release(event.pointerId));
  listen(window, 'keyup', event => {
    const action = keyboard.get(event.code); if (!action) return;
    keyboard.delete(event.code);
    if (![...keyboard.values()].includes(action) && ![...pointers.values()].some(pointer => pointer.action === action)) onRelease(action);
  });
  for (const [field, input] of [['x', x.input], ['y', y.input]]) listen(input, 'input', () => { layout[selected][field] = Number(input.value); refresh(); });
  listen(window, 'blur', clear);
  listen(document, 'visibilitychange', clear);
  listen(window, 'resize', () => {
    clear();
    const next = orientation();
    if (next !== mode) {
      if (editing) close(false);
      mode = next; layout = normalizeLayout(stored[mode], defaults(), actions);
    }
    refresh();
  });
  const observer = new ResizeObserver(refresh); observer.observe(stage); refresh();
  return { root, open, clear,
    reset() {
      clear(); stored = {}; layout = defaults(); opacity = 0.85; floating = style === 'battle';
      try { localStorage.removeItem(storageKey); } catch { /* Session reset still works. */ }
      refresh();
    },
    setActive(value) { if (active === value) return; clear(); active = value; refresh(); },
    destroy() { clear(); observer.disconnect(); listeners.forEach(remove => remove()); root.remove(); dialog.remove(); }
  };
}
