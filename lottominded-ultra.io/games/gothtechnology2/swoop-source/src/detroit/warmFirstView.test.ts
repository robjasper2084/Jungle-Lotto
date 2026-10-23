import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {warmFirstView} from './warmFirstView.ts';
test('first-view preparation uploads visible textures once and waits for shaders before rendering',async()=>{
 const scene=new T.Scene(),texture=new T.Texture(),hiddenTexture=new T.Texture(),geometry=new T.BoxGeometry();
 for(let i=0;i<2;i++)scene.add(new T.Mesh(geometry,new T.MeshStandardMaterial({map:texture})));
 const hidden=new T.Group();hidden.visible=false;hidden.add(new T.Mesh(geometry,new T.MeshStandardMaterial({map:hiddenTexture})));scene.add(hidden);
 const events:unknown[]=[],camera=new T.PerspectiveCamera();
 let complete!:()=>void;const compiled=new Promise<void>(resolve=>complete=resolve);
 const renderer={initTexture(t:T.Texture){events.push(t);},compileAsync(){events.push('compile');return compiled;},render(){events.push('render');}} as unknown as T.WebGLRenderer;
 const work=warmFirstView(renderer,scene,camera);
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.deepEqual(events,[texture,'compile']);
 complete();await work;assert.deepEqual(events,[texture,'compile','render']);
});
test('off-camera roster buffers are uploaded and all visibility/culling flags are restored',async()=>{
 const scene=new T.Scene(),root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial()),hidden=new T.Mesh();
 root.visible=false;hidden.visible=false;mesh.frustumCulled=true;hidden.frustumCulled=false;root.add(mesh,hidden);scene.add(root);
 const renderer={initTexture(){},async compileAsync(){},render(){assert(root.visible);assert.equal(mesh.frustumCulled,false);assert.equal(hidden.visible,false);}} as unknown as T.WebGLRenderer;
 await warmFirstView(renderer,scene,new T.PerspectiveCamera(),[root]);
 assert.equal(root.visible,false);assert.equal(mesh.frustumCulled,true);assert.equal(hidden.frustumCulled,false);assert.equal(hidden.visible,false);
});
test('failed shader preparation cannot leave hidden enemies visible',async()=>{
 const scene=new T.Scene(),root=new T.Group(),mesh=new T.Mesh();root.visible=false;root.add(mesh);scene.add(root);
 const renderer={initTexture(){},async compileAsync(){throw Error('context lost');}} as unknown as T.WebGLRenderer;
 await assert.rejects(warmFirstView(renderer,scene,new T.PerspectiveCamera(),[root]),/context lost/);
 assert.equal(root.visible,false);assert.equal(mesh.frustumCulled,true);
});
