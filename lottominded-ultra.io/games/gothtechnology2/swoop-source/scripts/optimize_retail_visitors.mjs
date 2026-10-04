import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdir,stat,writeFile} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'scripts/asset-tools/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{dedup,prune,weld,textureCompress}=require('@gltf-transform/functions'),sharp=require('sharp');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),out=resolve(root,'public/exports/visitors');await mkdir(out,{recursive:true});
const ids=['detroit-photographer','detroit-blonde-shopper','detroit-bob-shopper','detroit-cap-shopper','gallery-blue-visitor'],report=[];
for(const id of ids){
 const doc=await io.read(resolve(root,'art/visitors',id+'-authoring.glb'));
 if(!doc.getRoot().listMaterials().some(m=>m.getName().includes('photographic skin')))throw Error('Missing projected reference skin: '+id);
 await doc.transform(weld(),dedup(),prune(),textureCompress({encoder:sharp,targetFormat:'jpeg',resize:[1024,1024],quality:88}));
 const file=resolve(out,id+'.glb');await io.write(file,doc);
 report.push({id,bytes:(await stat(file)).size,meshes:doc.getRoot().listMeshes().length,bones:doc.getRoot().listSkins().map(s=>s.listJoints().length),textures:doc.getRoot().listTextures().map(t=>({name:t.getName(),size:t.getSize()}))});
}
await writeFile(resolve(root,'art/visitors/runtime-report.json'),JSON.stringify(report,null,2));console.log(report.map(({id,bytes,meshes,bones})=>({id,bytes,meshes,bones})));
