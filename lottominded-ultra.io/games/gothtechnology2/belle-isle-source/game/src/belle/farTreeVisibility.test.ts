import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {WebGLAttributes} from 'three/src/renderers/webgl/WebGLAttributes.js';
import {FarTreeVisibility,TreeInstanceVisibility} from './farTreeVisibility.ts';
import {referenceTree} from './referenceTrees.ts';

function view(x=0,y=4,z=0,targetZ=-100){
 const camera=new T.PerspectiveCamera(60,1.5,.1,1000);
 camera.position.set(x,y,z);camera.lookAt(x,y,targetZ);camera.updateMatrixWorld(true);return camera;
}
function pair(count:number,geometry:T.BufferGeometry[]=[new T.BoxGeometry(1,6,1).translate(0,3,0),new T.BoxGeometry(6,6,6).translate(0,8,0)]){
 const meshes=geometry.map(g=>{
  const mesh=new T.InstancedMesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}),count);
  mesh.castShadow=false;mesh.frustumCulled=false;
  g.setAttribute('lodWeight',new T.InstancedBufferAttribute(new Float32Array(count),1));
  g.setAttribute('canopyDensity',new T.InstancedBufferAttribute(new Float32Array(count),1));
  g.setAttribute('sourceId',new T.InstancedBufferAttribute(new Uint32Array(count),1));
  mesh.updateMatrixWorld(true);return mesh;
 });
 // Construction precedes the original selector's first lazy instanceColor.
 const visibility=new FarTreeVisibility(meshes);
 return {meshes,visibility};
}
function fill(meshes:T.InstancedMesh[],matrices:T.Matrix4[],season=0){
 for(const mesh of meshes){
  mesh.count=matrices.length;
  matrices.forEach((matrix,i)=>{
   mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new T.Color((i+1)/10,.25+season/100,.7));
   mesh.geometry.getAttribute('sourceId').setX(i,i);
   mesh.geometry.getAttribute('lodWeight').setX(i,(i+1)/(matrices.length+1));
   mesh.geometry.getAttribute('canopyDensity').setX(i,season===1?0:.48+i*.03);
  });
 }
}
const translation=(x:number,z:number)=>new T.Matrix4().makeTranslation(x,0,z);

test('near trees keep every shadow caster and pickable instance when the beauty pass is compacted',()=>{
 const {meshes}=pair(3);
 meshes.forEach(mesh=>mesh.castShadow=true);
 const near=new TreeInstanceVisibility(meshes,undefined,'near'),camera=view();
 fill(meshes,[translation(0,40),translation(0,-40),translation(300,-40)]);
 near.capture();
 const ray=new T.Raycaster(new T.Vector3(0,3,0),new T.Vector3(0,0,1));
 const originalHits=ray.intersectObject(meshes[0]).map(h=>[h.instanceId,h.distance]);
 assert(originalHits.length);
 assert.equal(near.render(camera),1);
 assert.deepEqual(ids(meshes[0]),[1]);
 assert.deepEqual(ray.intersectObject(meshes[0]).map(h=>[h.instanceId,h.distance]),originalHits);
 assert.deepEqual(ids(meshes[0]),[1]);
 assert.equal(near.render(camera,true),3);
 assert.deepEqual(ids(meshes[0]),[0,1,2]);
 assert.equal(near.render(camera),1);
 const away=view(0,4,0,100);
 assert.equal(near.render(away),1);
 assert.deepEqual(ids(meshes[0]),[0]);
});
const ids=(mesh:T.InstancedMesh)=>Array.from({length:mesh.count},(_,i)=>mesh.geometry.getAttribute('sourceId').getX(i));
const streams=(mesh:T.InstancedMesh)=>[mesh.instanceMatrix,mesh.instanceColor!,...['lodWeight','canopyDensity','sourceId'].map(name=>mesh.geometry.getAttribute(name) as T.BufferAttribute)];

test('far trees compact matrix, colour, seasonal density and fade from immutable sources across views',()=>{
 const {meshes,visibility}=pair(4),matrices=[translation(0,-40),translation(0,40),translation(300,-40),translation(0,-70)];
 fill(meshes,matrices);const original=meshes.map(mesh=>streams(mesh).map(attribute=>attribute.array.slice()));
 const geometry=meshes.map(mesh=>({object:mesh.geometry,positions:mesh.geometry.attributes.position.array.slice()}));
 visibility.capture();assert.equal(visibility.sourceCount,4);
 assert.equal(visibility.render(view()),2);assert.deepEqual(ids(meshes[0]),[0,3]);
 for(const [part,mesh] of meshes.entries())for(const [s,attribute]of streams(mesh).entries())for(const [out,id]of ids(mesh).entries()){
  assert.deepEqual(Array.from(attribute.array.slice(out*attribute.itemSize,(out+1)*attribute.itemSize)),Array.from(original[part][s].slice(id*attribute.itemSize,(id+1)*attribute.itemSize)));
 }
 const versions=meshes.flatMap(mesh=>streams(mesh).map(attribute=>attribute.version));
 visibility.render(view());assert.deepEqual(meshes.flatMap(mesh=>streams(mesh).map(attribute=>attribute.version)),versions,'unchanged membership performs no upload');
 assert.equal(visibility.render(view(0,4,0,100)),1);assert.deepEqual(ids(meshes[0]),[1],'rotation without translation selects the new side');
 assert.equal(visibility.render(view()),2);assert.deepEqual(ids(meshes[0]),[0,3],'secondary views cannot consume the saved source set');
 for(const [i,mesh]of meshes.entries()){
  assert.equal(mesh.geometry,geometry[i].object);assert.deepEqual(mesh.geometry.attributes.position.array,geometry[i].positions);assert.equal(mesh.castShadow,false);
 }
 // Original selection may replace membership and season while both cameras
 // remain at the same position. The new source attributes must take effect.
 fill(meshes,[translation(0,-20),translation(0,-50)],1);visibility.capture();visibility.render(view());
 assert.equal(visibility.sourceCount,2);assert.deepEqual(ids(meshes[0]),[0,1]);assert.deepEqual(Array.from(meshes[0].geometry.getAttribute('canopyDensity').array).slice(0,2),[0,0]);
});

