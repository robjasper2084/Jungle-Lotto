import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,DataTexture,DirectionalLight,Group,InstancedMesh,Mesh,MeshBasicMaterial,MeshStandardMaterial,PerspectiveCamera,PointLight,Scene,SpotLight,type Texture,type Object3D} from 'three';
import {prepareColoredDetailPool,SceneWarmup} from './sceneWarmup.ts';
import {warmLandmarkPrograms} from './landmarkPrograms.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';

for(const parallel of [true,false]){
 test('landmark preparation reflects every shared-material variant before drawing, parallel='+parallel,async()=>{
  const model=new Group(),camera=new PerspectiveCamera(),scene=new Scene(),mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());
  const material=mesh.material;model.add(mesh);
  const atmosphere=new WorldAtmosphere(scene,new DataTexture());
  const addedVisibility:boolean[]=[];
  scene.addEventListener('childadded',event=>addedVisibility.push(event.child.visible));
  const reflected:number[]=[],linked:number[]=[];
  let flushed=false,firstPoll=true;
  const programs=[1,2].map(program=>({program,getUniforms(){assert(flushed);reflected.push(program);}}));
  const gl={LINK_STATUS:2,isContextLost:()=>false,flush(){flushed=true;},
   getExtension:()=>parallel?{COMPLETION_STATUS_KHR:1}:null,
   getProgramParameter(handle:number,key:number){
    if(key===2){linked.push(handle);return true;}
    assert(parallel);if(handle===1&&firstPoll){firstPoll=false;return false;}return true;
   }};
  const renderer={compile(root:Group,view:PerspectiveCamera,target:Scene){
   assert.equal(root,model);assert.equal(view,camera);assert.equal(target,scene);
   assert.match(material.customProgramCacheKey(),/belle-height-fog-clouds/);return new Set([material]);
  },properties:{get:()=>({programs:new Map(programs.map(p=>[p.program,p])),currentProgram:programs[1]})},getContext:()=>gl};
  await warmLandmarkPrograms(renderer as unknown as Parameters<typeof warmLandmarkPrograms>[0],model,camera,scene);
  assert.deepEqual(reflected,parallel?[2,1]:[1,2]);assert.deepEqual(linked,reflected);
  assert.deepEqual(addedVisibility,[false]);assert.equal(model.parent,null);assert.equal(model.visible,true);
  const preparedKey=material.customProgramCacheKey();
  scene.add(model);await Promise.resolve();assert.equal(material.customProgramCacheKey(),preparedKey);atmosphere.dispose();
 });
}

test('both island lighting variants must finish linking before the island becomes ready',async()=>{
 const {scene,sun,camera}=fixture(),states:boolean[]=[],busy:boolean[]=[];
 const handles=[{},{}],programs:{program:object;getUniforms():void}[]=[],checked=new Set<object>(),polled:object[]=[];
 let notifyPoll=()=>{};const firstPoll=new Promise<void>(resolve=>{notifyPoll=resolve;});
 let firstReady=false,flushes=0;
 const gl={getExtension:()=>({COMPLETION_STATUS_KHR:1}),LINK_STATUS:2,
  flush(){flushes++;},isContextLost:()=>false,getProgramParameter(handle:object,key:number){
   if(key===2){checked.add(handle);return true;}
   polled.push(handle);notifyPoll();return handle===handles[1]||firstReady;
  }};
 const renderer={info:{programs},getContext:()=>gl,compile(){
  states.push(sun.castShadow);programs.push({program:handles[states.length-1],getUniforms(){}});
 },compileAsync(){throw Error('unexpected additional compilation');}};
 const warmup=new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,b=>busy.push(b),async()=>{});
 const ready=warmup.prepare();
 await firstPoll;assert.deepEqual(polled,[handles[0]]);assert.equal(checked.size,0);
 assert.deepEqual(states,[false,true]);assert.deepEqual(busy,[true]);assert.equal(flushes,2);
 firstReady=true;await ready;assert.equal(checked.size,2);assert.deepEqual(busy,[true,false]);assert.equal(sun.castShadow,true);
});

