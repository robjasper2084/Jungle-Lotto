/** Additional complete-exterior evidence. Plans use read-only original terrain;
 * all actual travel and camera aiming use the public Guide and native input. */
import assert from 'node:assert/strict';

const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
const linePoints=(a,b)=>{const count=Math.max(1,Math.ceil(distance(a,b)/.5));return Array.from({length:count+1},(_,i)=>({x:a.x+(b.x-a.x)*i/count,z:a.z+(b.z-a.z)*i/count}));};

/** Four-neighbour grid plus independent half-metre edge checks. A blocked
 * connector/edge fails or is replanned; it never teleports or relaxes terrain. */
export async function createExteriorPlanner({bounds,camera,layout,queryGround}){
 const center={x:bounds.center[0],z:bounds.center[2]},radius=Math.hypot(...bounds.max.map((n,i)=>n-bounds.min[i]))/2;
 const halfV=camera.fov*Math.PI/360,halfH=Math.atan(Math.tan(halfV)*camera.aspect);
 const viewDistance=radius/Math.sin(Math.min(halfV,halfH))*1.22,range=viewDistance+60,spacing=4,width=Math.ceil(range*2/spacing)+1;
 assert(width*width<=50000,'Exterior terrain query exceeds its bounded area');
 const points=Array.from({length:width*width},(_,i)=>({x:center.x-range+i%width*spacing,z:center.z-range+Math.floor(i/width)*spacing}));
 async function query(values){const rows=[];for(let i=0;i<values.length;i+=10000)rows.push(...await queryGround(values.slice(i,i+10000)));assert.equal(rows.length,values.length,'Incomplete original terrain receipt');return rows;}
 const ground=await query(points),blocked=new Set();let checkedEdges=0;
 async function route(start,bearing){
  const starts=points.map((p,i)=>({i,d:distance(start,p)})).filter(v=>ground[v.i].walkable&&v.d<=12).sort((a,b)=>a.d-b.d);
  let first=-1;
  for(const candidate of starts)if((await query(linePoints(start,points[candidate.i]))).every(p=>p.walkable)){first=candidate.i;break;}
  assert(first>=0,'The actual actor has no walkable original-terrain connector');
  const candidates=points.flatMap((p,i)=>{
   const d=distance(p,center),delta=Math.abs(angle(Math.atan2(p.x-center.x,p.z-center.z)-bearing));
   return ground[i].walkable&&d>=viewDistance&&d<=viewDistance+48&&delta<=Math.PI/9?[{i,score:d-viewDistance+delta*viewDistance}]:[];
  }).sort((a,b)=>a.score-b.score);
  assert(candidates.length,'No dry exterior viewpoint exists in the required direction');
  for(let attempt=0;attempt<64;attempt++){
   const parent=new Int32Array(points.length).fill(-1),queue=[first];parent[first]=first;
   for(let j=0;j<queue.length;j++){
    const current=queue[j],x=current%width,z=Math.floor(current/width);
    for(const next of[x>0?current-1:-1,x+1<width?current+1:-1,z>0?current-width:-1,z+1<width?current+width:-1]){
     if(next<0||parent[next]>=0||!ground[next].walkable||blocked.has(edgeKey(current,next)))continue;
     parent[next]=current;queue.push(next);
    }
   }
   const goal=candidates.find(c=>parent[c.i]>=0);assert(goal,`No connected original-terrain route reaches the required exterior direction (${queue.length} connected cells, ${candidates.length} candidate cells, ${blocked.size} rejected edges)`);
   const indices=[goal.i];while(indices.at(-1)!==first)indices.push(parent[indices.at(-1)]);indices.reverse();
   const samples=[],owners=[];
   for(let i=1;i<indices.length;i++)for(const p of linePoints(points[indices[i-1]],points[indices[i]])){samples.push(p);owners.push(edgeKey(indices[i-1],indices[i]));}
   const checked=await query(samples);checkedEdges+=indices.length-1;let failed=false;
   for(let i=0;i<checked.length;i++)if(!checked[i].walkable){blocked.add(owners[i]);failed=true;}
   if(failed)continue;
   const waypoints=[points[first]];
   for(let i=1;i<indices.length-1;i++)if(indices[i]-indices[i-1]!==indices[i+1]-indices[i])waypoints.push(points[indices[i]]);
   waypoints.push(points[indices.at(-1)]);
   return{bearing,viewDistance,spacing,layout,waypoints,endpoint:waypoints.at(-1),checkedEdges,halfMetreSamples:checked.length,
    source:'Read-only original terrain land/obstruction queries, with at least 0.7m planning clearance and independently recorded actual native walking'};
  }
  throw Error('Exterior route could not pass all original-terrain edge checks');
 }
 return{route,query,viewDistance,center};
}

