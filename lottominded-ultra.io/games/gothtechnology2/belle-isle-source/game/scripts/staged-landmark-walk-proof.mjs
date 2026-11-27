/** Opt-in PR213 evidence in the actual built island. The public Guide and
 * trusted browser keys move the actor. The staging observer has no setters.
 * This is functional/geometry evidence, not a hardware FPS certification. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runExteriorProof,assertExteriorEvidence} from './staged-landmark-exterior-proof.mjs';

const AQUARIUM='107227742',CONSERVATORY='107310050';
const STAGED_FLAG='VITE_STAGED_BELLE_ARCHITECTURE=1';
const CASE_MS=32*60_000;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const angle=value=>Math.atan2(Math.sin(value),Math.cos(value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const site=(snapshot,id)=>{const value=snapshot.sites.find(item=>item.id===id);assert(value,'Missing observed site '+id);return value;};
const finitePoint=value=>value&&['x','y','z'].every(key=>Number.isFinite(value[key]));

export function readEntrancePulse(events,{name,key}){
 const rows=events.filter(event=>event.phase===name&&event.code==='Key'+key.toUpperCase()&&['keydown','keyup'].includes(event.type));
 assert.equal(rows.length,2,'Each entrance pulse requires exactly one native keydown and keyup');
 assert(rows[0].type==='keydown'&&rows[1].type==='keyup'&&rows.every(row=>row.trusted&&Number.isFinite(row.at))&&rows[1].at>rows[0].at,'Entrance pulse events must be trusted, ordered and advancing');
 return{keydownAt:rows[0].at,keyupAt:rows[1].at,heldMilliseconds:rows[1].at-rows[0].at};
}

/** Keep the original four corrections and 0.15-radian acceptance. A finite
 * native key pulse ends before observing the result, so observation latency
 * cannot keep steering through the target while a heading poll is pending. */
export async function turnEntranceHeading({heading,name,receipt,motion,phase,setFirstPerson,focusCanvas,pulse,settleHeading}){
 assert(Number.isFinite(heading),'Missing finite entrance heading');
 Object.assign(receipt,{name,heading,tolerance:.15,maximumCorrections:4,before:await motion(),pulses:[],after:null,complete:false});
 assert(receipt.before.actor?.onFoot&&Number.isFinite(receipt.before.actor.headingY),'Entrance turn must begin with the actual on-foot actor');
 await phase(name+'-tpp');await setFirstPerson(false);await focusCanvas();
 let current=await settleHeading(name+'-initial-settled'),radiansPerRequestedMs=2.7/1000;
 for(let attempt=0;attempt<4;attempt++){
  assert(current.actor?.onFoot&&!current.actor.firstPerson&&Number.isFinite(current.actor.headingY),'Native entrance turn left third-person walking');
  const delta=angle(heading-current.actor.headingY);if(Math.abs(delta)<=.15)break;
  const key=delta>0?'a':'d',milliseconds=Math.min(900,Math.max(8,Math.abs(delta)/radiansPerRequestedMs*.75));
  const correction={name:name+'-pulse-'+attempt,key,milliseconds,radiansPerRequestedMs,before:current,after:null};receipt.pulses.push(correction);
  await phase(correction.name);correction.native=await pulse(key,milliseconds,correction.name);
  current=await settleHeading(correction.name+'-settled');correction.after=current;
  correction.observedTurnRadians=angle(current.actor.headingY-correction.before.actor.headingY);
  assert(current.actor.onFoot&&!current.actor.firstPerson&&distance(correction.before.actor,current.actor)<.015,'An entrance pulse changed the stationary walking mode');
  // Use the fully settled native response to account for dispatch latency and
  // the unchanged main-loop time cap. Ignored or wrong-direction input cannot
  // supply a useful gain and remains subject to the original final gate.
  if(Math.sign(correction.observedTurnRadians)===Math.sign(delta)&&Math.abs(correction.observedTurnRadians)>0)
   radiansPerRequestedMs=Math.abs(correction.observedTurnRadians)/milliseconds;
 }
 assert(Math.abs(angle(heading-current.actor.headingY))<=.15,'Native heading turn did not reach the intended obstacle');
 await phase(name+'-fpp');await setFirstPerson(true);current=await settleHeading(name+'-final-settled');receipt.after=current;
 receipt.finalErrorRadians=Math.abs(angle(heading-current.actor.headingY));
 assert(current.actor.onFoot&&current.actor.firstPerson,'Native entrance turn did not restore the walking camera');
 assert(receipt.finalErrorRadians<=.15,'Native heading changed after restoring the walking camera');
 assert(distance(receipt.before.actor,current.actor)<.015,'A stationary entrance turn moved the actual actor');
 receipt.complete=true;return receipt;
}

