import {readFile,writeFile,mkdir,copyFile,readdir,rename,cp} from 'node:fs/promises';
import {buildRelease,readableTree,runtimeLicenses,modelDependencies} from './game-package.mjs';
import {resolve,dirname,basename} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {syncLottoComponents} from '../swoop-source/scripts/sync_lotto_components.mjs';
export async function prepareSwoop(source=resolve(import.meta.dirname,'../swoop-source'),pack=process.env.SWOOP_ASSET_PACK||resolve(import.meta.dirname,'../../../../../Digital_Static_Street_Asset_Pack')){
source=resolve(source);pack=resolve(pack);
await syncLottoComponents(source);
const require=createRequire(resolve(source,'package.json'));
const {build}=await import(pathToFileURL(require.resolve('vite')).href);
await readableTree(resolve(source,'public/love-tag/swoop-detroit.json.gz'));
const bridge=await readFile(resolve(import.meta.dirname,'swoop-reward-bridge.ts'),'utf8');
function replace(code,from,to){if(!code.includes(from))throw Error('Elmwood source changed: '+from.slice(0,70));return code.replace(from,to);}
const files=[];
files.push('exports/glb/DS_Bicycle_Styles/DS_Bicycle_Styles_LOD1.glb','exports/glb/DS_Bicycle_Styles/manifest.json');
for(const dir of ['exports/architecture','exports/cut','textures/architecture','textures/cut','textures/trees','textures/realistic'])for(const name of await readdir(resolve(pack,dir)))if(/\.(glb|png|jpg|hdr)$/i.test(name)&&!(dir==='textures/cut'&&name.endsWith('.png'))&&!(dir==='exports/architecture'&&!['DS_Detroit_Globe_OAC.glb','DS_Detroit_Shed_3.glb'].includes(name)))files.push(dir+'/'+name);
for(const id of ['DS_Man_01','DS_EUC_01','DS_Boerboel_01','DS_Pedestrian_01','DS_Cyclist_01','DS_Bicycle_01','DS_Hazard_Cone_01','DS_Hazard_Barrier_01','DS_Hoodie_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01'])files.push(`exports/glb/${id}/${id}_LOD${id==='DS_Man_01'?0:1}.glb`);
// New source-authored riders are not part of the original external asset pack.
const sourceFiles=[...['talaria','ultra','sr','varg'].map(id=>'exports/electric/Ebike_'+id+'.glb'),...['city','tour','trail','speed'].map(id=>'exports/electric/Euc_'+id+'.glb'),'exports/electric/NOTICE.md','exports/glb/DS_Armored_Rider_01/DS_Armored_Rider_01_LOD1.glb'];
sourceFiles.push('art/loading-trailer.mp4','art/loading-trailer-poster.webp',...['serengeti','lottomind','penny-auction'].flatMap(id=>['art/entrances/'+id+'.mp4','art/entrances/'+id+'.webp']));
sourceFiles.push(...await modelDependencies(resolve(source,'public'),sourceFiles));
for(const file of sourceFiles)await readableTree(resolve(source,'public',file));
for(const id of ['DS_Segway_01','DS_InlineSkate_01'])files.push(`exports/mobility/${id}.glb`);
// Check all inputs before touching the previous working package.
files.push(...await modelDependencies(pack,files));
for(const file of files)await readableTree(resolve(pack,file));
for(const dir of ['audio/swoop','detroit/geospatial'])await readableTree(resolve(pack,dir));
for(const file of ['exports/boutique','exports/gallery','exports/scooter','exports/atwater','exports/polish','exports/visitors','exports/waterfront','exports/street-furniture','exports/valade','mural-credits.html','manifest.webmanifest','touch-icon.png'])await readableTree(resolve(source,'public',file));
const licenses=await runtimeLicenses(source);licenses.push({input:resolve(source,'node_modules/@digital-static/ridecore/LICENSE.txt'),output:'LICENSE-RideCore.txt'});
licenses.push({input:resolve(source,'src/vendor/LICENSE-hls.js.txt'),output:'LICENSE-hls.js.txt'});
await readableTree(resolve(source,'node_modules/@digital-static/ridecore/LICENSE.txt'));
await readableTree(resolve(pack,'detroit/licenses'));
return {name:'swoop-detroit',entry:'index.html',source,soundtrackRoot:resolve(pack,'audio/swoop'),async build(out){
await build({root:source,configFile:false,base:'./',publicDir:false,resolve:{dedupe:['three','@dimforge/rapier3d-compat']},plugins:[{
 name:'swoop-store',enforce:'pre',
 transform(code,id){id=id.replaceAll('\\','/');if(!id.includes('/src/'))return;code=code.replaceAll('\r\n','\n');
  code=code.replace(/(['"`])\/(exports|textures|audio)\//g,'$1./$2/');
  if(id.endsWith('/detroit/main.ts')){
   // The published map chooser routes to the separate Explorer before this module runs.
   code=replace(code,"const elmwood=new URLSearchParams(location.search).get('map')==='elmwood';",'const elmwood=false;');
   code=replace(code,'let ready=false,','let rewardRunId=crypto.randomUUID(),rewardEngaged=false,rewardBaseline=0;\nlet ready=false,');
   code=replace(code,'function reset(spot=selectedSpot,station?:number){','function reset(spot=selectedSpot,station?:number){\n void (window as any).GothGameRewardFlush?.(swoopReceipt());rewardRunId=crypto.randomUUID();rewardEngaged=false;rewardBaseline=0;');
   code=replace(code,'if(running&&!paused&&!finished){\n    acc+=dt;',`if(running&&!paused&&!finished){
    if(!rewardEngaged&&(Math.abs(throttle)>.01||Math.abs(steer)>.01||crouch||hop||touch.hopHeld||gp.hopHeld||xp.hopHeld||trickRequest)){rewardEngaged=true;rewardBaseline=score;}
    acc+=dt;`);
   code+=bridge;
  }
  if(id.endsWith('/elmwoodScenery.ts'))code=replace(code,'time.value=t;','time.value=document.documentElement.dataset.reducedMotion==="true"||matchMedia("(prefers-reduced-motion: reduce)").matches||new URLSearchParams(location.search).has("reducedMotion")?0:t;');
  if(id.endsWith('/scenery.ts'))code=replace(code,"treeTime.value=document.documentElement.dataset.renderQuality==='compact'?0:time;",'treeTime.value=document.documentElement.dataset.renderQuality==="compact"||document.documentElement.dataset.reducedMotion==="true"||matchMedia("(prefers-reduced-motion: reduce)").matches?0:time;');
  return code;
 },
 transformIndexHtml(html,ctx){if(!ctx.path.endsWith("detroit.html"))return html.replaceAll("./detroit.html","./index.html");return html.replace('<head>', '<head><script>if(new URLSearchParams(location.search).get("map")==="elmwood")location.replace(new URL("../elmwood-explorer/elmwood.html",location.href).href);</script>').replaceAll('\r\n','\n').replace(/<p class="hint"><a href="\.\/rider-studio.html"[\s\S]*?<\/p>/,'').replace('</head>','<meta name="goth-reward-game" content="swoop-detroit"><style>button:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid #dec57c;outline-offset:3px}button{min-height:44px}@media(min-width:1025px) and (pointer:fine){.session{bottom:85px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}</style></head>').replace('</body>','<script type="module" src="../reward-tracker.js"></script><script type="module" src="../swoop-store-return.js"></script></body>');}
}],build:{outDir:out,emptyOutDir:true,target:'es2022',rollupOptions:{input:Object.fromEntries(['detroit','rider-studio','companion-studio','traffic-studio'].map(name=>[name,resolve(source,name+'.html')]))}}});
await rename(resolve(out,'detroit.html'),resolve(out,'index.html'));
for(const file of files){const target=resolve(out,file);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(pack,file),target);}
for(const file of sourceFiles){const target=resolve(out,file);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(source,'public',file),target);}
await cp(resolve(source,'public/exports/boutique'),resolve(out,'exports/boutique'),{recursive:true});
await cp(resolve(source,'public/exports/gallery'),resolve(out,'exports/gallery'),{recursive:true});
await cp(resolve(source,'public/exports/scooter'),resolve(out,'exports/scooter'),{recursive:true});
await cp(resolve(source,'public/exports/atwater'),resolve(out,'exports/atwater'),{recursive:true});
await cp(resolve(source,'public/exports/waterfront'),resolve(out,'exports/waterfront'),{recursive:true});
await cp(resolve(source,'public/exports/street-furniture'),resolve(out,'exports/street-furniture'),{recursive:true});
await cp(resolve(source,'public/exports/valade'),resolve(out,'exports/valade'),{recursive:true});
await cp(resolve(source,'public/exports/polish'),resolve(out,'exports/polish'),{recursive:true,filter:file=>basename(file)!=='swoop-intro-30.mp4'});
await cp(resolve(source,'public/exports/visitors'),resolve(out,'exports/visitors'),{recursive:true});
await copyFile(resolve(source,'public/mural-credits.html'),resolve(out,'mural-credits.html'));
for(const file of ['manifest.webmanifest','touch-icon.png'])await copyFile(resolve(source,'public',file),resolve(out,file));
// Removed by request: Digital static (2). Preserve the original asset pack.
await cp(resolve(pack,'audio/swoop'),resolve(out,'audio/swoop'),{recursive:true,filter:file=>!['track-12.mp3','catalog.json'].includes(basename(file))});
const soundtrackCatalog=JSON.parse(await readFile(resolve(pack,'audio/swoop/catalog.json'),'utf8'));
await writeFile(resolve(out,'audio/swoop/catalog.json'),JSON.stringify(soundtrackCatalog.filter(track=>track.id!=='track-12'),null,2)+'\n');
await cp(resolve(pack,'detroit/geospatial'),resolve(out,'geospatial'),{recursive:true});
// The canonical Swoop JSON exceeds GitHub's blob limit. Both modern and older
// browsers decode the same gzip fixture; authoring JSON stays outside release.
await cp(resolve(source,'public/love-tag'),resolve(out,'love-tag'),{recursive:true,filter:file=>!['swoop-detroit.json','elmwood-explorer.json'].includes(basename(file))});
await cp(resolve(source,'public/exports/nature'),resolve(out,'exports/nature'),{recursive:true});
await cp(resolve(source,'public/audio/nature'),resolve(out,'audio/nature'),{recursive:true});
await writeFile(resolve(out,'SOURCE.md'),'Digital Static Ride Detroit, supplied via Digital_Static_Street_Asset_Pack/integrations/digital-static-ride. Dequindre Cut with navigation to the separately packaged Elmwood Explorer; original riding, rider, dog, touch, controller and physics retained. Built by scripts/build-swoop-detroit.mjs from versioned swoop-source; original external asset pack remains unchanged. Store additions: portable assets, saved sound preference respected, reduced-motion scenery, shared discount-preview receipts for native earned scores. Reference geometry and placement remain approximate as disclosed by the game.\n');
console.log('Packaged Swoop Detroit: '+files.length+' assets');

for(const file of licenses){const target=resolve(out,file.output);await mkdir(dirname(target),{recursive:true});await copyFile(file.input,target);}
await cp(resolve(pack,'detroit/licenses'),resolve(out,'licenses/original-asset-pack'),{recursive:true});
}};
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){
 const args=process.argv.slice(2).filter(a=>!a.startsWith("--"));
 const plan=await prepareSwoop(args[0],args[1]);
 if(!process.argv.includes('--preflight'))await buildRelease(resolve(import.meta.dirname,'..'),[plan]);
 else console.log('Swoop preflight passed');
}
