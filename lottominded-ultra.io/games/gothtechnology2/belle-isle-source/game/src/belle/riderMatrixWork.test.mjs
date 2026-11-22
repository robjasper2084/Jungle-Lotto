import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const game=fileURLToPath(new URL('../../',import.meta.url));
// Keep the previous eager propagation as an independent behavior oracle. The
// rest of apply() is shared so the comparison exercises its real IK, contacts,
// animation transitions and public world queries, not a simplified pose model.
const eagerRotation=`function rotateWorld(bone:T.Object3D|undefined,axis:T.Vector3,angle:number){if(!bone)return;const w=bone.getWorldQuaternion(q()).premultiply(q().setFromAxisAngle(axis,angle));bone.quaternion.copy(bone.parent!.getWorldQuaternion(q()).invert().multiply(w));bone.updateWorldMatrix(false,true);}\n`;
const eagerCamera="  if(this.carried.visible){hero.updateWorldMatrix(true,true);const hand=hero.getObjectByName('RightHand')??hero.getObjectByName('Hand_R');if(hand){this.carried.position.copy(hand.getWorldPosition(new T.Vector3()));this.carried.quaternion.copy(hero.getWorldQuaternion(new T.Quaternion()));this.carried.position.y-=.08;}else this.carried.visible=false;}";
async function implementation(eager){
 const outfile=path.join(game,'.test',`rider-matrix-${eager?'eager':'current'}.mjs`);
 await build({absWorkingDir:game,stdin:{contents:`export {ThreeRiderView} from './runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';export {createPose} from './runtime/ride-core/src/controller.ts';export {HUMAN_PROFILE} from './runtime/ride-core/src/profiles.ts';export {FallMotion,getUpPose} from './runtime/ride-core/src/fallMotion.ts';export {prepareOnFootRider} from './runtime/ride-core/src/onFootRider.ts';export {Photography} from './src/belle/photography.ts';`,resolveDir:game,loader:'ts'},outfile,bundle:true,platform:'node',format:'esm',external:['three'],alias:{'@digital-static/ridecore':path.join(game,'runtime/ride-core/src/index.ts')},logLevel:'error',plugins:[{name:'rig-verification',setup(b){
  // Browser-only cosmetic images/CSS are not needed for transform verification.
  b.onResolve({filter:/\.(?:css|webp)(?:\?.*)?$/},args=>({path:args.path,namespace:'test-browser-assets'}));
  b.onLoad({filter:/.*/,namespace:'test-browser-assets'},()=>({contents:'export default "";',loader:'js'}));
  if(eager)b.onLoad({filter:/(?:threeRiderView|photography|onFootRider)\.ts$/},async args=>{
   let source=await fs.readFile(args.path,'utf8');
   if(args.path.endsWith('threeRiderView.ts')){const start=source.indexOf('function rotateWorld('),end=source.indexOf('function prepare(',start);assert(start>=0&&end>start);source=source.slice(0,start)+eagerRotation+source.slice(end);}
   else if(args.path.endsWith('onFootRider.ts')){
    const scan='m.getVertexPosition(i,vertex).applyMatrix4(m.matrixWorld).applyMatrix4(worldToRig);';assert(source.includes(scan));
    source=source.replace(' h.root.updateWorldMatrix(true,false);\n','').replace(scan,'h.root.worldToLocal(m.getVertexPosition(i,vertex).applyMatrix4(m.matrixWorld));');
   }else{const expression=/^  if\(this\.carried\.visible\)\{.*\}$/m;assert(expression.test(source));source=source.replace(expression,eagerCamera);}
   return{contents:source,loader:'ts'};
  });
 }}]});
 return import(pathToFileURL(outfile).href);
}
// Load the exact shipped geometry, skin, hierarchy and clips. Removing texture
// references only in this fixture avoids needing a DOM image decoder in Node.
async function asset(relative){
 const bytes=await fs.readFile(path.join(game,'public',relative)),length=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+length).toString());
 data.materials=(data.materials??[]).map(m=>({name:m.name}));
 const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const binary=bytes.subarray(20+length),output=Buffer.alloc(20+padded.length+binary.length);
 output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);binary.copy(output,20+padded.length);
 return new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'');
}
const [current,eager,rider,wheel]=await Promise.all([implementation(false),implementation(true),asset('exports/rigged-heroes/DS_Armored_Rider_01.glb'),asset('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb')]);
const terrain={sampleGround(x,z,out){out.height=2+x*.001+z*.002;out.normal={x:-.001,y:1,z:-.002};out.surface='pavement';out.offCourse=false;return out;},raycastObstacle(){return null;}};
function browserFixture(){
 let now=2000,reduced=false;
 const globals=new Map(['window','document','matchMedia'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),clock=Object.getOwnPropertyDescriptor(performance,'now'),load=T.TextureLoader.prototype.loadAsync;
 Object.assign(globalThis,{window:new EventTarget(),document:{documentElement:{dataset:{}}},matchMedia:()=>Object.assign(new EventTarget(),{matches:reduced})});
 Object.defineProperty(performance,'now',{configurable:true,value:()=>now});T.TextureLoader.prototype.loadAsync=async()=>new T.Texture();
 return{step(){now+=1000/60;},reduced(value){reduced=value;},restore(){for(const [k,d]of globals)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];if(clock)Object.defineProperty(performance,'now',clock);else delete performance.now;T.TextureLoader.prototype.loadAsync=load;}};
}
function actor(api){const view=new api.ThreeRiderView(rider,wheel,terrain,{...api.HUMAN_PROFILE,id:'DS_Armored_Rider_01'});const scene=new T.Scene();scene.add(view.root);return view;}
function pose(overrides={}){return{...current.createPose(),x:464.05,y:4.225,z:880.67,headingY:.6,...overrides};}
function cases(){
 const rows=[['idle',pose()]];
 for(let i=0;i<16;i++){const f=i/15,s=Math.sin(f*Math.PI*2);rows.push(['ride '+i,pose({x:464+i*.13,z:880+i*.2,headingY:.6+f,speed:3+f*14,rollAngle:s*.42,riderRoll:s*.27,riderPitch:s*.3,brakeAmount:f>.7?.75:0,groundRoll:s*.06,wheelPitch:s*.02,wheelSpin:i*.7,bodyBob:s*.006,crouch:f>.4&&f<.6?.8:0,turnIntent:s,riderTurnTwist:s*.2,riderLookYaw:s*.3,stopFoot:i===0?.7:0})]);}
 rows.push(['natural motion',pose({speed:12,naturalMotion:1,bodyDrop:.14,bodyPitch:.31,bodyLateral:.03,bodyHipTilt:.04,bodyHipYaw:.07,bodyChestRoll:.04,bodyHeadRoll:.12,bodyTwist:.15,bodyLook:.2,shoulderL:.07,shoulderR:-.1,handLX:.09,handRX:-.07,handLY:.15,handRY:.2,handLZ:.1,handRZ:.12,armBank:.05,armSwing:.08})]);
 rows.push(['reverse',pose({speed:-3,reverseBlend:1,riderLookYaw:.7})],['takeoff',pose({speed:8,takeoffExtension:.8})],['airborne',pose({speed:8,airBlend:1,airHeight:1.1,crouch:.35})],['landing',pose({speed:7,landingCompression:.9,landingAnticipation:.7})]);
 for(let i=0;i<5;i++)rows.push(['dismount '+i,pose({footMode:1,footBlend:i/4,footTime:i/10,parkX:464,parkY:4.2,parkZ:880,parkHeading:.6})]);
 for(const [name,extra]of [['walk',{speed:2}],['run',{speed:5.4}],['crouch',{speed:1.1,footCrouch:1}],['prone',{speed:.7,footProne:1}],['evade',{speed:2,footEvade:.4,footEvadeDir:-1}],['vault',{speed:1.8,footVault:.4}],['jump',{speed:2,footJump:1,airHeight:.5,airBlend:1}]])for(let i=0;i<4;i++)rows.push([name+' '+i,pose({footMode:2,footBlend:1,footPhase:(i+.25)/4,footCycle:2+i/4,footTime:2+i/4,velocityX:.7,velocityZ:1.4,parkX:463,parkY:4.2,parkZ:879,parkHeading:.6,...extra})]);
 for(let i=0;i<7;i++)rows.push(['mount '+i,pose({footMode:3,footBlend:1-i/6,footMountTime:i*.4,footTime:5+i*.4,parkX:464,parkY:4.2,parkZ:880,parkHeading:.6})]);
 for(const side of [-1,1]){
  const initial=pose({speed:12,rollAngle:side*.38,naturalMotion:1}),fall=new current.FallMotion(initial,'obstacle'),rest={...initial};
  for(let i=0;i<=8;i++){const p={...initial};fall.sample(fall.settleTime*i/8,p);rows.push(['fall '+side+' '+i,p]);Object.assign(rest,p);}
  for(let i=1;i<=6;i++){const p={...rest};current.getUpPose(rest,i/6,p,i%2===0);rows.push(['recover '+side+' '+i,p]);}
 }
 rows.push(['recovered reset',pose({crashForward:1,wheelCrashLateral:.5})],['repeated reset',pose()]);
 return rows;
}
function near(a,b,label,tolerance=1e-10){assert.equal(a.length,b.length,label);for(let i=0;i<a.length;i++)assert(Number.isFinite(a[i])&&Number.isFinite(b[i])&&Math.abs(a[i]-b[i])<=tolerance,`${label} [${i}]: ${a[i]} != ${b[i]}`);}
function nodes(root){const result=[];root.traverse(o=>result.push(o));return result;}
function compareActors(a,b,label){
 const left=nodes(a.root),right=nodes(b.root);assert.equal(left.length,right.length);
 for(let i=0;i<left.length;i++){const x=left[i],y=right[i],name=label+' '+x.name;assert.equal(x.name,y.name);assert.equal(x.visible,y.visible,name);near([...x.position,...x.quaternion,...x.scale],[...y.position,...y.quaternion,...y.scale],name+' local');near(x.matrixWorld.elements,y.matrixWorld.elements,name+' published world');}
 // Publish finger poses exactly as the renderer does, then compare every skin
 // matrix and sampled deformed vertices, including the added garment hardware.
 a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);
 for(let i=0;i<left.length;i++){const x=left[i],y=right[i];if(!x.isSkinnedMesh)continue;x.skeleton.update();y.skeleton.update();near(x.skeleton.boneMatrices,y.skeleton.boneMatrices,label+' skin '+x.name,1e-6);const count=x.geometry.attributes.position.count;assert.equal(count,y.geometry.attributes.position.count);for(let j=0;j<count;j+=Math.max(1,Math.floor(count/64)))near(x.getVertexPosition(j,new T.Vector3()).applyMatrix4(x.matrixWorld).toArray(),y.getVertexPosition(j,new T.Vector3()).applyMatrix4(y.matrixWorld).toArray(),label+' vertex '+x.name+' '+j);}
}
function audit(action){
 // Compare every ancestor-aware world getter at the moment of use. The old
 // per-vertex worldToLocal calls are replaced by equivalent matrix arithmetic;
 // all their vertex results are checked separately below.
 const original=T.Object3D.prototype.updateMatrix,methods=['getWorldPosition','getWorldQuaternion','getWorldScale','localToWorld'],saved=new Map(),queries=[];let visits=0;
 T.Object3D.prototype.updateMatrix=function(){visits++;return original.call(this);};
 for(const key of methods){const fn=T.Object3D.prototype[key];saved.set(key,fn);T.Object3D.prototype[key]=function(...args){const result=fn.apply(this,args);queries.push([key,this.name,result.toArray()]);return result;};}
 try{action();return{visits,queries};}finally{T.Object3D.prototype.updateMatrix=original;for(const [key,fn]of saved)T.Object3D.prototype[key]=fn;}
}
function compareQueries(a,b,label){assert.equal(a.length,b.length,label+' getter count');for(let i=0;i<a.length;i++){assert.deepEqual(a[i].slice(0,2),b[i].slice(0,2),label+' getter order');near(a[i][2],b[i][2],label+' getter '+i+' '+a[i][0]+' '+a[i][1]);}}
test('deferred rider propagation preserves shipped rig poses, skinning and intermediate world queries',()=>{
 const browser=browserFixture();let a,b;
 try{
  a=actor(current);b=actor(eager);const rows=cases(),steadyRiding={frames:0,eager:0,deferred:0};let before=0,after=0;
  for(const reduced of [false,true]){browser.reduced(reduced);for(const [label,p]of rows){browser.step();const x=audit(()=>a.apply({...p})),y=audit(()=>b.apply({...p}));compareQueries(x.queries,y.queries,label);compareActors(a,b,label);assert(y.visits-x.visits>=500,label+' avoids repeated descendant work');before+=y.visits;after+=x.visits;if(reduced&&label.startsWith('ride ')){steadyRiding.frames++;steadyRiding.eager+=y.visits;steadyRiding.deferred+=x.visits;}}}
  console.log(JSON.stringify({measurement:'rider matrix compositions including cold fit',frames:rows.length*2,eager:before,deferred:after,reduction:1-after/before,steadyRiding}));
 }finally{a?.dispose();b?.dispose();browser.restore();}
});
test('cached fitting inverse preserves every shipped rider vertex and removes repeated root updates',()=>{
 const browser=browserFixture();let a,b;
 try{
  a=actor(current);b=actor(eager);let vertices=0;
  // Nonidentity ancestors ensure the cached transform is genuinely world to
  // root; check every mesh vertex, including cosmetics and fitted hardware.
  a.root.parent.position.set(3,.1,-4);a.root.parent.rotation.y=.2;a.root.position.set(464,4.2,880);a.root.rotation.y=.6;a.root.parent.updateMatrixWorld(true);
  a.root.updateWorldMatrix(true,false);const inverse=a.root.matrixWorld.clone().invert();
  a.rider.traverse(m=>{if(!m.isMesh)return;for(let i=0;i<m.geometry.attributes.position.count;i++){const world=m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrixWorld);assert.deepEqual(world.clone().applyMatrix4(inverse).toArray(),a.root.worldToLocal(world.clone()).toArray(),m.name+' vertex '+i);vertices++;}});
  a.root.parent.position.set(0,0,0);a.root.parent.rotation.set(0,0,0);a.root.position.set(0,0,0);a.root.rotation.set(0,0,0);a.root.parent.updateMatrixWorld(true);
  const x=audit(()=>current.prepareOnFootRider(a)),y=audit(()=>eager.prepareOnFootRider(b));compareQueries(x.queries,y.queries,'cold fit');compareActors(a,b,'cold fit');assert(x.visits<y.visits*.1,'one fitting inverse avoids per-vertex ancestor work');
  console.log(JSON.stringify({measurement:'cold rig fitting matrix compositions',vertices,eager:y.visits,cached:x.visits,reduction:1-x.visits/y.visits}));
 }finally{a?.dispose();b?.dispose();browser.restore();}
});
function photo(api){const value=Object.create(api.Photography.prototype);Object.assign(value,{capture:{active:false,finder:false,update(){}},rig:new T.Group(),carried:new T.Group()});return value;}
test('carried camera reads current hand/hero transforms without visiting unrelated descendants',()=>{
 const browser=browserFixture();let a,b;
 try{
  a=actor(current);b=actor(eager);const pa=photo(current),pb=photo(eager),camera=new T.PerspectiveCamera();let before=0,after=0;
  for(const [label,p]of cases().filter((_,i)=>i%7===0)){
   browser.step();a.apply({...p});b.apply({...p});
   // Simulate edits since the last renderer traversal, including an ancestor.
   for(const view of [a,b]){view.root.parent.position.set(3,.1,-4);view.root.parent.rotation.y=.2;view.rider.getObjectByName('RightHand').rotation.x+=.03;}
   const x=audit(()=>pa.update(camera,true,a.rider,1000)),y=audit(()=>pb.update(camera,true,b.rider,1000));before+=y.visits;after+=x.visits;compareQueries(x.queries,y.queries,label+' camera');near(pa.carried.position.toArray(),pb.carried.position.toArray(),label+' camera position');near(pa.carried.quaternion.toArray(),pb.carried.quaternion.toArray(),label+' camera rotation');assert.equal(pa.carried.visible,pb.carried.visible);
   // Camera attachment only promises its queried transforms immediately. The
   // normal scene traversal publishes the other descendants before rendering.
   a.root.parent.updateMatrixWorld(true);b.root.parent.updateMatrixWorld(true);compareActors(a,b,label+' after render traversal');
  }
  assert(after<before*.35,`camera matrix compositions: ${before} -> ${after}`);
  for(const available of [false,true])for(const visible of [false,true]){a.root.visible=b.root.visible=visible;pa.update(camera,available,a.rider,1000);pb.update(camera,available,b.rider,1000);assert.equal(pa.carried.visible,pb.carried.visible);assert.equal(pa.carried.visible,available&&visible);}
  for(const name of ['Hand_R','missing']){const hero=new T.Group(),hand=new T.Bone();hand.name=name;hand.position.set(.1,1.2,.2);hero.add(hand);pa.update(camera,true,hero,1000);pb.update(camera,true,hero,1000);assert.equal(pa.carried.visible,name==='Hand_R');assert.equal(pa.carried.visible,pb.carried.visible);near(pa.carried.position.toArray(),pb.carried.position.toArray(),'fallback hand');}
  console.log(JSON.stringify({measurement:'carried camera matrix compositions',eager:before,deferred:after,reduction:1-after/before}));
 }finally{a?.dispose();b?.dispose();browser.restore();}
});
test('optional Linux CPU proxy for the shipped rider pose update',{skip:process.env.BELLE_RENDER_BENCHMARK!=='1'},()=>{
 const browser=browserFixture();let a,b;
 try{
  a=actor(current);b=actor(eager);const rows=cases().filter(([name])=>name.startsWith('ride ')).map(([,p])=>p),iterations=512,before=[],after=[];
  const run=view=>{const start=process.hrtime.bigint();for(let i=0;i<iterations;i++){browser.step();view.apply(rows[i%rows.length]);}return Number(process.hrtime.bigint()-start)/1e6/iterations;};
  run(a);run(b);
  for(let i=0;i<9;i++){if(i%2){before.push(run(b));after.push(run(a));}else{after.push(run(a));before.push(run(b));}}
  const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
  console.log(JSON.stringify({measurement:'Linux Node CPU proxy; not iPad or GPU timing',iterationsPerRound:iterations,rounds:before.length,eagerMsPerApply:median(before),deferredMsPerApply:median(after),eagerRounds:before,deferredRounds:after}));
 }finally{a?.dispose();b?.dispose();browser.restore();}
});
test('optional Linux CPU proxy for cold rig fitting',{skip:process.env.BELLE_RENDER_BENCHMARK!=='1'},()=>{
 const browser=browserFixture(),before=[],after=[];
 try{
  const run=api=>{const view=actor(api);try{const start=process.hrtime.bigint();api.prepareOnFootRider(view);return Number(process.hrtime.bigint()-start)/1e6;}finally{view.dispose();}};
  run(current);run(eager);
  for(let i=0;i<7;i++){if(i%2){before.push(run(eager));after.push(run(current));}else{after.push(run(current));before.push(run(eager));}}
  const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
  console.log(JSON.stringify({measurement:'Linux Node cold fitting CPU proxy; not iPad timing',rounds:before.length,eagerMs:median(before),cachedMs:median(after),eagerRounds:before,cachedRounds:after}));
 }finally{browser.restore();}
});
