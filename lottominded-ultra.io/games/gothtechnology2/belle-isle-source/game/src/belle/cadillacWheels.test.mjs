import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const game=fileURLToPath(new URL('../../',import.meta.url)),module=path.join(game,'.test/cadillac-wheels.mjs');
await build({absWorkingDir:game,entryPoints:['src/belle/cadillacWheels.ts'],outfile:module,bundle:true,platform:'node',format:'esm',external:['three'],logLevel:'error'});
const {CadillacWheels,CADILLAC_WHEEL_FITS,CADILLAC_WHEEL_DEFAULTS,normalizeCadillacWheelSelection}=await import(pathToFileURL(module).href);
const hydraulicModule=path.join(game,'.test/cadillac-wheels-hydraulic-rig.mjs');
await build({absWorkingDir:game,entryPoints:['src/belle/cadillacHydraulics.ts'],outfile:hydraulicModule,bundle:true,platform:'node',format:'esm',external:['three'],logLevel:'error'});
const {CadillacHydraulics}=await import(pathToFileURL(hydraulicModule).href);
const wireModule=path.join(game,'.test/cadillac-wheels-fitted-wire.mjs');
await build({absWorkingDir:game,entryPoints:['src/belle/cadillacWireWheels.ts'],outfile:wireModule,bundle:true,platform:'node',format:'esm',external:['three'],logLevel:'error'});
const {fitCadillacWireWheels}=await import(pathToFileURL(wireModule).href);
const sources=new Map();
for(const [variant,file]of [['cadillac','silver-cadillac.glb'],['hydraulic-cadillac','hydraulics-cadillac.glb']]){
 const bytes=await fs.readFile(path.join(game,'public/belle/vehicles',file)),length=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+length).toString());
 // Keep both real source meshes, pivots, winding and UVs. Only image decoding
 // is omitted because these Node geometry tests do not own a browser decoder.
 data.materials=data.materials.map(material=>({name:material.name}));
 const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const binary=bytes.subarray(20+length),output=Buffer.alloc(20+padded.length+binary.length);
 output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);binary.copy(output,20+padded.length);
 const scene=(await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'')).scene;
 // Match the shipped loader: its fitted candy-red/gold wire rim, rather than
 // the obsolete GLB chrome primitive, must be accepted and restored as stock.
 if(variant==='hydraulic-cadillac')fitCadillacWireWheels(scene);
 sources.set(variant,scene);
}
const corners=['FL','FR','RL','RR'];
function fixture(variant='cadillac'){
 const model=sources.get(variant).clone(true);
 // Use the real hydraulic adapter: it creates steering hubs and removes the
 // cylinder attachment from each spinning visual before wheels are replaced.
 const hydraulics=variant==='hydraulic-cadillac'?new CadillacHydraulics(model.getObjectByName('Cadillac_Model'),model.getObjectByName('ChassisGeometry')):undefined;
 const wheels=new CadillacWheels(model,variant);
 const spin=corner=>model.getObjectByName(variant==='cadillac'?'Spin'+corner:'Wheel_'+corner);
 const source=corner=>model.getObjectByName(variant==='cadillac'?'Tire'+corner:'WheelGeometry_'+corner);
 const custom=corner=>model.getObjectByName('Cadillac_CustomWheel_'+corner);
 return{model,wheels,spin,source,custom,hydraulics};
}
function meshList(root){const result=[];root.traverse(object=>{if(object.isMesh)result.push(object);});return result;}
function sourceReceipt(root){return meshList(root).map(mesh=>({mesh,geometry:mesh.geometry,material:mesh.material,position:Array.from(mesh.geometry.getAttribute('position').array),index:Array.from(mesh.geometry.index.array)}));}
function localBounds(root,reference){
 root.updateWorldMatrix(true,true);reference.updateWorldMatrix(true,false);
 const inverse=reference.matrixWorld.clone().invert(),bounds=new T.Box3(),point=new T.Vector3();let radial=0;
 for(const mesh of meshList(root)){
  const transform=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),positions=mesh.geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(transform);bounds.expandByPoint(point);radial=Math.max(radial,Math.hypot(point.y,point.z));}
 }
 return{bounds,radial};
}
function triangleComponents(geometry){
 const count=geometry.getAttribute('position').count,parent=Array.from({length:count},(_,i)=>i),index=geometry.index;
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<index.count;i+=3){const a=root(index.getX(i)),b=root(index.getX(i+1)),c=root(index.getX(i+2));parent[b]=parent[c]=a;}
 const triangles=new Map();for(let i=0;i<index.count;i+=3){const key=root(index.getX(i));triangles.set(key,(triangles.get(key)??0)+1);}
 return [...triangles.values()];
}