test('an unlinked island program fails preparation and allows a fresh attempt',async()=>{
 const {scene,sun,camera}=fixture(),programs=[{program:{},getUniforms(){}}];sun.castShadow=false;
 let linked=false;
 const gl={getExtension:()=>({COMPLETION_STATUS_KHR:1}),LINK_STATUS:2,flush(){},isContextLost:()=>false,
  getProgramParameter:(_:unknown,key:number)=>key===1||linked,getProgramInfoLog:()=>'driver error'};
 const renderer={info:{programs},getContext:()=>gl,compile(){},compileAsync(){throw Error('unexpected fallback');}};
 const warmup=new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,()=>{},async()=>{});
 await assert.rejects(warmup.prepare(),/Island shader link failed: driver error/);assert.equal(sun.castShadow,false);
 linked=true;await warmup.prepare();assert.equal(sun.castShadow,false);
});

test('early mapped submission keeps the current lights and still validates both final variants with late actors',async()=>{
 const {scene,sun,bike,camera}=fixture(),late=new Mesh(),seen:boolean[]=[],busy:boolean[]=[];
 let primes=0,flushes=0;
 const renderer={shadowMap:{enabled:true},getContext:()=>({
  isContextLost:()=>false,getExtension:()=>({}),flush(){flushes++;}
 }),compile(root:Object3D,view:PerspectiveCamera,target:Scene){
  assert.equal(root,scene);assert.equal(view,camera);assert.equal(target,scene);
  assert.equal(sun.castShadow,true);assert.equal(bike.visible,false);assert.equal(root.getObjectById(late.id),undefined);primes++;
 },async compileAsync(root:Object3D){const submitted:Object3D[]=[];root.traverse(o=>submitted.push(o));assert(submitted.includes(late));seen.push(sun.castShadow);return scene;}};
 const warmup=new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,v=>busy.push(v),async()=>{});
 warmup.primeIsland();assert.equal(primes,1);assert.equal(flushes,1);assert.deepEqual(busy,[]);
 scene.add(late);await warmup.prepare();assert.deepEqual(seen,[false,true]);assert.deepEqual(busy,[true,false]);
 assert.equal(sun.castShadow,true);assert.equal(bike.visible,false);
});

test('early preparation does not submit a full hidden island for Smooth or a synchronous-only backend',()=>{
 const {scene,camera}=fixture();let ext:object|null={},lost=false;
 const renderer={shadowMap:{enabled:false},getContext:()=>({isContextLost:()=>lost,getExtension:()=>ext}),
  compile(){throw Error('unexpected early submission');},compileAsync:async()=>scene};
 const warmup=new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,()=>{});
 warmup.primeIsland();renderer.shadowMap.enabled=true;ext=null;warmup.primeIsland();ext={};lost=true;warmup.primeIsland();
});

function fixture(){const scene=new Scene(),sun=new DirectionalLight();sun.castShadow=true;scene.add(sun,...Array.from({length:4},()=>new PointLight()));const bike=new Group();bike.visible=false;bike.add(new PointLight(),new SpotLight(),new SpotLight());scene.add(bike);return{scene,sun,bike,camera:new PerspectiveCamera()};}
function topology(scene:Scene){let points=0,spots=0,shadows=0;scene.traverseVisible(o=>{if(o instanceof PointLight)points++;if(o instanceof SpotLight)spots++;if(o instanceof DirectionalLight&&o.castShadow)shadows++;});return{points,spots,shadows};}

test('Smooth island warmup submits bounded batches and retains each visible drawable exactly once',async()=>{
 const {scene,camera}=fixture(),meshes=Array.from({length:150},()=>new Mesh());
 scene.add(...meshes);
 const seen:Object3D[]=[],sizes:number[]=[];
 const renderer={shadowMap:{enabled:false},compileAsync:async(root:Object3D)=>{
  const before=seen.length;
  root.traverse(o=>seen.push(o));
  sizes.push(seen.length-before);
  return scene;
 }};
 await new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,()=>{},async()=>{}).prepare();
 assert.deepEqual(sizes,[64,64,22]);assert.deepEqual(seen,meshes);
});

