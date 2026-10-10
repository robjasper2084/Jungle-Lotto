import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
const source=resolve(import.meta.dirname,'../../../../../swoop-detroit-bloom-unity/Builds/WebGL');
const target=resolve(import.meta.dirname,'../swoop-source/public/exports/jazz-stage');
await mkdir(target,{recursive:true});
for(const name of ['Build','StreamingAssets'])await cp(resolve(source,name),resolve(target,name),{recursive:true});
let html=await readFile(resolve(source,'index.html'),'utf8');
html=html.replace('<title>Swoop Detroit — Bloom Through Gloom | Unity</title>','<title>Jazz Network Foundation · Unity stage</title>').replace('</style>','header,footer{display:none}main{height:100%}</style>').replace('Ride into the music.','The club stage is loading.').replace("Restart Open-Browser-Preview.cmd.",'Leave the seat and try the performance again.');
await writeFile(resolve(target,'index.html'),html);
const files=['Build/WebGL.data','Build/WebGL.wasm','Build/WebGL.framework.js','Build/WebGL.loader.js','StreamingAssets/BloomPerformance.mp4'];
await writeFile(resolve(target,'SOURCE.json'),JSON.stringify({source,origin:'Actual Unity performance served on port 8229',integration:'Lazy stage iframe, user begins performance; destroyed on exit',files:await Promise.all(files.map(async file=>{const b=await readFile(resolve(source,file));return{file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}))},null,2));
console.log('Packaged the actual Unity stage and performance video.');