export function assertExteriorEvidence(report){
 const evidence=report.nativeEvidence;
 assert(evidence&&!evidence.overflow&&evidence.events.length,'Missing complete exterior native input receipts');
 assert(evidence.events.every(e=>e.trusted),'Untrusted exterior input');
 assert.deepEqual(evidence.held,[]);assert.deepEqual(evidence.focusLossDuringInput,[]);
 assert(evidence.events.some(e=>e.type==='click'&&e.target==='#start'),'Missing native Start');
 for(const [title,action]of[['Belle Isle Aquarium','Travel to entrance'],['Anna Scripps Whitcomb Conservatory','Travel to path']])
  assert(evidence.events.some(e=>e.type==='click'&&e.landmark===title&&e.text===action),'Missing public exterior Guide action');
 for(const code of['KeyW','KeyF','KeyV'])for(const type of['keydown','keyup'])assert(evidence.events.some(e=>e.type===type&&e.code===code),'Missing exterior native '+code+' '+type);
 assert(report.groundFit?.structuralReceiptPassed,'Actual loaded ground/step/paving receipt failed');
 assert.equal(report.captures.length,4,'Both opposite views of both complete exteriors are required');
 assert.equal(report.exteriorViews.length,4);assert(report.exteriorLegs.length>0,'No genuine exterior walking');
 for(const id of['107227742','107310050']){
  const views=report.exteriorViews.filter(v=>v.id===id);assert.equal(views.length,2);
  assert(Math.abs(angle(views[0].bearing-views[1].bearing))>=Math.PI*.8,'Exterior views do not cover opposite directions');
  for(const view of views){
   assert(view.before.completeBoundsInFrame&&view.after.completeBoundsInFrame,'A cropped exterior cannot pass');
   assert(view.before.selectedLevels.length===1&&view.after.selectedLevels.length===1,'Exterior LOD visibility is ambiguous');
   assert(report.captures.some(c=>c.id===id&&c.name===view.name&&c.sha256&&c.bytes>1000),'Missing actual complete-exterior PNG');
   for(const type of['pointerdown','pointermove','pointerup'])assert(evidence.events.some(e=>e.phase===view.name+'-aim'&&e.type===type),'Missing genuine camera drag '+type);
  }
 }
 for(const leg of report.exteriorLegs){
  assert(leg.after.frames>leg.before.frames+3&&distance(leg.before.actor,leg.after.actor)>.15,'Exterior walking has no genuine actor movement');
  assert(leg.trace.length>=2&&leg.trace.every(row=>row.actor.onFoot),'Exterior trajectory is missing or changed walking mode');
  const dx=leg.goal.x-leg.before.actor.x,dz=leg.goal.z-leg.before.actor.z,length=Math.hypot(dx,dz);
  assert(length>.4&&Number.isFinite(leg.maxLateral)&&leg.maxLateral>0&&leg.ground.every(p=>p.walkable&&p.planningClearance>=.7),'Missing original-terrain route clearance');
  for(const row of[...leg.trace,leg.after]){
   const x=row.actor.x-leg.before.actor.x,z=row.actor.z-leg.before.actor.z;
   assert(Math.abs(x*dz-z*dx)/length<=leg.maxLateral,'Observed native trajectory left its measured lateral corridor');
  }
  const afterX=leg.after.actor.x-leg.before.actor.x,afterZ=leg.after.actor.z-leg.before.actor.z;
  assert((afterX*dx+afterZ*dz)/length>=length-.1,'The actual actor did not reach the recorded leg goal');
  for(const type of['keydown','keyup'])assert(evidence.events.some(e=>e.phase===leg.name&&e.type===type&&e.code==='KeyW'),'Missing genuine exterior leg '+type);
 }
}

