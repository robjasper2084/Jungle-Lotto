import { saved } from './dom';

/** Silent decorative motion; the responsive artwork remains the no-JS/error fallback. */
export function initHeroVideo() {
  const hero = document.querySelector<HTMLElement>('#arrival');
  const video = hero?.querySelector<HTMLVideoElement>('#hero-background-video');
  const toggle = hero?.querySelector<HTMLButtonElement>('[data-toggle-hero-video]');
  const status = hero?.querySelector<HTMLElement>('#scene-status');
  if (!hero || !video || !toggle || !status) return;
  // Stretch the six-second camera move into a restrained fifteen-second hero loop.
  video.defaultPlaybackRate = 0.4;
  video.playbackRate = 0.4;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
  let wanted = true, visible = false, failed = false;
  const staticPreference = () => motion.matches || document.documentElement.dataset.reducedMotion === 'true'
    || saved('gothtechnology.armory.motion') === 'reduced' || saved('gothtechnology.armory.pause') === 'true'
    || connection?.saveData || saved('gothtechnology.armory.quality') === 'fallback';
  const shouldPlay = () => wanted && visible && !document.hidden && !staticPreference() && !failed;
  const sync = () => {
    toggle.hidden = false;
    toggle.disabled = !!staticPreference() || failed;
    toggle.textContent = failed ? 'Video unavailable' : staticPreference() ? 'Motion off' : video.paused ? 'Play background' : 'Pause background';
    toggle.setAttribute('aria-pressed', String(!video.paused));
    status.textContent = !video.paused ? 'Armory Online — Cinematic Loop' : hero.dataset.videoReady === 'true' ? 'Armory Online — Motion Paused' : 'Armory Online — Static Display';
  };
  const update = () => {
    if (!shouldPlay()) {
      video.pause();
      if (staticPreference() || failed) delete hero.dataset.videoReady;
      sync();
      return;
    }
    video.muted = true;
    if (!video.hasAttribute('src')) video.src = video.dataset.src!;
    void video.play().catch(sync);
  };
  video.addEventListener('playing', () => {
    if (!shouldPlay()) { video.pause(); return; }
    hero.dataset.videoReady = 'true';
    sync();
  });
  video.addEventListener('pause', sync);
  video.addEventListener('error', () => { failed = true; update(); });
  toggle.addEventListener('click', () => { wanted = video.paused; update(); });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    update();
  }, { threshold: 0 });
  observer.observe(hero);
  document.addEventListener('visibilitychange', update);
  document.addEventListener('store:preferences', update);
  document.addEventListener('store:motion', update);
  motion.addEventListener('change', update);
  connection?.addEventListener?.('change', update);
  window.addEventListener('pagehide', () => video.pause());
  window.addEventListener('pageshow', update);
  sync();
}
