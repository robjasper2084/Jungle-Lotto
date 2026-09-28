import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

// Reuse identical Elmwood textures in the published Swoop models. Source models
// and standalone previews stay intact; geometry, skinning and pixels are unchanged.
export function shareModelTextures(input, modelPath, textures) {
  if (input.readUInt32LE(0) !== 0x46546c67) throw new Error('Expected GLB');
  const jsonLength = input.readUInt32LE(12);
  const gltf = JSON.parse(input.toString('utf8', 20, 20 + jsonLength));
  const binary = input.subarray(28 + jsonLength);
  const removed = new Set();
  for (const image of gltf.images ?? []) {
    if (image.bufferView === undefined) continue;
    const view = gltf.bufferViews[image.bufferView];
    const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const target = textures.get(hash);
    if (!target || target.mime !== image.mimeType) continue;
    removed.add(image.bufferView);
    delete image.bufferView;
    image.uri = relative(dirname(modelPath), target.path).replaceAll('\\', '/');
  }
  if (!removed.size) return input;
  const views = [], chunks = [], remap = new Map();
  let offset = 0;
  for (const [index, view] of gltf.bufferViews.entries()) {
    if (removed.has(index)) continue;
    remap.set(index, views.length);
    const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4);
    bytes.copy(padded);
    views.push({ ...view, byteOffset: offset });
    chunks.push(padded);
    offset += padded.length;
  }
  gltf.bufferViews = views;
  function remapViews(node) {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'bufferView') {
        if (!remap.has(value)) throw new Error('Texture buffer is also used by model data');
        node[key] = remap.get(value);
      } else remapViews(value);
    }
  }
  remapViews(gltf);
  gltf.buffers[0].byteLength = offset;
  const json = Buffer.from(JSON.stringify(gltf));
  const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
  json.copy(paddedJson);
  const result = Buffer.alloc(28 + paddedJson.length + offset);
  result.writeUInt32LE(0x46546c67, 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(paddedJson.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  paddedJson.copy(result, 20);
  result.writeUInt32LE(offset, 20 + paddedJson.length);
  result.writeUInt32LE(0x004e4942, 24 + paddedJson.length);
  Buffer.concat(chunks).copy(result, 28 + paddedJson.length);
  return result;
}

export async function shareRideTextures(outputRoot) {
  const arcade = resolve(outputRoot, 'lottominded-ultra.io/games/gothtechnology2/arcade');
  const canonical = resolve(arcade, 'elmwood-explorer/shared-textures');
  const textures = new Map();
  for (const entry of await readdir(canonical, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isFile() || !/\.(png|jpg)$/.test(entry.name)) continue;
    const path = resolve(canonical, entry.name);
    const hash = createHash('sha256').update(await readFile(path)).digest('hex');
    textures.set(hash, { path, mime: entry.name.endsWith('.png') ? 'image/png' : 'image/jpeg' });
  }
  let saved = 0, models = 0;
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.glb')) {
        const input = await readFile(path);
        const output = shareModelTextures(input, path, textures);
        if (output.length >= input.length) continue;
        await writeFile(path, output);
        saved += input.length - output.length;
        models++;
      }
    }
  }
  await walk(resolve(arcade, 'swoop-detroit'));
  console.log(`Shared identical ride textures in ${models} models; saved ${(saved / 1048576).toFixed(1)} MiB.`);
  return { saved, models };
}