test('empty distance-selected pools warm the colored variant before a ride in either shadow mode',async()=>{
 for(const mapped of [true,false]){
  const {scene,camera,bike}=fixture();
  const pool=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),8);
  pool.count=0;pool.visible=false;scene.add(pool);
  const limestone=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),4);
  limestone.count=0;limestone.visible=false;scene.add(limestone);
  const hiddenRide=new Mesh();bike.add(hiddenRide);
  prepareColoredDetailPool(pool);
  const draws:Object3D[]=[];
  const renderer={shadowMap:{enabled:mapped},compileAsync:async(root:Object3D)=>{
   root.traverse(object=>draws.push(object));return scene;
  }};
  await new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,()=>{},async()=>{}).prepare();
  assert.equal(pool.instanceColor?.count,8);assert.equal(pool.count,0);assert.equal(pool.visible,false);
  assert.equal(limestone.instanceColor,null);
  assert.deepEqual(draws,mapped?[pool,limestone,pool,limestone]:[pool,limestone]);
 }
});

test('contact-only warmup skips mapped shadows and permits a later mapped warmup',async()=>{
 const {scene,sun,camera}=fixture(),calls:boolean[]=[];
 const renderer={shadowMap:{enabled:false},compileAsync:async()=>{calls.push(sun.castShadow);return scene;}};
 const warmup=new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,()=>{},async()=>{});
 await warmup.prepare();await warmup.prepare();
 assert.deepEqual(calls,[false]);assert.equal(sun.castShadow,true);
 renderer.shadowMap.enabled=true;
 await warmup.prepare();await warmup.prepare();
 assert.deepEqual(calls,[false,false,true]);
});

test('island batches link concurrently within one lighting policy and drain before it changes',async()=>{
 const {scene,camera,sun}=fixture();
 scene.add(...Array.from({length:193},()=>new Mesh()));
 let active=0,peak=0;
 const calls:boolean[]=[];
 const renderer={shadowMap:{enabled:true},compileAsync:async()=>{
  const shadow=sun.castShadow;calls.push(shadow);active++;peak=Math.max(peak,active);
  await new Promise(done=>setTimeout(done,12));
  assert.equal(sun.castShadow,shadow);active--;return scene;
 }};
 await new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,()=>{},async()=>{}).prepare();
 assert(peak>1&&peak<=4);assert.deepEqual(calls,[false,false,false,false,true,true,true,true]);
});

test('a fixed directional light needs one mapped topology and polls shared programs only once',async()=>{
 const {scene,camera,sun}=fixture();sun.userData.fixedShadowLayout=true;
 scene.add(...Array.from({length:129},()=>new Mesh()));
 const uniforms:number[]=[],programs=[0,1].map(i=>({program:{},getUniforms:()=>uniforms.push(i)})),polls:object[]=[],shadows:boolean[]=[];
 let flushed=0;
 const renderer={shadowMap:{enabled:true},info:{programs},getContext:()=>({
  getExtension:()=>({COMPLETION_STATUS_KHR:0x91b1}),LINK_STATUS:0x8b82,isContextLost:()=>false,flush:()=>flushed++,
  getProgramParameter:(program:object,key:number)=>{if(key===0x8b82)return true;polls.push(program);return polls.length!==1;}
 }),compile:()=>shadows.push(sun.castShadow),compileAsync:()=>{throw Error('unexpected material poll');}};
 await new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,()=>{},async()=>{}).prepare();
 assert.deepEqual(shadows,[true,true,true]);assert.equal(flushed,1);
 assert.deepEqual(polls,[programs[0].program,programs[0].program,programs[1].program]);
 assert.deepEqual(uniforms,[0,1]);
});

test('vehicle warmup reflects each program before making the ride visible',async()=>{
 const {scene,camera,bike}=fixture();
 const reflected:number[]=[];
 const programs=[0,1].map(i=>({program:{},getUniforms:()=>reflected.push(i)}));
 const renderer={shadowMap:{enabled:false},info:{programs},getContext:()=>({
  getExtension:()=>({COMPLETION_STATUS_KHR:1}),LINK_STATUS:2,isContextLost:()=>false,flush(){},
  getProgramParameter(){assert.equal(bike.visible,false);return true;}
 }),compile(_root:Object3D,view:PerspectiveCamera,target:Scene){
  assert.equal(view,camera);assert.equal(target,scene);assert.equal(bike.visible,true);
 },compileAsync(){throw Error('Unexpected material-only poll');}};
 await new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],
  scene,camera,()=>{},async()=>{}).prepare(bike);
 assert.deepEqual(reflected,[0,1]);assert.equal(bike.visible,false);
});

