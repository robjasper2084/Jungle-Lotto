import { config } from '../config';
import { $, $$, saved, save, openDialog, announce } from './dom';

const SESSION_KEY = 'gothtechnology.armory.commercial.20260716.seen';
const HIDE_KEY = 'gothtechnology.armory.hideTransmissions';

export function initHomeCommercial() {
  const dialog = $<HTMLDialogElement>('#home-commercial');
  if (!dialog || !config.features.enableCommercialTransmissions) return;
  const video = $<HTMLVideoElement>('#home-commercial-video', dialog)!;
  const play = $<HTMLButtonElement>('[data-commercial-play]', dialog)!;
  const sound = $<HTMLButtonElement>('[data-commercial-sound]', dialog)!;
  const status = $('[data-commercial-status]', dialog)!;
  const reduced = () => document.documentElement.dataset.reducedMotion === 'true';
  const saveData = () => !!(navigator as Navigator & {connection?: {saveData?: boolean}}).connection?.saveData;
  let shown = false, timer = 0, lastInteraction = Date.now();
  const expires = Date.now() + 120_000;

  const alreadySeen = () => {
    try { return sessionStorage.getItem(SESSION_KEY) === 'true'; }
    catch { return true; } // If session storage is blocked, keep playback on request.
  };
  const interacted = () => { lastInteraction = Date.now(); };
  const stopPrompt = () => {
    clearTimeout(timer);
    document.removeEventListener('pointerdown', interacted);
    document.removeEventListener('keydown', interacted);
    document.removeEventListener('wheel', interacted);
  };
  const syncControls = () => {
    play.textContent = video.ended ? 'Replay film' : video.paused ? 'Play film' : 'Pause film';
    sound.textContent = video.muted ? 'Turn sound on' : 'Mute sound';
    sound.setAttribute('aria-pressed', String(!video.muted));
  };
  const startPlayback = async () => {
    try { await video.play(); }
    catch { status.textContent = 'Press Play film to start the commercial.'; }
  };
  const show = (trigger?: HTMLElement) => {
    if (dialog.open) return;
    stopPrompt();
    shown = true;
    try { sessionStorage.setItem(SESSION_KEY, 'true'); } catch { /* Manual replay remains available. */ }
    status.textContent = '';
    video.muted = true;
    video.src = video.dataset.src!;
    syncControls();
    document.dispatchEvent(new Event('store:media-play'));
    openDialog(dialog.id, trigger ?? document.activeElement as HTMLElement);
    if (!reduced()) void startPlayback();
  };
  $$('[data-watch-commercial],[data-watch-transmission]').forEach(button => button.addEventListener('click', () => show(button)));
  play.addEventListener('click', () => {
    status.textContent = '';
    if (video.paused) void startPlayback();
    else video.pause();
  });
  sound.addEventListener('click', () => { video.muted = !video.muted; syncControls(); });
  ['play', 'pause', 'ended', 'volumechange'].forEach(event => video.addEventListener(event, syncControls));
  video.addEventListener('play', () => document.dispatchEvent(new Event('store:media-play')));
  video.addEventListener('error', () => { status.textContent = 'The commercial could not load. You can still explore the charm below.'; });
  dialog.addEventListener('close', () => { video.pause(); video.removeAttribute('src'); video.load(); });
  $('[data-commercial-hide]', dialog)!.addEventListener('click', () => {
    const persisted = save(HIDE_KEY, 'true');
    dialog.close();
    announce(persisted
      ? 'Automatic commercials are off. Watch transmission still lets you replay the film.'
      : 'Commercial dismissed for this visit. Browser settings prevented saving your preference.');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
  document.addEventListener('store:preferences', () => { if (reduced()) video.pause(); });
  window.addEventListener('pagehide', () => { stopPrompt(); video.pause(); }, {once:true});

  const promptWhenIdle = () => {
    if (shown || alreadySeen() || saved(HIDE_KEY) === 'true' || reduced() || saveData() || Date.now() > expires) {
      stopPrompt();
      return;
    }
    const editing = document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
    if (document.hidden || document.querySelector('dialog[open]') || editing || Date.now() - lastInteraction < 5_000) {
      timer = window.setTimeout(promptWhenIdle, 1_000);
      return;
    }
    show();
  };
  if (!alreadySeen() && saved(HIDE_KEY) !== 'true' && !reduced() && !saveData()) {
    document.addEventListener('pointerdown', interacted, {passive:true});
    document.addEventListener('keydown', interacted);
    document.addEventListener('wheel', interacted, {passive:true});
    timer = window.setTimeout(promptWhenIdle, 8_000);
  }
}