export function assertEntranceTurns(report){
 assert.equal(report.entranceTurns?.length,2,'Both original contact turns require receipts');
 for(const [index,name]of['aquarium-tank-contact-turn','conservatory-wall-contact-turn'].entries()){
  const turn=report.entranceTurns[index];
  assert(turn.name===name&&turn.complete&&turn.tolerance===.15&&turn.maximumCorrections===4,'The original entrance heading limits changed');
  assert(turn.before.actor.onFoot&&turn.after.actor.onFoot&&turn.after.actor.firstPerson,'Entrance turn did not remain on foot');
  assert(turn.finalErrorRadians===Math.abs(angle(turn.heading-turn.after.actor.headingY))&&turn.finalErrorRadians<=.15,'Missing actual accepted entrance heading');
  assert(distance(turn.before.actor,turn.after.actor)<.015&&turn.pulses.length<=4,'Entrance turn changed position or its correction limit');
  let radiansPerRequestedMs=2.7/1000;
  for(const correction of turn.pulses){
   assert(correction.after&&correction.milliseconds>=8&&correction.milliseconds<=900&&['a','d'].includes(correction.key),'Missing bounded native entrance pulse');
   const delta=angle(turn.heading-correction.before.actor.headingY);
   assert.equal(correction.key,delta>0?'a':'d');assert.equal(correction.radiansPerRequestedMs,radiansPerRequestedMs);
   assert.equal(correction.milliseconds,Math.min(900,Math.max(8,Math.abs(delta)/radiansPerRequestedMs*.75)));
   assert.equal(correction.observedTurnRadians,angle(correction.after.actor.headingY-correction.before.actor.headingY));
   assert(correction.before.actor.onFoot&&correction.after.actor.onFoot&&!correction.before.actor.firstPerson&&!correction.after.actor.firstPerson&&distance(correction.before.actor,correction.after.actor)<.015,'A pulse changed the stationary third-person actor');
   assert.deepEqual(correction.native,readEntrancePulse(report.nativeEvidence.events,correction),'Native entrance pulse timing does not match its actual events');
   if(Math.sign(correction.observedTurnRadians)===Math.sign(delta)&&Math.abs(correction.observedTurnRadians)>0)
    radiansPerRequestedMs=Math.abs(correction.observedTurnRadians)/correction.milliseconds;
  }
 }
}

export function assertNativeEvidence(evidence){
 assert(evidence&&evidence.events.length>0,'No native input receipts');
 assert.equal(evidence.overflow,false,'Native evidence overflowed');
 assert(evidence.events.every(event=>event.trusted),'Untrusted input was observed');
 for(const code of ['KeyW','KeyF','KeyV']){
  assert(evidence.events.some(e=>e.type==='keydown'&&e.code===code),'Missing genuine '+code+' keydown');
  assert(evidence.events.some(e=>e.type==='keyup'&&e.code===code),'Missing genuine '+code+' keyup');
 }
 assert(evidence.events.some(e=>e.type==='click'&&e.target==='#start'),'Missing native Start click');
 assert(evidence.events.some(e=>e.type==='click'&&e.text==='Travel to entrance'&&e.landmark==='Belle Isle Aquarium'),'Missing public Aquarium Travel action');
 assert(evidence.events.some(e=>e.type==='click'&&e.text==='Travel to path'&&e.landmark==='Anna Scripps Whitcomb Conservatory'),'Missing public Conservatory Travel action');
 assert(evidence.events.some(e=>e.type==='click'&&e.text==='Explore Palm House on foot'&&e.landmark==='Anna Scripps Whitcomb Conservatory'),'Missing public Explore action');
 assert(evidence.events.some(e=>e.type==='keydown'&&['KeyA','KeyD'].includes(e.code)),'Missing a native heading turn');
 for(const phase of ['aquarium-native-entry','aquarium-native-gallery','aquarium-tank-contact','conservatory-native-entry',
  'conservatory-native-vestibule','conservatory-wall-contact','conservatory-native-palm-house']){
  assert(evidence.events.some(e=>e.phase===phase&&e.type==='keydown'&&e.code==='KeyW'),'Missing native walk keydown for '+phase);
  assert(evidence.events.some(e=>e.phase===phase&&e.type==='keyup'&&e.code==='KeyW'),'Missing native walk keyup for '+phase);
 }
 assert.deepEqual(evidence.focusLossDuringInput,[],'The page lost focus or visibility while movement keys were held');
 assert.deepEqual(evidence.held,[],'Native keys remained held');
}

export function assertPassage({before,after,trace,id,axis,boundary,clearHalfWidth}){
 const start=site(before,id).local,end=site(after,id).local;
 assert(start[axis]<boundary&&end[axis]>boundary,'The actor did not cross the entrance plane');
 assert(after.frames>before.frames+3,'No genuine frame progression through the entrance');
 assert(distance(before.actor,after.actor)>5,'The entrance route did not move the actual actor at least 5m');
 assert(after.actor.onFoot&&after.actor.footBlend>.99,'The crossing did not end on foot');
 const other=axis==='u'?'v':'u';
 const crossing=trace.filter(s=>Math.abs(site(s,id).local[axis]-boundary)<.8);
 assert(crossing.length>0,'No observed actor samples at the entrance');
 assert(crossing.every(s=>Math.abs(site(s,id).local[other])<=clearHalfWidth-.27+.08),'The actor crossed outside the existing doorway clearance');
 assert(trace.every(s=>s.actor.onFoot),'The route changed out of walking mode');
 return{source:'actual native-key trajectory',id,boundary,axis,start,end,frames:after.frames-before.frames,
  movedMetres:distance(before.actor,after.actor),crossingSamples:crossing.length,bodyRadius:.27,clearHalfWidth};
}

