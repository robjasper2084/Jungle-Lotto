import {readFile,readdir,unlink} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
const product='lottominded-ultra.io/games/gothtechnology2';
/** Only the artifact copy is reduced. Editable source and exact committed binaries remain. */
export async function shareBelleAssets(root,options={}){
 const game=options.game??resolve(root,product,'arcade/belle-isle-explorer');
 const pins=options.pins??JSON.parse(await readFile(new URL('../'+product+'/belle-isle-source/game/src/belle/assetPins.json',import.meta.url),'utf8'));
 if(!/^[a-f0-9]{40}$/.test(pins.commit)||!pins.base.includes('/'+pins.commit+'/')||!pins.base.startsWith('https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/'))throw Error('Belle Isle requires immutable first-party asset pins');
 const chunks=await readdir(resolve(game,'assets'));let runtime='';for(const file of chunks.filter(f=>f.endsWith('.js')))runtime+=await readFile(resolve(game,'assets',file),'utf8');
 if(!runtime.includes(pins.base))throw Error('Belle Isle asset resolver missing from built runtime');
 const files=[];for(const entry of pins.files){const file=resolve(game,entry.path);if(!file.startsWith(resolve(game)+sep))throw Error('Unsafe Belle Isle asset path');
  const bytes=await readFile(file);if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Pinned Belle Isle asset changed: '+entry.path);
  files.push({file,bytes:bytes.length});
 }
 // All integrity and resolver checks finish before any artifact file is removed.
 for(const entry of files)await unlink(entry.file);
 const saved=files.reduce((sum,f)=>sum+f.bytes,0);console.log('Shared exact Belle Isle assets: '+(saved/1048576).toFixed(1)+' MiB.');return{saved,files:files.length,source:pins.base};
}
