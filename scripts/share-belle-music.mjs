import {readFile,readdir,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const marker='<meta name="belle-music-base" content="../swoop-detroit/">';
const gitBlob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
/** Pages-only deduplication. Standalone builds and both games' source stay intact.
 * The browser opts into the canonical same-origin sibling via an HTML marker;
 * compiled, hashed scripts are never rewritten.
 */
export async function shareBelleMusic(game){
 const directory=resolve(game,'audio/swoop');
 let names;
 try{names=await readdir(directory);}catch(error){if(error.code==='ENOENT')return{files:0,saved:0};throw error;}
 const provenance=JSON.parse(await readFile(resolve(directory,'belle-audio-provenance.json'),'utf8'));
 if(!Array.isArray(provenance.tracks)||!provenance.tracks.length)throw Error('Missing Belle music provenance');
 const expected=new Set();
 for(const track of provenance.tracks){
  if(!/^track-\d{2}\.mp3$/.test(track.file)||expected.has(track.file)||!Number.isSafeInteger(track.bytes)||track.bytes<=0||!/^[a-f0-9]{40}$/.test(track.gitBlob))throw Error('Invalid Belle music provenance');
  expected.add(track.file);
 }
 const entry=resolve(game,'index.html'),html=await readFile(entry,'utf8');
 if(!html.includes('</head>')||/<base\b/i.test(html))throw Error('Unsupported Belle music document base');
 const alreadyShared=html.includes(marker);
 if(/name=["']belle-music-base["']/.test(html)&&!alreadyShared)throw Error('Conflicting Belle music base');
 const mp3=names.filter(name=>name.endsWith('.mp3'));
 if(mp3.some(name=>!expected.has(name))||(!alreadyShared&&mp3.length!==expected.size))throw Error('Belle music file set differs from provenance');
 let runtime='';
 for(const file of (await readdir(resolve(game,'assets'))).filter(name=>name.endsWith('.js')))runtime+=await readFile(resolve(game,'assets',file),'utf8');
 if(!runtime.includes('belle-music-base')||!runtime.includes('../swoop-detroit/'))throw Error('Belle shared-music resolver missing from runtime');
 const remove=[];
 for(const track of provenance.tracks){
  const canonical=await readFile(resolve(game,'../swoop-detroit/audio/swoop',track.file));
  if(canonical.length!==track.bytes||gitBlob(canonical)!==track.gitBlob)throw Error('Canonical Swoop music changed: '+track.file);
  if(mp3.includes(track.file)){
   const path=resolve(directory,track.file),copy=await readFile(path);
   if(!copy.equals(canonical))throw Error('Belle music differs from Swoop: '+track.file);
   remove.push({path,bytes:copy.length});
  }
 }
 // Complete every identity/path/resolver check before changing the artifact.
 const output=alreadyShared?html:html.replace('</head>',marker+'\n</head>');
 if(output!==html)await writeFile(entry,output);
 for(const item of remove)await unlink(item.path);
 const saved=remove.reduce((sum,item)=>sum+item.bytes,0)-Buffer.byteLength(output)+Buffer.byteLength(html);
 console.log(`Shared ${remove.length} exact Belle soundtrack files; saved ${(saved/1048576).toFixed(1)} MiB.`);
 return{files:remove.length,saved,base:'../swoop-detroit/'};
}
