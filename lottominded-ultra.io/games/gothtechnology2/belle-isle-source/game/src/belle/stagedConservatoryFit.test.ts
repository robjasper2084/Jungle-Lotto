import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// These tests read the shipped meshes and the game's original collision layout.
// They do not change either model placement or collision geometry to make a fit pass.
const files=['Conservatory_Architectural_Study.glb','Conservatory_Architectural_Study_LOD1.glb','Conservatory_Architectural_Study_LOD2.glb'];
const models=Promise.all(files.map(async file=>{
  const bytes=await readFile(new URL('../../public/belle/staged-architecture/'+file,import.meta.url));
  const loaded=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');
  loaded.scene.updateMatrixWorld(true);
  return {file,bytes,root:loaded.scene};
}));
const map=JSON.parse(await readFile(new URL('../../public/belle/map.json',import.meta.url),'utf8')).conservatory;
const baseline=JSON.parse(await readFile(new URL('../../scripts/staged-landmark-authoring/source/conservatory-original-components.json',import.meta.url),'utf8'));
const changed=new Set(['Vestibule/WestFacadePiers__steel','Vestibule/GlassSideLights__glass','Vestibule/SideGlass__glass','Vestibule/TransparentRoof__glass']);
type Point=[number,number];
type Wall={a:Point;b:Point};
const mesh=(root:T.Object3D,name:string)=>{
  const found=root.getObjectByName(T.PropertyBinding.sanitizeNodeName(name));
  assert.ok(found instanceof T.Mesh,'Actual GLTFLoader component '+name);
  return found;
};
const hits=(object:T.Object3D,origin:T.Vector3,direction:T.Vector3,far=100)=>new T.Raycaster(origin,direction,0,far).intersectObject(object,true);
const axisAt=(wall:Wall,u:number)=>wall.a[1]+(u-wall.a[0])*(wall.b[1]-wall.a[1])/(wall.b[0]-wall.a[0]);

test('actual near-LOD glazing follows both asymmetric supplied vestibule wall axes',async()=>{
  const {root}= (await models)[0],glass=mesh(root,'Vestibule/SideGlass__glass');
  assert.notEqual(Math.abs(axisAt(map.walls[56],-12)),Math.abs(axisAt(map.walls[65],-12)));
  for(const index of [56,65]){
    const wall:Wall=map.walls[index],slope=(wall.b[1]-wall.a[1])/(wall.b[0]-wall.a[0]);
    for(const u of [-15.4,-14.5,-13.5,-12,-11.1])for(const height of [.62,1.1,1.58]){
      const v=axisAt(wall,u),sign=Math.sign(v);
      const surfaces=hits(glass,new T.Vector3(u,height,0),new T.Vector3(0,0,-sign));
      assert.ok(surfaces.length,'Visible wall at local u='+u+' v='+v);
      // Original 0.052m pane thickness, measured along its actual wall normal.
      const expected=Math.abs(v)-.026*Math.sqrt(1+slope*slope);
      assert.ok(Math.abs(surfaces[0].distance-expected)<1e-4,
        `Wall ${index}, u=${u}: visible surface ${surfaces[0].distance}, retained boundary surface ${expected}`);
      assert.ok(surfaces[0].face);
      assert.ok(Math.abs(surfaces[0].face.normal.dot(new T.Vector3(slope,0,1).normalize()))>1-1e-6,
        'Actual side-pane face normal follows the supplied wall slope');
    }
  }
});

test('every LOD keeps front and corner piers on the original supplied wall segments',async()=>{
  for(const {file,root} of await models){
    const piers=mesh(root,'Vestibule/WestFacadePiers__steel');
    for(const index of [57,58,59,60,61,62,63,64]){
      const {a,b}:Wall=map.walls[index],du=b[0]-a[0],dv=b[1]-a[1],length=Math.hypot(du,dv);
      let nu=-dv/length,nv=du/length;
      const u=(a[0]+b[0])/2,v=(a[1]+b[1])/2;
      if(nu*(-13.5-u)+nv*(.3-v)>0){nu=-nu;nv=-nv;}
      for(const height of [.62,1.1,1.58]){
        const origin=new T.Vector3(u-nu*.5,height,-(v-nv*.5));
        const surfaces=hits(piers,origin,new T.Vector3(nu,0,-nv),1);
        assert.ok(surfaces.length,file+' visible corner strip '+index);
        assert.ok(Math.abs(surfaces[0].distance-(.5-.17/2))<1e-4,file+' retained wall alignment '+index);
        assert.ok(surfaces[0].face);
        assert.ok(Math.abs(surfaces[0].face.normal.dot(new T.Vector3(nu,0,-nv)))>1-1e-6,file+' corner face normal '+index);
      }
    }
  }
});

