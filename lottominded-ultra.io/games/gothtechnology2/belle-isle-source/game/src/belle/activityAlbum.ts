import {PHOTO_FRAMES, type PhotoFrame} from './activityProgress.ts';

export type AlbumPhoto = {
  id: string;
  assignment: string;
  subject: string;
  score: number;
  createdAt: number;
  blob: Blob;
};
const LIMIT = 24;
const DATABASE = 'belle-isle-photo-quest-v1';
const validPhoto = (value: unknown): value is AlbumPhoto => {
  if (!value || typeof value !== 'object') return false;
  const photo = value as AlbumPhoto;
  return typeof photo.id === 'string' && photo.id.length > 0
    && typeof photo.assignment === 'string' && typeof photo.subject === 'string'
    && Number.isFinite(photo.score) && photo.score >= 0 && photo.score <= 100
    && Number.isFinite(photo.createdAt) && photo.createdAt >= 0
    && photo.blob instanceof Blob && photo.blob.size > 0;
};
const newest = (photos: AlbumPhoto[]) => photos.sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(0, LIMIT);

/** Images live in IndexedDB, separately from the small JSON progression record. */
export class ActivityAlbum {
  private memory = new Map<string, AlbumPhoto>();
  private database?: Promise<IDBDatabase | null>;
  private writes: Promise<unknown> = Promise.resolve();
  private open() {
    return this.database ??= new Promise<IDBDatabase | null>(resolve => {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      try {
        const request = indexedDB.open(DATABASE, 1);
        let settled = false;
        const unavailable = () => { if (!settled) { settled = true; resolve(null); } };
        request.onupgradeneeded = () => request.result.createObjectStore('photos', {keyPath: 'id'});
        request.onsuccess = () => {
          const db = request.result;
          // A blocked open can succeed later. Close that unused connection rather
          // than keeping a leaked handle that blocks the next database upgrade.
          if (settled) { db.close(); return; }
          settled = true;
          db.onversionchange = () => { db.close(); this.database = undefined; };
          resolve(db);
        };
        request.onerror = request.onblocked = unavailable;
      } catch { resolve(null); }
    });
  }
  async list(): Promise<AlbumPhoto[]> {
    const db = await this.open();
    const saved: AlbumPhoto[] = db ? await new Promise(resolve => {
      try {
        const request = db.transaction('photos', 'readonly').objectStore('photos').getAll();
        request.onsuccess = () => resolve(request.result.filter(validPhoto));
        request.onerror = () => resolve([]);
      } catch { resolve([]); }
    }) : [];
    return newest([...new Map([...saved, ...this.memory.values()].map(photo => [photo.id, photo])).values()]);
  }
  /** Make a capture available immediately while JPEG resizing/persistence runs. */
  stage(photo: AlbumPhoto): void {
    if (!validPhoto(photo)) return;
    this.memory.set(photo.id, photo);
    this.memory = new Map(newest([...this.memory.values()]).map(photo => [photo.id, photo]));
  }
  save(photo: AlbumPhoto): Promise<boolean> {
    if (!validPhoto(photo)) return Promise.resolve(false);
    this.stage(photo);
    const write = this.writes.then(async () => {
      const db = await this.open();
      if (!db) return false;
      return new Promise<boolean>(resolve => {
        try {
          const transaction = db.transaction('photos', 'readwrite');
          const store = transaction.objectStore('photos');
          const read = store.getAll();
          read.onsuccess = () => {
            // Prune against committed records plus THIS write only. Future
            // staged captures might fail quota and must not evict durable photos.
            const merged = new Map<string, AlbumPhoto>(read.result.filter(validPhoto).map((saved: AlbumPhoto) => [saved.id, saved]));
            merged.set(photo.id, photo);
            const ids = new Set(newest([...merged.values()]).map(item => item.id));
            store.put(photo);
            const request = store.openCursor();
            request.onsuccess = () => {
              const cursor = request.result;
              if (!cursor) return;
              if (typeof cursor.key !== 'string' || !ids.has(cursor.key)) cursor.delete();
              cursor.continue();
            };
          };
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = transaction.onabort = () => resolve(false);
        } catch { resolve(false); }
      });
    });
    this.writes = write.catch(() => false);
    return write.catch(() => false);
  }
}

/** Bound album memory and export size independently of the display's pixel ratio. */
export async function albumImage(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap === 'undefined') return blob;
  const image = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>(resolve => canvas.toBlob(value => {
      canvas.width = canvas.height = 0;
      resolve(value ?? blob);
    }, 'image/jpeg', .86));
  } finally { image.close(); }
}

export async function downloadAlbumPhoto(photo: AlbumPhoto, frameId: PhotoFrame) {
  let blob = photo.blob;
  if (typeof createImageBitmap !== 'undefined') {
    let image: ImageBitmap | undefined;
    let canvas: HTMLCanvasElement | undefined;
    try {
      image = await createImageBitmap(photo.blob);
      canvas = document.createElement('canvas');
      const border = Math.max(12, Math.round(image.width * .02));
      const caption = Math.max(84, Math.round(image.width * .09));
      canvas.width = image.width + border * 2;
      canvas.height = image.height + border * 2 + caption;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo frame rendering is unavailable');
      const color = PHOTO_FRAMES.find(frame => frame.id === frameId)?.color ?? '#e4dcc5';
      context.fillStyle = '#0c1d20'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, border, border);
      context.fillStyle = color;
      const size = Math.max(17, Math.round(image.width * .018));
      context.font = `600 ${size}px system-ui, sans-serif`;
      context.fillText(photo.subject, border, image.height + border * 2 + size * 1.4, image.width);
      context.font = `${Math.max(13, size * .72)}px system-ui, sans-serif`;
      context.fillText(`PHOTO QUEST  /  ${photo.score} POINTS  /  DIGITAL STATIC · DETROIT`, border, canvas.height - border - size * .3, image.width);
      blob = await new Promise<Blob>(resolve => canvas!.toBlob(value => resolve(value ?? photo.blob), 'image/jpeg', .92));
    } catch {
      // Cosmetic framing is optional; a browser decoder/canvas failure must not
      // prevent the player from downloading an already captured photograph.
      blob = photo.blob;
    } finally {
      if (canvas) canvas.width = canvas.height = 0;
      image?.close();
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  link.download = `Belle-Isle-Photo-Quest-${photo.subject.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.${extension}`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
