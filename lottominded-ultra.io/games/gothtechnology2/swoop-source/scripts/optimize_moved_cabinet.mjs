import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'scripts/asset-tools/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {dedup,prune,weld,textureCompress}=require('@gltf-transform/functions'),sharp=require('sharp');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
for(const relative of ['atwater/lottomind-store.glb','boutique/GothTechnology-Store.glb']){
 const filename=relative.split('/').at(-1),doc=await io.read(resolve(root,'art/studio-retail',filename.replace('.glb','-authoring.glb')));
 await doc.transform(weld(),dedup(),textureCompress({encoder:sharp,targetFormat:'jpeg',resize:[768,768],quality:86}),prune());
 await io.write(resolve(root,'public/exports',relative),doc);
 console.log(relative+': '+doc.getRoot().listMeshes().length+' meshes');
}
