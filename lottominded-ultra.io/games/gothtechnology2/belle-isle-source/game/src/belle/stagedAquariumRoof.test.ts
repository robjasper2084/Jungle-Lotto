import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const game=new URL('../../',import.meta.url);
const receipt=JSON.parse(await readFile(new URL('scripts/staged-landmark-authoring/source/aquarium-roof-ends.json',game),'utf8'));
const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const blob=(value:Buffer)=>createHash('sha1').update(Buffer.from('blob '+value.length+'\0')).update(value).digest('hex');
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
function parse(raw:Buffer){
  assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
  const n=raw.readUInt32LE(12);assert.equal(raw.readUInt32LE(16),0x4e4f534a);assert.equal(raw.readUInt32LE(24+n),0x004e4942);
  const doc=JSON.parse(raw.subarray(20,20+n).toString()),binary=raw.subarray(28+n);assert.equal(binary.length,raw.readUInt32LE(20+n));
  return{doc,binary};
}
function accessor(doc:any,binary:Buffer,index:number){
  const a=doc.accessors[index],view=doc.bufferViews[a.bufferView],width=a.type==='VEC3'?12:4;
  assert.ok([5125,5126].includes(a.componentType));assert.equal(a.sparse,undefined);assert.equal(view.byteStride??width,width);
  const offset=(view.byteOffset??0)+(a.byteOffset??0);return binary.subarray(offset,offset+a.count*width);
}
function encode(doc:any,binary:Buffer){
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((-json.length)&3,0x20)]);
  const head=Buffer.alloc(20),binHead=Buffer.alloc(8);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+binary.length,8);
  head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4e4f534a,16);binHead.writeUInt32LE(binary.length);binHead.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([head,json,binHead,binary]);
}
const models=await Promise.all(Object.entries(receipt.models).map(async([file,pin]:[string,any])=>{
  const raw=await readFile(new URL('public/belle/staged-architecture/'+file,game)),{doc,binary}=parse(raw),old=pin.before;
  const beforeDoc=structuredClone(doc);beforeDoc.accessors.splice(old.accessorCount);beforeDoc.bufferViews.splice(old.bufferViewCount);
  beforeDoc.buffers[0].byteLength=old.binaryBytes;beforeDoc.meshes[old.meshIndex].primitives[0]=structuredClone(old.roofPrimitive);
  const beforeRaw=encode(beforeDoc,binary.subarray(0,old.binaryBytes));
  const before=(await new GLTFLoader().parseAsync(Uint8Array.from(beforeRaw).buffer,'')).scene;
  const after=(await new GLTFLoader().parseAsync(Uint8Array.from(raw).buffer,'')).scene;
  before.updateMatrixWorld(true);after.updateMatrixWorld(true);
  const name=T.PropertyBinding.sanitizeNodeName(receipt.component),oldRoof=before.getObjectByName(name),roof=after.getObjectByName(name);
  assert.ok(oldRoof instanceof T.Mesh&&roof instanceof T.Mesh);
  return{file,pin,raw,doc,binary,beforeDoc,before,after,oldRoof,roof};
}));

test('all three GLBs preserve every original binary byte and all original metadata except the two roof accessor links',()=>{
  assert.equal(receipt.sourceHead,'bf2fa1eaef4c529e8428f2ac1d0ac5a897a1e112');assert.equal(models.length,3);
  for(const {file,pin,raw,doc,binary,beforeDoc} of models){
    const old=pin.before,p=doc.meshes[old.meshIndex].primitives[0];
    assert.equal(sha(raw),pin.after.sha256,file+' reviewed output');assert.equal(raw.length,pin.after.bytes);
    assert.equal(sha(binary.subarray(0,old.binaryBytes)),old.binarySha256,file+' complete original binary prefix');
    assert.equal(sha(JSON.stringify(sorted(beforeDoc))),old.jsonCanonicalSha256,file+' original materials, nodes, images, textures, topology and metadata');
    assert.equal(doc.accessors.length,old.accessorCount+2);assert.equal(doc.bufferViews.length,old.bufferViewCount+2);
    assert.equal(p.attributes.POSITION,old.accessorCount);assert.equal(p.indices,old.accessorCount+1);
    assert.deepEqual({...p,attributes:old.roofPrimitive.attributes,indices:old.roofPrimitive.indices},old.roofPrimitive);
    for(const [oldIndex,newIndex] of [[old.roofPrimitive.attributes.POSITION,p.attributes.POSITION],[old.roofPrimitive.indices,p.indices]]){
      const original=accessor(beforeDoc,binary,oldIndex),current=accessor(doc,binary,newIndex);
      assert.ok(current.subarray(0,original.length).equals(original),file+' original referenced vertex/index prefix');
    }
    assert.equal(doc.accessors[p.attributes.POSITION].count,150);assert.equal(doc.accessors[p.indices].count,294);
    assert.equal(pin.after.triangles,old.triangles+50);assert.equal(pin.after.meshGroups,old.meshGroups);
  }
});

