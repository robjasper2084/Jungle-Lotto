import { config } from '../config';
import { $, $$, openDialog } from './dom';
import { analytics } from '../state/analytics';

/** A click requests the film and authorizes its sound; no idle popup or preload. */
export function initHomeCommercial() {
  const dialog = $<HTMLDialogElement>('#home-commercial');
  if (!dialog || !config.features.enableCommercialTransmissions) return;
  const video = $<HTMLVideoElement>('#home-commercial-video', dialog)!;
  const play = $<HTMLButtonElement>('[data-commercial-play]', dialog)!;
  const sound = $<HTMLButtonElement>('[data-commercial-sound]', dialog)!;
  const status = $('[data-commercial-status]', dialog)!;
  const syncControls = () => {
    play.textContent = video.ended ? 'Replay film' : video.paused ? 'Play film' : 'Pause film';
    sound.textContent = video.muted ? 'Turn sound on' : 'Mute sound';
    sound.setAttribute('aria-pressed', String(!video.muted));
  };
  const startPlayback = async () => {
    status.textContent = '';
    try { await video.play(); }
    catch { if (dialog.open) status.textContent = 'Press Play film to start the commercial with sound.'; }
  };
  const show = (trigger: HTMLElement) => {
    if (dialog.open) return;
    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;
    video.src = video.dataset.src!;
    syncControls();
    document.dispatchEvent(new Event('store:media-play'));
    openDialog(dialog.id, trigger);
    analytics.trackEvent('watch_campaign', { handle: 'home-charm-commercial' });
    void startPlayback();
  };
  $$('[data-watch-commercial],[data-watch-transmission]').forEach(button => button.addEventListener('click', () => show(button)));
  play.addEventListener('click', () => { if (video.paused) void startPlayback(); else video.pause(); });
  sound.addEventListener('click', () => { video.muted = !video.muted; syncControls(); });
  ['play', 'pause', 'ended', 'volumechange'].forEach(event => video.addEventListener(event, syncControls));
  video.addEventListener('play', () => document.dispatchEvent(new Event('store:media-play')));
  video.addEventListener('error', () => { if (dialog.open) status.textContent = 'The commercial could not load. You can still explore the charm below.'; });
  const release = () => { video.pause(); video.removeAttribute('src'); video.load(); };
  dialog.addEventListener('close', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
  window.addEventListener('pagehide', release, { once: true });
}
