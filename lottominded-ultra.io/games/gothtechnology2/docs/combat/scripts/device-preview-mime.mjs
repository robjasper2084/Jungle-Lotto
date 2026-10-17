import {extname} from 'node:path';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.wasm':'application/wasm','.glb':'model/gltf-binary','.bin':'application/octet-stream','.gz':'application/gzip','.mp4':'video/mp4','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.hdr':'application/octet-stream','.exr':'application/octet-stream','.ktx2':'image/ktx2','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.txt':'text/plain'};
// Gzip files are compressed game payloads, not HTTP Content-Encoding. Keep
// executable/source/config formats outside this build-only allowlist.
export function previewContentType(file){return mime[extname(file).toLowerCase()];}
