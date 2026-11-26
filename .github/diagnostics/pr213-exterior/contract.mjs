import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const sourceSha='61a9db36df072850f4bcea4536471e3d92e07453';
export const artifactPin=Object.freeze({id:15149060140,run:45882624790,name:'belle-staged-architecture-verified-build',
 sha256:'6d244cd0bf5c5564af1e4790bab5605493f887d4686eaa0640386b3d6eb80559',
 indexSha256:'9f7a207d35aab93fffad7dd8ccdda9573bb60022d82fa96e440b2abdc61d28d3'});
export const sourcePins=Object.freeze({
 'staged-landmark-walk-proof.mjs':'dbe7bf975297053c873c20d4483a413c9da3c52ddce412e00760618a46814470',
 'landmark-comparison-observer.mjs':'b62f69d328341a005330f1837c992d4ab298e2a80a8c11df9a7bfa64ac9054e4',
 'staged-landmark-comparison-contract.mjs':'072e9e58a98b5a86616359cb47c021d0435db72b1855321ea82e426f8df4ab69',
 'staged-landmark-native-comparison.mjs':'ba540580fa2eea0b42d3460534858e62a870b92550148de52f5820abc0335776',
 'native-select-typeahead.mjs':'6125282fee606b399c5ecb047c31a5aca1d9cc22be003bf362096c3bf9770d5f',
});
export const assetPins=Object.freeze({
 '107227742':{file:'Aquarium_Arched_Entrance_Study.glb',sha256:'26447779b20c5bbd2ab1ee6eb3dc1489333722e045400697c40a32cae3c69b93'},
 '107310050':{file:'Conservatory_Architectural_Study.glb',sha256:'d4ca492b0c5d07f90c7e8a1e3a6369811e6fe765f15c73f707bd34c9d55f1ae2'},
});
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function replaceOnce(source,from,to){
 assert(from.length&&source.split(from).length===2,'Expected one immutable driver anchor: '+from.slice(0,100));
 return source.replace(from,to);
}
export function betweenOnce(source,start,end,replacement){
 assert.equal(source.split(start).length,2,'Start route anchor is not unique');
 assert.equal(source.split(end).length,2,'End route anchor is not unique');
 const a=source.indexOf(start),b=source.indexOf(end);assert(a<b);return source.slice(0,a)+replacement+source.slice(b);
}

/** Routes are desired walking waypoints, not actor or camera assignments. Each
 * begins with the public Guide entrance and retains failures independently.
 * Both buildings occupy adjacent sites, so rear/second-side views are oblique.
 * A complete model bounding box in frame does not prove absence of occlusion. */
export function exteriorPlan(layout){
 assert(['desktop','phone'].includes(layout));
 const point=(u,v)=>({u,v}),aq='107227742',co='107310050';
 return [
  {name:'aquarium-front',id:aq,guideId:aq,waypoints:[point(0,-90)]},
  {name:'aquarium-west-side',id:aq,guideId:aq,waypoints:[point(-9.1575,-40.5715),point(-49.0268,34.3447),point(-70,50)]},
  {name:'aquarium-rear',id:aq,guideId:aq,waypoints:[point(-9.1575,-40.5715),point(-50,65)]},
  {name:'aquarium-east-oblique',id:aq,guideId:aq,waypoints:[point(50,-110)]},
  {name:'conservatory-west-front',id:co,guideId:co,waypoints:[point(-55.9525,8.3335),point(-98.012,8.2817),point(-108.3945,2.1822),point(-110,0)]},
  {name:'conservatory-north-wing',id:co,guideId:co,waypoints:[point(-70,-60)]},
  {name:'conservatory-south-wing',id:co,guideId:aq,waypoints:[point(0,105)]},
  {name:'conservatory-east-rear-oblique',id:co,guideId:aq,waypoints:[point(70,105)]},
 ].map(view=>({...view,guideTravel:view.guideId===aq?'Travel to entrance':'Travel to path'}));
}
export function segmentWaypoints(from,to,maximum=8){
 assert(maximum>0&&maximum<=8);for(const p of [from,to])assert(Number.isFinite(p.x)&&Number.isFinite(p.z));
 const count=Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/maximum);assert(count<=256,'Route exceeds bounded segment count');
 return Array.from({length:count},(_,i)=>({x:from.x+(to.x-from.x)*(i+1)/count,z:from.z+(to.z-from.z)*(i+1)/count}));
}
export function galleryViewport(layout){
 assert(['desktop','phone'].includes(layout));
 return layout==='phone'?{width:844,height:390}:{width:1280,height:800};
}
export function worldPoint(layout,{u,v}){
 const c=Math.cos(layout.yaw),s=Math.sin(layout.yaw);
 return{x:layout.center[0]+c*u-s*v,z:layout.center[1]-s*u-c*v};
}
export function headingTo(actor,point){return Math.atan2(point.x-actor.x,point.z-actor.z);}