export function assertContact({before,after,trace,id,axis}){
 assert(trace.length>=9,'Insufficient contact trajectory');
 const tail=trace.slice(-8),travel=distance(before.actor,after.actor);
 assert(travel>1.5,'No meaningful approach movement preceded the contact');
 assert(['u','v'].includes(axis),'Missing the authored obstacle normal');
 const tangent=axis==='u'?'v':'u',firstLocal=site(tail[0],id).local;
 const normalTravel=Math.abs(site(after,id).local[axis]-site(before,id).local[axis]);
 assert(normalTravel>1.5,'No meaningful movement toward the obstacle normal');
 assert(tail.at(-1).frames-tail[0].frames>=7,'The actor did not continue receiving real frames at contact');
 const normalMaximum=Math.max(...tail.map(s=>Math.abs(site(s,id).local[axis]-firstLocal[axis])));
 const tangentMaximum=Math.max(...tail.map(s=>Math.abs(site(s,id).local[tangent]-firstLocal[tangent])));
 assert(normalMaximum<.05,'The existing collision did not stop penetration under held movement input');
 assert(tangentMaximum<.8,'Tangential movement exceeded the sampled wall-contact region');
 assert(tail.every(s=>s.actor.onFoot),'Contact was not measured on foot');
 const probe=after.actor.forwardProbe;
 assert.equal(probe.radius,.27,'Collision evidence changed the existing body radius');
 assert.deepEqual(probe.bodyHeights,[.62,1.1,1.58],'Collision evidence changed the standing sweep heights');
 assert.equal(probe.maxDistance,.7,'Collision evidence changed the forward sweep length');
 assert.equal(probe.sweptHits.length,3,'Missing original terrain sweep heights');
 const visualSweeps=after.actor.visibleForwardSweeps;
 assert.equal(visualSweeps?.length,3,'Missing same-radius visible triangle sweeps');
 for(let i=0;i<3;i++){
  const visual=visualSweeps[i],height=probe.bodyHeights[i];
  assert.equal(visual.height,height);assert.equal(visual.radius,probe.radius);assert.equal(visual.maxDistance,probe.maxDistance);
  const origin=[after.actor.x,after.actor.y+height,after.actor.z],direction=[Math.sin(after.actor.headingY),0,Math.cos(after.actor.headingY)];
  assert(visual.origin?.length===3&&visual.origin.every((v,j)=>v===origin[j]),'Visible sweep moved the actual actor origin');
  assert(visual.direction?.length===3&&visual.direction.every((v,j)=>v===direction[j]),'Visible sweep changed the actual heading');
  assert.deepEqual(visual.unsupportedMeshes,[],'Visible triangle coverage contains unsupported geometry');
  assert(Number.isSafeInteger(visual.checkedTriangles)&&visual.checkedTriangles>=0);
  if(visual.hit){
   const hit=visual.hit;assert(visual.checkedTriangles>0&&Number.isFinite(hit.distance)&&hit.distance>=0&&hit.distance<=probe.maxDistance,'Invalid forward visible sphere hit');
   assert(['face','edge','vertex','initial-overlap'].includes(hit.feature)&&typeof hit.mesh==='string'&&hit.mesh.length>0);
   assert(Number.isSafeInteger(hit.faceIndex)&&hit.faceIndex>=0&&hit.vertexIndices?.length===3&&hit.vertexIndices.every(v=>Number.isSafeInteger(v)&&v>=0));
   assert(hit.triangle?.length===3&&hit.triangle.every(p=>p.length===3&&p.every(Number.isFinite))&&hit.point?.length===3&&hit.point.every(Number.isFinite));
   const subtract=(a,b)=>a.map((v,j)=>v-b[j]),dot=(a,b)=>a.reduce((sum,v,j)=>sum+v*b[j],0);
   const [a,b,c]=hit.triangle,u=subtract(b,a),v=subtract(c,a),w=subtract(hit.point,a),uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),wu=dot(w,u),wv=dot(w,v),den=uu*vv-uv*uv;
   const beta=(wu*vv-wv*uv)/den,gamma=(wv*uu-wu*uv)/den;
   const reconstructed=a.map((x,j)=>x+beta*u[j]+gamma*v[j]);
   assert(den>0&&beta>=-1e-9&&gamma>=-1e-9&&beta+gamma<=1+1e-9&&Math.hypot(...subtract(hit.point,reconstructed))<1e-7,'Visible contact point is outside its actual finite triangle');
   const separation=Math.hypot(...hit.point.map((v,j)=>v-(origin[j]+direction[j]*hit.distance)));
   assert(hit.feature==='initial-overlap'?hit.distance===0&&separation<=probe.radius+1e-7:Math.abs(separation-probe.radius)<1e-7,'Visible evidence is not a real same-radius swept-sphere contact');
  }
 }
 const pairs=probe.sweptHits.flatMap((hit,i)=>{
  if(hit===null||!Number.isFinite(hit)||hit<0||hit>probe.maxDistance)return[];
  const visual=visualSweeps[i];
  return visual.hit?[{height:probe.bodyHeights[i],sweptHit:hit,visual,
   surfaceDifferenceMetres:Math.abs(visual.hit.distance-hit)}]:[];
 });
 assert(probe.blocked||probe.sweptHits.some(hit=>hit!==null&&Number.isFinite(hit)&&hit<=probe.maxDistance),'No real terrain obstruction ahead at the stop');
 assert(pairs.some(pair=>pair.surfaceDifferenceMetres<=.35),'The visible surface and existing collision contact differ by more than 0.35m, or a visible surface is missing');
 return{id,source:'native held W, advancing actor frames, existing terrain sweep and same-radius visible triangle sweeps',
  movedMetres:travel,obstacleNormalAxis:axis,normalTravelMetres:normalTravel,plateauFrames:tail.at(-1).frames-tail[0].frames,
  normalMaximumMetres:normalMaximum,tangentialMaximumMetres:tangentMaximum,probe,visualPairs:pairs,visibleForwardSurfaces:after.actor.visibleForwardSurfaces,
  surfaceAgreementToleranceMetres:.35,scope:'This sampled contact only; not complete architectural collider parity'};
}