test('the added triangles form exactly the two existing-profile endpoint polygons, with outward winding and no degeneracy',()=>{
  for(const {file,roof,oldRoof} of models){
    const positions=roof.geometry.getAttribute('position'),indices=roof.geometry.getIndex()!;
    const profile=new Map<number,number>();for(let i=0;i<96;i++)profile.set(positions.getX(i),positions.getY(i));
    const xs=[...profile.keys()].sort((a,b)=>a-b),bottom=Math.fround(7.6),end=Math.fround(38.2);
    assert.equal(xs.length,25);assert.equal(positions.count,150);assert.equal(indices.count,294);
    const expectedArea=xs.slice(1).reduce((sum,x,i)=>sum+(x-xs[i])*((profile.get(x)!+profile.get(xs[i])!)/2-bottom),0);
    const area=new Map([[-end,0],[end,0]]),counts=new Map([[-end,0],[end,0]]);
    for(let i=96;i<150;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);assert.ok(area.has(z),file+' unchanged endpoint plane');
      assert.ok((y===bottom&&(x===xs[0]||x===xs.at(-1)))||profile.get(x)===y,file+' existing wall top or exact roof boundary');
    }
    const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3();
    for(let i=144;i<294;i+=3){
      const ids=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)];assert.ok(ids.every(id=>id>=96&&id<150));
      a.fromBufferAttribute(positions,ids[0]);b.fromBufferAttribute(positions,ids[1]);c.fromBufferAttribute(positions,ids[2]);
      assert.equal(a.z,b.z);assert.equal(a.z,c.z);normal.crossVectors(b.clone().sub(a),c.clone().sub(a));
      assert.ok(normal.length()>1e-8,file+' nondegenerate closure');assert.equal(normal.x,0);assert.equal(normal.y,0);assert.ok(normal.z*a.z>0,file+' outward facing');
      area.set(a.z,area.get(a.z)!+normal.length()/2);counts.set(a.z,counts.get(a.z)!+1);
    }
    for(const z of [-end,end]){assert.equal(counts.get(z),25);assert.ok(Math.abs(area.get(z)!-expectedArea)<1e-8,file+' complete polygon area');}
    assert.deepEqual(new T.Box3().setFromObject(roof.parent!).min.toArray(),new T.Box3().setFromObject(oldRoof.parent!).min.toArray());
    assert.deepEqual(new T.Box3().setFromObject(roof.parent!).max.toArray(),new T.Box3().setFromObject(oldRoof.parent!).max.toArray());
  }
});

test('actual GLTFLoader flat shading and copper optics stay exact, with separate closure vertices preserving any computed old normals',()=>{
  for(const {file,roof,oldRoof,before,after} of models){
    assert.equal(roof.geometry.getAttribute('normal'),undefined);assert.equal(oldRoof.geometry.getAttribute('normal'),undefined);
    const computed=roof.geometry.clone(),oldComputed=oldRoof.geometry.clone();computed.computeVertexNormals();oldComputed.computeVertexNormals();
    const normal=computed.getAttribute('normal'),old=oldComputed.getAttribute('normal');
    assert.deepEqual(Array.from(normal.array.slice(0,old.array.length)),Array.from(old.array),file+' original roof normals if computed later');
    computed.dispose();oldComputed.dispose();
    const material=roof.material;assert.ok(material instanceof T.MeshStandardMaterial);
    assert.equal(material.flatShading,true);assert.equal((oldRoof.material as T.MeshStandardMaterial).flatShading,true);
    assert.equal(material.name,'copper');assert.equal(material.side,T.FrontSide);assert.equal(material.transparent,false);assert.equal(material.opacity,1);
    assert.equal(material.roughness,.55);assert.equal(material.metalness,.45);assert.deepEqual(material.color.toArray(),[60/255,119/255,102/255]);
    const oldNodes:string[]=[],newNodes:string[]=[];before.traverse(n=>oldNodes.push(n.name));after.traverse(n=>newNodes.push(n.name));assert.deepEqual(newNodes,oldNodes);
  }
});

