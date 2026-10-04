import {createRequire} from 'node:module';import {resolve} from 'node:path';import {stat,writeFile,mkdir,copyFile} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..'),req=createRequire(resolve(root,'scripts/asset-tools/package.json'));
const {NodeIO}=req('@gltf-transform/core'),{ALL_EXTENSIONS}=req('@gltf-transform/extensions'),{weld,dedup,prune}=req('@gltf-transform/functions');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),report=[];await mkdir(resolve(root,'art/waterfront/Unity/Assets/Waterfront'),{recursive:true});
for(const name of ['aretha-amphitheatre','aretha-entry','shore-railing','dock-service','harbor-cruiser']){const file=resolve(root,'public/exports/waterfront/'+name+'.glb'),doc=await io.read(file);await doc.transform(weld(),dedup(),prune());await io.write(file,doc);await copyFile(resolve(root,'art/waterfront/'+name+'.fbx'),resolve(root,'art/waterfront/Unity/Assets/Waterfront/'+name+'.fbx'));report.push({name,bytes:(await stat(file)).size,meshes:doc.getRoot().listMeshes().length});}
await writeFile(resolve(root,'art/waterfront/runtime-assets.json'),JSON.stringify(report,null,2));console.log(report);
