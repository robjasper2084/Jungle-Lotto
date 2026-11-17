import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGlb,validateBellePack} from './validate-belle-asset-pack.mjs';

function fixture({draco=false,rock=true,missingLod=false,biggerLod=false,external=false}={}){
  const accessors=[];const meshes=[];const nodes=[];
  const add=(name,role,triangles)=>{
    const pos=accessors.push({count:triangles*3,min:[0,0,0],max:[2,5,2]})-1;
    const idx=accessors.push({count:triangles*3})-1;
    meshes.push({primitives:[{attributes:{POSITION:pos},indices:idx,material:0}]});
    nodes.push({name,mesh:meshes.length-1,extras:{belle_role:role}});
  };
  add('BELL_BRIDGE__LOD0','bridge',500);
  add('BELL_BRIDGE__LOD1','bridge',biggerLod?700:220);
  if(!missingLod)add('BELL_BRIDGE__LOD2','bridge',90);
  if(rock){
    add('RIPRAP_01__LOD0','rock',400);add('RIPRAP_01__LOD1','rock',200);
    add('RIPRAP_01__LOD2','rock',80);add('RIPRAP_01__COLLIDER','rock',55);
    meshes.at(-1).primitives[0].material = undefined;
  }
  return {asset:{version:'2.0'},nodes,meshes,accessors,materials:[{pbrMetallicRoughness:{}}],
    ...(draco?{extensionsUsed:['KHR_draco_mesh_compression']}:{}),
    ...(external?{images:[{uri:'https://somewhere.invalid/rock.png'}]}:{})};
}
function glb(json) {
  const raw=Buffer.from(JSON.stringify(json));const pad=(4-raw.length%4)%4;
  const out=Buffer.alloc(20+raw.length+pad,0x20);
  out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);
  out.writeUInt32LE(out.length,8);out.writeUInt32LE(raw.length+pad,12);
  out.writeUInt32LE(0x4e4f534a,16);raw.copy(out,20);
  return out;
}

test('validates 3 LODs plus separate rock collider',()=>{
  const buffer=glb(fixture());
  const result=validateBellePack(parseGlb(buffer),buffer.length);
  assert.equal(result.assetCount,2);
  assert.equal(result.lod0Triangles,900);
  assert.equal(result.lod0Draws,2);
  assert.deepEqual(result.assets[1].lodTriangles,[400,200,80]);
  assert.equal(result.assets[1].colliderTriangles,55);
});
test('rejects Draco GLBs without an app decoder',()=>assert.throws(()=>validateBellePack(fixture({draco:true})),/KHR_draco/));
test('rejects missing LOD2',()=>assert.throws(()=>validateBellePack(fixture({missingLod:true})),/missing LOD2/));
test('rejects LOD complexity regressions',()=>assert.throws(()=>validateBellePack(fixture({biggerLod:true})),/more triangles/));
test('rejects external textures',()=>assert.throws(()=>validateBellePack(fixture({external:true})),/external texture URI/));
test('rejects unpaired rock collider',()=>{
  const f=fixture();f.nodes=f.nodes.filter(n=>!n.name.endsWith('__COLLIDER'));
  assert.throws(()=>validateBellePack(f),/missing a simplified collision proxy/);
});
test('rejects oversized exported model before rendering',()=>assert.throws(()=>validateBellePack(fixture(),16*1024*1024+1),/size exceeds/));
test('rejects GLB framing errors and truncation',()=>{
  const good=glb(fixture());
  assert.throws(()=>parseGlb(Buffer.from('bad')),/too short/);
  assert.throws(()=>parseGlb(good.subarray(0,good.length-4)),/declared length/);
  const damaged=Buffer.from(good);damaged.writeUInt32LE(0,0);
  assert.throws(()=>parseGlb(damaged),/magic/);
});

test('rejects material-heavy rock collider proxies',()=>{
  const f=fixture(); f.meshes.at(-1).primitives[0].material=0;
  assert.throws(()=>validateBellePack(f),/collision proxy should not contain PBR materials/);
});
test('rejects colliders for foliage, shoreline and bridge geometry',()=>{
  const f=fixture();
  f.nodes.push({name:'BELL_BRIDGE__COLLIDER',mesh:0,extras:{belle_role:'bridge'}});
  assert.throws(()=>validateBellePack(f),/only rocks may contain COLLIDER nodes/);
});
test('allows waterbed geometry but not compressed textures',()=>{
  const f=fixture({rock:false});
  const pos=f.accessors.push({count:24,min:[0,-1,0],max:[3,0,3]})-1;
  const idx=f.accessors.push({count:24})-1;
  for(const level of [0,1,2]){
    f.meshes.push({primitives:[{attributes:{POSITION:pos},indices:idx,material:0}]});
    f.nodes.push({name:`LAGOON_BED__LOD${level}`,mesh:f.meshes.length-1,extras:{belle_role:'waterbed'}});
  }
  assert.deepEqual(validateBellePack(f).roles,['bridge','waterbed']);
  f.extensionsUsed=['KHR_texture_basisu'];
  assert.throws(()=>validateBellePack(f),/KHR_texture_basisu/);
});
