import { isReduced } from './experience';
import { openDialog } from './dom';
import { href } from '../utilities/paths';

export function initStory() {
  const root = document.documentElement;
  const pause = document.querySelector<HTMLButtonElement>('#scene-pause')!;
  const sound = document.querySelector<HTMLButtonElement>('[data-sound-proxy]')!;
  const motion = document.querySelector<HTMLButtonElement>('[data-motion-proxy]')!;
  const soundOriginal = document.querySelector<HTMLButtonElement>('#sound-toggle')!;
  const motionOriginal = document.querySelector<HTMLButtonElement>('#motion-toggle')!;
  const sync = () => {
    sound.textContent = soundOriginal.textContent; sound.setAttribute('aria-pressed', soundOriginal.getAttribute('aria-pressed') ?? 'false');
    motion.textContent = motionOriginal.textContent; motion.setAttribute('aria-pressed', String(isReduced()));
    pause.disabled = isReduced();
    if (isReduced()) root.dataset.cinemaPaused = 'true';
    pause.textContent = isReduced() ? 'Motion reduced' : root.dataset.cinemaPaused === 'true' ? 'Resume motion' : 'Pause motion';
    pause.setAttribute('aria-pressed', String(root.dataset.cinemaPaused === 'true'));
    document.dispatchEvent(new Event('store:motion'));
  };
  pause.addEventListener('click', () => { root.dataset.cinemaPaused = String(root.dataset.cinemaPaused !== 'true'); sync(); });
  sound.addEventListener('click', () => soundOriginal.click());
  motion.addEventListener('click', () => motionOriginal.click());
  document.addEventListener('store:preferences', sync); document.addEventListener('store:sound', sync); sync();

  const portal = document.querySelector<HTMLElement>('#enter-the-fight')!;
  portal.dataset.storyScene = 'portal';
  portal.querySelectorAll('a').forEach(a => a.setAttribute('data-portal-link', ''));
  const sections = [...document.querySelectorAll<HTMLElement>('[data-story-scene]')];
  const chapters = [...document.querySelectorAll<HTMLAnchorElement>('[data-chapter]')];
  let frame = 0;
  const update = () => {
    frame = 0;
    let current = sections[0];
    for (const section of sections) if (section.getBoundingClientRect().top <= innerHeight * .5) current = section;
    root.dataset.storyChapter = current.dataset.storyScene;
    chapters.forEach(a => { if (a.dataset.chapter === current.dataset.storyScene) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    if (isReduced() || root.dataset.cinemaPaused === 'true') return;
    const rect = portal.getBoundingClientRect();
    if (rect.bottom >= 0 && rect.top <= innerHeight) portal.style.setProperty('--portal-depth', String(Math.max(0, Math.min(1, 1 - rect.top / innerHeight))));
  };
  const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', scroll); update();
  const reveals = new IntersectionObserver(entries => entries.forEach(entry => { entry.target.classList.toggle('scene-in-view', entry.isIntersecting); }), { threshold: .12 });
  sections.forEach(section => reveals.observe(section));

  const dialog = document.querySelector<HTMLDialogElement>('#material-display')!;
  const image = dialog.querySelector<HTMLImageElement>('#material-image')!;
  const title = dialog.querySelector<HTMLElement>('#material-title')!;
  const product = dialog.querySelector<HTMLAnchorElement>('[data-material-product]')!;
  const zoom = dialog.querySelector<HTMLButtonElement>('[data-material-zoom]')!;
  const reset = () => { dialog.dataset.zoom = 'false'; zoom.setAttribute('aria-pressed', 'false'); zoom.textContent = 'Zoom detail'; };
  document.querySelectorAll<HTMLButtonElement>('[data-inspect-material]').forEach(button => button.addEventListener('click', () => {
    const embroidery = button.dataset.inspectMaterial === 'embroidery';
    image.src = href(`media/${embroidery ? 'embroidery' : 'charm'}.webp`);
    image.alt = embroidery ? 'Close-up reference of the Detroit skyline embroidery' : 'LottoMind character, gold clasp and branded strap reference';
    title.textContent = embroidery ? 'The embroidery study' : 'The signature charm';
    product.href = href(`products/${embroidery ? 'night-protocol-hoodie' : 'gothtechnology-luggage-charm'}/`);
    reset(); openDialog('material-display', button);
  }));
  zoom.addEventListener('click', () => { const zoomed = dialog.dataset.zoom !== 'true'; dialog.dataset.zoom = String(zoomed); zoom.setAttribute('aria-pressed', String(zoomed)); zoom.textContent = zoomed ? 'Reset detail' : 'Zoom detail'; });
  dialog.addEventListener('close', reset);

  let transitionTimer = 0, audio: AudioContext | null = null;
  document.querySelectorAll<HTMLAnchorElement>('[data-portal-link]').forEach(link => link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
    if (isReduced() || root.dataset.cinemaPaused === 'true') return;
    event.preventDefault();
    if (transitionTimer) return;
    if (root.dataset.sound === 'on') {
      try { audio ??= new AudioContext(); void audio.resume(); const oscillator = audio.createOscillator(), gain = audio.createGain(); oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(220, audio.currentTime); oscillator.frequency.exponentialRampToValueAtTime(75, audio.currentTime + .25); gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .28); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .3); } catch { /* Sound never blocks navigation. */ }
    }
    document.dispatchEvent(new Event('store:game-launch'));
    root.dataset.portalEntering = 'true';
    transitionTimer = window.setTimeout(() => { location.assign(link.href); }, 320);
  }));
  const resetPortal = () => { delete root.dataset.portalEntering; window.clearTimeout(transitionTimer); transitionTimer = 0; };
  window.addEventListener('pageshow', resetPortal);
  window.addEventListener('pagehide', () => { resetPortal(); cancelAnimationFrame(frame); reveals.disconnect(); window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll); void audio?.close(); }, { once: true });
}
