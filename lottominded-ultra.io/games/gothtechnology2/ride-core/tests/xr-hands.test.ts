import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {XRHands} from '../src/xrHands.ts';
test('tracked gloves use actual handedness, render complete fingers, and hide on disconnection',()=>{
 const grips=[new T.Group(),new T.Group()],rays=[new T.Group(),new T.Group()],origin=new T.Group();
 const hands=new XRHands({xr:{getControllerGrip:(i:number)=>grips[i],getController:(i:number)=>rays[i]}} as unknown as T.WebGLRenderer,origin);
 hands.update(true);assert(grips.every(g=>!g.children[0].visible));
 grips[0].dispatchEvent({type:'connected',data:{handedness:'right',gamepad:{buttons:[{pressed:false}]}}} as never);
 grips[1].dispatchEvent({type:'connected',data:{handedness:'left',gamepad:{buttons:[{pressed:true}]}}} as never);hands.update(true);
 assert.equal(hands.controller('right')?.grip,grips[0]);
 for(const grip of grips){const glove=grip.children[0] as T.InstancedMesh;assert(glove.visible);assert.equal(glove.count,16);for(let i=0;i<glove.count;i++){const m=new T.Matrix4();glove.getMatrixAt(i,m);assert(m.elements.every(Number.isFinite));}}
 grips[0].dispatchEvent({type:'disconnected'} as never);hands.update(true);assert(!grips[0].children[0].visible);assert(!hands.controller('right'));
 hands.update(false);assert(!grips[1].children[0].visible);hands.dispose();assert.equal(origin.children.length,0);
});
