const sessionValues = new Map<string, string | null>();
let unavailable = false;

function reportUnavailable() {
  unavailable = true;
  globalThis.dispatchEvent?.(new Event('lottomind:storage-unavailable'));
}

export const isStorageUnavailable = () => unavailable;

// Keep progress coherent within the open game even if durable storage fails.
export const gameStorage = {
  getItem(key: string): string | null {
    if (sessionValues.has(key)) return sessionValues.get(key) ?? null;
    try { return localStorage.getItem(key); }
    catch { reportUnavailable(); return null; }
  },
  setItem(key: string, value: string): void {
    sessionValues.set(key, value);
    try { localStorage.setItem(key, value); sessionValues.delete(key); }
    catch { reportUnavailable(); }
  },
  removeItem(key: string): void {
    sessionValues.set(key, null);
    try { localStorage.removeItem(key); sessionValues.delete(key); }
    catch { reportUnavailable(); }
  }
};