function assertSnapshot(snapshot,id,{near=true}={}){
 assert(snapshot.ready,'Staged observer is not ready');
 assert(Number.isSafeInteger(snapshot.frames)&&snapshot.frames>0,'Missing actual view frame counter');
 assert(finitePoint(snapshot.actor),'Missing finite actual actor pose');
 assert(snapshot.camera?.position?.length===3&&snapshot.camera.position.every(Number.isFinite),'Missing finite actual camera position');
 assert(snapshot.camera?.direction?.length===3&&snapshot.camera.direction.every(Number.isFinite),'Missing finite actual camera direction');
 for(const observed of snapshot.sites){
  assert.equal(observed.installedLods,3,'The staged three-level LOD root is not installed');
  assert.deepEqual(observed.attachedLegacyFacades,[],'A replaced legacy facade is still attached');
 }
 const observed=site(snapshot,id);
 if(near)assert.deepEqual(observed.selectedLevels,[0],'Near-camera evidence must show the full staged model');
 const required=id===AQUARIUM?['Aquarium illuminated habitat','Aquarium aged handrails','Aquarium worn step nosings']:
  ['Conservatory concrete paving','Timber','Water lily golden heart'];
 for(const name of required){
  const authored=id+'_'+name;
  assert(observed.retainedDetails.includes(authored),'Required retained detail is missing: '+name);
  assert(observed.retainedDetailNodes?.some(node=>node.authored===authored&&typeof node.loaded==='string'&&node.loaded.startsWith(id+'_')),
   'Required detail has no actual loaded-node receipt: '+name);
 }
 return snapshot;
}

