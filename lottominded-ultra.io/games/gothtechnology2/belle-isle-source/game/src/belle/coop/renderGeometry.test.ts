import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {batchRigidChildren} from './batchRigid.ts';import {detailGeometry,indexHash} from '../landmarkDetail.ts';
import {cullMacArthurSpans} from '../macArthurSpanCulling.ts';
import {batchStaticArchitecture} from '../staticArchitectureBatch.ts';
test('custom callbacks and transformed world-space pigment keep their original draw',()=>{
 const make=()=>new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());
 const a=make(),b=make();
 for(const mesh of [a,b]){mesh.material.userData.realisticSurface='stone';mesh.material.userData.photoSurfaceFinish='masonry';mesh.position.y=1;}
 assert.equal(new StaticPaletteBatch([a,b]).stats.batches,0);
 for(const mesh of [a,b]){mesh.position.y=0;delete mesh.material.userData.photoSurfaceFinish;mesh.material.userData.realisticBaseIsStandard=false;}
 assert.equal(new StaticPaletteBatch([a,b]).stats.batches,0);
 for(const mesh of [a,b]){delete mesh.material.userData.realisticBaseIsStandard;mesh.material.onBeforeRender=()=>{};}
 assert.equal(new StaticPaletteBatch([a,b]).stats.batches,0);
 const scene=new T.Scene(),root=new T.Group(),c=make(),d=make();root.add(c,d);scene.add(root);d.onBeforeShadow=()=>{};
 const renderer={extensions:{has:()=>true}} as unknown as T.WebGLRenderer;
 assert.equal(batchStaticArchitecture(scene,renderer,[root],()=>false),undefined);
});
test('world-space bridge tiles retain their exact material and shader uniforms',()=>{
 const root=new T.Group(),material=new T.MeshStandardMaterial(),uniform={value:.25};
 material.onBeforeCompile=s=>{s.uniforms.bridgeNight=uniform;};
 const pieces=Array.from({length:3},()=>new T.Mesh(new T.BoxGeometry(),material));
 pieces[2].position.x=5;root.add(...pieces);
 const palette=new StaticPaletteBatch(pieces,new Set(pieces)),batch=palette.root.children[0] as T.BatchedMesh;
 assert.equal(palette.stats.sourceDraws,2);assert.equal(batch.material,material);
 const shader={uniforms:{}} as any;material.onBeforeCompile(shader,{} as T.WebGLRenderer);assert.equal(shader.uniforms.bridgeNight,uniform);
 let disposed=false;material.addEventListener('dispose',()=>{disposed=true;});palette.dispose();assert.equal(disposed,false);
});
test('ordinary architecture batches preserve original shadow, picking, visibility and LOD decisions',()=>{
 const scene=new T.Scene(),root=new T.Group(),material=new T.MeshStandardMaterial();scene.add(root);
 const pieces=Array.from({length:4},(_,i)=>{const m=new T.Mesh(new T.BoxGeometry(),material);m.name='piece '+i;m.position.x=i*3;m.castShadow=true;root.add(m);return m;});
 const renderer={extensions:{has:()=>true},xr:{isPresenting:false},shadowMap:{enabled:true,autoUpdate:true}} as unknown as T.WebGLRenderer;
 let split=false;
 const palette=batchStaticArchitecture(scene,renderer,[root],()=>split)!;
 const camera=new T.PerspectiveCamera(),batch=palette.root.children[0] as T.BatchedMesh;
 const begin=()=>scene.onBeforeRender(renderer,scene,camera,null!,null!,null!);
 const end=()=>scene.onAfterRender(renderer,scene,camera,null!,null!,null!);
 pieces[0].castShadow=false;pieces[3].visible=false;begin();
 assert.equal(batch.castShadow,true);assert.ok(pieces[0].visible);assert.equal(pieces[1].visible,false);assert.equal(pieces[2].visible,false);
 let hits=new T.Raycaster(new T.Vector3(3,0,2),new T.Vector3(0,0,-1)).intersectObjects(scene.children,true);
 assert.ok(hits.length);assert.ok(hits.every(h=>h.object===pieces[1]));
 scene.onBeforeRender(renderer,scene,camera,{} as T.BufferGeometry,null!,null!);
 assert.equal(palette.root.visible,false);assert.equal(pieces[1].visible,true);
 end();assert.equal(palette.root.visible,true);assert.equal(pieces[1].visible,false);
 end();assert.deepEqual(pieces.map(p=>p.visible),[true,true,true,false]);
 renderer.shadowMap.enabled=false;pieces[1].geometry=pieces[1].geometry.clone();begin();
 assert.equal(batch.castShadow,false);assert.equal(pieces[1].visible,true);assert.equal(pieces[2].visible,false);end();
 split=true;begin();assert.equal(palette.root.visible,false);end();
 const unsupported={extensions:{has:()=>false}} as unknown as T.WebGLRenderer;
 assert.equal(batchStaticArchitecture(scene,unsupported,[root],()=>false),undefined);
});
test('bridge span selection follows the active light or view and retains authored face IDs',()=>{
 const root=new T.Scene(),source=new T.BufferGeometry(),positions:number[]=[];
 // Interleave both ends in authored order, then a long triangle whose centroid
 // falls outside the photo frustum but whose tip is visible inside it.
 for(const z of [-200,200,-120,120])positions.push(-1,-1,z,1,-1,z,0,1,z);
 positions.push(-1,-1,-150,1,-1,-150,0,1,190);
 source.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 source.setIndex(Array.from({length:15},(_,i)=>i));
 const material=new T.MeshBasicMaterial({side:T.DoubleSide});
 const bridge=new T.Mesh(source,material);bridge.name='MacArthur_Painted_steel';root.add(bridge);
 cullMacArthurSpans(root);
 const display=bridge.geometry;assert.notEqual(display,source);assert.equal(display.attributes.position,source.attributes.position);
 const renderer={xr:{isPresenting:false},getRenderTarget:()=>null} as unknown as T.WebGLRenderer;
 const camera=new T.PerspectiveCamera(25,1,.1,70);camera.position.set(0,0,220);camera.lookAt(0,0,150);camera.updateMatrixWorld();
 const group=null as unknown as T.Group;
 bridge.onBeforeRender(renderer,root,camera,display,material,group);
 const visible=Array.from(display.index!.array).slice(display.drawRange.start,display.drawRange.start+display.drawRange.count);
 assert.ok(visible.includes(3)&&visible.includes(12));assert.ok(!visible.includes(0));assert.ok(visible.length<source.index!.count);
 const ray=new T.Raycaster(new T.Vector3(0,0,-190),new T.Vector3(0,0,-1));
 assert.equal(ray.intersectObject(bridge)[0]?.faceIndex,0);assert.equal(bridge.geometry,display);
 bridge.onAfterRender(renderer,root,camera,display,material,group);
 assert.equal(display.drawRange.count,Infinity);assert.equal(display.index!.count,source.index!.count);
 const reflection={xr:{isPresenting:false},getRenderTarget:()=>({})} as unknown as T.WebGLRenderer;
 bridge.onBeforeRender(reflection,root,camera,display,material,group);assert.equal(display.drawRange.count,Infinity);
 const lightView=new T.OrthographicCamera(-10,10,10,-10,.1,85);
 lightView.position.set(0,0,-220);lightView.lookAt(0,0,-160);lightView.updateMatrixWorld();
 const depth=new T.MeshDepthMaterial();
 bridge.onBeforeShadow(renderer,root,camera,lightView,display,depth,group);
 const casters=Array.from(display.index!.array).slice(display.drawRange.start,display.drawRange.start+display.drawRange.count);
 assert.ok(casters.includes(0)&&casters.includes(12),'retain off-screen casters and triangles crossing the light frustum');
 assert.ok(!casters.includes(3));
 bridge.onAfterShadow(renderer,root,camera,lightView,display,depth,group);
 assert.equal(display.drawRange.count,Infinity);
});
test('rigid batches preserve parent motion, material boundaries and animated pieces',()=>{const root=new T.Group(),rotor=new T.Group(),mat=new T.MeshBasicMaterial(),other=new T.MeshBasicMaterial();root.add(rotor);const a=new T.Mesh(new T.BoxGeometry(),mat),b=new T.Mesh(new T.BoxGeometry(),mat),lever=new T.Mesh(new T.BoxGeometry(),mat),glass=new T.Mesh(new T.BoxGeometry(),other);a.position.x=2;b.position.x=-2;lever.name='lever';rotor.add(a,b,lever,glass);const expected=new T.Box3().expandByObject(a).expandByObject(b);const result=batchRigidChildren(root,new Set(['lever']));assert.equal(result.before,2);assert.equal(result.after,1);assert.equal(lever.parent,rotor);assert.equal(glass.parent,rotor);const batch=rotor.children.find(o=>o.name.startsWith('Rigid batch ·'))!;assert.deepEqual(new T.Box3().setFromObject(batch),expected);rotor.position.x=10;root.updateMatrixWorld(true);assert.equal(new T.Box3().setFromObject(batch).min.x,expected.min.x+10);result.dispose();});
test('skinning, hidden parts and child sockets never merge',()=>{const root=new T.Group(),mat=new T.MeshBasicMaterial();const skin=new T.SkinnedMesh(new T.BoxGeometry(),mat),hidden=new T.Mesh(new T.BoxGeometry(),mat),socket=new T.Mesh(new T.BoxGeometry(),mat);hidden.visible=false;socket.add(new T.Object3D());root.add(skin,hidden,socket);assert.equal(batchRigidChildren(root).before,0);assert.equal(root.children.length,3);});
test('landmark detail preserves attributes and rejects stale or out-of-range indices',()=>{const g=new T.BoxGeometry(),idx=new Uint32Array(g.index!.array),entry={mesh:0,primitive:0,vertices:g.getAttribute('position').count,originalCount:idx.length,hash:indexHash(idx),count:6,offset:0,length:0};const low=detailGeometry(g,entry,idx.slice(0,6))!;assert.ok(low);assert.equal(low.getAttribute('position'),g.getAttribute('position'));assert.equal(low.getAttribute('normal'),g.getAttribute('normal'));assert.equal(g.index!.count,36);assert.equal(detailGeometry(g,{...entry,hash:0},idx.slice(0,6)),null);assert.equal(detailGeometry(g,entry,new Uint32Array([999,0,1,2,3,4])),null);});