export async function runExteriorProof({page,report,phase,motion,snapshot,guideAction,dismount,turnTo,focusCanvas,keyDown,keyUp,waitMotion,settle,frames,capture,trace}){
 report.exteriorViews=[];report.exteriorLegs=[];
 report.manualVisualReviewRequired=true;report.appearanceAccepted=null;report.occlusionAccepted=null;report.collisionAccepted=null;
 report.groundFit=await page.evaluate(()=>window.__stagedLandmarkProof.groundFit());assert(report.groundFit.structuralReceiptPassed,'Actual original terrain and loaded walking surfaces disagree');
 const queryGround=points=>page.evaluate(points=>window.__stagedLandmarkProof.routeGround(points),points);
 const exterior=id=>page.evaluate(id=>window.__stagedLandmarkProof.exterior(id),id);
 async function walkRoute(route,label){
  for(const [index,waypoint]of route.waypoints.entries())for(let segment=0;segment<80;segment++){
   const current=(await motion()).actor,remaining=distance(current,waypoint);if(remaining<=.4)break;
   let length=Math.min(12,remaining),goal={x:current.x+(waypoint.x-current.x)*length/remaining,z:current.z+(waypoint.z-current.z)*length/remaining};
   let ground=await queryGround(linePoints(current,goal));
   if(ground.some(p=>p.planningClearance<2.25)){
    // The original garden passages are narrower than a 4.5m corridor. Keep the
    // unchanged native heading tolerance, but use short legs whose lateral
    // error remains within the measured clearance of the actual .27m body.
    length=Math.min(2.5,remaining);goal={x:current.x+(waypoint.x-current.x)*length/remaining,z:current.z+(waypoint.z-current.z)*length/remaining};
    ground=await queryGround(linePoints(current,goal));
   }
   assert(ground.every(p=>p.walkable),'Observed actor route approaches an original obstruction');
   const maxLateral=Math.min(...ground.map(p=>p.planningClearance))-.29;
   await turnTo(Math.atan2(goal.x-current.x,goal.z-current.z));
   const name=label+'-walk-'+index+'-'+segment;await phase(name);await focusCanvas();const before=await motion();
   const dx=goal.x-before.actor.x,dz=goal.z-before.actor.z,actualLength=Math.hypot(dx,dz);
   await keyDown('w');try{await waitMotion({type:'world-target',x:before.actor.x,z:before.actor.z,dx:dx/actualLength,dz:dz/actualLength,length:actualLength,maxLateral},90_000);}finally{await keyUp('w');}
   await settle(name);const after=await motion();report.exteriorLegs.push({name,before,after,goal,ground,maxLateral,trace:await trace(name)});
   assert(after.frames>before.frames+3&&distance(before.actor,after.actor)>.15,'Native exterior walk did not advance');
   if(segment===79)throw Error('Native exterior waypoint exceeded its bounded leg count');
  }
 }
 async function aim(id,name){
  await phase(name+'-aim');
  for(let attempt=0;attempt<24;attempt++){
   const read=await exterior(id),center=read.bounds.center,camera=read.camera;
   const yaw=Math.atan2(camera.direction[0],camera.direction[2]),desiredYaw=Math.atan2(center[0]-camera.position[0],center[2]-camera.position[2]);
   const pitch=Math.atan2(-camera.direction[1],Math.hypot(camera.direction[0],camera.direction[2]));
   const desiredPitch=Math.atan2(camera.position[1]-center[1],Math.hypot(center[0]-camera.position[0],center[2]-camera.position[2]));
   const yawDelta=angle(desiredYaw-yaw),pitchDelta=desiredPitch-pitch;
   if(Math.abs(yawDelta)<.012&&Math.abs(pitchDelta)<.012){assert(read.completeBoundsInFrame,'Aimed camera still crops the actual full-model bounds');return read;}
   // Normal look sensitivity in the untouched fresh context. Read the actual
   // camera after every trusted canvas drag, so ignored input fails the bound.
   const {width,height}=report.viewport,x=width*.5,y=height*.48,clamp=(v,m)=>Math.max(-m,Math.min(m,v));
   await page.mouse.move(x,y);await page.mouse.down();
   try{await page.mouse.move(x+clamp(-yawDelta/.003,width*.3),y+clamp(pitchDelta/.002,height*.2),{steps:4});}finally{await page.mouse.up();}
   await frames(3);
  }
  throw Error('Native pointer aiming did not reach the complete exterior');
 }
 for(const [id,label,action]of[['107227742','aquarium','Travel to entrance'],['107310050','conservatory','Travel to path']]){
  await guideAction(id,action);await dismount();
  const current=await snapshot(),site=current.sites.find(s=>s.id===id),initial=await exterior(id);assert(initial.ready);
  const planner=await createExteriorPlanner({bounds:initial.bounds,camera:initial.camera,layout:report.layout,queryGround});
  // Diagonal front/side and opposite rear/side directions expose all four
  // exterior orientations while preserving real surrounding scenery.
  const front=id==='107227742'?Math.atan2(Math.sin(site.layout.yaw),Math.cos(site.layout.yaw)):Math.atan2(-Math.cos(site.layout.yaw),Math.sin(site.layout.yaw));
  for(const [suffix,bearing]of[['front-side',front+Math.PI/4],['rear-side',front+Math.PI*1.25]]){
   const name=label+'-complete-'+suffix;await phase(name+'-plan');
   const route=await planner.route((await motion()).actor,bearing);await walkRoute(route,name);
   const before=await aim(id,name);await capture(name,id,{near:false});const after=await exterior(id);
   assert(after.completeBoundsInFrame,'The real capture camera cropped the model');
   report.exteriorViews.push({id,name,bearing:Math.atan2(after.camera.position[0]-after.bounds.center[0],after.camera.position[2]-after.bounds.center[2]),route,before,after});
  }
 }
 report.exteriorReview='Four native full-model-bounds PNGs: opposite front/side and rear/side views of both buildings. Framing and original terrain receipts are automated; architectural appearance, surrounding-scene occlusion and remaining fit acceptance require independent review of these actual PNGs. No surveyed measurements or complete collider parity are claimed.';
}
