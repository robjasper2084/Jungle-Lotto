import {createRequire} from 'node:module';import {resolve} from 'node:path';import {writeFile,copyFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),tools=resolve(process.argv[2]),require=createRequire(resolve(root,'package.json')),esbuild=require('esbuild');
const sdk=resolve(tools,'node_modules/@supabase/realtime-js/src/index.ts'),out=resolve(root,'public/exports/polish');await mkdir(out,{recursive:true});
await esbuild.build({entryPoints:[sdk],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:resolve(out,'supabase-realtime-2.117.2.mjs'),minify:true,legalComments:'eof'});
await copyFile(resolve(tools,'node_modules/@supabase/realtime-js/LICENSE'),resolve(out,'supabase-realtime-LICENSE.txt'));console.log('Vendored official Supabase Realtime 2.117.2 for isolated game-room networking.');
