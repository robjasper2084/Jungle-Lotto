import { openDialog } from './dom';
import { schedulePagePromo } from './page-promo-timer';

export function initPagePromos() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-page-promo]');
  if (!dialog) return;
  const delayMs = Number(dialog.dataset.delayMs);
  if (!Number.isFinite(delayMs) || delayMs < 0) return;
  const listeners = new AbortController();
  let cancel = () => {};
  const dispose = () => { cancel(); listeners.abort(); };
  const start = () => {
    cancel = schedulePagePromo(delayMs, {
      canShow: () => !document.hidden && !document.querySelector('dialog[open]')
        && !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')
        && !document.querySelector('[data-game-host] iframe')
        && ![...document.querySelectorAll<HTMLMediaElement>('video,audio')].some(media => media.controls && !media.paused && !media.muted),
      show: () => { openDialog(dialog.id); dispose(); },
    });
  };
  // Opening a game or leaving the page cancels the pending introduction.
  window.addEventListener('pagehide', dispose, { once: true, signal: listeners.signal });
  document.addEventListener('store:game-launch', dispose, { once: true, signal: listeners.signal });
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true, signal: listeners.signal });
}
