import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {sourcePins,assetPins,modelBounds,sha256,replaceOnce,betweenOnce,worldPoint,headingTo,
 exteriorPlan,galleryViewport,segmentWaypoints,projectedBounds,projectedModel,observedModelTransform,assertExteriorEvidence,assertGallerySettings} from './contract.mjs';
import {buildDriver} from './build-driver.mjs';

const game=process.env.STAGED_LANDMARK_GAME_DIR,dist=process.env.STAGED_LANDMARK_DIST;
assert(game&&dist,'Tests require the pinned original game scripts and staged dist');
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const translate=(x,y,z)=>{const m=[...identity];m.splice(12,3,x,y,z);return m;};

test('derivation fails closed on missing or duplicate exact source anchors',()=>{
 assert.equal(replaceOnce('abc','b','B'),'aBc');
 assert.throws(()=>replaceOnce('abc','x','X'));assert.throws(()=>replaceOnce('abbc','b','B'));
 assert.equal(betweenOnce('aSTARToldENDz','START','END','new'),'anewENDz');
 assert.throws(()=>betweenOnce('ENDSTART','START','END','x'));
 assert.throws(()=>betweenOnce('STARTSTARTEND','START','END','x'));
});
test('walking subdivision keeps every target on the planned line within eight metres',()=>{
 const from={x:1,z:2},to={x:101,z:42},goals=segmentWaypoints(from,to);assert.deepEqual(goals.at(-1),to);
 let previous=from;for(const point of goals){assert(Math.hypot(point.x-previous.x,point.z-previous.z)<=8);assert(Math.abs((point.x-1)*40-(point.z-2)*100)<1e-9);previous=point;}
 assert.deepEqual(segmentWaypoints(from,from),[]);assert.throws(()=>segmentWaypoints(from,to,9));
});

test('eight independent public routes remain distinct, including opposite sides',()=>{
 for(const layout of ['desktop','phone']){
  const views=exteriorPlan(layout);assert.equal(views.length,8);assert.equal(new Set(views.map(v=>v.name)).size,8);
  for(const id of Object.keys(assetPins)){
   const endpoints=views.filter(v=>v.id===id).map(v=>v.waypoints.at(-1));assert.equal(endpoints.length,4);
   assert(endpoints.some(p=>p.u>0)&&endpoints.some(p=>p.u<0));
   assert(endpoints.some(p=>p.v>0)&&endpoints.some(p=>p.v<0));
   assert(endpoints.every(p=>Math.hypot(p.u,p.v)<175));
  }
 }
 assert.throws(()=>exteriorPlan('other'));
 assert.deepEqual(galleryViewport('phone'),{width:844,height:390});
 assert.deepEqual(galleryViewport('desktop'),{width:1280,height:800});
 assert.deepEqual(worldPoint({center:[10,20],yaw:0},{u:3,v:4}),{x:13,z:16});
 assert.equal(headingTo({x:0,z:0},{x:1,z:0}),Math.PI/2);
});

test('actual pinned LOD0 bytes include roof, cornice, steps and complete wings',async()=>{
 const expected={
  '107227742':{min:[-7.010000228881836,0,-38.209999084472656],max:[7.010000228881836,9.822516441345215,41.040000915527344],vertices:1802},
  '107310050':{min:[-21.600000381469727,0,-41.005001068115234],max:[22.750638961791992,25.875,41.755001068115234],vertices:11400},
 };
 for(const [id,pin] of Object.entries(assetPins)){
  const bytes=await readFile(resolve(dist,'belle/staged-architecture',pin.file)),bounds=modelBounds(bytes,id);
  for(const key of ['min','max','vertices'])assert.deepEqual(bounds[key],expected[id][key]);
  assert.equal(bounds.positions.length,bounds.vertices*3);assert.equal(JSON.stringify(bounds).includes('positions'),false);
  const camera={matrixWorldInverse:identity,projectionMatrix:[.001,0,0,0,0,.001,0,0,0,0,.001,0,0,0,0,1]};
  const fit=projectedModel(bounds,identity,camera);assert.equal(fit.verticesChecked,bounds.vertices);assert.equal(fit.framed,true);
  assert.equal(projectedModel(bounds,translate(2000,0,0),camera).framed,false);
  const changed=Buffer.from(bytes);changed[changed.length-1]^=1;
  assert.throws(()=>modelBounds(changed,id),/Actual model bytes changed/);
 }
});