test('the exact native front-camera gap ray now hits a new opaque face in every LOD',()=>{
  const proof=receipt.nativeBeforeEvidence.gapRay,origin=new T.Vector3().fromArray(proof.originLocal),direction=new T.Vector3().fromArray(proof.directionLocal);
  for(const {file,before,after,roof} of models){
    const ray=new T.Raycaster(origin,direction,0,100);assert.equal(ray.intersectObject(before,true).length,0,file+' demonstrated original hole');
    const hit=ray.intersectObject(after,true)[0];assert.ok(hit,file+' closure hit');assert.equal(hit.object,roof);assert.ok(hit.faceIndex!>=48);
    assert.ok(Math.abs(hit.point.z-Math.fround(38.2))<1e-8);assert.ok(hit.face!.normal.z>0);
  }
});

test('both endpoint polygons cover each of the 24 roof segments at low, middle and high interior heights',()=>{
  for(const {file,roof} of models){
    const pos=roof.geometry.getAttribute('position'),profile=new Map<number,number>();for(let i=0;i<96;i++)profile.set(pos.getX(i),pos.getY(i));
    const xs=[...profile.keys()].sort((a,b)=>a-b),bottom=Math.fround(7.6),end=Math.fround(38.2);
    for(let i=0;i<24;i++)for(const fraction of [.05,.5,.95])for(const sign of [-1,1]){
      const x=(xs[i]+xs[i+1])/2,top=(profile.get(xs[i])!+profile.get(xs[i+1])!)/2,y=bottom+fraction*(top-bottom);
      const hits=new T.Raycaster(new T.Vector3(x,y,sign*45),new T.Vector3(0,0,-sign),0,10).intersectObject(roof);
      assert.ok(hits.length,file+' complete sampled endpoint coverage');assert.ok(hits[0].faceIndex!>=48);assert.ok(Math.abs(hits[0].point.z-sign*end)<1e-8);
    }
  }
});

test('all other assets, collision inputs, placement, LOD and shadow code stay exact',async()=>{
  assert.equal(Object.keys(receipt.unchangedAssets).length,9);
  for(const [file,pin] of Object.entries(receipt.unchangedAssets) as [string,any][]){
    const raw=await readFile(new URL('public/belle/staged-architecture/'+file,game));assert.equal(raw.length,pin.bytes);assert.equal(sha(raw),pin.sha256,file);
  }
  for(const [file,pin] of Object.entries(receipt.collisionInputs.files) as [string,string][]){assert.equal(blob(await readFile(new URL(file,game))),pin,file+' exact authority input');}
  assert.equal(blob(await readFile(new URL('public/belle/map.json',game))),receipt.collisionInputs.mapBlob);
  let loader=await readFile(new URL('src/belle/stagedLandmarkStudies.ts',game),'utf8');
  for(const pin of Object.values(receipt.models) as any[]){assert.equal(loader.split(pin.after.sha256).length,2);loader=loader.replace(pin.after.sha256,pin.before.sha256);}
  assert.equal(blob(Buffer.from(loader)),receipt.originalLoaderBlob,'only the three asset hash pins change in the loader');
  const manifest=JSON.parse(await readFile(new URL('public/belle/staged-architecture/manifest.json',game),'utf8'));
  const model=manifest.models.find((x:any)=>x.site==='Belle Isle Aquarium');assert.equal(model.authoringAssumptions.roofHeightUnverified,true);
  for(const lod of model.lods){const pin=receipt.models[lod.file].after;assert.equal(lod.sha256,pin.sha256);assert.equal(lod.bytes,pin.bytes);assert.equal(lod.total_triangles,pin.triangles);assert.equal(lod.total_mesh_groups,pin.meshGroups);}
  assert.equal(manifest.productionReady,false);assert.equal(manifest.nativePerformanceAccepted,false);assert.equal(manifest.aquariumRoofEndSource.pixelEquivalent,false);
});
