import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {PointLightBudget} from '../src/pointLightBudget.ts';
const rendered=(scene:T.Scene,camera:T.Camera)=>{const lights:T.PointLight[]=[];scene.traverseVisible(o=>{if((o as T.PointLight).isPointLight&&o.layers.test(camera.layers))lights.push(o as T.PointLight);});return lights;};
test('entering and leaving streamed rooms preserves a fixed shader light count',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),budget=new PointLightBudget(scene),room=new T.Group();scene.add(room);
 assert.equal(rendered(scene,camera).length,4);assert.ok(budget.pool.every(l=>l.intensity===0));
 for(let i=0;i<12;i++){const light=new T.PointLight('#ffe0bb',20,18);light.position.set(i,2,0);room.add(light);}
 budget.update(camera);assert.equal(rendered(scene,camera).length,4);assert.ok(budget.pool.every(l=>l.intensity===20));
 room.visible=false;budget.update(camera);assert.equal(rendered(scene,camera).length,4);assert.ok(budget.pool.every(l=>l.intensity===0));
 room.visible=true;camera.position.x=100;budget.update(camera);assert.equal(rendered(scene,camera).length,4);assert.ok(budget.pool.every(l=>l.intensity===0));budget.dispose();
});
test('nearest emitters retain world placement, color and light properties for each camera',()=>{
 const scene=new T.Scene(),room=new T.Group(),camera=new T.PerspectiveCamera();room.position.set(8,0,4);room.rotation.y=Math.PI/2;scene.add(room);
 const near=new T.PointLight('#fc7040',35,14,1.8),far=new T.PointLight('#00ffff',90,20);near.position.set(0,3,2);far.position.x=20;room.add(near,far);const budget=new PointLightBudget(scene,1);budget.update(camera);
 assert.deepEqual(budget.pool[0].position.toArray(),near.getWorldPosition(new T.Vector3()).toArray());assert.equal(budget.pool[0].color.getHex(),near.color.getHex());assert.equal(budget.pool[0].decay,1.8);
 camera.position.copy(far.getWorldPosition(new T.Vector3()));budget.update(camera);assert.equal(budget.pool[0].color.getHex(),far.color.getHex());assert.equal(budget.pool[0].intensity,90);budget.dispose();
});
test('removing rooms and disposing restores layers and prior render hooks',()=>{
 const scene=new T.Scene(),room=new T.Group(),light=new T.PointLight('#fff',20,10),shadow=new T.PointLight('#fff',5);shadow.castShadow=true;light.layers.set(2);room.add(light,shadow);scene.add(room);const prior=scene.onBeforeRender,budget=new PointLightBudget(scene);
 assert.equal(light.layers.mask,0);assert.equal(shadow.layers.mask,1);scene.remove(room);assert.equal(light.layers.mask,4);scene.add(room);assert.equal(light.layers.mask,0);budget.dispose();assert.equal(light.layers.mask,4);assert.equal(scene.onBeforeRender,prior);assert.equal(scene.children.length,1);
});