test('all LODs preserve the real standing doorway and fitted roof height',async()=>{
  assert.deepEqual(map.center,[1330.8,1174.7]);assert.equal(map.yaw,.313);
  for(const {file,root} of await models){
    for(const v of [-1.3,-.8,0,.8,1.3])for(const height of [.62,1.1,1.58]){
      assert.equal(hits(root,new T.Vector3(-18.5,height,-v),new T.Vector3(1,0,0),3).length,0,
        file+' standing doorway at v='+v+' height='+height);
    }
    const roof=mesh(root,'Vestibule/TransparentRoof__glass');
    for(const u of [-16.5,-15.5,-14,-12])for(const v of [-4,0,4]){
      const surfaces=hits(roof,new T.Vector3(u,7,-v),new T.Vector3(0,-1,0),1);
      assert.ok(surfaces.length,file+' coordinated roof covers fitted vestibule');
      assert.ok(Math.abs(surfaces[0].point.y-6.3375)<1e-5,file+' original roof height');
    }
  }
});

// Compare named primitive payloads independently of container JSON ordering or
// accessor numbering. The source receipt came from the verified original ZIP.
function primitiveReceipts(bytes:Buffer){
  const jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8')),binary=28+jsonLength;
  const widths:Record<number,number>={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
  const columns:Record<string,number>={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  function accessor(index:number){
    const a=doc.accessors[index],view=doc.bufferViews[a.bufferView],width=widths[a.componentType]*columns[a.type];
    assert.equal(a.sparse,undefined);
    const offset=binary+(view.byteOffset||0)+(a.byteOffset||0),stride=view.byteStride||width;
    const data=Buffer.concat(Array.from({length:a.count},(_,i)=>bytes.subarray(offset+i*stride,offset+i*stride+width)));
    return {descriptor:{componentType:a.componentType,count:a.count,type:a.type,sha256:createHash('sha256').update(data).digest('hex')},data};
  }
  const groups:Record<string,any>={};
  for(const node of doc.nodes){
    if(node.mesh===undefined)continue;
    for(const key of ['matrix','translation','rotation','scale'])assert.equal(node[key],undefined,'No hidden placement changes');
    const primitives=doc.meshes[node.mesh].primitives;assert.equal(primitives.length,1);
    const p=primitives[0],positions=accessor(p.attributes.POSITION),yValues=new Set<number>();
    assert.equal(positions.descriptor.componentType,5126);assert.equal(positions.descriptor.type,'VEC3');
    for(let i=0;i<positions.descriptor.count;i++)yValues.add(positions.data.readFloatLE(i*12+4));
    const ys=[...yValues].sort((a,b)=>a-b),indices=accessor(p.indices).descriptor;
    groups[node.name]={attributes:Object.fromEntries(Object.entries(p.attributes).map(([key,index])=>[key,accessor(index as number).descriptor])),indices,
      material:doc.materials[p.material],yRange:[ys[0],ys.at(-1)],yValues:ys,triangles:indices.count/3,vertices:positions.descriptor.count,mode:p.mode??4};
  }
  return {groups,materials:doc.materials,images:doc.images||[],textures:doc.textures||[]};
}

test('the fit preserves every unaffected primitive, all materials and every vertical coordinate',async()=>{
  assert.equal(baseline.sourcePackageSha256,'74d2eb591f1b5a9b4b67b679923b3cdf71b287cd26e00d8712e892fd9a597705');
  for(const {file,bytes} of await models){
    const before=baseline.models[file],after=primitiveReceipts(bytes);
    assert.deepEqual(Object.keys(after.groups).sort(),Object.keys(before.groups).sort(),file+' component selections');
    assert.deepEqual(after.materials,before.materials);assert.deepEqual(after.images,before.images);assert.deepEqual(after.textures,before.textures);
    for(const [name,actual] of Object.entries(after.groups)){
      const old=before.groups[name];
      if(!changed.has(name))assert.deepEqual(actual,old,file+' unchanged '+name);
      else{
        assert.deepEqual(actual.material,old.material,file+' material '+name);
        assert.deepEqual(actual.yValues,old.yValues,file+' vertical coordinates '+name);
        assert.ok(actual.triangles>=old.triangles&&actual.vertices>=old.vertices,file+' no detail reduction '+name);
      }
    }
  }
});