test('instanced pieces retain every instance and are never baked as one mesh',()=>{const root=new T.Group(),mat=new T.MeshBasicMaterial(),a=new T.InstancedMesh(new T.BoxGeometry(),mat,8),b=new T.Mesh(new T.BoxGeometry(),mat);root.add(a,b);assert.equal(batchRigidChildren(root).before,0);assert.equal(a.parent,root);assert.equal(a.count,8);});

import {StaticPaletteBatch} from '../staticPaletteBatch.ts';
test('static palette batches preserve linear colors, transformed bounds and visibility',()=>{const scene=new T.Scene(),a=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0xff0000})),b=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0x00ff00}));a.position.x=2;b.position.x=4;scene.add(a,b);scene.updateMatrixWorld(true);const bounds=new T.Box3().expandByObject(a).expandByObject(b),batch=new StaticPaletteBatch([a,b]);assert.equal(batch.stats.sourceDraws,2);assert.equal(batch.stats.batches,1);scene.add(batch.root);assert.deepEqual(new T.Box3().setFromObject(batch.root),bounds);const mesh=batch.root.children[0] as T.BatchedMesh,red=new T.Color(),green=new T.Color();mesh.getColorAt(0,red);mesh.getColorAt(1,green);assert.equal(red.r,1);assert.equal(green.g,1);assert.equal(mesh.perObjectFrustumCulled,true);batch.beginView();assert.equal(a.visible,false);assert.equal(mesh.visible,true);batch.endView();assert.equal(a.visible,true);b.visible=false;batch.beginView();assert.equal(mesh.getVisibleAt(0),true);assert.equal(mesh.getVisibleAt(1),false);assert.equal(a.visible,false);batch.endView();assert.equal(a.visible,true);assert.equal(b.visible,false);batch.dispose();assert.equal(a.parent,scene);});
test('palette skips custom shaders, transparent parts and different roughness',()=>{const normal=new T.MeshStandardMaterial(),shader=normal.clone(),glass=normal.clone(),rough=normal.clone();shader.onBeforeCompile=()=>{};glass.transparent=true;rough.roughness=.2;const meshes=[normal,shader,glass,rough].map(m=>new T.Mesh(new T.BoxGeometry(),m));assert.equal(new StaticPaletteBatch(meshes).stats.batches,0);});
test('palette preserves realistic model-space grain and its base pigment',()=>{const a=new T.MeshStandardMaterial({color:0xff0000}),b=new T.MeshStandardMaterial({color:0x00ff00});for(const m of [a,b]){m.userData.realisticSurface='stone';m.onBeforeCompile=s=>{s.vertexShader+='skinPosition=position;skinNormal=normal;';s.fragmentShader+='mix(diffuseColor.rgb,skinC*diffuse,.3)';};m.customProgramCacheKey=()=>'surface-test';}const batch=new StaticPaletteBatch([new T.Mesh(new T.BoxGeometry(),a),new T.Mesh(new T.BoxGeometry(),b)]);assert.equal(batch.stats.batches,1);const mesh=batch.root.children[0] as T.Mesh,shader={vertexShader:'',fragmentShader:''};(mesh.material as T.Material).onBeforeCompile(shader as any,{} as any);assert.match(shader.vertexShader,/skinPosition=position/);assert.match(shader.fragmentShader,/skinC\*diffuse,/);assert.doesNotMatch(shader.fragmentShader,/diffuse\*vColor/);assert.equal(mesh.geometry.getAttribute('sourcePosition'),undefined);});