test('vehicle warmup validates only submitted materials, including their already cached variants',async()=>{
 const {scene,camera,sun}=fixture();sun.userData.fixedShadowLayout=true;
 const material=new MeshStandardMaterial(),ride=new Group();ride.add(new Mesh(new BoxGeometry(),material));ride.visible=false;scene.add(ride);
 const unrelated={},cached={},added={},checked:object[]=[],reflected:object[]=[];
 const entry=(program:object)=>({program,getUniforms(){reflected.push(program);}});
 const unrelatedEntry=entry(unrelated),cachedEntry=entry(cached),addedEntry=entry(added);
 const programs=[unrelatedEntry,cachedEntry],variants=new Map([['cached',cachedEntry]]);
 let compilations=0,flushed=false;
 const renderer={shadowMap:{enabled:true},info:{programs},properties:{get(value:unknown){assert.equal(value,material);return{programs:variants,currentProgram:addedEntry};}},
  compile(root:Object3D,view:PerspectiveCamera,target:Scene){
   assert.equal(root,ride);assert.equal(view,camera);assert.equal(target,scene);assert.equal(ride.visible,true);
   compilations++;programs.push(addedEntry);variants.set('added',addedEntry);return new Set([material]);
  },compileAsync(){throw Error('unexpected additional compilation');},getContext:()=>({
   getExtension:()=>({COMPLETION_STATUS_KHR:1}),LINK_STATUS:2,isContextLost:()=>false,flush(){flushed=true;},
   getProgramParameter(handle:object,key:number){
    assert(flushed);assert.equal(ride.visible,false);
    assert.notEqual(handle,unrelated,'an unrelated, potentially pending program must not gate this ride');
    if(key===2)checked.push(handle);return true;
   }
  })};
 await new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,()=>{},async()=>{}).prepare(ride);
 assert.equal(compilations,1);assert.deepEqual(checked,[cached,added]);assert.deepEqual(reflected,[cached,added]);
 assert.equal(ride.visible,false);assert.equal(sun.castShadow,true);
});

test('scoped preparation retains every shared-material variant across island batches and shadow policies',async()=>{
 const {scene,camera,sun}=fixture(),first=new MeshStandardMaterial(),shared=new MeshStandardMaterial(),geometry=new BoxGeometry();
 scene.add(...Array.from({length:64},()=>new Mesh(geometry,first)),new Mesh(geometry,shared),new InstancedMesh(geometry,shared,1));
 type Entry={program:{name:string};getUniforms():void};
 const unrelated={name:'unrelated'},checked:string[]=[],reflected:string[]=[],policies:boolean[]=[];
 const programs:Entry[]=[{program:unrelated,getUniforms(){throw Error('unrelated reflection');}}];
 const materialPrograms=new Map([first,shared].map(material=>[material,new Map<string,Entry>()]));
 let delayed=false,flushes=0;
 const renderer={shadowMap:{enabled:true},info:{programs},properties:{get(material:MeshStandardMaterial){
  const variants=materialPrograms.get(material)!;return{programs:variants,currentProgram:[...variants.values()].at(-1)};
 }},compile(root:Object3D){
  policies.push(sun.castShadow);const submitted=new Set<MeshStandardMaterial>();
  root.traverse(object=>{
   if(!(object instanceof Mesh))return;
   const material=object.material as MeshStandardMaterial,variants=materialPrograms.get(material)!;
   const key=(sun.castShadow?'mapped':'contact')+((object as InstancedMesh).isInstancedMesh?'-instanced':'-ordinary');
   if(!variants.has(key)){
    const name=(material===first?'first-':'shared-')+key;
    const entry={program:{name},getUniforms(){reflected.push(name);}};
    variants.set(key,entry);programs.push(entry);
   }
   submitted.add(material);
  });return submitted;
 },compileAsync(){throw Error('unexpected additional compilation');},getContext:()=>({
  getExtension:()=>({COMPLETION_STATUS_KHR:1}),LINK_STATUS:2,isContextLost:()=>false,flush(){flushes++;},
  getProgramParameter(handle:{name:string},key:number){
   assert.notEqual(handle,unrelated);assert.equal(flushes,2,'both policies submit before polling');
   if(key===1&&handle.name==='shared-contact-instanced'&&!delayed){delayed=true;return false;}
   if(key===2)checked.push(handle.name);return true;
  }
 })};
 await new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,()=>{},async()=>{}).prepare();
 const expected=['first-contact-ordinary','shared-contact-ordinary','shared-contact-instanced','first-mapped-ordinary','shared-mapped-ordinary','shared-mapped-instanced'];
 assert.deepEqual(policies,[false,false,true,true]);assert(delayed);
 assert.deepEqual(checked,expected);assert.deepEqual(reflected,expected);assert.equal(sun.castShadow,true);
});

