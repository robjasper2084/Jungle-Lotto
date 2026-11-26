import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePavementDepthProof} from './pavement-depth-proof-contract.mjs';
import * as T from 'three';
import {readFile} from 'node:fs/promises';
import {pavementProofShadowAnchor} from './pavement-depth-proof-shadow.ts';
import {createPavementGeometry} from '../src/belle/pavement.ts';

function fixture(){
 const matrix=Array.from({length:16},(_,i)=>i%5===0?1065353216:0),source={id:1,geometryId:5,materialId:7,pass:'color',calls:1,triangles:2,start:0,count:6,world:matrix,view:matrix,projection:matrix,positionId:11,indexId:12};
 const other={...source,id:2,geometryId:6,materialId:8,triangles:3,count:9},shadow={...other,id:3,pass:'shadow',triangles:1,count:3},depth={...source,id:10,geometryId:20,materialId:30};
 const names=['original-software-start-day','original-software-start-night','island-landing-day','island-landing-night','island-far-road-day','island-far-road-night','quantized-near-day','quantized-far-day'];
 return JSON.parse(JSON.stringify({threeRevision:'185',width:1280,height:800,quantizedEqualPixels:40,unsupportedFallback:{changedPixels:0,depthCalls:0,targetSourceId:1,targetDepthId:10,targetMaterial:{transparent:true,opacity:.65},
  depthStats:{entries:[{sourceId:1,depthId:10,status:'material-changed',selectedIndices:0},{sourceId:2,depthId:20,status:'active',selectedIndices:9}]},baselineDraws:[shadow,source,other],candidateDraws:[shadow,{...other,id:20},source,other],baselineCalls:3,candidateCalls:4,baselineTriangles:6,candidateTriangles:9},
  rows:names.map(name=>({name,changedPixels:0,maxChannelDelta:0,baselineRgbaSha256:'a'.repeat(64),candidateRgbaSha256:'a'.repeat(64),visibleAsphaltPixels:100,visibleShaderPixels:60,visibleShadowPixels:12,rejectedBiasedDepthPixels:100,
   cameraUnchanged:true,ownersUnchanged:true,shadowAnchor:{point:[1,2,3],distance:20,ndc:[0,-.35],size:3,sourceId:1,faceIndex:0},depthStats:{supported:true,disposed:false,entries:[{sourceId:1,depthId:10}]},baselineDraws:[shadow,source,other],candidateDraws:[shadow,depth,source,other],
   baselineCalls:3,candidateCalls:4,extraDepthCalls:1,baselineTriangles:6,candidateTriangles:8,extraDepthTriangles:2}))}));
}
test('strict proof accepts actual extra depth work with conserved original draws and exact native inputs',()=>assert.equal(validatePavementDepthProof(fixture()),true));
test('any nonzero RGBA channel, missing pose, inactive depth, missing source or changed order fails',()=>{
 const changes=[r=>r.rows[0].changedPixels=1,r=>r.rows[0].maxChannelDelta=1,r=>r.rows.pop(),r=>r.rows[0].candidateDraws.splice(1,1),
  r=>r.rows[0].candidateDraws.splice(2,1),r=>r.rows[0].candidateDraws.reverse(),r=>r.rows[0].candidateRgbaSha256='b'.repeat(64)];
 for(const change of changes){const result=fixture();change(result);assert.throws(()=>validatePavementDepthProof(result));}
});