test('layer-only camera overlay leaves world instances and upload versions untouched',()=>{
 const {meshes,visibility}=pair(2);fill(meshes,[translation(0,-40),translation(0,40)]);visibility.capture();const camera=view();visibility.render(camera);
 const versions=meshes.flatMap(mesh=>streams(mesh).map(attribute=>attribute.version));const overlay=view();overlay.layers.set(30);overlay.far=10;overlay.updateProjectionMatrix();
 visibility.render(overlay);visibility.render(camera);
 assert.deepEqual(ids(meshes[0]),[0]);assert.deepEqual(meshes.flatMap(mesh=>streams(mesh).map(attribute=>attribute.version)),versions);
});

test('XR, invalid cameras and invalid instance/world transforms retain source geometry',()=>{
 const {meshes,visibility}=pair(3);fill(meshes,[translation(0,-40),translation(0,40),translation(300,-40)]);visibility.capture();const camera=view();visibility.render(camera);
 visibility.render(new T.ArrayCamera([camera,view(0,4,0,100)]));assert.deepEqual(ids(meshes[0]),[0,1,2]);
 visibility.render(camera);const invalid=view();invalid.projectionMatrix.elements[0]=NaN;visibility.render(invalid);assert.equal(meshes[0].count,3);
 visibility.render(camera);invalid.projectionMatrix.makeScale(0,0,0);visibility.render(invalid);assert.equal(meshes[0].count,3);
 const rounded=view();rounded.matrixWorldInverse.elements[15]=1+Number.EPSILON;
 visibility.render(rounded);assert.deepEqual(ids(meshes[0]),[0],'ordinary inverse-matrix roundoff keeps useful culling');
 const malformed=translation(300,-40);malformed.elements[12]=NaN;fill(meshes,[translation(0,-40),translation(0,40),malformed]);visibility.capture();visibility.render(camera);assert.deepEqual(ids(meshes[0]),[0,2]);
 meshes[0].matrixWorld.elements[12]=NaN;visibility.render(camera);assert.equal(meshes[0].count,3);
});

test('source-wide local raycast bounds survive opposite views, full restoration and source replacement',()=>{
 const {meshes,visibility}=pair(2);fill(meshes,[translation(0,-40),translation(0,40)]);visibility.capture();
 visibility.render(view(0,4,0,100));visibility.render(view());
 const ray=new T.Raycaster(new T.Vector3(0,3,0),new T.Vector3(0,0,-1));
 assert(ray.intersectObject(meshes[0],false).length>0,'the front tree remains a photo occluder after a rear view');
 assert(meshes[0].boundingSphere!.containsPoint(new T.Vector3(0,3,40)),'broad phase also retains the full source region');
 fill(meshes,[translation(0,-400),translation(0,400)]);visibility.capture();visibility.render(view());
 assert(ray.intersectObject(meshes[0],false).length>0,'a changed source range refreshes the photo broad phase');
 assert(meshes[0].boundingSphere!.containsPoint(new T.Vector3(0,3,400)));
});

test('first GPU upload followed by an all-visible source rewrite uploads the complete new prefix',()=>{
 type Buffer={data:Float32Array};let bound:Buffer|undefined;
 const gl={FLOAT:0x1406,ARRAY_BUFFER:0x8892,createBuffer:()=>({data:new Float32Array(0)}),bindBuffer:(_target:number,buffer:Buffer)=>{bound=buffer;},
  bufferData:(_target:number,array:Float32Array)=>{bound!.data=array.slice();},
  bufferSubData:(_target:number,offset:number,array:Float32Array,start=0,count=array.length)=>{bound!.data.set(array.subarray(start,start+count),offset/array.BYTES_PER_ELEMENT);}};
 const gpu=new WebGLAttributes(gl as unknown as WebGL2RenderingContext);
 const {meshes,visibility}=pair(2,[new T.BoxGeometry(.1,.1,.1)]),mesh=meshes[0];
 fill(meshes,[translation(0,-5),translation(0,5)]);visibility.capture();visibility.render(view(0,0));gpu.update(mesh.instanceMatrix,gl.ARRAY_BUFFER);
 assert.deepEqual(mesh.instanceMatrix.updateRanges,[{start:0,count:16}],'Three retains the first upload range');
 fill(meshes,[translation(0,-7),translation(0,-10)]);visibility.capture();assert.equal(visibility.render(view(0,0)),2);gpu.update(mesh.instanceMatrix,gl.ARRAY_BUFFER);
 const data=(gpu.get(mesh.instanceMatrix)!.buffer as unknown as Buffer).data;
 assert.equal(data[14],-7);assert.equal(data[30],-10,'the newly visible tail was uploaded, not left behind the camera');
});

