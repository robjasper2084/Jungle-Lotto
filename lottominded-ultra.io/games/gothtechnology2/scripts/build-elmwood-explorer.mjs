import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const source=resolve(process.argv[2]||'../../../../euc-detroit-riverwalk'),store=resolve(import.meta.dirname,'..'),out=resolve(store,'store/public/arcade/elmwood-explorer');
if(dirname(out)!==resolve(store,'store/public/arcade'))throw Error('Unexpected build directory');
const require=createRequire(resolve(source,'package.json')),{build}=await import(pathToFileURL(require.resolve('vite')).href);
const css=await readFile(resolve(import.meta.dirname,'elmwood-explorer-embed.css'),'utf8'),js=await readFile(resolve(import.meta.dirname,'elmwood-explorer-embed.js'),'utf8');
await build({root:source,configFile:false,base:'./',publicDir:false,plugins:[{name:'elmwood-explorer-store',enforce:'pre',
 transform(code,id){id=id.replaceAll('\\','/');if(!id.includes('/src/'))return;
  code=code.replace(/(['"`])\/elmwood\//g,'$1./elmwood/');
  if(id.endsWith('/elmwood-ride.ts')){if(!code.includes('return {stop,update'))throw Error('Ride API changed');code=code.replace('return {stop,update','return {stop,pause,update');}
  if(id.endsWith('/elmwood.ts')){code=code.replace('wind.value=t;','wind.value=matchMedia("(prefers-reduced-motion: reduce)").matches||new URLSearchParams(location.search).has("reducedMotion")?0:t;');code+='\n(window as any).RahbeArcadeGame={get ready(){return el("detail").dataset.loaded==="true";},pause(){rideControls?.pause(true);}};';}
  return code;
 },
 transformIndexHtml(html){return html.replaceAll('"/elmwood/','"./elmwood/').replace('<a href="/">Return to Detroit ride</a>','<a href="../../collections/#elmwood" target="_top">Back to Collections</a>').replace('</head>',`<style>${css}</style></head>`).replace('</body>',`<script>${js}</script></body>`);}
}],build:{outDir:out,emptyOutDir:true,target:'es2022',rollupOptions:{input:resolve(source,'elmwood.html'),output:{banner:'/*! EUC Thrills (c) 2026 VibezZzCoder, MIT. Digital Static adaptation and RideCore. */'}}}});
const assets=JSON.parse(await readFile(resolve(source,'public/elmwood/asset-manifest.json'),'utf8'));
const files=new Set(['elmwood/asset-manifest.json','elmwood/placements.json','elmwood/terrain.json','elmwood/site.json','elmwood/placement-audit.json','elmwood/forest_grove_2k.hdr','elmwood/Elmwood_Map_Audit.kml','elmwood/map-audit.png','elmwood/cemetery-plan.png','elmwood/reference-gallery.html','elmwood/models/elmwood-foundation.glb',...assets.map(a=>'elmwood/models/'+(a.id==='flying-geese-study'?'flying-geese-baked':a.id)+'.glb'),'exports/glb/DS_Man_01/DS_Man_01_LOD0.glb','exports/glb/DS_EUC_01/DS_EUC_Compact.glb',...['suit','hoodie','euc'].map(id=>`circuit-riders/models/circuit-${id}.glb`)]);
async function collect(dir){for(const item of await readdir(resolve(source,'public',dir),{withFileTypes:true})){const file=dir+'/'+item.name;if(item.isDirectory())await collect(file);else files.add(file);}}await collect('elmwood/references');
const textures=new Set();let total=0;
for(const file of files){const target=resolve(out,file),input=await readFile(resolve(source,'public',file));await mkdir(dirname(target),{recursive:true});
 if(!file.endsWith('.glb')){const data=file.endsWith('reference-gallery.html')?Buffer.from(input.toString().replaceAll('"/elmwood/','"./')):input;await writeFile(target,data);total+=data.length;continue;}
 const jsonLength=input.readUInt32LE(12),gltf=JSON.parse(input.toString('utf8',20,20+jsonLength)),bin=input.subarray(28+jsonLength),removed=new Set();
 for(const img of gltf.images??[]){if(img.bufferView===undefined)continue;const view=gltf.bufferViews[img.bufferView],data=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),hash=createHash('sha256').update(data).digest('hex'),ext=img.mimeType==='image/jpeg'?'jpg':img.mimeType==='image/png'?'png':null;if(!ext)throw Error('Unsupported image');
 const texture=resolve(out,'shared-textures',hash+'.'+ext);if(!textures.has(texture)){await mkdir(dirname(texture),{recursive:true});await writeFile(texture,data);textures.add(texture);total+=data.length;}removed.add(img.bufferView);delete img.bufferView;img.uri=relative(dirname(target),texture).replaceAll('\\','/');}
 const remap=new Map(),views=[],chunks=[];let offset=0;
 for(const [i,v]of gltf.bufferViews.entries()){if(removed.has(i))continue;remap.set(i,views.length);const bytes=bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);views.push({...v,byteOffset:offset});const padded=Buffer.alloc(Math.ceil(bytes.length/4)*4);bytes.copy(padded);chunks.push(padded);offset+=padded.length;}
 gltf.bufferViews=views;function remapViews(o){if(!o||typeof o!=='object')return;for(const [key,value]of Object.entries(o)){if(key==='bufferView'){if(!remap.has(value))throw Error('Removed referenced buffer view');o[key]=remap.get(value);}else remapViews(value);}}remapViews(gltf);
 gltf.buffers[0].byteLength=offset;const json=Buffer.from(JSON.stringify(gltf)),paddedJson=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(paddedJson);const binary=Buffer.concat(chunks),result=Buffer.alloc(28+paddedJson.length+binary.length);result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(paddedJson.length,12);result.writeUInt32LE(0x4e4f534a,16);paddedJson.copy(result,20);result.writeUInt32LE(binary.length,20+paddedJson.length);result.writeUInt32LE(0x004e4942,24+paddedJson.length);binary.copy(result,28+paddedJson.length);await writeFile(target,result);total+=result.length;
}
await copyFile(resolve(source,'LICENSE'),resolve(out,'LICENSE-EUC-Thrills.txt'));await copyFile(resolve(source,'../Digital_Static_RideCore/LICENSE.txt'),resolve(out,'LICENSE-RideCore.txt'));
await writeFile(resolve(out,'SOURCE.md'),'Original Elmwood exploration scene supplied from euc-detroit-riverwalk at localhost:8198/elmwood.html. Source remains unchanged. EUC Thrills by VibezZzCoder (MIT), Digital Static adaptation and RideCore. Built using scripts/build-elmwood-explorer.mjs. Shared textures retain identical bytes. Store additions: portable paths, popup ready/pause API, reduced-motion wind, responsive settings and touch controls. This scene has no native reward score.\n');
console.log(JSON.stringify({files:files.size,textures:textures.size,megabytes:Math.round(total/1048576)}));