test('framing uses the observed model transform and real camera clipping convention',()=>{
 const bounds={min:[-1,-1,-1],max:[1,1,1]},near=1,far=100;
 const camera={matrixWorldInverse:identity,projectionMatrix:[1,0,0,0,0,1,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]};
 assert.equal(projectedBounds(bounds,translate(0,0,-10),camera).framed,true);
 assert.equal(projectedBounds(bounds,translate(9,0,-10),camera).framed,false);
 assert.equal(projectedBounds(bounds,translate(0,0,10),camera).framed,false);
 assert.equal(projectedBounds(bounds,translate(0,0,-101),camera).framed,false);
 assert.deepEqual(projectedBounds(bounds,translate(2,3,-10),camera).corners[0].world,[1,2,-11]);
 const node={name:'107227742_STAGED_LOD0',worldVisible:true,matrixWorld:translate(20,2,-40)};
 assert.equal(observedModelTransform({inventory:{nodes:[node]}},'107227742'),node);
 assert.throws(()=>observedModelTransform({inventory:{nodes:[node,node]}},'107227742'));
 assert.throws(()=>observedModelTransform({inventory:{nodes:[{...node,worldVisible:false}]}},'107227742'));
 assert.throws(()=>projectedBounds(bounds,[],camera));
});

function inputFixture(){
 const views=exteriorPlan('desktop'),events=[{type:'click',target:'#start',trusted:true}];
 for(const [target,value] of [['#quality','high'],['#fps','60'],['#sky-preset','12'],['#sky-clouds','clear']])
  for(const type of ['input','change'])events.push({type,target,value,trusted:true,phase:'configure-exterior',settingsOpen:true});
 for(const view of views){
  events.push({type:'click',trusted:true,text:view.guideTravel,landmark:view.guideId==='107227742'?'Belle Isle Aquarium':'Anna Scripps Whitcomb Conservatory'});
  for(const code of ['KeyF','KeyV','KeyW'])for(const type of ['keydown','keyup'])events.push({type,code,trusted:true,phase:'walk-'+view.name+'-0-0'});
 }
 return{views,evidence:{events,overflow:false,held:[],focusLossDuringInput:[]}};
}
test('native input contract rejects synthetic data, missing releases and reused Guide starts',()=>{
 const {views,evidence}=inputFixture();assert.doesNotThrow(()=>assertExteriorEvidence(evidence,views,'desktop'));
 for(const mutate of [e=>{e.events[0].trusted=false;},e=>{e.held=['KeyW'];},e=>{e.focusLossDuringInput=[{reason:'blur'}];},
  e=>{e.events=e.events.filter(row=>!(row.type==='keyup'&&row.code==='KeyW'&&row.phase.includes('aquarium-rear')));},
  e=>{const guides=e.events.flatMap((row,i)=>row.text==='Travel to entrance'?[i]:[]);e.events.splice(guides[1],1);},
  e=>{e.overflow=true;},e=>{e.events=e.events.filter(row=>row.target!=='#quality');}]){
  const changed=structuredClone(evidence);mutate(changed);assert.throws(()=>assertExteriorEvidence(changed,views,'desktop'));
 }
});

test('landscape mobile gallery requires actual Smooth/30 at full native scale',()=>{
 const settings={quality:'smooth',effectiveQuality:'smooth',fps:'30',frameCap:30,adaptiveScale:1,pixelRatio:1,
  width:844,height:390,devicePixelRatio:1,reducedMotion:true,focused:true,visible:true,skyCycle:false,skyHour:12,clouds:'clear'};
 assertGallerySettings(settings,'phone');
 for(const changed of [{quality:'high'},{width:390,height:844},{adaptiveScale:.75},{pixelRatio:.5},{focused:false},{skyCycle:true}])
  assert.throws(()=>assertGallerySettings({...settings,...changed},'phone'));
});

test('generation preserves all pinned sources and cannot accept a modified driver',async()=>{
 const work=await mkdtemp(resolve(tmpdir(),'pr213-exterior-contract-'));
 try{
  const receipt=await buildDriver({game,out:resolve(work,'generated')});
  execFileSync(process.execPath,['--check',receipt.output]);
  const derived=await readFile(receipt.output,'utf8');assert.equal(sha256(derived),receipt.derivedSha256);
  assert(derived.includes('await exteriorRoute();'));assert(derived.includes('assertExteriorEvidence(report.nativeEvidence,exteriorViews,layout)'));
  assert(!derived.includes("await capture('aquarium-entry',AQUARIUM)"));
  for(const [name,pin] of Object.entries(sourcePins))assert.equal(sha256(await readFile(resolve(game,'scripts',name))),pin);
  const changed=resolve(work,'changed');await mkdir(resolve(changed,'scripts'),{recursive:true});
  for(const name of Object.keys(sourcePins))await writeFile(resolve(changed,'scripts',name),await readFile(resolve(game,'scripts',name)));
  await writeFile(resolve(changed,'scripts/staged-landmark-walk-proof.mjs'),derived);
  await assert.rejects(buildDriver({game:changed,out:resolve(work,'rejected')}),/Pinned source changed/);
 }finally{await rm(work,{recursive:true,force:true});}
});
