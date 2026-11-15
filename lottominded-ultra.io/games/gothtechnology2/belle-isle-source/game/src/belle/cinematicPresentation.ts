import {BELLE_SUNSET, hudPreset} from './cinematicPolicy.ts';
import type {SkySettings} from './skyModel.ts';
type Sky = {configure(next: Partial<SkySettings>): void};
/** One installation per page; no polling, render loop, extra assets or physics writes. */
export function installCinematicPresentation(sky: Sky): void {
  const settings = document.getElementById('settings');
  if (!settings || document.getElementById('cinematic-settings')) return;
  const field = document.createElement('fieldset');
  field.id = 'cinematic-settings';
  field.innerHTML = `<legend>Presentation</legend>
    <label for="hud-preset">HUD layout</label><select id="hud-preset">
      <option value="exploration">Exploration</option>
      <option value="racing">Racing</option>
      <option value="cinematic">Cinematic</option></select>
    <label class="check-row"><input id="compact-cockpit" type="checkbox" checked>Compact cockpit display</label>
    <button id="belle-sunset" type="button">Belle Isle Sunset</button>
    <p>Warm wispy-cloud sunset with a slow day cycle. Your saved sky is unchanged until selected. Race alerts and driving controls remain available in every layout.</p>
    <a href="./deployment-health.html" target="_blank" rel="noopener">Deployment health and exact build verification ↗</a>`;
  settings.querySelector('h2')?.insertAdjacentElement('afterend', field);
  if (!field.isConnected) settings.append(field);
  const preset = field.querySelector<HTMLSelectElement>('#hud-preset')!;
  const compact = field.querySelector<HTMLInputElement>('#compact-cockpit')!;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('belle-presentation-v1') || 'null');
    if (saved && typeof saved === 'object') {
      const p = saved as {preset?: unknown; compact?: unknown};
      preset.value = hudPreset(p.preset); compact.checked = p.compact !== false;
    }
  } catch { /* Private browsing and damaged preferences keep safe defaults. */ }
  const motion = document.querySelector<HTMLInputElement>('#motion');
  const quality = document.querySelector<HTMLSelectElement>('#quality');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set<Animation>();
  const stop = () => { for (const a of animations) a.cancel(); animations.clear(); };
  const apply = () => {
    document.body.dataset.hudPreset = hudPreset(preset.value);
    document.body.dataset.cockpitDensity = compact.checked ? 'compact' : 'full';
    document.body.dataset.presentationMotion = media.matches || motion?.checked ? 'reduced' : 'full';
    if (document.body.dataset.presentationMotion === 'reduced') stop();
    document.body.dataset.presentationQuality = quality?.value === 'high' ? 'high' : 'light';
  };
  const save = () => {
    apply();
    try { localStorage.setItem('belle-presentation-v1', JSON.stringify({preset: hudPreset(preset.value), compact: compact.checked})); } catch { /* Session still works. */ }
  };
  preset.addEventListener('change', save); compact.addEventListener('change', save);
  motion?.addEventListener('change', apply); quality?.addEventListener('change', apply);
  media.addEventListener('change', apply);
  field.querySelector<HTMLButtonElement>('#belle-sunset')!.addEventListener('click', () => {
    // Respect the existing room-host controls: no bypass of a locked sky panel.
    if (document.querySelector<HTMLSelectElement>('#sky-preset')?.disabled) return;
    sky.configure({...BELLE_SUNSET});
    const jump = document.querySelector<HTMLSelectElement>('#sky-preset');
    if (jump) jump.value = '';
    const cycle = document.querySelector<HTMLInputElement>('#sky-cycle');
    const clouds = document.querySelector<HTMLSelectElement>('#sky-clouds');
    const hour = document.querySelector<HTMLInputElement>('#sky-hour');
    const speed = document.querySelector<HTMLSelectElement>('#sky-speed');
    if (cycle) cycle.checked = true; if (clouds) clouds.value = BELLE_SUNSET.clouds;
    if (hour) hour.value = String(BELLE_SUNSET.hour); if (speed) speed.value = String(BELLE_SUNSET.dayMinutes);
  });
  const feedback = (event: Event) => {
    if (document.hidden || document.body.dataset.presentationMotion === 'reduced') return;
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('button') : null;
    if (!target || !target.closest('#settings, #hover-hud, .ride-header, #trial-board, #trial-hud') || target.matches(':disabled')) return;
    // Bound rapid input without moving hit targets or affecting held controls.
    if (animations.size >= 4) return;
    const animation = target.animate([{filter:'brightness(1.25)'},{filter:'brightness(1)'}], {duration:160});
    animations.add(animation); animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  };
  document.addEventListener('click', feedback);
  document.addEventListener('visibilitychange', stop);
  const cleanup = (event: PageTransitionEvent) => {
    stop(); if (event.persisted) return;
    document.removeEventListener('click', feedback); document.removeEventListener('visibilitychange', stop);
    media.removeEventListener('change', apply); motion?.removeEventListener('change', apply);
    quality?.removeEventListener('change', apply); window.removeEventListener('pagehide', cleanup);
  };
  window.addEventListener('pagehide', cleanup); apply();
}
