import test from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {ActivityAlbum, downloadAlbumPhoto} from './activityAlbum.ts';
import type {AlbumPhoto} from './activityAlbum.ts';

const photo = (id: string, createdAt: number, blob = new Blob(['photo'], {type: 'image/jpeg'})): AlbumPhoto => ({
  id, createdAt, blob, assignment: 'Island Icon', subject: 'Belle Isle Casino', score: 80,
});

function replaceGlobal(t: TestContext, name: string, value: unknown) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {value, configurable: true, writable: true});
  t.after(() => {
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  });
}

/** Small asynchronous transaction fake with atomic commit/abort, including quota failures. */
function indexedDbFixture(initial: AlbumPhoto[], failIds = new Set<string>()) {
  let durable = new Map<unknown, unknown>(initial.map(item => [item.id, item]));
  type Request = {result: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null};
  const db = {
    close() {},
    onversionchange: null as (() => void) | null,
    transaction(_store: string, mode: string) {
      const staged = new Map(durable);
      let pending = 0, finished = false;
      const tx = {
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onabort: null as (() => void) | null,
        objectStore: (_name: string) => store,
      };
      const enqueue = (request: Request, action: () => unknown) => {
        pending++;
        queueMicrotask(() => {
          if (finished) return;
          try { request.result = action(); request.onsuccess?.(); }
          catch {
            finished = true;
            request.onerror?.(); tx.onerror?.(); tx.onabort?.();
          }
          pending--;
          queueMicrotask(() => {
            if (finished || pending) return;
            finished = true;
            if (mode === 'readwrite') durable = staged;
            tx.oncomplete?.();
          });
        });
      };
      const request = (action: () => unknown): Request => {
        const result: Request = {result: undefined, onsuccess: null, onerror: null};
        enqueue(result, action);
        return result;
      };
      const store = {
        getAll: () => request(() => [...staged.values()]),
        put: (item: AlbumPhoto) => request(() => {
          if (failIds.has(item.id)) throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
          staged.set(item.id, item); return item.id;
        }),
        openCursor: () => {
          const cursorRequest: Request = {result: undefined, onsuccess: null, onerror: null};
          let keys: unknown[] | undefined, index = 0;
          const next = () => enqueue(cursorRequest, () => {
            keys ??= [...staged.keys()];
            if (index >= keys.length) return null;
            const key = keys[index++];
            return {
              key,
              delete: () => request(() => staged.delete(key)),
              continue: next,
            };
          });
          next();
          return cursorRequest;
        },
      };
      return tx;
    },
  };
  return {
    factory: {
      open() {
        const request = {result: db, onsuccess: null as (() => void) | null};
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    },
    rows: () => [...durable.values()] as AlbumPhoto[],
  };
}

test('staged photos appear immediately, are replaceable by resized copies, and memory stays bounded without IndexedDB', async t => {
  replaceGlobal(t, 'indexedDB', undefined);
  const album = new ActivityAlbum();
  const raw = photo('new', 100, new Blob(['large original'], {type: 'image/jpeg'}));
  album.stage(raw);
  assert.equal((await album.list())[0].blob, raw.blob);
  const resized = {...raw, blob: new Blob(['small'], {type: 'image/jpeg'})};
  assert.equal(await album.save(resized), false, 'unavailable durable storage must be reported');
  assert.equal((await album.list())[0].blob, resized.blob);
  for (let index = 0; index < 30; index++) album.stage(photo(`capture-${index}`, 200 + index));
  const retained = await album.list();
  assert.equal(retained.length, 24);
  assert.equal(retained[0].id, 'capture-29');
  assert.equal(retained[23].id, 'capture-6');
});

test('a failed queued write cannot make an earlier save evict extra durable photographs', async t => {
  const existing = Array.from({length: 24}, (_, index) => photo(`saved-${index}`, index));
  const fixture = indexedDbFixture(existing, new Set(['later-quota-failure']));
  replaceGlobal(t, 'indexedDB', fixture.factory);
  const album = new ActivityAlbum();
  const successful = album.save(photo('first-new', 100));
  const failed = album.save(photo('later-quota-failure', 101));
  assert.deepEqual(await Promise.all([successful, failed]), [true, false]);
  assert.equal(fixture.rows().length, 24, 'one committed addition should evict exactly one previous photograph');
  assert(fixture.rows().some(item => item.id === 'saved-1'), 'future pending photos must not influence an earlier transaction');
  assert(fixture.rows().some(item => item.id === 'first-new'));
  assert(!fixture.rows().some(item => item.id === 'saved-0'));
  assert(!fixture.rows().some(item => item.id === 'later-quota-failure'));
  assert((await album.list()).some(item => item.id === 'later-quota-failure'), 'failed capture must remain downloadable this session');
  const reopened = new ActivityAlbum();
  assert.equal((await reopened.list()).length, 24, 'previous durable photographs survive a reload');
});

test('a quota abort preserves every previously saved photograph while the new capture stays in memory', async t => {
  const previous = photo('previous', 1), blocked = photo('blocked', 2);
  const fixture = indexedDbFixture([previous], new Set([blocked.id]));
  replaceGlobal(t, 'indexedDB', fixture.factory);
  const album = new ActivityAlbum();
  assert.equal(await album.save(blocked), false);
  assert.deepEqual(fixture.rows().map(item => item.id), ['previous']);
  assert.deepEqual((await album.list()).map(item => item.id), ['blocked', 'previous']);
});

test('invalid album records cannot break ordering or produce a broken download entry', async t => {
  replaceGlobal(t, 'indexedDB', undefined);
  const album = new ActivityAlbum();
  album.stage(photo('valid', 1));
  album.stage({...photo('invalid-time', 2), createdAt: NaN});
  album.stage({...photo('invalid-score', 2), score: Infinity});
  assert.equal(await album.save({...photo('empty', 2), blob: new Blob([])}), false);
  assert.deepEqual((await album.list()).map(item => item.id), ['valid']);
});

test('a connection opened after a blocked fallback is closed instead of leaked', async t => {
  let closed = 0;
  const request = {
    result: {close: () => { closed++; }},
    onsuccess: null as (() => void) | null,
    onblocked: null as (() => void) | null,
  };
  replaceGlobal(t, 'indexedDB', {open: () => { queueMicrotask(() => request.onblocked?.()); return request; }});
  const album = new ActivityAlbum();
  album.stage(photo('session-photo', 1));
  assert.equal((await album.list()).length, 1);
  request.onsuccess?.();
  assert.equal(closed, 1);
});

test('optional photo framing failures still download the original image with its actual extension', async t => {
  const original = photo('download', 1, new Blob(['original png'], {type: 'image/png'}));
  let downloaded: Blob | undefined, clicked = false, removed = false, revoked = false;
  const link = {href: '', download: '', click: () => { clicked = true; }, remove: () => { removed = true; }};
  replaceGlobal(t, 'createImageBitmap', async () => { throw new Error('Image decoder unavailable'); });
  replaceGlobal(t, 'document', {
    createElement: (tag: string) => { assert.equal(tag, 'a'); return link; },
    body: {append: (element: unknown) => assert.equal(element, link)},
  });
  replaceGlobal(t, 'URL', {
    createObjectURL: (blob: Blob) => { downloaded = blob; return 'blob:download'; },
    revokeObjectURL: () => { revoked = true; },
  });
  replaceGlobal(t, 'setTimeout', (callback: () => void) => { callback(); return 0; });
  await downloadAlbumPhoto(original, 'cyan');
  assert.equal(downloaded, original.blob);
  assert(link.download.endsWith('.png'));
  assert(clicked && removed && revoked);
});