test('float32 cancellation and a crown intersecting the view remain conservatively visible',()=>{
 const {meshes,visibility}=pair(1,[new T.BoxGeometry(.2,.2,.2)]),mesh=meshes[0];
 fill(meshes,[translation(-100000000,-2)]);mesh.matrixWorld.makeTranslation(100000003,0,0);visibility.capture();
 // Shader float32 rounding cancels these translations to zero even though the
 // CPU product places the centre outside the camera. The error budget includes
 // the intermediate magnitudes, so this potentially visible tree is retained.
 assert.equal(visibility.render(view(0,0)),1);
 const partial=pair(1,[new T.BoxGeometry(1,1,1),new T.BoxGeometry(100,3,3).translate(-50,0,0)]);
 fill(partial.meshes,[translation(70,-40)]);partial.visibility.capture();assert.equal(partial.visibility.render(view(0,0)),1,'offscreen trunk cannot remove an intersecting crown');
});

test('actual far-tree vertices visible after float32 transforms survive culling under camera and parent changes',()=>{
 const tree=referenceTree('maple',true,16),{meshes,visibility}=pair(6,[tree.trunk,tree.leaves]);
 const matrices=Array.from({length:6},(_,i)=>new T.Matrix4().compose(new T.Vector3((i%3-1)*27,0,i<3?-45:35),new T.Quaternion().setFromEuler(new T.Euler(.03,i*.47,.02)),new T.Vector3(.8+i*.09,1.2+i*.04,1.1)));
 fill(meshes,matrices);const scene=new T.Scene();meshes.forEach(mesh=>scene.add(mesh));scene.updateMatrixWorld(true);visibility.capture();
 const point=new T.Vector4(),instancePoint=new T.Vector4(),clip=new T.Vector4();
 const gpuMultiply=(out:T.Vector4,m:T.Matrix4,p:T.Vector4)=>{const e=m.elements,f=Math.fround;return out.set(f(f(f(f(e[0])*p.x)+f(f(e[4])*p.y))+f(f(f(e[8])*p.z)+f(f(e[12])*p.w))),f(f(f(f(e[1])*p.x)+f(f(e[5])*p.y))+f(f(f(e[9])*p.z)+f(f(e[13])*p.w))),f(f(f(f(e[2])*p.x)+f(f(e[6])*p.y))+f(f(f(e[10])*p.z)+f(f(e[14])*p.w))),f(f(f(f(e[3])*p.x)+f(f(e[7])*p.y))+f(f(f(e[11])*p.z)+f(f(e[15])*p.w))));};
 const sourceMatrices=meshes.map(mesh=>Array.from({length:6},(_,i)=>new T.Matrix4().fromArray(mesh.instanceMatrix.array,i*16)));
 let checked=0;
 for(const shear of [0,.3]){
  scene.matrixAutoUpdate=false;scene.matrix.set(1,shear,0,3170,0,1,.1,0,0,0,1,245,0,0,0,1);scene.updateMatrixWorld(true);
  for(let heading=0;heading<360;heading+=45){
   const camera=view(3170,9,245),angle=heading*Math.PI/180;camera.lookAt(3170+Math.sin(angle)*100,9,245+Math.cos(angle)*100);camera.fov=heading%90?100:60;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);visibility.render(camera);
   for(const [part,mesh]of meshes.entries()){
    const retained=new Set(ids(mesh)),positions=mesh.geometry.getAttribute('position'),modelView=new T.Matrix4().multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);
    for(let id=0;id<6;id++){
     if(retained.has(id))continue;
     for(let vertex=0;vertex<positions.count;vertex++){
      point.set(positions.getX(vertex),positions.getY(vertex),positions.getZ(vertex),1);gpuMultiply(instancePoint,sourceMatrices[part][id],point);gpuMultiply(point,modelView,instancePoint);gpuMultiply(clip,camera.projectionMatrix,point);checked++;
      assert(!(clip.w>0&&Math.abs(clip.x)<=clip.w&&Math.abs(clip.y)<=clip.w&&Math.abs(clip.z)<=clip.w),`visible source ${id} vertex ${vertex} was rejected at heading ${heading}, shear ${shear}`);
     }
    }
   }
  }
 }
 assert(checked>100000,'the parity check exercised actual rejected tree geometry');
});
