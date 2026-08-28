export const $ = <T extends Element = HTMLElement>(selector: string, parent: ParentNode = document) => parent.querySelector<T>(selector);
export const $$ = <T extends Element = HTMLElement>(selector: string, parent: ParentNode = document) => [...parent.querySelectorAll<T>(selector)];
export const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function storage(): Storage | null { try { return window.localStorage; } catch { return null; } }
export function saved(key: string) { try { return storage()?.getItem(key) ?? null; } catch { return null; } }
export function save(key: string, value: string) { try { storage()?.setItem(key, value); return true; } catch { return false; } }
export function announce(message: string) { const target = $('#store-status'); if (target) target.textContent = message; }
const triggers = new WeakMap<HTMLDialogElement, HTMLElement>();
export function openDialog(id: string, trigger = document.activeElement as HTMLElement) {
  const dialog = $<HTMLDialogElement>(`#${id}`); if (!dialog || dialog.open) return;
  const current = $<HTMLDialogElement>('dialog[open]');
  if (current) { trigger = triggers.get(current) ?? trigger; current.close(); }
  if (trigger) triggers.set(dialog, trigger);
  dialog.showModal();
  document.dispatchEvent(new Event('store:dialog'));
}
export function initDialogs() {
  document.addEventListener('click', event => {
    const target = event.target as Element;
    target.closest('[data-close-dialog]')?.closest('dialog')?.close();
  });
  $$<HTMLDialogElement>('dialog').forEach(dialog => {
    dialog.addEventListener('keydown', event => {
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close();return;}
      if(event.key!=='Tab')return;
      const items=$$<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',dialog).filter(el=>el.getClientRects().length>0);
      // Safari's native Tab order can omit links. Cycle the same visible controls
      // on every platform instead of waiting for a browser-specific last item.
      event.preventDefault();
      if(!items.length)return;
      const index=items.indexOf(document.activeElement as HTMLElement);
      const next=index<0 ? (event.shiftKey?items.length-1:0) : (index+(event.shiftKey?-1:1)+items.length)%items.length;
      items[next].focus();
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
    dialog.addEventListener('close', () => { const trigger=triggers.get(dialog); requestAnimationFrame(()=>{if(!document.querySelector('dialog[open]') && trigger?.isConnected) trigger.focus({preventScroll:true});}); document.dispatchEvent(new Event('store:dialog')); });
    dialog.addEventListener('click', event => { if(event.target===dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.close(); } });
  });
}
