import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const game=fileURLToPath(new URL('../../',import.meta.url));
const work=path.join(game,'.test');
// Keep the previous string-key cache as an independent oracle. The actual
// probe selection, native skinning, ground sampler and contact arithmetic stay
// unchanged in both bundles. Trace only records the completed vertex reads.
async function implementation(stringKeys,trace=false){
 const outfile=path.join(work,`contact-ground-${stringKeys?'strings':'numbers'}${trace?'-trace':''}.mjs`);
 await build({absWorkingDir:game,stdin:{contents:`export {ThreeRiderView} from './runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';export {createPose} from './runtime/ride-core/src/controller.ts';export {HUMAN_PROFILE,MASCOT_PROFILE} from './runtime/ride-core/src/profiles.ts';export {FallMotion,getUpPose} from './runtime/ride-core/src/fallMotion.ts';export {FallenSupport} from './runtime/ride-core/src/fallenSupport.ts';export {CrashContact} from './runtime/elmwood-source/src/detroit/riding/crashContact.ts';`,resolveDir:game,loader:'ts'},outfile,bundle:true,platform:'node',format:'esm',external:['three'],alias:{'@digital-static/ridecore':path.join(game,'runtime/ride-core/src/index.ts')},logLevel:'error',plugins:[{name:'contact-parity',setup(b){
  b.onResolve({filter:/\.(?:css|webp)(?:\?.*)?$/},args=>({path:args.path,namespace:'test-browser-assets'}));
  b.onLoad({filter:/.*/,namespace:'test-browser-assets'},()=>({contents:'export default "";',loader:'js'}));
  b.onLoad({filter:/(?:fallenSupport|crashContact)\.ts$/},async args=>{
   let source=await fs.readFile(args.path,'utf8');
   const fallen=args.path.endsWith('fallenSupport.ts');
   if(stringKeys){
    assert(source.includes('new Map<number,Map<number,ReturnType<typeof createGroundSample>>>()'));
    source=source.replace('new Map<number,Map<number,ReturnType<typeof createGroundSample>>>()','new Map<string,ReturnType<typeof createGroundSample>>()');
    if(fallen){
     source=source.replace('z=Math.round(p.z/.35)*.35;','z=Math.round(p.z/.35)*.35,key=x+\',\'+z;');
     const from=`let ground=this.groundCache.get(x)?.get(z);
     if(!ground){
      ground=terrain.sampleGround(x,z,createGroundSample(),floor);
      // A sampler may reenter support and clear the cache; read its column again.
      let column=this.groundCache.get(x);if(!column)this.groundCache.set(x,column=new Map());column.set(z,ground);
     }`;
     assert(source.includes(from));source=source.replace(from,'let ground=this.groundCache.get(key);if(!ground){ground=terrain.sampleGround(x,z,createGroundSample(),floor);this.groundCache.set(key,ground);}');
    }else{
     source=source.replace('z=Math.round(this.point.z/.35)*.35;','z=Math.round(this.point.z/.35)*.35,key=x+\',\'+z;');
     const from=`let sample=groundCache.get(x)?.get(z);
          if(!sample){
            sample=terrain.sampleGround(x,z,createGroundSample(),floor);
            let column=groundCache.get(x);if(!column)groundCache.set(x,column=new Map());column.set(z,sample);
          }`;
     assert(source.includes(from));source=source.replace(from,`let sample=groundCache.get(key);
          if(!sample){sample=terrain.sampleGround(x,z,createGroundSample(),floor);groundCache.set(key,sample);}`);
    }
   }
   if(trace){
    const needle=fallen?'mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);':'mesh.getVertexPosition(index,this.point).applyMatrix4(mesh.matrixWorld);';
    const record=fallen?'globalThis.__contactGroundTrace?.(mesh,i,p);':'globalThis.__contactGroundTrace?.(mesh,index,this.point);';
    assert(source.includes(needle));source=source.replace(needle,needle+record);
   }
   return{contents:source,loader:'ts'};
  });
 }}]});
 return import(pathToFileURL(outfile).href);
}
async function asset(relative,root=path.join(game,'public')){
 const bytes=await fs.readFile(path.join(root,relative)),length=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+length).toString());
 data.materials=(data.materials??[]).map(m=>({name:m.name}));
 const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const binary=bytes.subarray(20+length),output=Buffer.alloc(20+padded.length+binary.length);
 output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);binary.copy(output,20+padded.length);
 return new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'');
}
const ids=['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Hoodie_01','DS_Mascot_Suit_01'];
const [current,previous,wheel,...riders]=await Promise.all([implementation(false,true),implementation(true,true),asset('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'),...ids.map((id,i)=>asset('exports/rigged-heroes/'+id+'.glb',i?path.resolve(game,'../../elmwood-source/public'):undefined))]);
const terrain={sampleGround(x,z,out){out.height=2+x*.001+z*.002;out.normal={x:-.001,y:1,z:-.002};out.surface='pavement';out.offCourse=false;return out;},raycastObstacle(){return null;}};
function browserFixture(){
 let now=2000,reduced=false;
 const globals=new Map(['window','document','matchMedia'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),clock=Object.getOwnPropertyDescriptor(performance,'now'),load=T.TextureLoader.prototype.loadAsync;
 Object.assign(globalThis,{window:new EventTarget(),document:{documentElement:{dataset:{}}},matchMedia:()=>Object.assign(new EventTarget(),{matches:reduced})});
 Object.defineProperty(performance,'now',{configurable:true,value:()=>now});T.TextureLoader.prototype.loadAsync=async()=>new T.Texture();
 return{step(){now+=1000/60;},reduced(value){reduced=value;},restore(){for(const[k,d]of globals)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];if(clock)Object.defineProperty(performance,'now',clock);else delete performance.now;T.TextureLoader.prototype.loadAsync=load;}};
}
function actor(api,ground=terrain,index=0){const id=ids[index],profile=id.includes('Mascot')?api.MASCOT_PROFILE:api.HUMAN_PROFILE;const view=new api.ThreeRiderView(riders[index],wheel,ground,{...profile,id});const scene=new T.Scene();scene.add(view.root);return view;}
function cases(api){
 const pose=(overrides={})=>({...api.createPose(),x:464.05,y:4.225,z:880.67,headingY:.6,...overrides});
 const rows=[['idle',pose()]];
 for(let i=0;i<16;i++){const f=i/15,s=Math.sin(f*Math.PI*2);rows.push(['ride '+i,pose({x:464+i*.13,z:880+i*.2,headingY:.6+f,speed:3+f*14,rollAngle:s*.42,riderRoll:s*.27,riderPitch:s*.3,brakeAmount:f>.7?.75:0,groundRoll:s*.06,wheelPitch:s*.02,wheelSpin:i*.7,bodyBob:s*.006,crouch:f>.4&&f<.6?.8:0,turnIntent:s,riderTurnTwist:s*.2,riderLookYaw:s*.3,stopFoot:i===0?.7:0})]);}
 rows.push(['natural motion',pose({speed:12,naturalMotion:1,bodyDrop:.14,bodyPitch:.31,bodyLateral:.03,bodyHipTilt:.04,bodyHipYaw:.07,bodyChestRoll:.04,bodyHeadRoll:.12,bodyTwist:.15,bodyLook:.2,shoulderL:.07,shoulderR:-.1,handLX:.09,handRX:-.07,handLY:.15,handRY:.2,handLZ:.1,handRZ:.12,armBank:.05,armSwing:.08})]);
 rows.push(['reverse',pose({speed:-3,reverseBlend:1,riderLookYaw:.7})],['takeoff',pose({speed:8,takeoffExtension:.8})],['airborne',pose({speed:8,airBlend:1,airHeight:1.1,crouch:.35})],['landing',pose({speed:7,landingCompression:.9,landingAnticipation:.7})]);
 for(let i=0;i<5;i++)rows.push(['dismount '+i,pose({footMode:1,footBlend:i/4,footTime:i/10,parkX:464,parkY:4.2,parkZ:880,parkHeading:.6})]);
 for(const[name,extra]of [['walk',{speed:2}],['run',{speed:5.4}],['crouch',{speed:1.1,footCrouch:1}],['prone',{speed:.7,footProne:1}],['evade',{speed:2,footEvade:.4,footEvadeDir:-1}],['vault',{speed:1.8,footVault:.4}],['jump',{speed:2,footJump:1,airHeight:.5,airBlend:1}]])for(let i=0;i<4;i++)rows.push([name+' '+i,pose({footMode:2,footBlend:1,footPhase:(i+.25)/4,footCycle:2+i/4,footTime:2+i/4,velocityX:.7,velocityZ:1.4,parkX:463,parkY:4.2,parkZ:879,parkHeading:.6,...extra})]);
 for(let i=0;i<7;i++)rows.push(['mount '+i,pose({footMode:3,footBlend:1-i/6,footMountTime:i*.4,footTime:5+i*.4,parkX:464,parkY:4.2,parkZ:880,parkHeading:.6})]);
 for(const side of [-1,1])for(const reason of ['obstacle','wobble']){
  const initial=pose({speed:12,rollAngle:side*.38,naturalMotion:1}),fall=new api.FallMotion(initial,reason),rest={...initial};
  for(let i=0;i<=8;i++){const p={...initial};fall.sample(fall.settleTime*i/8,p);rows.push([`fall ${reason} ${side} ${i}`,p]);Object.assign(rest,p);}
  for(let i=1;i<=6;i++){const p={...rest};api.getUpPose(rest,i/6,p,i%2===0);rows.push([`recover ${reason} ${side} ${i}`,p]);}
 }
 rows.push(['recovered reset',pose({crashForward:1,wheelCrashLateral:.5})],['repeated reset',pose()]);
 return rows;
}
function nodes(root){const result=[];root.traverse(o=>result.push(o));return result;}
function compareActors(a,b,label){
 const left=nodes(a.root),right=nodes(b.root);assert.equal(left.length,right.length);
 for(let i=0;i<left.length;i++){const x=left[i],y=right[i],name=label+' '+x.name;assert.equal(x.name,y.name);assert.equal(x.visible,y.visible,name);assert.deepEqual([...x.position,...x.quaternion,...x.scale],[...y.position,...y.quaternion,...y.scale],name+' local');assert.deepEqual(x.matrixWorld.elements,y.matrixWorld.elements,name+' published world');}
 a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);
 for(let i=0;i<left.length;i++){const x=left[i],y=right[i];if(!x.isSkinnedMesh)continue;x.skeleton.update();y.skeleton.update();assert.deepEqual(x.skeleton.boneMatrices,y.skeleton.boneMatrices,label+' skin '+x.name);}
}
function measure(action,iterations){const start=process.hrtime.bigint();for(let i=0;i<iterations;i++)action(i);return Number(process.hrtime.bigint()-start)/1e6/iterations;}
const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
function record(action){const vertices=[];globalThis.__contactGroundTrace=(mesh,index,p)=>vertices.push([mesh.name,index,...p]);try{return{value:action(),vertices};}finally{delete globalThis.__contactGroundTrace;}}
function loggedTerrain(queries,mutate=()=>{}){return{...terrain,sampleGround(x,z,out,floor){queries.push([x,z,floor]);mutate(queries.length);return terrain.sampleGround(x,z,out,floor);}};}
test('numeric ground cache preserves every contact vertex, sample and pose on all five authored rigs',()=>{
 const browser=browserFixture();let a,b,vertices=0,samples=0,poses=0;
 try{
  for(let rig=0;rig<riders.length;rig++)for(const reduced of [false,true]){
   browser.reduced(reduced);const left=[],right=[];a=actor(previous,loggedTerrain(left),rig);b=actor(current,loggedTerrain(right),rig);
   for(const[label,p]of cases(current)){
    browser.step();left.length=right.length=0;const x=record(()=>a.apply({...p})),y=record(()=>b.apply({...p}));
    assert.deepEqual(y.vertices,x.vertices,ids[rig]+' '+label+' every vertex');assert.deepEqual(right,left,label+' every terrain sample');compareActors(a,b,ids[rig]+' '+label);vertices+=x.vertices.length;samples+=left.length;poses++;
   }
   a.dispose();b.dispose();a=b=undefined;
  }
  console.log(JSON.stringify({measurement:'exact contact parity',rigs:riders.length,poses,vertices,terrainSamples:samples,reducedMotion:[false,true]}));
 }finally{a?.dispose();b?.dispose();browser.restore();}
});
function firstSkin(view){return nodes(view.rider).find(mesh=>mesh.isSkinnedMesh&&mesh.geometry.attributes.position.count>8);}
function editSkin(view,kind){
 // SkeletonUtils keeps authored inverse arrays shared. Isolate the two oracle
 // actors while preserving that sharing among meshes within each actor.
 const inverses=new Map();view.rider.traverse(object=>{if(!object.isSkinnedMesh)return;const old=object.skeleton.boneInverses;if(!inverses.has(old))inverses.set(old,old.map(matrix=>matrix.clone()));object.skeleton.boneInverses=inverses.get(old);});
 const mesh=firstSkin(view);mesh.geometry=mesh.geometry.clone();const geometry=mesh.geometry,position=geometry.attributes.position;
 if(kind.startsWith('morph')){
  geometry.morphTargetsRelative=kind==='morph-relative';
  geometry.morphAttributes.position=[.01,-.013].map(offset=>{const values=new Float32Array(position.count*3);for(let i=0;i<position.count;i++)for(let c=0;c<3;c++)values[i*3+c]=(geometry.morphTargetsRelative?0:position.getComponent(i,c))+offset*(c+1)*(1+i%3);return new T.Float32BufferAttribute(values,3);});
  mesh.updateMorphTargets();mesh.morphTargetInfluences=[.25,.6];
 }
 if(kind==='zero-invalid-index'||kind==='nonzero-invalid-index'||kind==='nan-weights'){
  const index=view.riderContact.probes.find(probe=>probe.mesh===mesh).indices[0],weights=geometry.attributes.skinWeight,joints=geometry.attributes.skinIndex;
  for(let i=0;i<4;i++){weights.setComponent(index,i,0);joints.setComponent(index,i,mesh.skeleton.bones.length+10);}
  if(kind==='nonzero-invalid-index')weights.setX(index,1);
  if(kind==='nan-weights'){weights.setX(index,NaN);joints.setX(index,0);}
 }
 return mesh;
}
test('native skinning and custom methods stay live across contact vertex reads',()=>{
 const browser=browserFixture();let a,b,vertices=0;
 try{
  for(const kind of ['morph-relative','morph-absolute','zero-invalid-index','nan-weights','bone-inverse-bind-mutation','custom-method-change']){
   a=actor(previous);b=actor(current);const am=editSkin(a,kind),bm=editSkin(b,kind),left=[],right=[];
   const mutate=mesh=>step=>{
    if(step!==1)return;
    if(kind.startsWith('morph'))mesh.morphTargetInfluences[0]=.875;
    if(kind==='bone-inverse-bind-mutation'){
     mesh.skeleton.bones[0].matrixWorld.elements[12]+=.125;
     mesh.skeleton.boneInverses[0]=mesh.skeleton.boneInverses[0].clone();mesh.skeleton.boneInverses[0].elements[5]*=1.00013;
     mesh.bindMatrix.elements[14]-=.03125;mesh.bindMatrixInverse=mesh.bindMatrixInverse.clone();mesh.bindMatrixInverse.elements[13]+=.0625;
    }
    if(kind==='custom-method-change'){
     const original=mesh.getVertexPosition;
     mesh.getVertexPosition=function(index,target){const value=original.call(this,index,target);value.x+=.035*(index%3);return value;};
    }
   };
   const x=record(()=>a.riderContact.settle(a.rider,2,loggedTerrain(left,mutate(am)),.025,.7));
   const y=record(()=>b.riderContact.settle(b.rider,2,loggedTerrain(right,mutate(bm)),.025,.7));
   assert.deepEqual(y,x,kind+' vertices and returned lift');assert.deepEqual(right,left,kind+' terrain order');compareActors(a,b,kind);vertices+=x.vertices.length;
   a.dispose();b.dispose();a=b=undefined;
  }
  a=actor(previous);b=actor(current);editSkin(a,'nonzero-invalid-index');editSkin(b,'nonzero-invalid-index');
  const error=view=>{let thrown;try{view.riderContact.settle(view.rider,2,terrain);}catch(e){thrown=e;}assert(thrown instanceof TypeError,'nonzero invalid bone must throw the native TypeError');return[thrown.name,thrown.message];};
  assert.deepEqual(error(b),error(a),'nonzero invalid bone keeps the native error');
  console.log(JSON.stringify({measurement:'live native skinning parity',cases:7,vertices}));
 }finally{a?.dispose();b?.dispose();browser.restore();}
});
function pointProbe(points){const mesh=new T.Mesh(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points.flat(),3)));mesh.name='numeric-grid';mesh.getVertexPosition=function(index,target){return target.set(...points[index]);};return{mesh,indices:points.map((_,i)=>i)};}
function bareSupport(api){const value=Object.create(api.FallenSupport.prototype);value.groundCache=new Map();return value;}
test('numeric cell keys preserve signed zero, nonfinite coordinates, repeated cells and reentrant clearing',()=>{
 const points=[[0,0,0],[-0,.1,-0],[.12,.2,.11],[-.12,.3,-.11],[.35,.4,-.35],[.35,.5,-.35],[1e25,.6,1e-25],[1e25,.7,1e-25],[NaN,.8,NaN],[NaN,.9,NaN],[Infinity,1,-Infinity],[Infinity,1.1,-Infinity]],a=bareSupport(previous),b=bareSupport(current),left=[],right=[];
 const run=(support,queries)=>record(()=>support.lift([pointProbe(points)],2,loggedTerrain(queries),.025));
 assert.deepEqual(run(b,right),run(a,left));assert.deepEqual(right,left,'numeric key equivalence');
 assert.equal(left.length,4,'same numeric cells are sampled once, including nonfinite world points');
 // The second missing z clears an already-existing x column. Inserting into a
 // retained column after that callback would silently lose its returned sample.
 const repeated=[[0,0,0],[0,.1,1],[0,.2,1],[0,.3,2],[0,.4,1]];
 for(const support of [a,b])support.groundCache.clear();left.length=right.length=0;
 const reentrant=(support,queries)=>record(()=>support.lift([pointProbe(repeated)],2,loggedTerrain(queries,step=>{if(step===2)support.groundCache.clear();}),.025));
 assert.deepEqual(reentrant(b,right),reentrant(a,left));assert.deepEqual(right,left,'reentrant clear preserves samples');assert.equal(left.length,3);
});
test('optional CPU benchmark of actual contact methods and full fallen pose updates',{skip:process.env.BELLE_CONTACT_BENCHMARK!=='1'},async()=>{
 const [numeric,strings]=await Promise.all([implementation(false),implementation(true)]),browser=browserFixture();let a,b;
 try{
  a=actor(strings);b=actor(numeric);const rows=cases(numeric).filter(([name])=>name.startsWith('fall')||name.startsWith('recover')).map(([,p])=>p),settled=rows.find(p=>p.crashSettle>=.99&&p.crashKind);
  a.apply({...settled});b.apply({...settled});compareActors(a,b,'benchmark starting pose');
  const benchmark=(label,before,after,iterations)=>{const left=[],right=[];measure(before,iterations);measure(after,iterations);for(let i=0;i<9;i++){if(i%2){left.push(measure(before,iterations));right.push(measure(after,iterations));}else{right.push(measure(after,iterations));left.push(measure(before,iterations));}}console.log(JSON.stringify({measurement:label,scope:'Linux Node CPU; not native browser acceptance or historical stall attribution',iterations,rounds:9,stringMs:median(left),numericMs:median(right),ratio:median(right)/median(left),stringRounds:left,numericRounds:right}));};
  benchmark('actual CrashContact.settle on shipped armored rider',()=>a.riderContact.settle(a.rider,2,terrain,.025,0),()=>b.riderContact.settle(b.rider,2,terrain,.025,0),192);
  benchmark('actual FallenSupport.lift over all shipped armored rider probes',()=>{a.fallenSupport.groundCache.clear();a.fallenSupport.lift(a.riderContact.probes,2,terrain,.025);},()=>{b.fallenSupport.groundCache.clear();b.fallenSupport.lift(b.riderContact.probes,2,terrain,.025);},192);
  benchmark('actual ThreeRiderView.apply across fall/recovery poses',i=>{browser.step();a.apply({...rows[i%rows.length]});},i=>{browser.step();b.apply({...rows[i%rows.length]});},128);
 }finally{a?.dispose();b?.dispose();browser.restore();}
});
