import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';

// Only generated, content-hashed Vite assets are candidates. Source packages
// remain untouched, and every non-candidate file is a reachability root.
export async function pruneRidingBundles(files, read = file => readFile(file.source, 'utf8')) {
  const candidate = file => /\/arcade\/(?:swoop-detroit|elmwood-explorer)\/assets\/[^/]+-[\w-]{8}\.(?:js|css|png|jpe?g|webp|hdr|mp4|wasm|glb)$/.test(file.path);
  const text = file => /\.(?:html|js|mjs|css|json|webmanifest)$/.test(file.path);
  const generated = files.filter(candidate), byName = new Map();
  for (const file of generated) {
    const name = basename(file.path);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(file);
  }
  const keep = new Set(), queue = files.filter(file => !candidate(file) && text(file));
  while (queue.length) {
    const file = queue.pop(), content = file.content ?? await read(file);
    for (const name of new Set(content.match(/[A-Za-z0-9_@-]+\.[A-Za-z0-9]+/g) ?? [])) {
      for (const asset of byName.get(name) ?? []) {
        if (keep.has(asset)) continue;
        keep.add(asset);
        if (text(asset)) queue.push(asset);
      }
    }
  }
  const omitted = generated.filter(file => !keep.has(file));
  const saved = omitted.reduce((n, file) => n + file.bytes, 0);
  console.log(`Omitted ${omitted.length} unreachable riding bundles; saved ${(saved / 1048576).toFixed(1)} MiB. Source packages retained.`);
  return {files:files.filter(file => !candidate(file) || keep.has(file)), saved, omitted};
}
