import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePavementDepthProof} from './pavement-depth-proof-contract.mjs';

function fixture(){
 const matrix=Array.from({length:16},(_,i)=>i%5===0?1065353216:0),source={id:1,geometryId:5,materialId:7,pass:'color',calls:1,triangles:2,start:0,count:6,world:matrix,view:matrix,projection:matrix,positionId:11,indexId:12};
 const other={...source,id:2,geometryId:6,materialId:8,triangles:3,count:9},shadow={...other,id:3,pass:'shadow',triangles:1,count:3},depth={...source,id:10,geometryId:20,materialId:30};
 const names=['original-software-start-day','original-software-start-night','island-landing-day','island-landing-night','island-far-road-day','island-far-road-night','quantized-near-day','quantized-far-day'];
 return JSON.parse(JSON.stringify({threeRevision:'185',width:1280,height:800,quantizedEqualPixels:40,unsupportedFallback:{changedPixels:0,depthCalls:0},
  rows:names.map(name=>({name,changedPixels:0,maxChannelDelta:0,baselineRgbaSha256:'a'.repeat(64),candidateRgbaSha256:'a'.repeat(64),visibleAsphaltPixels:100,visibleShaderPixels:60,visibleShadowPixels:12,rejectedBiasedDepthPixels:100,
   cameraUnchanged:true,ownersUnchanged:true,depthStats:{supported:true,disposed:false,entries:[{sourceId:1,depthId:10}]},baselineDraws:[shadow,source,other],candidateDraws:[shadow,depth,source,other],
   baselineCalls:3,candidateCalls:4,extraDepthCalls:1,baselineTriangles:6,candidateTriangles:8,extraDepthTriangles:2}))}));
}
test('strict proof accepts actual extra depth work with conserved original draws and exact native inputs',()=>assert.equal(validatePavementDepthProof(fixture()),true));
test('any nonzero RGBA channel, missing pose, inactive depth, missing source or changed order fails',()=>{
 const changes=[r=>r.rows[0].changedPixels=1,r=>r.rows[0].maxChannelDelta=1,r=>r.rows.pop(),r=>r.rows[0].candidateDraws.splice(1,1),
  r=>r.rows[0].candidateDraws.splice(2,1),r=>r.rows[0].candidateDraws.reverse(),r=>r.rows[0].candidateRgbaSha256='b'.repeat(64)];
 for(const change of changes){const result=fixture();change(result);assert.throws(()=>validatePavementDepthProof(result));}
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
