import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFile,stat} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..');
// Optional tool directory keeps this pipeline independent of the game dependency junction.
const require=createRequire(resolve(process.argv[2]??resolve(root,'scripts/asset-tools'),'package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {dedup,prune,resample,textureCompress}=require('@gltf-transform/functions'),sharp=require('sharp');
const original=resolve(root,'art/animation-polish/DS_Boerboel_Polished-authoring.glb');
const file=resolve(root,'public/exports/polish/DS_Boerboel_Polished.glb');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(original);
await doc.transform(dedup(),resample(),textureCompress({encoder:sharp,targetFormat:'jpeg',resize:[1024,1024],quality:85}),prune());
await io.write(file,doc);
const report={tool:'glTF Transform 4.5.1',beforeBytes:(await stat(original)).size,afterBytes:(await stat(file)).size,clips:doc.getRoot().listAnimations().map(a=>a.getName()),meshes:doc.getRoot().listMeshes().length,skeletons:doc.getRoot().listSkins().length};
await writeFile(resolve(root,'art/animation-polish/optimization.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
