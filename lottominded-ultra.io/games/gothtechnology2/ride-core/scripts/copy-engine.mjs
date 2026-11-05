import {copyFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await mkdir(new URL('dist/engine/',root),{recursive:true});
await copyFile(new URL('src/engine/breadflower.wasm',root),new URL('dist/engine/breadflower.wasm',root));