export async function run(){
 const game=resolve(process.env.STAGED_LANDMARK_GAME_DIR||resolve(import.meta.dirname,'..'));
 const dist=resolve(process.env.STAGED_LANDMARK_DIST||resolve(game,'dist'));
 const layout=process.env.STAGED_LANDMARK_LAYOUT||'desktop';
 assert(['desktop','phone'].includes(layout),'Unknown staged walk layout');
 const scope=process.env.STAGED_LANDMARK_SCOPE||'entrances';
 assert(['entrances','exterior'].includes(scope),'Unknown staged architecture scope');
 const out=resolve(process.env.STAGED_LANDMARK_OUT||resolve(game,scope==='exterior'?'output/staged-landmark-exterior-proof':'output/staged-landmark-walk-proof',layout));
 const checkout=execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim();
 const source=process.env.STAGED_LANDMARK_SOURCE_SHA||checkout;
 assert.match(source,/^[0-9a-f]{40}$/);assert.equal(checkout,source,'Checkout must match the requested candidate head');
 const viewport=layout==='phone'?{width:390,height:844}:{width:1280,height:800},started=Date.now();
 const requireMetal=process.env.ENV_GALLERY_REQUIRE_METAL==='1';
 const requestedRenderer=process.env.STAGED_LANDMARK_RENDERER||(requireMetal?'metal':'software');
 assert(['metal','software'].includes(requestedRenderer),'Unknown requested renderer');
 if(requireMetal)assert.equal(requestedRenderer,'metal','The native Metal lane cannot select software rendering');
 if(requestedRenderer==='metal')assert.equal(process.platform,'darwin','The strict Metal proof requires macOS');
 const report={version:1,passed:false,source,checkout,run:process.env.GITHUB_RUN_ID||null,startedAt:new Date(started).toISOString(),
  phase:'setup',scope,layout,viewport,deviceScaleFactor:1,requestedRenderer,stagedFlag:STAGED_FLAG,caseBudgetMs:CASE_MS,snapshots:[],captures:[],passages:[],contacts:[],entranceTurns:[],errors:[],failedRequests:[],
  limitations:'Actual staged full island, original terrain/colliders, normal default graphics, reduced motion, trusted native browser controls and genuine compositor PNGs. Functional evidence on the recorded renderer; not hardware FPS, physical-device certification, full collision parity or human visual approval.'};
 await mkdir(out,{recursive:true});
 const require=createRequire(resolve(game,'../../package.json'));
 const {chromium,expect:baseExpect}=require('@playwright/test'),expect=baseExpect.configure({timeout:90_000});
 const {createCoopStaticServer}=await import(pathToFileURL(resolve(game,'scripts/coop-static-server.mjs')).href);
 const {captureCadillacViewportPng}=await import(pathToFileURL(resolve(game,'scripts/cadillac-cdp-viewport-png.mjs')).href);
 const server=createCoopStaticServer(dist),ownedKeys=new Set();
 let browser,context,page,client,stopped=false,budgetTimer;
 const checkBudget=()=>{if(stopped||Date.now()-started>=CASE_MS)throw Error('Staged walk case exceeded its 32-minute budget');};
 const bounded=async(promise,ms,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded its deadline')),ms);})]);}finally{clearTimeout(timer);}};
 const phase=async name=>{
  checkBudget();report.phase=name;console.log(new Date().toISOString()+' staged-landmarks '+name);
  if(page)await page.evaluate(value=>{window.__stagedWalkNativeEvidence.phase=value;},name);
 };
 const snapshot=async()=>{checkBudget();return page.evaluate(()=>window.__stagedLandmarkProof.snapshot());};
 const motion=async()=>{checkBudget();return page.evaluate(()=>window.__stagedLandmarkProof.motion());};
 const keyDown=async key=>{checkBudget();ownedKeys.add(key);await page.keyboard.down(key);};
 const keyUp=async key=>{try{await page.keyboard.up(key);}finally{ownedKeys.delete(key);}};
 const press=async key=>{await keyDown(key);await keyUp(key);};
 const releaseOwned=async()=>{const failures=[];for(const key of [...ownedKeys])try{await keyUp(key);}catch(error){failures.push(String(error));}return failures;};
 const focusCanvas=async()=>{checkBudget();await page.locator('#game').click({position:{x:viewport.width*.58,y:viewport.height*.55}});await expect(page.locator('#game')).toBeFocused();};

 async function waitMotion(rule,timeout=180_000){
  checkBudget();
  const handle=await page.waitForFunction(({rule,phase})=>{
   const api=window.__stagedLandmarkProof,e=window.__stagedWalkNativeEvidence;
   if(!api||!api.frame())return false;
   const row=api.motion();if(!row.actor)return false;
   const trace=e.traces[phase]??=[];
   if(!trace.length||trace.at(-1).frames!==row.frames){
    if(trace.length>=4096){e.overflow=true;throw Error('Movement trace overflow');}
    trace.push(row);
   }
   if(rule.type==='frames')return row.frames>=rule.target?row:false;
   if(rule.type==='on-foot')return row.actor.onFoot&&row.actor.footBlend>.99?row:false;
   if(!row.actor.onFoot)throw Error('The native walk changed out of on-foot mode');
   if(rule.type==='target'){
    const local=row.sites.find(s=>s.id===rule.id)?.local;
    if(!local)throw Error('Missing actual site-local actor pose');
    return (local[rule.axis]-rule.value)*rule.sign>=0?row:false;
   }
   if(rule.type==='world-target'){
    const dx=row.actor.x-rule.x,dz=row.actor.z-rule.z,progress=dx*rule.dx+dz*rule.dz;
    if(Math.abs(dx*rule.dz-dz*rule.dx)>rule.maxLateral)throw Error('Native exterior walk departed its observed route corridor');
    if(progress<rule.length-.1)return false;
    return row;
   }
   if(rule.type==='turn'){
    const progress=Math.atan2(Math.sin(row.actor.headingY-rule.start),Math.cos(row.actor.headingY-rule.start))*rule.sign;
    return progress>=rule.radians-.08?row:false;
   }
   if(rule.type==='settled'){
    if(trace.length<4)return false;
    const tail=trace.slice(-4),first=tail[0];
    return row.frames-first.frames>=3&&tail.every(s=>Math.hypot(s.actor.x-first.actor.x,s.actor.z-first.actor.z)<.015)?row:false;
   }
   if(rule.type==='heading-settled'){
    if(trace.length<4)return false;
    const tail=trace.slice(-4),first=tail[0];
    return row.frames-first.frames>=3&&tail.every(s=>Math.hypot(s.actor.x-first.actor.x,s.actor.z-first.actor.z)<.015&&
     Math.abs(Math.atan2(Math.sin(s.actor.headingY-row.actor.headingY),Math.cos(s.actor.headingY-row.actor.headingY)))<.002)?row:false;
   }
   if(rule.type==='contact'){
    if(trace.length<9||Math.hypot(row.actor.x-rule.x,row.actor.z-rule.z)<=1.5)return false;
    const tail=trace.slice(-8),first=tail[0],local=s=>s.sites.find(site=>site.id===rule.id).local;
    const firstLocal=local(first),tangent=rule.axis==='u'?'v':'u';
    return row.frames-first.frames>=7&&tail.every(s=>Math.abs(local(s)[rule.axis]-firstLocal[rule.axis])<.05&&Math.abs(local(s)[tangent]-firstLocal[tangent])<.8)?row:false;
   }
   throw Error('Unknown motion rule');
  },{rule,phase:report.phase},{polling:rule.type==='world-target'?16:100,timeout:Math.min(timeout,CASE_MS-(Date.now()-started))});
  try{return await handle.jsonValue();}finally{await handle.dispose();}
 }
 const frames=async count=>{const before=await motion();return waitMotion({type:'frames',target:before.frames+count});};
 const trace=async name=>page.evaluate(name=>window.__stagedWalkNativeEvidence.traces[name]||[],name);
 async function settle(name){await phase('settle-'+name);await waitMotion({type:'settled'});}
 async function setFirstPerson(wanted){
  const observed=await motion();
  if(observed.actor.firstPerson!==wanted){await focusCanvas();await press('v');await frames(2);}
  await expect(page.locator('#view')).toHaveAttribute('aria-pressed',String(wanted));
  assert.equal((await motion()).actor.firstPerson,wanted,'Actual camera mode did not follow native V');
 }
 async function guideAction(id,label){
  await phase('guide-'+id+'-'+label.toLowerCase().replaceAll(' ','-'));
  if(!await page.locator('#map-open').isVisible())await page.locator('#tools-toggle').click();
  await page.locator('#map-open').click();await expect(page.locator('#guide')).toBeVisible();
  const title=id===AQUARIUM?'Belle Isle Aquarium':'Anna Scripps Whitcomb Conservatory';
  const card=page.locator('#guide article.landmark').filter({has:page.getByRole('heading',{name:title,exact:true})});
  assert.equal(await card.count(),1,'Expected one public landmark card');
  await card.getByRole('button',{name:label,exact:true}).click();
  await expect(page.locator('#guide')).not.toBeVisible();await focusCanvas();await frames(3);
 }
 async function dismount(){
  await focusCanvas();assert.equal((await motion()).actor.onFoot,false,'Travel must start from the normal mounted state');
  await press('f');await waitMotion({type:'on-foot'});await frames(3);await setFirstPerson(true);
 }
 async function walkTo(name,id,axis,value){
  await phase(name);await focusCanvas();const before=await snapshot();
  const sign=Math.sign(value-site(before,id).local[axis]);assert.equal(sign,1,'This authored forward route must increase its local axis');
  await keyDown('w');try{await waitMotion({type:'target',id,axis,value,sign},300_000);}finally{await keyUp('w');}
  await settle(name);const after=await snapshot();
  assert(distance(before.actor,after.actor)>1,'No genuine movement on '+name);
  return{before,after,trace:await trace(name)};
 }
 async function turnTo(heading,name){
  const receipt={};report.entranceTurns.push(receipt);
  await turnEntranceHeading({heading,name,receipt,motion,phase,setFirstPerson,focusCanvas,
   pulse:async(key,milliseconds,name)=>{
    await keyDown(key);try{await new Promise(resolve=>setTimeout(resolve,milliseconds));}finally{await keyUp(key);}
    const events=await page.evaluate(name=>window.__stagedWalkNativeEvidence.events.filter(event=>event.phase===name),name);
    return readEntrancePulse(events,{name,key});
   },
   settleHeading:async label=>{await phase(label);return waitMotion({type:'heading-settled'});}});
 }
 async function contact(name,id,du,dv){
  const cfg=site(await snapshot(),id).layout;
  const dx=Math.cos(cfg.yaw)*du-Math.sin(cfg.yaw)*dv,dz=-Math.sin(cfg.yaw)*du-Math.cos(cfg.yaw)*dv;
  await turnTo(Math.atan2(dx,dz),name+'-turn');await phase(name);await focusCanvas();
  const before=await snapshot(),axis=du?'u':'v';await keyDown('w');
  let after,contactFailure;
  try{await waitMotion({type:'contact',id,axis,x:before.actor.x,z:before.actor.z},300_000);after=await snapshot();}
  catch(error){contactFailure=error;}
  finally{await keyUp('w');}
  after??=await snapshot();const trajectory=await trace(name);
  try{
   if(contactFailure)throw contactFailure;
   const result=assertContact({before,after,trace:trajectory,id,axis});
   report.contacts.push({name,passed:true,...result});
  }catch(error){
   // Keep the failure and its real pose/query evidence, then collect the other
   // requested camera views. A failed contact can never produce a passing case.
   report.contacts.push({name,id,passed:false,error:String(error),obstacleNormalAxis:axis,
    probe:after.actor.forwardProbe,visibleForwardSurfaces:after.actor.visibleForwardSurfaces,visibleForwardSweeps:after.actor.visibleForwardSweeps});
   report.errors.push(name+': '+String(error));
  }
  report.snapshots.push({name,before,after,trace:trajectory});await settle(name);await capture(name,id);
 }
 async function painted(){
  return page.evaluate(()=>new Promise((yes,no)=>{
   const canvas=document.querySelector('#game'),gl=canvas?.getContext('webgl2');
   if(!gl||gl.isContextLost()||!canvas.width||!canvas.height)return no(Error('A live game WebGL2 canvas is required'));
   const debug=gl.getExtension('WEBGL_debug_renderer_info'),renderer=gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER);
   const submittedAt=performance.now(),sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)return no(Error('Missing GPU completion fence'));
   let frame=0,done=false;const deadline=setTimeout(()=>finish(Error('Canvas completion exceeded 45 seconds')),45000);gl.flush();
   function finish(error,value){if(done)return;done=true;clearTimeout(deadline);cancelAnimationFrame(frame);gl.deleteSync(sync);error?no(error):yes(value);}
   function poll(){
    if(gl.isContextLost())return finish(Error('Game WebGL context lost'));
    const status=gl.clientWaitSync(sync,0,0);
    if(status===gl.TIMEOUT_EXPIRED){frame=requestAnimationFrame(poll);return;}
    if(status!==gl.ALREADY_SIGNALED&&status!==gl.CONDITION_SATISFIED)return finish(Error('Game GPU fence failed'));
    const completedAt=performance.now();frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>finish(null,{renderer,submittedAt,completedAt,paintOpportunities:2,width:canvas.width,height:canvas.height}));});
   }frame=requestAnimationFrame(poll);
  }));
 }
 async function capture(name,id,options){
  checkBudget();const gpu=await painted();
  if(requestedRenderer==='metal'){
   assert.match(gpu.renderer,/Metal/i,'The strict native lane requires an actual Metal renderer');
   assert.doesNotMatch(gpu.renderer,/SwiftShader|llvmpipe|software rasterizer/i,'No software fallback is allowed in the Metal lane');
  }else assert.match(gpu.renderer,/SwiftShader/i,'The software proof must identify its renderer honestly');
  const before=assertSnapshot(await snapshot(),id,options),file=name+'.png';
  const bytes=await bounded(captureCadillacViewportPng({client,viewport,path:resolve(out,file)}),150_000,'Native viewport PNG');
  const after=assertSnapshot(await snapshot(),id,options);assert(distance(before.actor,after.actor)<.1,'Actor moved while the screenshot was being captured');
  report.captures.push({name,file,id,sha256:hash(bytes),bytes:bytes.length,layout,viewport,gpu,before,after,
   place:await page.locator('#place').textContent()});
 }
 async function exercise(){
  const marker=JSON.parse(await readFile(resolve(dist,'staged-landmark-proof-build.json'),'utf8'));
  assert.equal(marker.sourceSha,source);assert.equal(marker.indexSha256,hash(await readFile(resolve(dist,'index.html'))));
  assert.equal(marker.stagedFlag,STAGED_FLAG);report.build=marker;
  await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
  const args=requestedRenderer==='metal'?['--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60'];
  browser=await chromium.launch({channel:'chrome',headless:false,args});
  report.browser=browser.version();context=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(scope=>{
   const held=new Set(),e=window.__stagedWalkNativeEvidence={phase:'boot',events:[],traces:{},overflow:false,focusLossDuringInput:[],held:[]};
   for(const type of ['click','keydown','keyup','pointerdown','pointerup',...(scope==='exterior'?['pointermove']:[])])document.addEventListener(type,event=>{
    if(type==='keydown')held.add(event.code);if(type==='keyup')held.delete(event.code);e.held=[...held];
    const element=event.target,button=element?.closest?.('button');
    if(e.events.length>=10_000){e.overflow=true;return;}
    e.events.push({type,trusted:event.isTrusted,code:event.code||null,target:button?.id?'#'+button.id:element?.id?'#'+element.id:element?.tagName,
     text:button?.textContent?.trim()||null,landmark:button?.closest('article.landmark')?.querySelector('h3')?.textContent?.trim()||null,
     phase:e.phase,at:performance.now()});
   },true);
   const lost=reason=>{if(held.size)e.focusLossDuringInput.push({reason,phase:e.phase,keys:[...held],at:performance.now()});};
   addEventListener('blur',()=>lost('window blur'));document.addEventListener('visibilitychange',()=>{if(document.hidden)lost('document hidden');});
  },scope);
  page=await context.newPage();page.setDefaultTimeout(90_000);client=await context.newCDPSession(page);
  page.on('pageerror',error=>report.errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());});
  page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?stagedArchitectureProof=1&profile=1',{waitUntil:'domcontentloaded',timeout:30_000});
  await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180_000});
  await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');await page.locator('#start').click();
  await expect(page.locator('body')).not.toHaveClass(/at-start/);
  await page.waitForFunction(()=>window.__stagedLandmarkProof?.frame()>0,null,{timeout:180_000});
  await phase('staged-ready');assertSnapshot(await snapshot(),AQUARIUM,{near:false});
  report.initialGraphics=await page.evaluate(()=>({quality:document.querySelector('#quality')?.value,fps:document.querySelector('#fps')?.value,antiAliasing:document.querySelector('#anti-aliasing')?.value}));

  if(scope==='exterior'){
   await runExteriorProof({page,report,phase,motion,snapshot,guideAction,dismount,turnTo,focusCanvas,keyDown,keyUp,waitMotion,settle,frames,capture,trace});
  }else{
  await guideAction(AQUARIUM,'Travel to entrance');await setFirstPerson(false);await capture('aquarium-exterior',AQUARIUM);
  await dismount();
  const aquariumEntry=await walkTo('aquarium-native-entry',AQUARIUM,'v',-36.8);
  report.passages.push(assertPassage({...aquariumEntry,id:AQUARIUM,axis:'v',boundary:-38,clearHalfWidth:1.65}));
  await capture('aquarium-entry',AQUARIUM);
  await walkTo('aquarium-native-gallery',AQUARIUM,'v',-24);
  await expect(page.locator('#place')).toHaveText('Aquarium · North gallery');await capture('aquarium-gallery',AQUARIUM);
  await contact('aquarium-tank-contact',AQUARIUM,1,0);

  await guideAction(CONSERVATORY,'Travel to path');await setFirstPerson(false);await capture('conservatory-exterior',CONSERVATORY);
  await dismount();
  const conservatoryEntry=await walkTo('conservatory-native-entry',CONSERVATORY,'u',-15.5);
  report.passages.push(assertPassage({...conservatoryEntry,id:CONSERVATORY,axis:'u',boundary:-17,clearHalfWidth:1.7}));
  await capture('conservatory-west-portal',CONSERVATORY);
  await walkTo('conservatory-native-vestibule',CONSERVATORY,'u',-12);
  await contact('conservatory-wall-contact',CONSERVATORY,0,1);
  await guideAction(CONSERVATORY,'Explore Palm House on foot');await waitMotion({type:'on-foot'});await setFirstPerson(true);
  await walkTo('conservatory-native-palm-house',CONSERVATORY,'u',-2);
  await expect(page.locator('#place')).toHaveText('Palm House');await capture('conservatory-palm-house',CONSERVATORY);
  }

  report.finalGraphics=await page.evaluate(()=>({quality:document.querySelector('#quality')?.value,fps:document.querySelector('#fps')?.value,antiAliasing:document.querySelector('#anti-aliasing')?.value}));
  assert.deepEqual(report.finalGraphics,report.initialGraphics,'The walk proof changed graphics settings');
  report.nativeEvidence=await page.evaluate(()=>window.__stagedWalkNativeEvidence);
  if(scope==='exterior')assertExteriorEvidence(report);
  else{
  assertNativeEvidence(report.nativeEvidence);
  assertEntranceTurns(report);
  assert.equal(report.passages.length,2);assert.equal(report.contacts.length,2);assert.equal(report.captures.length,8);
  assert(report.contacts.every(contact=>contact.passed),'A sampled contact did not satisfy the native visual/collider agreement gate');
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);checkBudget();report.passed=true;
 }
 try{
  await Promise.race([exercise(),new Promise((_,reject)=>{budgetTimer=setTimeout(()=>{stopped=true;reject(Error('Staged walk case exceeded its 32-minute budget'));},CASE_MS);})]);
 }catch(error){report.passed=false;report.errors.push(String(error?.stack||error));}
 finally{
  clearTimeout(budgetTimer);stopped=true;
  const cleanup=await bounded(releaseOwned(),10_000,'Native key release').catch(error=>[String(error)]);
  if(cleanup.length){report.passed=false;report.errors.push(...cleanup);}
  if(page){
   try{report.nativeEvidence=await bounded(page.evaluate(()=>window.__stagedWalkNativeEvidence),10_000,'Native evidence collection');}catch(error){report.errors.push(String(error));report.passed=false;}
  }
  await bounded(browser?.close(),10_000,'Browser cleanup').catch(error=>{report.errors.push(String(error));report.passed=false;});
  server.closeAllConnections();await new Promise(yes=>server.close(()=>yes()));
  report.finishedAt=new Date().toISOString();report.elapsedWallMs=Date.now()-started;
  if(report.errors.length||report.failedRequests.length)report.passed=false;
  await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
 console.log(JSON.stringify({passed:report.passed,source,layout,phase:report.phase,passages:report.passages.length,contacts:report.contacts.length,captures:report.captures.length,errors:report.errors.slice(0,4)}));
 if(!report.passed)process.exitCode=1;return report;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await run();