test('wheel preference normalization bounds corrupt persisted values and keeps the stock crest authoritative',()=>{
 for(const value of [null,undefined,false,[],42,'wire-gold',{rim:'unknown',tire:'giant',center:'pink'}])assert.deepEqual(normalizeCadillacWheelSelection(value),CADILLAC_WHEEL_DEFAULTS);
 assert.deepEqual(normalizeCadillacWheelSelection({rim:'stock',tire:'whitewall',center:'black'}),{rim:'stock',tire:'whitewall',center:'gold'});
 assert.deepEqual(normalizeCadillacWheelSelection({rim:'wire-chrome',tire:'low-profile-whitewall',center:'white'}),{rim:'wire-chrome',tire:'low-profile-whitewall',center:'white'});
 assert(Object.isFrozen(CADILLAC_WHEEL_DEFAULTS));
});

test('hydraulic Original rims retain the shipped red/gold finish and cap depth with every tire profile',()=>{
 const {wheels,source,spin,custom}=fixture('hydraulic-cadillac');
 const original=corners.map(corner=>{
  const rim=source(corner).getObjectByName('Cadillac_Wire_Rim_'+corner);
  assert(rim?.isMesh,'fixture must contain the actual fitted production rim');
  assert.equal(rim.material.name,'Candy red and gold wire finish');
  const colors=Array.from(rim.geometry.getAttribute('color').array),outward=corner.endsWith('R')?-1:1;
  const shape=localBounds(rim,spin(corner));
  assert(Math.abs(shape.radial-.249)<1e-7);
  assert(Math.abs((outward>0?shape.bounds.max.x:-shape.bounds.min.x)-.129)<1e-7);
  return{corner,rim,colors,material:rim.material,geometry:rim.geometry};
 });
 try{
  for(const tire of ['whitewall','low-profile','low-profile-whitewall']){
   assert(wheels.apply({rim:'stock',tire,center:'gold'}));
   for(const {corner,rim,colors,material}of original){
    const replacement=custom(corner).getObjectByName('Cadillac_CustomWheel_'+corner+'_OriginalRim');
    assert.equal(replacement.material,material);
    assert.deepEqual(Array.from(replacement.geometry.getAttribute('color').array),colors);
    const shape=localBounds(replacement,spin(corner)),outset=corner.endsWith('R')?-shape.bounds.min.x:shape.bounds.max.x;
    assert(Math.abs(shape.radial-(tire.startsWith('low-profile')?.276:.249))<1e-7,'only the intended rim radius changes');
    assert(Math.abs(outset-.129)<1e-7,'low-profile scaling must not push the center cap farther out');
    assert.equal(rim.geometry.getAttribute('color').array.length,colors.length);
   }
  }
  assert(wheels.apply(CADILLAC_WHEEL_DEFAULTS));
  for(const {corner,rim,colors,material,geometry}of original){
   assert(source(corner).visible);assert(!custom(corner).visible);
   assert.equal(source(corner).getObjectByName('Cadillac_Wire_Rim_'+corner),rim);
   assert.equal(rim.geometry,geometry);assert.equal(rim.material,material);
   assert.deepEqual(Array.from(rim.geometry.getAttribute('color').array),colors);
  }
 }finally{wheels.dispose();}
});