test('unsupported fallback attribution rejects a target depth draw, missing native target or concealed eligible work',()=>{
 const changes=[r=>r.unsupportedFallback.candidateDraws[1].id=10,r=>r.unsupportedFallback.targetSourceId=2,
  r=>r.unsupportedFallback.baselineDraws=r.unsupportedFallback.baselineDraws.filter(d=>d.id!==1),r=>r.unsupportedFallback.candidateCalls--,
  r=>r.unsupportedFallback.candidateDraws[1].indexId=99,r=>r.unsupportedFallback.targetMaterial.transparent=false,
  r=>r.unsupportedFallback.depthStats.entries[0].status='active',r=>r.unsupportedFallback.depthStats.entries[0].selectedIndices=6,
  r=>r.rows[0].shadowAnchor.sourceId=100,r=>r.rows[0].shadowAnchor.ndc=[0,2],r=>r.rows[0].shadowAnchor.faceIndex=2];
 for(const change of changes){const result=fixture();change(result);assert.throws(()=>validatePavementDepthProof(result));}
});

test('shadow anchor finds real retained asphalt in the failed far view and restores native ranges',async()=>{
 const root=new URL('../public/belle/',import.meta.url),metadata=JSON.parse(await readFile(new URL('pavement.json',root),'utf8'));
 const bytes=await readFile(new URL('pavement.bin',root)),buffer=Uint8Array.from(bytes).buffer,sources=[];
 for(const part of metadata.groups.filter(p=>p.kind==='asphalt'&&p.vertices)){
  const geometry=createPavementGeometry(buffer,part,metadata.stride);geometry.setDrawRange(3,6);
  const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial());mesh.updateMatrixWorld();sources.push(mesh);
 }
 assert(sources.length>0);const camera=new T.PerspectiveCamera(54,1.6,.08,22000);camera.position.set(1320,40,1500);camera.lookAt(1600,2,900);camera.updateMatrixWorld();
 const before=camera.matrixWorld.elements.slice(),anchor=pavementProofShadowAnchor(camera,sources),projected=new T.Vector3().fromArray(anchor.point).project(camera);
 assert(Math.abs(projected.x-anchor.ndc[0])<1e-9&&Math.abs(projected.y-anchor.ndc[1])<1e-9);assert(projected.z>-1&&projected.z<1);
 assert(anchor.distance>24);assert(anchor.size>=3&&anchor.size<=12);assert.deepEqual(camera.matrixWorld.elements,before);
 assert(sources.every(s=>s.geometry.drawRange.start===3&&s.geometry.drawRange.count===6));
 const original=sources[0].raycast;sources[0].raycast=()=>{throw Error('ray failed');};assert.throws(()=>pavementProofShadowAnchor(camera,sources),/ray failed/);sources[0].raycast=original;
 assert(sources.every(s=>s.geometry.drawRange.start===3&&s.geometry.drawRange.count===6));assert.throws(()=>pavementProofShadowAnchor(camera,[]),/No actual visible/);
});
test('range, native matrix bits, attribute owner, shadow pollution and concealed extra work fail',()=>{
 const changes=[r=>r.rows[0].candidateDraws[1].view[0]++,r=>r.rows[0].candidateDraws[1].projection[5]++,r=>r.rows[0].candidateDraws[1].count=3,
  r=>r.rows[0].candidateDraws[1].positionId=90,r=>r.rows[0].candidateDraws[1].pass='shadow',r=>r.rows[0].candidateCalls--,r=>r.rows[0].extraDepthTriangles=0];
 for(const change of changes){const result=fixture();change(result);assert.throws(()=>validatePavementDepthProof(result));}
});
test('occluded geometry, invisible shaders/shadows, ineffective broken-depth control or unsafe fallback fail',()=>{
 const changes=[r=>r.rows[0].visibleAsphaltPixels=0,r=>r.rows[0].visibleShaderPixels=0,r=>r.rows[0].visibleShadowPixels=0,r=>r.rows[0].rejectedBiasedDepthPixels=0,
  r=>r.quantizedEqualPixels=0,r=>r.unsupportedFallback.changedPixels=1,r=>r.unsupportedFallback.depthCalls=1,r=>r.rows[0].cameraUnchanged=false,r=>r.rows[0].ownersUnchanged=false];
 for(const change of changes){const result=fixture();change(result);assert.throws(()=>validatePavementDepthProof(result));}
});
