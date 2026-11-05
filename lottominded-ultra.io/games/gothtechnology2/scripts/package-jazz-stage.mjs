import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import {createHash} from 'node:crypto';
// Same current portal selected by SourceArt/serve_browser.py on port 8229.
const source=resolve(import.meta.dirname,'../../../../../swoop-detroit-bloom-unity/Builds/JazzPortal');
const target=resolve(import.meta.dirname,'../swoop-source/public/exports/jazz-stage');
const html=await readFile(resolve(source,'index.html'),'utf8');
const config=JSON.parse(html.match(/const config=(\{[^\n]+\});/)[1]);
const loader=html.match(/script\.src=("[^"]+")/);
const files=['index.html',config.dataUrl,config.frameworkUrl,config.codeUrl,JSON.parse(loader[1]),config.streamingAssetsUrl+'/BloomPerformance.mp4'];
const receipt=[];
for(const file of files){
 if(!/^(index\.html|Build\/[\w.-]+|StreamingAssets\/[\w.-]+)$/.test(file))throw Error('Unexpected Jazz asset path: '+file);
 const bytes=await readFile(resolve(source,file));
 await mkdir(dirname(resolve(target,file)),{recursive:true});
 await cp(resolve(source,file),resolve(target,file));
 receipt.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(resolve(target,'SOURCE.json'),JSON.stringify({source,version:config.productVersion,integration:'Current port 8229 music world; full viewport walking and riding; safe return to Detroit',files:receipt},null,2)+'\n');
console.log('Packaged current Jazz world '+config.productVersion+'; '+files.length+' files verified.');

