import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFile,stat} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..');
const require=createRequire(resolve(process.argv[2]??resolve(root,'scripts/asset-tools'),'package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {dedup,prune,weld,textureCompress}=require('@gltf-transform/functions'),sharp=createRequire(resolve(root,'package.json'))('sharp');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),report=[];
for(const relative of ['atwater/mack-gothtech-studio.glb','boutique/GothTechnology-Store.glb','gallery/Serengeti-Galleries.glb','atwater/lottomind-store.glb']){
 const filename=relative.split('/').at(-1),source=resolve(root,'art/studio-retail',filename.replace('.glb','-authoring.glb')),target=resolve(root,'public/exports',relative),doc=await io.read(source);
 await doc.transform(weld(),dedup(),textureCompress({encoder:sharp,targetFormat:'jpeg',resize:[768,768],quality:86}),prune());await io.write(target,doc);
 report.push({file:relative,beforeBytes:(await stat(source)).size,bytes:(await stat(target)).size,meshes:doc.getRoot().listMeshes().length,textures:doc.getRoot().listTextures().length});
}
await writeFile(resolve(root,'art/studio-retail/optimization.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
