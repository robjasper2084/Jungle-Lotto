import { analytics } from '../state/analytics';

export function initInlineFilms() {
  document.querySelectorAll<HTMLElement>('[data-inline-film]').forEach(host => {
    const film = host.querySelector<HTMLVideoElement>('video')!;
    const toggle = host.querySelector<HTMLButtonElement>('[data-origin-film-toggle]')!;
    const sound = host.querySelector<HTMLButtonElement>('[data-origin-film-sound]')!;
    const status = host.querySelector<HTMLElement>('[data-origin-film-status]')!;
    film.defaultMuted = false; film.muted = false; film.volume = 1;
    const sync = () => {
      toggle.textContent = (film.ended ? 'Replay ' : film.paused ? 'Play ' : 'Pause ') + toggle.dataset.filmLabel;
      sound.textContent = film.muted ? 'Turn sound on' : 'Mute sound';
      sound.setAttribute('aria-pressed', String(!film.muted));
    };
    toggle.addEventListener('click', async () => {
      if (!film.paused) { film.pause(); return; }
      if (!film.getAttribute('src')) film.src = film.dataset.src!;
      try { await film.play(); status.textContent = ''; analytics.trackEvent('watch_campaign', { handle: film.id }); }
      catch { status.textContent = 'Press Play to try again, or open the video file.'; }
    });
    sound.addEventListener('click', () => { film.muted = !film.muted; sync(); });
    film.addEventListener('play', () => {
      document.querySelectorAll<HTMLVideoElement>('video').forEach(other => { if (other !== film) other.pause(); });
      document.dispatchEvent(new Event('store:media-play'));
      sync();
    });
    ['pause', 'ended', 'volumechange'].forEach(event => film.addEventListener(event, sync));
    film.addEventListener('error', () => { if (film.getAttribute('src')) status.textContent = 'Video unavailable. Try opening the video file.'; });
    // Returning to a tab never restarts a film without another click.
    document.addEventListener('visibilitychange', () => { if (document.hidden) film.pause(); });
    document.addEventListener('store:dialog', () => { if (document.querySelector('dialog[open]')) film.pause(); });
    window.addEventListener('pagehide', () => { film.pause(); film.removeAttribute('src'); film.load(); }, { once: true });
    sync();
  });
}
