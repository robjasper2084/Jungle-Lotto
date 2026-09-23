import {readFile,writeFile,mkdir,copyFile,readdir,rename,cp} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const source=resolve(process.argv[2]||'../../../../Digital_Static_Street_Asset_Pack/integrations/digital-static-ride');
const pack=resolve(source,'../..'),store=resolve(import.meta.dirname,'..'),out=resolve(store,'store/public/arcade/swoop-detroit');
if(dirname(out)!==resolve(store,'store/public/arcade'))throw Error('Unexpected build directory');
const require=createRequire(resolve(source,'package.json'));
const {build}=await import(pathToFileURL(require.resolve('vite')).href);
const bridge=await readFile(resolve(import.meta.dirname,'swoop-reward-bridge.ts'),'utf8');
function replace(code,from,to){if(!code.includes(from))throw Error('Elmwood source changed: '+from.slice(0,70));return code.replace(from,to);}
await build({root:source,configFile:false,base:'./',publicDir:false,plugins:[{
 name:'swoop-store',enforce:'pre',
 transform(code,id){id=id.replaceAll('\\','/');if(!id.includes('/src/'))return;code=code.replaceAll('\r\n','\n');
  code=code.replace(/(['"`])\/(exports|textures|audio)\//g,'$1./$2/');
  if(id.endsWith('/detroit/main.ts')){
   code=replace(code,"const elmwood=new URLSearchParams(location.search).get('map')==='elmwood';","const elmwood=false;");
   code=replace(code,"document.querySelector('.options')!.prepend(mapChooser());$('mapPanel').querySelector('h2')!.after(mapChooser());",'');
   code=replace(code,'let ready=false,','let rewardRunId=crypto.randomUUID(),rewardEngaged=false,rewardBaseline=0;\nlet ready=false,');
   code=replace(code,"try{muted=localStorage.getItem('digital-static-ride-sound')==='off';}catch{}",'muted=false;');
   code=replace(code,'function reset(spot=selectedSpot,station?:number){','function reset(spot=selectedSpot,station?:number){\n void (window as any).GothGameRewardFlush?.(swoopReceipt());rewardRunId=crypto.randomUUID();rewardEngaged=false;rewardBaseline=0;');
   code=replace(code,'if(running&&!paused&&!finished){\n    acc+=dt;',`if(running&&!paused&&!finished){
    if(!rewardEngaged&&(Math.abs(throttle)>.01||Math.abs(steer)>.01||crouch||hop||touch.hopHeld||gp.hopHeld||xp.hopHeld||trickRequest)){rewardEngaged=true;rewardBaseline=score;}
    acc+=dt;`);
   code+=bridge;
  }
  if(id.endsWith('/elmwoodScenery.ts'))code=replace(code,'time.value=t;','time.value=document.documentElement.dataset.reducedMotion==="true"||matchMedia("(prefers-reduced-motion: reduce)").matches||new URLSearchParams(location.search).has("reducedMotion")?0:t;');
  if(id.endsWith('/scenery.ts'))code=replace(code,'treeTime.value=time;','treeTime.value=document.documentElement.dataset.reducedMotion==="true"||matchMedia("(prefers-reduced-motion: reduce)").matches?0:time;');
  return code;
 },
 transformIndexHtml(html){return html.replace(/<p class="hint"><a href="\.\/rider-studio.html"[\s\S]*?<\/p>/,'').replace('</head>','<meta name="goth-reward-game" content="swoop-detroit"><style>button:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid #dec57c;outline-offset:3px}button{min-height:44px}@media(min-width:1025px) and (pointer:fine){.session{bottom:85px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}</style></head>').replace('</body>','<script type="module" src="../reward-tracker.js"></script><script type="module" src="../swoop-store-return.js"></script></body>');}
}],build:{outDir:out,emptyOutDir:true,target:'es2022',rollupOptions:{input:resolve(source,'detroit.html')}}});
await rename(resolve(out,'detroit.html'),resolve(out,'index.html'));
const files=[];
for(const dir of ['exports/architecture','exports/cut','textures/architecture','textures/cut','textures/trees','textures/realistic'])for(const name of await readdir(resolve(pack,dir)))if(/\.(glb|png|jpg|hdr)$/i.test(name)&&!(dir==='textures/cut'&&name.endsWith('.png'))&&!(dir==='exports/architecture'&&!['DS_Detroit_Globe_OAC.glb','DS_Detroit_Shed_3.glb'].includes(name)))files.push(dir+'/'+name);
for(const id of ['DS_Man_01','DS_EUC_01','DS_Boerboel_01','DS_Pedestrian_01','DS_Cyclist_01','DS_Bicycle_01','DS_Hazard_Cone_01','DS_Hazard_Barrier_01','DS_Hoodie_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01'])files.push(`exports/glb/${id}/${id}_LOD${id==='DS_Man_01'?0:1}.glb`);
for(const id of ['DS_Segway_01','DS_InlineSkate_01'])files.push(`exports/mobility/${id}.glb`);
for(const file of files){const target=resolve(out,file);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(pack,file),target);}
await cp(resolve(pack,'audio/swoop'),resolve(out,'audio/swoop'),{recursive:true});
await cp(resolve(pack,'detroit/geospatial'),resolve(out,'geospatial'),{recursive:true});
await writeFile(resolve(out,'SOURCE.md'),'Digital Static Ride Detroit, supplied via Digital_Static_Street_Asset_Pack/integrations/digital-static-ride. Dequindre Cut map selected; original riding, rider, dog, touch, controller and physics retained. Built by scripts/build-swoop-detroit.mjs without changing the source project. Store additions: portable assets, sound enabled by default, reduced-motion scenery, shared discount-preview receipts for native earned scores. Reference geometry and placement remain approximate as disclosed by the game.\n');
console.log('Packaged Swoop Detroit: '+files.length+' assets');
