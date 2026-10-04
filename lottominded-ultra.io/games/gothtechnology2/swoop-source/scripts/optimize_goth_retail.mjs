import {createRequire} from 'node:module';import {resolve} from 'node:path';import {stat,writeFile} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'scripts/asset-tools/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{weld,dedup,prune,textureCompress}=require('@gltf-transform/functions'),sharp=require('sharp');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),src=resolve(root,'art/studio-retail/GothTechnology-Store-authoring.glb'),out=resolve(root,'public/exports/boutique/GothTechnology-Store.glb'),doc=await io.read(src);
await doc.transform(weld(),dedup(),prune(),textureCompress({encoder:sharp,targetFormat:'jpeg',resize:[1024,1024],quality:88}));await io.write(out,doc);
const report={authoringBytes:(await stat(src)).size,runtimeBytes:(await stat(out)).size,meshes:doc.getRoot().listMeshes().length};await writeFile(resolve(root,'art/studio-retail/goth-retail-optimization.json'),JSON.stringify(report,null,2));console.log(report);