/** The two pinned models have Float32 POSITION accessors and identity nodes.
 * Read actual bytes, rather than trusting glTF min/max metadata. Reject future
 * morphs, skins, transforms or compressed accessors instead of guessing bounds. */
export function modelBounds(bytes,id){
 const pin=assetPins[id];assert(pin,'Unknown model');assert.equal(sha256(bytes),pin.sha256,'Actual model bytes changed');
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 let json,bin;for(let p=12;p<bytes.length;){const n=bytes.readUInt32LE(p),type=bytes.readUInt32LE(p+4);assert(p+8+n<=bytes.length);const part=bytes.subarray(p+8,p+8+n);if(type===0x4e4f534a)json=JSON.parse(part.toString('utf8'));else if(type===0x004e4942)bin=part;p+=8+n;}
 assert(json&&bin);assert.equal(json.extensionsRequired?.length??0,0);assert.equal(json.skins?.length??0,0);
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],positions=[],visited=new Set();let vertices=0;
 const walk=index=>{
  assert(!visited.has(index),'Shared/cyclic model node');visited.add(index);const n=json.nodes[index];assert(n);
  for(const key of ['matrix','translation','rotation','scale','skin','weights'])assert.equal(n[key],undefined,'Unsupported transformed model node');
  if(n.mesh!==undefined)for(const primitive of json.meshes[n.mesh].primitives){
   assert.equal(primitive.mode??4,4);assert.equal(primitive.targets,undefined);const a=json.accessors[primitive.attributes.POSITION];
   assert(a&&a.type==='VEC3'&&a.componentType===5126&&!a.sparse&&!a.normalized);const view=json.bufferViews[a.bufferView];
   assert.equal(view.buffer??0,0);assert.equal(view.extensions,undefined);const stride=view.byteStride??12,start=(view.byteOffset??0)+(a.byteOffset??0);
   assert(stride>=12&&start+(a.count-1)*stride+12<=bin.length);
   for(let i=0;i<a.count;i++)for(let axis=0;axis<3;axis++){const v=bin.readFloatLE(start+i*stride+axis*4);assert(Number.isFinite(v));positions.push(v);min[axis]=Math.min(min[axis],v);max[axis]=Math.max(max[axis],v);}
   vertices+=a.count;
  }
  for(const child of n.children??[])walk(child);
 };
 for(const node of json.scenes[json.scene??0].nodes)walk(node);assert(vertices>0);
 const result={id,file:pin.file,sha256:pin.sha256,min,max,vertices,scope:'All actual POSITION bytes in the pinned LOD0 model; excludes retained legacy interiors and world vegetation'};
 // Keep exact positions for projection without repeating them in every JSON
 // capture. The immutable asset hash and vertex count bind the input bytes.
 return Object.defineProperty(result,'positions',{value:positions,enumerable:false});
}
const multiply=(m,v)=>[0,1,2,3].map(row=>m[row]*v[0]+m[row+4]*v[1]+m[row+8]*v[2]+m[row+12]*v[3]);
export function observedModelTransform(observation,id){
 const matches=observation.inventory?.nodes?.filter(n=>n.name===id+'_STAGED_LOD0');
 assert.equal(matches?.length,1,'Missing unique observed target LOD0 root');
 const root=matches[0];assert(root.worldVisible,'The target full-detail root is not visible');
 assert(root.matrixWorld?.length===16&&root.matrixWorld.every(Number.isFinite),'Missing actual model world matrix');
 return root;
}
export function projectedBounds(bounds,modelMatrix,camera,margin=.92){
 assert(modelMatrix?.length===16&&modelMatrix.every(Number.isFinite),'Missing observed model transform');
 assert(camera.matrixWorldInverse?.length===16&&camera.matrixWorldInverse.every(Number.isFinite));
 assert(camera.projectionMatrix?.length===16&&camera.projectionMatrix.every(Number.isFinite));
 assert(margin>0&&margin<=1);
 const points=[];
 for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]]){
  const world=multiply(modelMatrix,[x,y,z,1]);assert.equal(world[3],1,'Expected affine actual model transform');
  const clip=multiply(camera.projectionMatrix,multiply(camera.matrixWorldInverse,world));
  points.push({world:world.slice(0,3),clip,ndc:clip.slice(0,3).map(v=>v/clip[3])});
 }
 const framed=points.every(p=>p.clip[3]>0&&p.ndc.every(Number.isFinite)&&Math.abs(p.ndc[0])<=margin&&Math.abs(p.ndc[1])<=margin&&Math.abs(p.ndc[2])<=1);
 return{framed,margin,corners:points,scope:'The transformed LOD0 bounding box lies within the actual camera frustum. This does not prove unobstructed screen pixels, ground contact or architectural fidelity.'};
}
export function projectedModel(bounds,modelMatrix,camera,margin=.92){
 const boundingBox=projectedBounds(bounds,modelMatrix,camera,margin),positions=bounds.positions;
 assert(positions?.length===bounds.vertices*3&&positions.length>0,'Actual position bytes are required');
 let framed=true;const minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity],extremes={};
 for(let i=0;i<positions.length;i+=3){
  const local=positions.slice(i,i+3),world=multiply(modelMatrix,[...local,1]);
  const clip=multiply(camera.projectionMatrix,multiply(camera.matrixWorldInverse,world)),ndc=clip.slice(0,3).map(v=>v/clip[3]);
  const point={vertex:i/3,local,world:world.slice(0,3),clip,ndc};
  if(!(clip[3]>0&&ndc.every(Number.isFinite)&&Math.abs(ndc[0])<=margin&&Math.abs(ndc[1])<=margin&&Math.abs(ndc[2])<=1))framed=false;
  for(let axis=0;axis<3;axis++){
   if(ndc[axis]<minimum[axis]){minimum[axis]=ndc[axis];extremes['min'+axis]=point;}
   if(ndc[axis]>maximum[axis]){maximum[axis]=ndc[axis];extremes['max'+axis]=point;}
  }
 }
 return{framed,margin,verticesChecked:bounds.vertices,ndcMinimum:minimum,ndcMaximum:maximum,
  maxAbsX:Math.max(Math.abs(minimum[0]),Math.abs(maximum[0])),maxAbsY:Math.max(Math.abs(minimum[1]),Math.abs(maximum[1])),extremes,boundingBox,
  scope:'Every actual LOD0 POSITION vertex fits the actual camera frustum. Convex clip planes also contain their triangles. Empty AABB corners are reported separately. This does not prove unobstructed screen pixels, ground contact or architectural fidelity.'};
}
export function assertExteriorEvidence(evidence,views,layout){
 galleryViewport(layout);
 assert(evidence?.events?.length>0);assert.equal(evidence.overflow,false);assert.deepEqual(evidence.held,[]);assert.deepEqual(evidence.focusLossDuringInput,[]);
 assert(evidence.events.every(e=>e.trusted===true),'Untrusted browser input was observed');
 assert(evidence.events.some(e=>e.type==='click'&&e.target==='#start'));
 for(const [target,value] of [['#quality',layout==='phone'?'smooth':'high'],['#fps',layout==='phone'?'30':'60'],['#sky-preset','12'],['#sky-clouds','clear']])
  for(const type of ['input','change'])assert(evidence.events.some(e=>e.type===type&&e.target===target&&e.value===value&&e.phase==='configure-exterior'&&e.settingsOpen===true),'Missing trusted exterior setting '+target+' '+value+' '+type);
 for(const code of ['KeyW','KeyF','KeyV'])for(const type of ['keydown','keyup'])assert(evidence.events.some(e=>e.code===code&&e.type===type),'Missing native '+code+' '+type);
 let previous=-1;
 for(const view of views){
  const indices=evidence.events.flatMap((e,i)=>e.code==='KeyW'&&['keydown','keyup'].includes(e.type)&&e.phase.startsWith('walk-'+view.name+'-')?[i]:[]);
  for(const type of ['keydown','keyup'])assert(indices.some(i=>evidence.events[i].type===type),'Missing native walking event for '+view.name);
  assert(indices[0]>previous,'Exterior routes are out of order');
  assert(evidence.events.some((e,i)=>i>previous&&i<indices[0]&&e.type==='click'&&e.text===view.guideTravel&&e.landmark===(view.guideId==='107227742'?'Belle Isle Aquarium':'Anna Scripps Whitcomb Conservatory')),'Missing independent public Guide start for '+view.name);
  previous=indices.at(-1);
 }
}
export function assertGallerySettings(settings,layout){
 const viewport=galleryViewport(layout);assert.equal(settings.quality,layout==='phone'?'smooth':'high');
 assert.equal(settings.effectiveQuality,settings.quality);assert.equal(settings.fps,layout==='phone'?'30':'60');
 assert.equal(settings.frameCap,Number(settings.fps));assert.equal(settings.adaptiveScale,1);assert.equal(settings.pixelRatio,1);
 assert.equal(settings.width,viewport.width);assert.equal(settings.height,viewport.height);assert.equal(settings.devicePixelRatio,1);
 assert.equal(settings.reducedMotion,true);assert.equal(settings.focused,true);assert.equal(settings.visible,true);
 assert.equal(settings.skyCycle,false);assert.equal(settings.skyHour,12);assert.equal(settings.clouds,'clear');
}
