import {createRequire} from 'node:module';import {resolve} from 'node:path';import {stat,writeFile} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..'),req=createRequire(resolve(root,'scripts/asset-tools/package.json'));
const {NodeIO}=req('@gltf-transform/core'),{ALL_EXTENSIONS}=req('@gltf-transform/extensions'),{weld,dedup,prune}=req('@gltf-transform/functions');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),report=[];
for(const [folder,names] of [['street-furniture',['street-lamp','camera-pole','hydrant','bench','waste-bin','bike-rack','drain-grate','utility-cover']],['valade',['valade-shed','valade-play-towers','valade-barge','valade-chair','valade-musical-garden','valade-picnic-table','valade-bbq']]])for(const name of names){
 const file=resolve(root,'public/exports/'+folder+'/'+name+'.glb'),doc=await io.read(file);await doc.transform(weld(),dedup(),prune());await io.write(file,doc);
 const pos=doc.getRoot().listAccessors().filter(a=>a.getType()==='VEC3'&&a.getName().includes('POSITION'));let triangles=0;
 for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives())triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
 report.push({folder,name,bytes:(await stat(file)).size,meshes:doc.getRoot().listMeshes().length,triangles,positions:pos.length});
}
await writeFile(resolve(root,'art/valade/runtime-assets.json'),JSON.stringify(report,null,2));console.log(report);
