import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {ActorVisibility} from './actorVisibility.ts';
test('presentation preserves nearby shadows and refreshes immediately after camera turns',()=>{
 const camera=new T.PerspectiveCamera(68,1,.1,500),visibility=new ActorVisibility();camera.position.set(0,2,0);camera.lookAt(0,2,-100);visibility.update(camera);
 assert(visibility.visible({x:0,y:0,z:-70},camera.position));assert(!visibility.visible({x:0,y:0,z:70},camera.position));assert(visibility.visible({x:0,y:0,z:20},camera.position));
 camera.lookAt(0,2,100);visibility.update(camera);assert(visibility.visible({x:0,y:0,z:70},camera.position));
});
