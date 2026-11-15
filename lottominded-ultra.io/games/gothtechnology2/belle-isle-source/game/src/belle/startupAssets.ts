import { LoaderUtils } from 'three';
import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gunzip } from 'fflate';
import paths from './startupAssets.json' with { type: 'json' };

const packedPaths = new Set(paths.map(path => './' + path));

function packedUrl(path: string) {
  const [pathname, search] = path.split('?');
  if (!import.meta.env.PROD || !packedPaths.has(pathname)) return undefined;
  return pathname + '.gz' + (search === undefined ? '' : '?' + search);
}

async function loadBytes(path: string, packed: boolean) {
  const response = await fetch(path);
  if (!response.ok) throw Error('Startup asset unavailable: ' + path + ' (' + response.status + ')');
  const bytes = await response.arrayBuffer();
  const prefix = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
  // Some hosts already unpack gzip assets via HTTP Content-Encoding.
  if (!packed || prefix[0] !== 0x1f || prefix[1] !== 0x8b) return bytes;
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }
  // Older browsers unpack in a worker so the loading screen remains responsive.
  const unpacked = await new Promise<Uint8Array>((resolve, reject) => {
    gunzip(new Uint8Array(bytes), (error, data) => error ? reject(error) : resolve(data));
  });
  return Uint8Array.from(unpacked).buffer;
}

export function loadStartupBytes(path: string) {
  const packed = packedUrl(path);
  return loadBytes(packed ?? path, !!packed);
}

export async function loadStartupModel(loader: GLTFLoader, path: string) {
  const packed = packedUrl(path);
  if (!packed) return loader.loadAsync(path);
  const bytes = await loadBytes(packed, true);
  return loader.parseAsync(bytes, LoaderUtils.extractUrlBase(path));
}