import {batchStaticGround} from '../staticGroundBatch.ts';
import {landmarkDisplayRange} from '../landmarkRange.ts';
test('ground batching retains exact vertices, UVs, material and bounds; excludes moved or hidden meshes',()=>{const scene=new T.Scene(),material=new T.MeshStandardMaterial(),a=new T.Mesh(new T.PlaneGeometry(2,2).rotateX(-Math.PI/2).translate(3,2,5),material),b=new T.Mesh(new T.PlaneGeometry(3,2).rotateX(-Math.PI/2).translate(-4,2,1),material),moved=new T.Mesh(new T.PlaneGeometry(),material),hidden=new T.Mesh(new T.PlaneGeometry(),material);moved.position.x=6;hidden.visible=false;scene.add(a,b,moved,hidden);const bounds=new T.Box3().expandByObject(a).expandByObject(b),uvs=[...a.geometry.attributes.uv.array,...b.geometry.attributes.uv.array],vertices=[...a.geometry.attributes.position.array,...b.geometry.attributes.position.array];assert.deepEqual(batchStaticGround([a,b,moved,hidden]),{before:2,after:1});const mesh=scene.children.find(o=>o.name.startsWith('Joined ground')) as T.Mesh;assert.equal(mesh.material,material);assert.deepEqual([...mesh.geometry.attributes.position.array],vertices);assert.deepEqual([...mesh.geometry.attributes.uv.array],uvs);assert.deepEqual(new T.Box3().setFromObject(mesh),bounds);assert.equal(moved.parent,scene);assert.equal(hidden.parent,scene);assert.equal(mesh.geometry.index!.count,12);});
test('hidden landmark ancestors cannot be resurrected by a palette batch',()=>{const scene=new T.Scene(),group=new T.Group(),mat=new T.MeshStandardMaterial(),a=new T.Mesh(new T.BoxGeometry(),mat),b=new T.Mesh(new T.BoxGeometry(),mat);scene.add(group);group.add(a,b);const batch=new StaticPaletteBatch([a,b]);scene.add(batch.root);group.visible=false;batch.beginView();const mesh=batch.root.children[0] as T.BatchedMesh;assert.equal(mesh.getVisibleAt(0),false);assert.equal(mesh.getVisibleAt(1),false);batch.endView();assert.equal(a.visible,true);assert.equal(group.visible,false);batch.dispose();});
test('distant interior detail culling retains building shells and nearby furnishings',()=>{assert.equal(landmarkDisplayRange('107310050_Conservatory_orchid_ivory'),240);assert.equal(landmarkDisplayRange('107227742_Aquarium_black_glazed_tile'),180);assert.equal(landmarkDisplayRange('107310050_Botanical_label_ivory'),240);assert.equal(landmarkDisplayRange('107227742_Aquarium_exterior_copper_roof'),1800);assert.equal(landmarkDisplayRange('107310050_Conservatory_clear_panes'),1800);assert.equal(landmarkDisplayRange('MacArthur_Higgsfield_warm_limestone'),1800);});

