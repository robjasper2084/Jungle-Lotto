import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {batchWheelDisplay} from './wheelDisplay.ts';

test('wheel display keeps original pick targets, animated parts and source-space grain',()=>{
 const scene=new T.Scene(),vehicle=new T.Group(),frame=new T.Group(),pivot=new T.Group();
 frame.name='EUC_ROOT';pivot.name='Body_Suspension';scene.add(vehicle);vehicle.add(frame);frame.add(pivot);
 const mat=new T.MeshStandardMaterial({side:T.DoubleSide});
 mat.userData.realisticSurface='rubber';
 const originals=[0,1,2].map((x)=>{
  const part=new T.Mesh(new T.BoxGeometry(),mat);part.name='part'+x;part.position.x=x*2;part.castShadow=true;pivot.add(part);return part;
 });
 const clip=new T.AnimationClip('animated',1,[new T.NumberKeyframeTrack('part2.position[x]',[0,1],[4,5])]);
 scene.updateMatrixWorld(true);
 const ray=new T.Raycaster(new T.Vector3(2,0,3),new T.Vector3(0,0,-1));
 const hits=()=>ray.intersectObject(vehicle).map(h=>[h.object.name,h.faceIndex,h.distance]);
 const before=hits();assert(before.length);
 batchWheelDisplay(vehicle,vehicle,[clip]);scene.updateMatrixWorld(true);
 const batch=pivot.children.find(m=>m.userData.presentationOnly) as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 assert(batch);assert.deepEqual(hits(),before);assert.equal(originals[2].material,mat);
 assert.equal(batch.material.defines?.BELLE_ORIGINAL_SURFACE_COORDS,1);
 assert.equal(batch.geometry.getAttribute('originalSurfacePosition').getX(24),originals[1].geometry.getAttribute('position').getX(0));
 assert.equal(batch.geometry.getAttribute('position').getX(24),2+originals[1].geometry.getAttribute('position').getX(0));
 originals[1].visible=false;
 batch.onBeforeRender({} as T.WebGLRenderer,scene,new T.PerspectiveCamera(),batch.geometry,batch.material,null as unknown as T.Group);
 assert.equal(batch.geometry.drawRange.count,originals[0].geometry.index!.count);
 scene.remove(vehicle);assert.equal(batch.parent,null);assert.equal(originals[0].material,mat);assert.equal(originals[1].material,mat);
});