test('a compiler with incomplete material properties retains full program validation',async()=>{
 const {scene,camera,sun}=fixture();sun.userData.fixedShadowLayout=true;
 const material=new MeshStandardMaterial(),ride=new Mesh(new BoxGeometry(),material);ride.visible=false;scene.add(ride);
 const reflected:number[]=[],programs=[0,1].map(id=>({program:{id},getUniforms(){reflected.push(id);}})),checked:number[]=[];
 const renderer={shadowMap:{enabled:true},info:{programs},properties:{get:()=>({})},compile:()=>new Set([material]),
  compileAsync(){throw Error('unexpected additional compilation');},getContext:()=>({
   getExtension:()=>({COMPLETION_STATUS_KHR:1}),LINK_STATUS:2,isContextLost:()=>false,flush(){},
   getProgramParameter(handle:{id:number},key:number){if(key===2)checked.push(handle.id);return true;}
  })};
 await new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,()=>{},async()=>{}).prepare(ride);
 assert.deepEqual(checked,[0,1]);assert.deepEqual(reflected,[0,1]);assert.equal(ride.visible,false);
});

test('a failed scoped program restores scene state and must be verified again on retry',async()=>{
 const {scene,camera,sun}=fixture();sun.userData.fixedShadowLayout=true;
 const material=new MeshStandardMaterial(),ride=new Mesh(new BoxGeometry(),material);ride.visible=false;scene.add(ride);
 let linked=false,compilations=0,reflections=0,linkChecks=0;const busy:boolean[]=[];
 const entry={program:{},getUniforms(){reflections++;}},programs=[entry],variants=new Map([['ride',entry]]);
 const renderer={shadowMap:{enabled:true},info:{programs},properties:{get:()=>({programs:variants})},
  compile(){compilations++;return new Set([material]);},compileAsync(){throw Error('unexpected additional compilation');},getContext:()=>({
   getExtension:()=>({COMPLETION_STATUS_KHR:1}),LINK_STATUS:2,isContextLost:()=>false,flush(){},getProgramInfoLog:()=>'scoped link failure',
   getProgramParameter(_:object,key:number){if(key===1)return true;linkChecks++;return linked;}
  })};
 const warmup=new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,value=>busy.push(value),async()=>{});
 await assert.rejects(warmup.prepare(ride),/scoped link failure/);
 assert.equal(reflections,0);assert.equal(ride.visible,false);assert.equal(sun.castShadow,true);
 linked=true;await warmup.prepare(ride);
 assert.equal(compilations,2);assert.equal(linkChecks,2);assert.equal(reflections,1);assert.deepEqual(busy,[true,false,true,false]);
 assert.equal(ride.visible,false);assert.equal(sun.castShadow,true);
});

