import {readFile,readdir,unlink} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {shareBelleMusic} from './share-belle-music.mjs';
const product='lottominded-ultra.io/games/gothtechnology2';
/** Only the artifact copy is reduced. Editable source and exact committed binaries remain. */
export async function shareBelleAssets(root,options={}){
 const game=options.game??resolve(root,product,'arcade/belle-isle-explorer');
 const pinSets=options.pinSets??(options.pins?[options.pins]:await Promise.all(['assetPins.json','vehicles/assetPins.json','cadillacHeroPins.json'].map(file=>readFile(new URL('../'+product+'/belle-isle-source/game/src/belle/'+file,import.meta.url),'utf8').then(JSON.parse))));
 const chunks=await readdir(resolve(game,'assets'));let runtime='';for(const file of chunks.filter(f=>f.endsWith('.js')))runtime+=await readFile(resolve(game,'assets',file),'utf8');
 const files=[],seen=new Set();for(const pins of pinSets){
 if(!/^[a-f0-9]{40}$/.test(pins.commit)||!pins.base.includes('/'+pins.commit+'/')||!pins.base.startsWith('https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/'))throw Error('Belle Isle requires immutable first-party asset pins');
 if(!runtime.includes(pins.base))throw Error('Belle Isle asset resolver missing from built runtime');
 for(const entry of pins.files){const file=resolve(game,entry.path);if(!file.startsWith(resolve(game)+sep))throw Error('Unsafe Belle Isle asset path');
  if(seen.has(file))throw Error('Duplicate Belle Isle asset pin: '+entry.path);seen.add(file);
  const bytes=await readFile(file);if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Pinned Belle Isle asset changed: '+entry.path);
  files.push({file,bytes:bytes.length});
 }}
 // Music verifies all canonical bytes before its opt-in marker and removal.
 const music=await shareBelleMusic(game);
 // All integrity and resolver checks finish before any artifact model is removed.
 for(const entry of files)await unlink(entry.file);
 const modelBytes=files.reduce((sum,f)=>sum+f.bytes,0);
 console.log('Shared exact Belle Isle assets: '+((modelBytes+music.saved)/1048576).toFixed(1)+' MiB.');
 return{saved:modelBytes+music.saved,files:files.length+music.files,source:pinSets[0].base,sources:pinSets.map(pins=>pins.base),music};
}
