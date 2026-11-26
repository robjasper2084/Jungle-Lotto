import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {StaticPaletteBatch} from './staticPaletteBatch.ts';
import {batchStaticArchitecture} from './staticArchitectureBatch.ts';

function fixture(){
 const scene=new T.Scene(),lod=new T.LOD(),sources:T.Mesh[]=[];
 const material=new T.MeshStandardMaterial();
 for(let level=0;level<3;level++){
  const root=new T.Group();root.name='level-'+level;root.visible=level===0;
  for(let piece=0;piece<2;piece++){
   const mesh=new T.Mesh(new T.BoxGeometry(1+level*.1,1,1),material);
   mesh.name=`level-${level}-piece-${piece}`;mesh.position.x=piece*2;root.add(mesh);sources.push(mesh);
  }
  lod.addLevel(root,[0,180,480][level],.12);
 }
 scene.add(lod);scene.updateMatrixWorld(true);
 return {scene,lod,sources};
}
function cameraAt(z:number){const camera=new T.PerspectiveCamera(60,1,.1,2000);camera.position.z=z;return camera;}
// Three r185 invokes scene.onBeforeRender before projectObject updates LODs.
// Apply that native public LOD operation after the batch takes over visibility.
function nativeLods(root:T.Object3D,camera:T.Camera){
 if(!root.visible)return;
 if(root instanceof T.LOD&&root.autoUpdate&&root.layers.test(camera.layers))root.update(camera);
 for(const child of root.children)nativeLods(child,camera);
}
function drawn(scene:T.Scene,palette:StaticPaletteBatch,sources:T.Mesh[]){
 const found:string[]=[];
 scene.traverseVisible(object=>{if(sources.includes(object as T.Mesh))found.push(object.name);});
 const batch=palette.root.children[0] as T.BatchedMesh;
 if(palette.root.visible&&batch.visible)for(let i=0;i<sources.length;i++)if(batch.getVisibleAt(i))found.push(sources[i].name);
 return found.sort();
}
const levelPieces=(level:number)=>[`level-${level}-piece-0`,`level-${level}-piece-1`];
const renderer={extensions:{has:()=>true},xr:{isPresenting:false},shadowMap:{enabled:false,autoUpdate:false,needsUpdate:false}} as unknown as T.WebGLRenderer;
function before(scene:T.Scene,camera:T.Camera){
 camera.updateMatrixWorld();Reflect.apply(scene.onBeforeRender,scene,[renderer,scene,camera,null]);
 nativeLods(scene,camera);
}
function after(scene:T.Scene,camera:T.Camera){Reflect.apply(scene.onAfterRender,scene,[renderer,scene,camera]);}

test('ordinary architecture renders exactly the selected authored level on the first near/far transition',()=>{
 const {scene,lod,sources}=fixture(),palette=batchStaticArchitecture(scene,renderer,[lod],()=>false)!;
 try{
  assert.equal(palette.stats.sourceDraws,6);
  for(const [distance,level] of [[10,0],[700,2],[450,2],[410,1],[170,1],[150,0]]){
   const camera=cameraAt(distance);before(scene,camera);
   assert.deepEqual(drawn(scene,palette,sources),levelPieces(level));
   after(scene,camera);assert.ok(sources.every(source=>source.visible));
  }
 }finally{palette.dispose();}
});

test('alternating split cameras select their own level before hiding source meshes',()=>{
 const {scene,lod,sources}=fixture(),palette=new StaticPaletteBatch(sources);scene.add(palette.root);
 try{
  const near=cameraAt(10),far=cameraAt(700);
  for(const [camera,level] of [[near,0],[far,2],[near,0],[far,2]] as const){
   // Co-op begins its palette view before renderer.render updates camera matrices.
   palette.beginView(undefined,camera);camera.updateMatrixWorld();nativeLods(lod,camera);
   assert.deepEqual(drawn(scene,palette,sources),levelPieces(level));palette.endView();
  }
 }finally{palette.dispose();}
});

test('a nested camera view restores the parent camera LOD when its batch resumes',()=>{
 const {scene,lod,sources}=fixture(),palette=batchStaticArchitecture(scene,renderer,[lod],()=>false)!;
 try{
  const near=cameraAt(10),far=cameraAt(700);
  before(scene,near);assert.deepEqual(drawn(scene,palette,sources),levelPieces(0));
  before(scene,far);assert.deepEqual(drawn(scene,palette,sources),levelPieces(2));
  after(scene,far);assert.deepEqual(drawn(scene,palette,sources),levelPieces(0));
  after(scene,near);assert.ok(sources.every(source=>source.visible));
 }finally{palette.dispose();}
});

test('manual LOD selection and hidden ancestors keep their native visibility',()=>{
 const {scene,lod,sources}=fixture(),palette=new StaticPaletteBatch(sources);scene.add(palette.root);
 try{
  const camera=cameraAt(700);lod.autoUpdate=false;
  palette.beginView(undefined,camera);nativeLods(lod,camera);
  assert.deepEqual(drawn(scene,palette,sources),levelPieces(0));palette.endView();
  lod.visible=false;palette.beginView(undefined,camera);nativeLods(lod,camera);
  assert.deepEqual(drawn(scene,palette,sources),[]);palette.endView();
 }finally{palette.dispose();}
});

test('native-controlled mesh level roots remain single native draws',()=>{
 const scene=new T.Scene(),lod=new T.LOD(),material=new T.MeshStandardMaterial();
 const sources:T.Mesh[]=[0,1,2].map(level=>{const mesh=new T.Mesh(new T.BoxGeometry(),material);mesh.name='level-'+level;lod.addLevel(mesh,[0,180,480][level]);return mesh;});
 scene.add(lod);scene.updateMatrixWorld(true);
 const palette=new StaticPaletteBatch(sources);scene.add(palette.root);
 try{
  assert.equal(palette.stats.sourceDraws,0);
  const camera=cameraAt(700);camera.updateMatrixWorld();palette.beginView(false,camera);nativeLods(lod,camera);
  const visible:string[]=[];scene.traverseVisible(object=>{if(sources.includes(object as T.Mesh))visible.push(object.name);});
  assert.deepEqual(visible,['level-2']);palette.endView();
 }finally{palette.dispose();}
});

test('detaching a staged LOD for rollback cannot leave its batched facade visible',()=>{
 const {scene,lod,sources}=fixture(),palette=new StaticPaletteBatch(sources);scene.add(palette.root);
 try{
  const camera=cameraAt(10);palette.beginView(false,camera);
  assert.deepEqual(drawn(scene,palette,sources),levelPieces(0));palette.endView();
  const otherRoot=new T.Group();scene.add(otherRoot);otherRoot.add(lod);
  palette.beginView(false,camera);assert.deepEqual(drawn(scene,palette,sources),levelPieces(0));palette.endView();
  lod.removeFromParent();palette.beginView(false,camera);nativeLods(scene,camera);
  assert.deepEqual(drawn(scene,palette,sources),[]);palette.endView();
  scene.add(lod);palette.beginView(false,camera);
  assert.deepEqual(drawn(scene,palette,sources),levelPieces(0));palette.endView();
 }finally{palette.dispose();}
});