test('Smooth prepares active drawables against the actual island lights, with a separate preparation for a hidden ride',async()=>{
 const {scene,bike,camera}=fixture(),island=new Mesh(),detail=new Mesh(),wrongLayer=new Mesh();
 const map=new DataTexture(new Uint8Array([255,255,255,255]),1,1),uploads:Texture[]=[];detail.material=new MeshBasicMaterial({map});
 wrongLayer.layers.set(2);scene.add(island,wrongLayer);bike.add(detail);
 const renderer={shadowMap:{enabled:false},initTexture:(t:Texture)=>{uploads.push(t);},compileAsync:async(root:Object3D,view:PerspectiveCamera,target:Scene)=>{
  assert.equal(view,camera);assert.equal(target,scene);
  const objects:Object3D[]=[];root.traverse(o=>objects.push(o));
  if(!bike.visible){
   assert.deepEqual(objects,[island]);
   const lights:Object3D[]=[];root.traverseVisible(o=>{if('isLight' in o)lights.push(o);});
   assert.equal(lights.length,0);
  }else assert(objects.includes(detail));
  return scene;
 }};
 const warmup=new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,()=>{},async()=>{});
 await warmup.prepare();assert.deepEqual(uploads,[map]);
 await warmup.prepare(bike);assert.deepEqual(uploads,[map]);
 assert.equal(detail.parent,bike);assert.equal(bike.visible,false);assert.equal(island.parent,scene);
});

test('island and mounted bike warm both shadow variants without drawing or leaving bike visible',async()=>{
 const {scene,sun,bike,camera}=fixture(),calls:ReturnType<typeof topology>[]=[],busy:boolean[]=[];let paints=0;
 const warmup=new SceneWarmup({compileAsync:async()=>{calls.push(topology(scene));return scene;}},scene,camera,v=>busy.push(v),async()=>{paints++;assert.equal(bike.visible,false);});
 await warmup.prepare();await warmup.prepare(bike);
 assert.deepEqual(calls,[{points:4,spots:0,shadows:0},{points:4,spots:0,shadows:1},{points:5,spots:2,shadows:0},{points:5,spots:2,shadows:1}]);
 assert.equal(bike.visible,false);assert.equal(sun.castShadow,true);assert.equal(paints,2);assert.deepEqual(busy,[true,false,true,false]);
 await warmup.prepare(bike);await warmup.prepare();assert.equal(calls.length,4,'already prepared restarts and mounts do no new compilation');
});

test('concurrent mount preparation is shared, stays locked until driver readiness, and restores hidden model immediately',async()=>{
 const {scene,sun,bike,camera}=fixture();let finish:(value:Scene)=>void=()=>{};const busy:boolean[]=[];let calls=0;
 const warmup=new SceneWarmup({compileAsync:()=>{calls++;assert.equal(bike.visible,true);return new Promise<Scene>(resolve=>{finish=resolve;});}},scene,camera,v=>busy.push(v),async()=>{});
 const first=warmup.prepare(bike),second=warmup.prepare(bike);assert.equal(first,second);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(bike.visible,false);assert.deepEqual(busy,[true]);assert.equal(calls,1);
 finish(scene);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);assert.equal(bike.visible,false);assert.deepEqual(busy,[true]);
 finish(scene);await first;assert.deepEqual(busy,[true,false]);assert.equal(sun.castShadow,true);
});

test('failed compilation restores light and visibility state and permits an honest retry',async()=>{
 const {scene,sun,bike,camera}=fixture();sun.castShadow=false;const busy:boolean[]=[];let fail=true,calls=0;
 const warmup=new SceneWarmup({compileAsync:async()=>{calls++;if(fail)throw Error('shader setup failed');return scene;}},scene,camera,v=>busy.push(v),async()=>{});
 await assert.rejects(warmup.prepare(bike),/shader setup failed/);assert.equal(bike.visible,false);assert.equal(sun.castShadow,false);assert.deepEqual(busy,[true,false]);
 fail=false;await warmup.prepare(bike);assert.equal(calls,3);assert.equal(bike.visible,false);assert.equal(sun.castShadow,false);assert.deepEqual(busy,[true,false,true,false]);
});

test('different scene preparations serialize and preserve an already visible vehicle',async()=>{
 const {scene,bike,camera}=fixture();bike.visible=true;let concurrent=0,peak=0;
 const warmup=new SceneWarmup({compileAsync:async()=>{concurrent++;peak=Math.max(peak,concurrent);await new Promise(resolve=>setImmediate(resolve));concurrent--;return scene;}},scene,camera,()=>{},async()=>{});
 await Promise.all([warmup.prepare(),warmup.prepare(bike)]);assert.equal(peak,1);assert.equal(bike.visible,true);
});