for(const variant of ['cadillac','hydraulic-cadillac']){
 test(variant+': all wheel choices stay inside the actual source contact envelope and preserve its pivot hierarchy',()=>{
  const {model,wheels,spin,source,custom}=fixture(variant),fit=CADILLAC_WHEEL_FITS[variant];
  const originals=corners.map(corner=>({corner,parent:source(corner).parent,spin:spin(corner),bounds:localBounds(source(corner),spin(corner)),receipt:sourceReceipt(source(corner))}));
  try{
   for(const rim of ['stock','wire-gold','wire-chrome'])for(const tire of ['standard','whitewall','low-profile','low-profile-whitewall'])for(const center of rim==='stock'?['gold']:['gold','black','white']){
    assert(wheels.apply({rim,tire,center}));assert.equal(wheels.radius,fit.radius);
    for(const original of originals){
     const {corner}=original;assert.equal(spin(corner),original.spin);assert.equal(source(corner).parent,original.parent);
     const active=rim==='stock'&&tire==='standard'?source(corner):custom(corner),bounds=localBounds(active,spin(corner));
     assert(bounds.radial<=original.bounds.radial+2e-6,`${rim}/${tire}/${corner} rolling envelope grew`);
     assert(Math.abs(bounds.radial-fit.radius)<2e-6,`${rim}/${tire}/${corner} ground contact changed`);
     assert(bounds.bounds.min.x>=original.bounds.bounds.min.x-2e-6&&bounds.bounds.max.x<=original.bounds.bounds.max.x+2e-6,`${rim}/${tire}/${corner} lateral clearance shrank`);
     assert.equal(meshList(active).length,2,'the replacement retains two material draws per wheel');
     if(variant==='hydraulic-cadillac')assert.equal(model.getObjectByName('Hydraulic_'+corner+'_HubMount').visible,true,'visual swap must not hide hydraulic attachment nodes');
    }
    const stats=wheels.diagnostics();assert.equal(stats.texturesAdded,0);if(stats.trianglesPerWheel!==null)assert(stats.trianglesPerWheel<=(variant==='cadillac'?2560:4150));
   }
   for(const original of originals)for(const receipt of original.receipt){
    assert.equal(receipt.mesh.geometry,receipt.geometry);assert.equal(receipt.mesh.material,receipt.material);
    assert.deepEqual(Array.from(receipt.geometry.getAttribute('position').array),receipt.position);assert.deepEqual(Array.from(receipt.geometry.index.array),receipt.index);
   }
  }finally{wheels.dispose();}
 });

 test(variant+': hot swaps follow existing wheel spin and steering, even after the whole car moves',()=>{
  const {model,wheels,spin,source,custom}=fixture(variant);
  try{
   model.position.set(700,6,-250);model.rotation.set(.09,1.1,-.04);
   for(const [i,corner]of corners.entries()){spin(corner).rotation.x=.6+i*.4;spin(corner).parent.rotation.y=i<2?.24:0;}
   const matrices=corners.map(corner=>{spin(corner).updateWorldMatrix(true,false);return spin(corner).matrixWorld.clone();});
   assert(wheels.apply({rim:'wire-gold',tire:'low-profile-whitewall',center:'black'}));
   for(const [i,corner]of corners.entries()){
    assert.equal(custom(corner).parent,spin(corner));spin(corner).updateWorldMatrix(true,false);assert.deepEqual(spin(corner).matrixWorld.elements,matrices[i].elements);
   }
   assert(wheels.apply({rim:'stock',tire:'whitewall',center:'gold'}));
   for(const corner of corners){
    const originalRim=meshList(source(corner)).find(mesh=>/Wire wheel and crest|Cadillac_Chrome|Candy red and gold wire finish/.test(mesh.material.name));
    const replacementRim=meshList(custom(corner)).find(mesh=>mesh.name.endsWith('_OriginalRim'));
    const a=localBounds(originalRim,spin(corner)).bounds,b=localBounds(replacementRim,spin(corner)).bounds;
    assert(a.min.distanceTo(b.min)<2e-5&&a.max.distanceTo(b.max)<2e-5,'original rim must stay attached after a translated/turned hot swap');
   }
  }finally{wheels.dispose();}
 });

 test(variant+': swapped wire wheels contain exactly 100 crossed spokes, a larger low-profile opening and both whitewall/blackwall options',()=>{
  const {wheels,custom}=fixture(variant),fit=CADILLAC_WHEEL_FITS[variant];
  try{
   wheels.apply({rim:'wire-gold',tire:'standard',center:'gold'});
   const metal=meshList(custom('FL')).find(mesh=>mesh.name.endsWith('_Wire'));
   assert.equal(triangleComponents(metal.geometry).filter(count=>count===6).length,100,'geometry, not a label, must contain 100 three-sided wire tubes');
   assert.equal(metal.material.metalness,1);assert(metal.material.roughness<=.2);assert(metal.material.vertexColors);
   const opening=()=>{const mesh=meshList(custom('FL')).find(item=>item.name.endsWith('_Tire')),position=mesh.geometry.getAttribute('position');let minimum=Infinity;
    for(let i=0;i<position.count;i++){const r=Math.hypot(position.getY(i),position.getZ(i));if(r>.15&&Math.abs(position.getX(i))<=fit.halfWidth+1e-6)minimum=Math.min(minimum,r);}return minimum;};
   const standard=opening();wheels.apply({rim:'wire-gold',tire:'low-profile',center:'gold'});assert(opening()>standard+.02);
   const whiteVertices=()=>{const mesh=meshList(custom('FL')).find(item=>item.name.endsWith('_Tire')),position=mesh.geometry.getAttribute('position'),color=mesh.geometry.getAttribute('color');let count=0;
    for(let i=0;i<position.count;i++)if(Math.hypot(position.getY(i),position.getZ(i))>.15&&color.getX(i)>.7&&color.getY(i)>.7&&color.getZ(i)>.7)count++;return count;};
   assert.equal(whiteVertices(),0);wheels.apply({rim:'wire-gold',tire:'low-profile-whitewall',center:'gold'});assert(whiteVertices()>80);
   for(const corner of ['FL','FR']){const list=meshList(custom(corner));assert.equal(list[0].geometry,meshList(custom('FL'))[0].geometry);}
  }finally{wheels.dispose();}
 });

 test(variant+': cache reuse, source isolation, exact stock restoration and owned-resource disposal survive repeated selections',()=>{
  const a=fixture(variant),b=fixture(variant),selection={rim:'wire-chrome',tire:'whitewall',center:'white'};
  const sourceGeometry=sourceReceipt(a.source('FL')).map(receipt=>receipt.geometry),sourceMaterial=sourceReceipt(a.source('FL')).map(receipt=>receipt.material);
  let sourceDisposals=0;for(const resource of [...sourceGeometry,...sourceMaterial])resource.addEventListener('dispose',()=>sourceDisposals++);
  try{
   a.wheels.apply(selection);const geometry=meshList(a.custom('FL')).map(mesh=>mesh.geometry),materials=meshList(a.custom('FL')).map(mesh=>mesh.material);
   for(let i=0;i<12;i++){a.wheels.apply(CADILLAC_WHEEL_DEFAULTS);a.wheels.apply(selection);}
   assert.equal(a.wheels.diagnostics().cachedCombinations,1);assert.deepEqual(meshList(a.custom('FL')).map(mesh=>mesh.geometry),geometry);
   for(const mesh of meshList(a.custom('FL')))assert.equal(mesh.castShadow,false,'custom wheels must respect an original non-shadow-casting quality policy');
   a.wheels.apply(CADILLAC_WHEEL_DEFAULTS);for(const mesh of meshList(a.source('FL'))){mesh.castShadow=true;mesh.receiveShadow=true;}
   a.wheels.apply(selection);for(const mesh of meshList(a.custom('FL')))assert(mesh.castShadow&&mesh.receiveShadow,'cached variants use the current source shadow policy');
   assert(b.source('FL').visible);assert(!b.custom('FL').visible);assert.deepEqual(b.wheels.selection,CADILLAC_WHEEL_DEFAULTS);
   const previous=a.wheels.selection;assert.equal(a.wheels.apply({rim:'oversize',tire:'standard',center:'gold'}),false);assert.deepEqual(a.wheels.selection,previous);
   let ownedDisposals=0;for(const resource of [...geometry,...materials])resource.addEventListener('dispose',()=>ownedDisposals++);
   a.wheels.apply(CADILLAC_WHEEL_DEFAULTS);assert(a.source('FL').visible&&!a.custom('FL').visible);assert(a.wheels.diagnostics().sourceRestored);
   a.wheels.dispose();a.wheels.dispose();assert.equal(ownedDisposals,4);assert.equal(sourceDisposals,0);assert.equal(a.model.getObjectByName('Cadillac_CustomWheel_FL'),undefined);
   assert.equal(a.wheels.apply(selection),false);
  }finally{a.wheels.dispose();b.wheels.dispose();}
 });
}