test('multi-draw retains source transforms and geometry when a distant sibling is hidden',()=>{const scene=new T.Scene(),mat=new T.MeshStandardMaterial(),geo=new T.BoxGeometry(),a=new T.Mesh(geo,mat),b=new T.Mesh(geo,mat);a.position.set(10,2,30);b.position.set(2000,3,4000);scene.add(a,b);scene.updateMatrixWorld(true);const batch=new StaticPaletteBatch([a,b]),mesh=batch.root.children[0] as T.BatchedMesh;assert.equal(batch.stats.batches,1);assert.deepEqual(mesh.getMatrixAt(1,new T.Matrix4()),b.matrixWorld);assert.equal(mesh.geometry.attributes.position.count,geo.attributes.position.count);b.visible=false;batch.beginView();assert.equal(mesh.getVisibleAt(0),true);assert.equal(mesh.getVisibleAt(1),false);batch.endView();assert.equal(a.visible,true);assert.equal(b.visible,false);let disposed=false;geo.addEventListener('dispose',()=>disposed=true);batch.dispose();assert.equal(disposed,false);assert.equal(a.geometry,geo);});
test('palette batches keep material bindings separate when two finishes share a GPU program',()=>{
 const make=(finish:string)=>{
  const material=new T.MeshStandardMaterial();
  material.userData.realisticSurface='grass';
  material.userData.realisticProfile=finish;
  material.customProgramCacheKey=()=>'shared-program';
  return new T.Mesh(new T.BoxGeometry(),material);
 };
 const batch=new StaticPaletteBatch([make('grass'),make('grass'),make('infield-grass'),make('infield-grass')]);
 assert.equal(batch.stats.batches,2);
});
import {LandmarkDetail,subpixelLandmark} from '../landmarkDetail.ts';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';

