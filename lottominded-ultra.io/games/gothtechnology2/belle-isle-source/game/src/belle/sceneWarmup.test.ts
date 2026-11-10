import test from 'node:test';
import assert from 'node:assert/strict';
import {DirectionalLight,Group,PerspectiveCamera,PointLight,Scene,SpotLight} from 'three';
import {SceneWarmup} from './sceneWarmup.ts';

function fixture(){const scene=new Scene(),sun=new DirectionalLight();sun.castShadow=true;scene.add(sun,...Array.from({length:4},()=>new PointLight()));const bike=new Group();bike.visible=false;bike.add(new PointLight(),new SpotLight(),new SpotLight());scene.add(bike);return{scene,sun,bike,camera:new PerspectiveCamera()};}
function topology(scene:Scene){let points=0,spots=0,shadows=0;scene.traverseVisible(o=>{if(o instanceof PointLight)points++;if(o instanceof SpotLight)spots++;if(o instanceof DirectionalLight&&o.castShadow)shadows++;});return{points,spots,shadows};}

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

test('a queued cancelled caller cannot lock the scene and an unready driver times out with retry available',async()=>{
 const {scene,bike,camera}=fixture(),busy:boolean[]=[];let ready=false,calls=0;
 const warmup=new SceneWarmup({compileAsync:()=>{calls++;return ready?Promise.resolve(scene):new Promise<Scene>(()=>{});}},scene,camera,v=>busy.push(v),async()=>{},15);
 const first=warmup.prepare(),failure=assert.rejects(first,/preparation took too long/);
 const signal=new AbortController(),queued=warmup.prepare(bike,signal.signal),cancelled=assert.rejects(queued,{name:'AbortError'});signal.abort();
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
