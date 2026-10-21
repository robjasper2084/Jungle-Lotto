import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {ShadowCadence,installShadowBudget,invalidateAnimatedShadow} from '../src/shadowBudget.ts';
import {acquireVisualMaterial} from '../src/sharedVisualMaterial.ts';
test('static scenery keeps 30 Hz caching, with immediate teleport and dirty refresh',()=>{
 const budget=new ShadowCadence();for(let i=0;i<60;i++)budget.due(i*1000/60,{x:i*.1,y:2,z:0});
 assert.equal(budget.updates,30);assert.equal(budget.skips,30);
 assert(budget.due(1001,{x:50,y:2,z:0}));assert(!budget.due(1002,{x:50,y:2,z:0}));
 assert(budget.due(1003,{x:50,y:2,z:0},30,true));assert(budget.due(0,{x:50,y:2,z:0}));
});

test('animated rider and dog poses cannot receive a previous-frame shadow',()=>{
 const scene=new T.Scene(),group=new T.Group(),rider=new T.Group(),dog=new T.Group(),camera=new T.PerspectiveCamera();scene.add(group,dog);group.add(rider);
 const renderer={shadowMap:{enabled:true,autoUpdate:true,needsUpdate:false},xr:{isPresenting:false}} as T.WebGLRenderer;
 installShadowBudget(renderer,scene);scene.onBeforeRender(renderer,scene,camera,null);
 for(const actor of [rider,dog,rider,dog]){renderer.shadowMap.needsUpdate=false;invalidateAnimatedShadow(actor);scene.onBeforeRender(renderer,scene,camera,null);assert(renderer.shadowMap.needsUpdate);}
 renderer.shadowMap.needsUpdate=false;group.visible=false;invalidateAnimatedShadow(rider);scene.onBeforeRender(renderer,scene,camera,null);assert(!renderer.shadowMap.needsUpdate,'hidden actors do not invalidate');
 renderer.shadowMap.enabled=false;invalidateAnimatedShadow(dog);scene.onBeforeRender(renderer,scene,camera,null);assert(!renderer.shadowMap.needsUpdate,'Smooth still has shadows disabled');
});
test('shadow scheduling preserves prior scene hook and leaves XR refreshing',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera();let called=0;scene.onBeforeRender=()=>called++;
 const renderer={shadowMap:{enabled:true,autoUpdate:true,needsUpdate:true},xr:{isPresenting:false}} as T.WebGLRenderer;
 installShadowBudget(renderer,scene);scene.onBeforeRender(renderer,scene,camera,null);assert.equal(called,1);assert(renderer.shadowMap.needsUpdate);
 renderer.shadowMap.needsUpdate=false;scene.onBeforeRender(renderer,scene,camera,null);assert(!renderer.shadowMap.needsUpdate);
 renderer.xr.isPresenting=true;scene.onBeforeRender(renderer,scene,camera,null);assert(renderer.shadowMap.needsUpdate);
});
test('matching styles share resources until the final owner releases them',()=>{
 const source=new T.MeshStandardMaterial();let built=0,disposed=0;
 const make=()=>{built++;const mat=source.clone();mat.addEventListener('dispose',()=>disposed++);return mat;};
 const a=acquireVisualMaterial(source,'teal',make),b=acquireVisualMaterial(source,'teal',make),c=acquireVisualMaterial(source,'gold',make);
 assert.equal(built,2);assert.equal(a.value,b.value);assert.notEqual(a.value,c.value);
 a.release();a.release();assert.equal(disposed,0);b.release();assert.equal(disposed,1);c.release();assert.equal(disposed,2);source.dispose();
});