test('landmarks use subpixel indices only during distant display and keep full picking geometry',async t=>{
 const scene=new T.Scene(),g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,0,-1,0,-1,1,0, 1,-1,0,2,-1,0,2,1,0],3));
 g.setIndex([0,1,2,3,4,5]);g.computeBoundingSphere();
 const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));scene.add(mesh);
 const reducedIndices=new Uint8Array([209,0,4,4,0,0,0,0]); // meshopt index sequence [0,1,2]
 const meta={version:1,entries:[{mesh:0,primitive:0,vertices:6,originalCount:6,hash:indexHash(g.index!.array),
   count:3,offset:0,length:reducedIndices.length,error:.04}]};
 t.mock.method(globalThis,'fetch',async (url:string)=>url.endsWith('.json')?Response.json(meta):new Response(reducedIndices));
 const asset={scene,parser:{associations:new Map([[mesh,{meshes:0,primitives:0}]])}} as unknown as GLTF;
 const detail=new LandmarkDetail(asset);await detail.prepareDistant(scene);
 const camera=new T.PerspectiveCamera(60,1.6,.1,10000);
 const renderer={xr:{isPresenting:false},getDrawingBufferSize:(v:T.Vector2)=>v.set(1440,900)} as T.WebGLRenderer;
 const draw=(z:number)=>{
  camera.position.z=z;camera.updateMatrixWorld();
  // Three passes scene, camera and render target to Scene.onBeforeRender.
  Reflect.apply(scene.onBeforeRender,scene,[renderer,scene,camera,null]);
 };
 draw(300);assert.equal(mesh.geometry.index!.count,3);
 const ray=new T.Raycaster(new T.Vector3(1.75,0,10),new T.Vector3(0,0,-1));
 assert.equal(ray.intersectObject(mesh).length,1);
 assert.equal(mesh.geometry.index!.count,3,'picking restores current display detail');
 Reflect.apply(scene.onAfterRender,scene,[renderer,scene,camera]);assert.equal(mesh.geometry,g);
 draw(40);assert.equal(mesh.geometry,g,'close-up uses authored geometry');
 camera.zoom=10;camera.updateProjectionMatrix();draw(300);assert.equal(mesh.geometry,g,'zoom resolves the mesh error');
 camera.zoom=1;camera.updateProjectionMatrix();mesh.castShadow=true;draw(300);assert.equal(mesh.geometry,g,'casters retain their original shadow');
 assert.equal(subpixelLandmark(NaN,1000,1000),false);
});
