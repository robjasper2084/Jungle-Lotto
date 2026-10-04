import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'scripts/asset-tools/package.json')),sharp=require('sharp');
const names=['lotto-billboard','lotto-fascia','gothtech-billboard','gothtech-fascia','serengeti-billboard','serengeti-fascia'];
const jobs=['59ab655a-d622-4224-87e3-e2f1f8b95470','fa3baed8-1728-466f-b453-0bd681571c96','4e52edc7-d3e4-45d8-a257-1c7c490fde7d','a8712e2f-a9e3-4e51-b841-719ac4712ce4','9676f2ff-380c-42a3-860b-5f0dd79cb628','d41f8062-c521-4300-8178-083452390b32'];
const art=resolve(root,'art/storefront-20261003'),out=resolve(root,'public/exports/polish/store-signs');await mkdir(out,{recursive:true});
const assets=[];
for(const [i,name]of names.entries()){const source=resolve(art,'higgsfield',name+'.png'),target=resolve(out,name+'.jpg'),meta=await sharp(source).metadata();await sharp(source).jpeg({quality:91,mozjpeg:true}).toFile(target);assets.push({name,job:jobs[i],source:'higgsfield/'+name+'.png',runtime:'exports/polish/store-signs/'+name+'.jpg',width:meta.width,height:meta.height});}
await writeFile(resolve(art,'provenance.json'),JSON.stringify({date:'2026-10-03',provider:'Higgsfield',model:'gpt_image_2_5',purpose:'Original brand billboard and fascia textures, generated at user request',treatment:'JPEG encoding only; full native image ratio preserved on 3D panels',assets},null,2)+'\n');
console.log('Prepared six original storefront textures');
