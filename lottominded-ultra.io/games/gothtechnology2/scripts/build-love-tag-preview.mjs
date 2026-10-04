import {prepareSwoop} from './build-swoop-detroit.mjs';
import {prepareElmwood} from './build-elmwood-explorer.mjs';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..');
const swoop=await prepareSwoop(),elmwood=await prepareElmwood(undefined,swoop.soundtrackRoot);
for(const plan of [swoop,elmwood]){const out=resolve(root,'.game-builds/love-tag-review',plan.name);await mkdir(out,{recursive:true});await plan.build(out);}
await writeFile(resolve(root,'.game-builds/love-tag-review/receipt.json'),JSON.stringify({at:new Date().toISOString(),scope:'local review only; no original or live outputs promoted',products:[swoop.name,elmwood.name]},null,2));
