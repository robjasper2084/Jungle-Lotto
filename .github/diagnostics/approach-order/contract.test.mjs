import assert from 'node:assert/strict';
import test from 'node:test';
import {analyze,compareDraws,PROOF_ORDER,MEASURED_ORDER,CASE_NAMES} from './contract.mjs';
import {pins} from './provenance.mjs';
const clone=x=>structuredClone(x);
function fixture(factor=1){
 const result={applicationSource:pins.applicationSource,gpu:'ANGLE Metal',viewport:[1280,800,1],errors:[],queries:{available:true,created:240,resolved:240,deleted:240,live:0,disjoint:false,rows:[]},cases:[]};
 let id=0,frame=0;
 for(let index=0;index<14;index++){
  const quality=index<12?'smooth':'high',night=index<12?index%2===1:index===12,name=CASE_NAMES[index];
  const camera={world:clone(pins.observation.camera.matrixWorld),view:[1,0,0,1],projection:clone(pins.observation.camera.projectionMatrix)};
  const settings={viewport:[1280,800,1],quality,effectiveQuality:quality,scale:1,hour:night?22:13,artStyle:'authentic',sourceQualityPixelRatio:1,fixturePixelRatio:1,fixedResolutionOverride:false,simulationTime:12+index,
   context:{alpha:true,antialias:true,depth:true,stencil:false,preserveDrawingBuffer:false},shadow:{enabled:quality==='high',type:1},outputColorSpace:'srgb',toneMapping:4,exposure:1.02};
  const targets=[10,11],context={sky:{id:8,order:-100},mainland:[{id:9,order:0}],targets:targets.map(id=>({id}))};
  const owners=targets.map(id=>({id,vertices:1353,indices:7680,renderOrder:0,castShadow:false,receiveShadow:true}));
  const draw=(object,order,pass='color')=>({object,name:'object-'+object,geometry:object+100,material:'material-'+object,pass,camera:pass==='shadow'?2:1,order,start:0,count:300,calls:1,triangles:100,lines:0,points:0});
  const shadows=quality==='high'?[draw(40,0,'shadow')]:[];
  const base=[draw(7,-102),draw(8,-100),draw(9,0),...targets.map(id=>draw(id,0)),draw(12,0)];
  const candidate=[...targets.map(id=>draw(id,-103)),draw(7,-102),draw(8,-100),draw(9,0),draw(12,0)];
  const receipt=mode=>({mode,frameBefore:frame++,frameAfter:frame,camera:clone(camera),settings:clone(settings),draws:clone(mode==='baseline'?base:candidate)});
  const pose={name:name.startsWith('real-road')?'real-road-occlusion':name.split('-day')[0]};
  if(pose.name==='real-road-occlusion')pose.occlusion={front:{id:12,distance:2,name:'Joined island pavement · asphalt',ownerKind:'source-asphalt-road',effectiveVisible:true,materials:[{name:'Island asphalt',surface:'asphalt',visible:true}]},approach:{id:10,distance:3}};
  const nativePreparation={...receipt('baseline'),draws:clone([...shadows,...base]),shadowMaps:quality==='high'?[{castShadow:true,intensity:1,requestedSize:[2048,2048],allocatedSize:[2048,2048]}]:[]};
  const c={index,name,timing:index<12,night,quality,camera,settings,context,owners,pose,nativePreparation,proof:PROOF_ORDER.map((mode,i)=>({...receipt(mode),index:i,pixelSha256:'a'.repeat(64),difference:{pixels:0,maxChannelDelta:0},content:{nonzeroRgbPixels:1280*800,distinctColorsAtLeast:32,readback:'same-task before compositor yield'}})),samples:[]};
  if(c.timing)for(const [phase,order]of [['warmup',PROOF_ORDER],['measured',MEASURED_ORDER]])for(const [i,mode]of order.entries()){
   const q={id:id++,case:name,mode,phase,index:i,status:'resolved',nanoseconds:mode==='candidate'?1e6*factor:1e6};result.queries.rows.push(q);c.samples.push({...receipt(mode),query:q});
  }
  result.cases.push(c);
 }
 return result;
}
test('complete improvements, neutral results and regressions all remain diagnostic evidence',()=>{
 for(const factor of [.8,1,1.2]){const r=analyze(fixture(factor));assert.equal(r.complete,true,JSON.stringify(r.errors));assert.equal(r.losslessAcrossRecordedCases,true);assert.equal(r.releaseAcceptance,false);assert.equal(r.cases[0].pairedDeltaPercent.all.length,8);assert(Math.abs(r.cases[0].pairedDeltaPercent.mean-(factor-1)*100)<1e-8);}
});
test('pixel differences, baseline drift, omitted images and altered pose/context fail closed',()=>{
 const edits=[r=>r.cases[0].proof[1].difference.pixels=1,r=>r.cases[0].proof[3].pixelSha256='b'.repeat(64),r=>r.cases[0].proof.pop(),
  r=>r.cases[0].camera.world[12]++,r=>r.cases[0].context.mainland[0].order=-102,r=>r.cases[0].settings.viewport[0]=640,
  r=>r.cases[12].settings.shadow.enabled=false,r=>r.cases[10].pose.occlusion.front.id=10,r=>r.cases[0].proof[0].content.nonzeroRgbPixels=0];
 for(const edit of edits){const r=fixture();edit(r);assert.equal(analyze(r).complete,false);}
});
test('an extra pass, omitted work, changed geometry/material or another reordered object is rejected',()=>{
 for(const edit of [r=>r.cases[0].proof[1].draws.pop(),r=>r.cases[0].proof[1].draws[0].geometry++,
  r=>r.cases[0].proof[1].draws[0].material='replacement',r=>r.cases[0].proof[1].frameAfter++,
  r=>r.cases[12].proof[1].draws[2].order=-103,r=>r.cases[0].proof[1].draws.reverse()]){const r=fixture();edit(r);assert.equal(analyze(r).complete,false);}
});
test('missing, duplicated, reassigned, disjoint or live elapsed queries cannot be interpreted',()=>{
 const edits=[r=>r.queries.live=1,r=>r.queries.disjoint=true,r=>r.queries.rows.pop(),r=>r.cases[0].samples.pop(),
  r=>r.cases[0].samples[4].query.id=0,r=>r.cases[0].samples[4].query.nanoseconds=0,
  r=>r.cases[0].samples[4].query.phase='warmup',r=>r.queries.rows[4]=clone(r.queries.rows[5])];
 for(const edit of edits){const r=fixture();edit(r);assert.equal(analyze(r).complete,false);}
});
test('balanced sample order and exact untouched alternative draw sequence are required',()=>{
 const r=fixture();[r.cases[0].samples[5],r.cases[0].samples[7]]=[r.cases[0].samples[7],r.cases[0].samples[5]];assert.equal(analyze(r).complete,false);
 const c=fixture().cases[0];assert.doesNotThrow(()=>compareDraws(c.proof[0].draws,c.proof[1].draws,[10,11]));
 const changed=clone(c.proof[1].draws);[changed[3],changed[4]]=[changed[4],changed[3]];assert.throws(()=>compareDraws(c.proof[0].draws,changed,[10,11]),/Non-approach/);
});
test('native preparation shadows, effective road visibility and distinct source times are required',()=>{
 const edits=[r=>delete r.cases[0].nativePreparation,r=>r.cases[12].nativePreparation.draws.splice(0,1),r=>r.cases[13].nativePreparation.shadowMaps[0].allocatedSize=null,
  r=>r.cases[10].pose.occlusion.front.name='decorative box',r=>r.cases[10].pose.occlusion.front.effectiveVisible=false,
  r=>{const c=r.cases[13];for(const settings of [c.settings,c.nativePreparation.settings,...c.proof.map(p=>p.settings)])settings.simulationTime=12;},
  r=>{const c=r.cases[10];for(const row of [c.nativePreparation,...c.proof,...c.samples])row.draws=row.draws.filter(d=>d.object!==12);},
  r=>r.cases[0].proof[0].frameBefore++];
 for(const edit of edits){const r=fixture();edit(r);assert.equal(analyze(r).complete,false);}
 const sw=fixture();sw.gpu='ANGLE SwiftShader';for(const c of sw.cases.filter(c=>c.quality==='high'))for(const settings of [c.settings,c.nativePreparation.settings,...c.proof.map(r=>r.settings)]){settings.sourceQualityPixelRatio=.7;settings.fixedResolutionOverride=true;}
 assert.equal(analyze(sw).complete,true,'Source-selected software DPR is distinct from the fixed fixture DPR');
});