test('leaving a preparing ride releases control even when driver readiness never resolves',async()=>{
 const {scene,sun,bike,camera}=fixture(),signal=new AbortController(),busy:boolean[]=[];
 const warmup=new SceneWarmup({compileAsync:()=>new Promise<Scene>(()=>{})},scene,camera,v=>busy.push(v),async()=>{});
 const pending=warmup.prepare(bike,signal.signal);const rejection=assert.rejects(pending,{name:'AbortError'});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(busy,[true]);signal.abort();await rejection;
 assert.deepEqual(busy,[true,false]);assert.equal(bike.visible,false);assert.equal(sun.castShadow,true);
});

test('abort and immediate restart of the same bike cannot cancel the new preparation or clear its lock',async()=>{
 const {scene,sun,bike,camera}=fixture(),firstSignal=new AbortController(),nextSignal=new AbortController(),busy:boolean[]=[];let calls=0;
 const finish:((value:Scene)=>void)[]=[];
 const warmup=new SceneWarmup({compileAsync:()=>{calls++;return new Promise<Scene>(resolve=>finish.push(resolve));}},scene,camera,v=>busy.push(v),async()=>{});
 const first=warmup.prepare(bike,firstSignal.signal),rejection=assert.rejects(first,{name:'AbortError'});
 await new Promise(resolve=>setImmediate(resolve));firstSignal.abort();const next=warmup.prepare(bike,nextSignal.signal);await rejection;
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);assert.deepEqual(busy,[true,false,true]);
 finish[0](scene);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(busy,[true,false,true],'late abandoned driver completion cannot release successor');
 finish[1](scene);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,3);assert.deepEqual(busy,[true,false,true]);
 finish[2](scene);await next;assert.deepEqual(busy,[true,false,true,false]);assert.equal(bike.visible,false);assert.equal(sun.castShadow,true);
 await warmup.prepare(bike,new AbortController().signal);assert.equal(calls,3);
});

test('a queued cancelled caller cannot lock the scene and an unready driver times out with retry available',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let now=0;t.mock.method(performance,'now',()=>now);
 const {scene,bike,camera}=fixture(),busy:boolean[]=[];let ready=false,calls=0;
 const warmup=new SceneWarmup({compileAsync:()=>{calls++;return ready?Promise.resolve(scene):new Promise<Scene>(()=>{});}},scene,camera,v=>busy.push(v),async()=>{});
 const first=warmup.prepare(),failure=assert.rejects(first,/preparation took too long/);
 const signal=new AbortController(),queued=warmup.prepare(bike,signal.signal),cancelled=assert.rejects(queued,{name:'AbortError'});signal.abort();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.deepEqual(busy,[true]);
 now=44_999;t.mock.timers.tick(now);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(busy,[true]);
 now=45_000;t.mock.timers.tick(1);
 await Promise.all([failure,cancelled]);assert.deepEqual(busy,[true,false]);assert.equal(calls,1);
 ready=true;await warmup.prepare(bike);assert.equal(calls,3);assert.deepEqual(busy,[true,false,true,false]);
});


test('rider-only warmup compiles the new actors against existing lighting without recompiling the island',async()=>{
 const {scene,camera}=fixture(),riders=new Group();riders.visible=false;scene.add(riders);
 const calls:unknown[][]=[];const warmup=new SceneWarmup({compileAsync:async(...args)=>{calls.push(args);return scene;}},scene,camera,()=>{},async()=>{});
 await warmup.prepare(riders);assert.equal(calls.length,2);
 for(const [root,view,lighting] of calls){assert.equal(root,riders);assert.equal(view,camera);assert.equal(lighting,scene);}
 assert.equal(riders.visible,false);
});

test('preparation flushes pending shaders before waiting on driver completion',async()=>{
 const {scene,camera}=fixture();
 let complete=()=>{},submissions=0;
 const renderer={
  compileAsync:()=>new Promise<Scene>(resolve=>{complete=()=>resolve(scene);}),
  getContext:()=>({flush(){submissions++;complete();}} as WebGL2RenderingContext),
 };
 await new SceneWarmup(renderer,scene,camera,()=>{},async()=>{},1000).prepare();
 assert.equal(submissions,2);
});
