import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {greenhouseWorld,greenhouseRay,greenhouseBlocked} from './conservatory.ts';
import {sweepVisibleMeshTriangles} from './visibleTriangleSweep.ts';

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
const connectorBefore=JSON.parse(await readFile(new URL('../../scripts/staged-landmark-authoring/source/conservatory-connector-before.json',import.meta.url),'utf8'));
const connectorComponent='ShowHouse/EndGlazing__greenGlass';
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
  let farExteriorTrianglePayload:any=null;
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
    if(node.name===connectorComponent){
      const indexBytes=accessor(p.indices).data,readIndex=(i:number)=>indices.componentType===5121?indexBytes.readUInt8(i):indices.componentType===5123?indexBytes.readUInt16LE(i*2):indexBytes.readUInt32LE(i*4);
      assert.ok([5121,5123,5125].includes(indices.componentType));
      const attributeNames=Object.keys(p.attributes).sort(),corners:Buffer[]=[];let triangles=0;
      for(let i=0;i<indices.count;i+=3){
        const ids=[readIndex(i),readIndex(i+1),readIndex(i+2)];
        if(!ids.every(index=>positions.data.readFloatLE(index*12)>20))continue;
        triangles++;
        for(const index of ids)for(const name of attributeNames){
          const a=accessor(p.attributes[name]),width=widths[a.descriptor.componentType]*columns[a.descriptor.type];
          corners.push(a.data.subarray(index*width,(index+1)*width));
        }
      }
      farExteriorTrianglePayload={triangles,attributeNames,sha256:createHash('sha256').update(Buffer.concat(corners)).digest('hex')};
    }
  }
  return {groups,materials:doc.materials,images:doc.images||[],textures:doc.textures||[],farExteriorTrianglePayload};
}

test('the fit preserves unaffected primitives, materials and original outer heights',async()=>{
  assert.equal(baseline.sourcePackageSha256,'74d2eb591f1b5a9b4b67b679923b3cdf71b287cd26e00d8712e892fd9a597705');
  for(const {file,bytes} of await models){
    const before=baseline.models[file],after=primitiveReceipts(bytes);
    assert.deepEqual(Object.keys(after.groups).sort(),Object.keys(before.groups).sort(),file+' component selections');
    assert.deepEqual(after.materials,before.materials);assert.deepEqual(after.images,before.images);assert.deepEqual(after.textures,before.textures);
    for(const [name,actual] of Object.entries(after.groups)){
      const old=before.groups[name];
      if(name===connectorComponent){
        assert.deepEqual(actual.material,old.material,file+' original connector optics');
        assert.deepEqual(actual.yRange,old.yRange,file+' original connector outer height');
        assert.deepEqual(actual.yValues,[...old.yValues,3.5].sort((a,b)=>a-b),file+' only the retained drum opening height is added');
        assert.equal(actual.triangles,old.triangles+16);assert.equal(actual.vertices,old.vertices+8);
      }
      else if(!changed.has(name))assert.deepEqual(actual,old,file+' unchanged '+name);
      else{
        assert.deepEqual(actual.material,old.material,file+' material '+name);
        assert.deepEqual(actual.yValues,old.yValues,file+' vertical coordinates '+name);
        assert.ok(actual.triangles>=old.triangles&&actual.vertices>=old.vertices,file+' no detail reduction '+name);
      }
    }
  }
});

test('the connector correction changes one primitive per LOD and retains the far end triangles and other assets',async()=>{
  assert.equal(connectorBefore.sourceHead,'9b43b72acb72cfe69dd483614e5c2d95bb57a7ed');
  assert.equal(connectorBefore.mapBlobSha,'e5c741279fe981b928c9fd4d58a72d72ae7cb017');
  assert.deepEqual(files.map(file=>connectorBefore.models[file].sha256),[
    '312fb0530916d72e75aef4f33be47b66e1c1afb1a904070629132d3881d5565e',
    'c1c28010258437a50647820aad6204cf947c78248771375e9dd57ad3273b0f2d',
    '5ea972e8d027e0fb46eadd65faac0ec49a4377e5b8710b2f5f07d7e4a5bb6716']);
  for(const {file,bytes,root} of await models){
    const before=connectorBefore.models[file],after=primitiveReceipts(bytes);
    assert.deepEqual(Object.keys(after.groups).sort(),Object.keys(before.groups).sort());
    for(const name of Object.keys(before.groups))if(name!==connectorComponent)assert.deepEqual(after.groups[name],before.groups[name],file+' exact9b43 '+name);
    assert.deepEqual(after.materials,before.materials);assert.deepEqual(after.images,before.images);assert.deepEqual(after.textures,before.textures);
    assert.deepEqual(after.farExteriorTrianglePayload,before.farExteriorTrianglePayload,file+' exterior end all12 triangle corner bytes/order');
    const material=mesh(root,connectorComponent).material;
    assert.ok(material instanceof T.MeshStandardMaterial);
    assert.deepEqual(material.color.toArray(),[140/255,181/255,151/255]);
    assert.equal(material.opacity,167/255);assert.equal(material.transparent,true);assert.equal(material.depthWrite,false);
    assert.equal(material.side,T.DoubleSide);assert.equal(material.roughness,.17);assert.equal(material.metalness,0);
  }
  assert.equal(Object.keys(connectorBefore.otherAssets).length,9);
  for(const [file,expected] of Object.entries(connectorBefore.otherAssets) as [string,{bytes:number;sha256:string}][]){
    const raw=await readFile(new URL('../../public/belle/staged-architecture/'+file,import.meta.url));
    assert.equal(raw.length,expected.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),expected.sha256,file+' unchanged asset');
  }
});

test('the actual connector stays open for the unchanged player-radius sphere in both directions',async()=>{
  const mapBytes=await readFile(new URL('../../public/belle/map.json',import.meta.url));
  assert.equal(createHash('sha1').update(Buffer.from('blob '+mapBytes.length+'\0')).update(mapBytes).digest('hex'),connectorBefore.mapBlobSha);
  for(const {file,root} of await models){
    const meshes:T.Mesh[]=[];root.traverse(object=>{if(object instanceof T.Mesh)meshes.push(object);});
    for(const v of [-3.9,-2,0,2,4.7])for(const height of [.62,1.1,1.58,2.82])for(const sign of [-1,1]){
      const u=sign===1?10:13,origin=new T.Vector3(u,height,-v),direction=new T.Vector3(sign,0,0);
      const visible=sweepVisibleMeshTriangles(meshes,origin,direction,.27,3);
      assert.equal(visible.unsupportedMeshes.length,0,file+' complete actual-triangle coverage');
      assert.ok(visible.checkedTriangles>0,file+' real triangle sweep');
      assert.equal(visible.hit,null,file+' open connector at '+JSON.stringify({u,v,height,sign}));
      assert.equal(hits(root,origin,direction,3).length,0,file+' open centerline');
      const point={...greenhouseWorld(map,u,v),y:2+height},worldDirection={x:sign*Math.cos(map.yaw),y:0,z:-sign*Math.sin(map.yaw)};
      assert.equal(greenhouseBlocked(map,point.x,point.z,.27),false,file+' original collider start');
      assert.equal(greenhouseRay(map,point,worldDirection,3,.27),null,file+' original collider passage');
    }
  }
});

test('the side glazing follows both exact connector lines and the retained transom is a real surface',async()=>{
  for(const {file,root} of await models){
    const pane=mesh(root,connectorComponent);
    for(const u of [11.07251,11.1,11.12749])for(const index of [17,32])for(const height of [.62,1.1,1.58,2.82]){
      const v=axisAt(map.walls[index],u),direction=new T.Vector3(0,0,-Math.sign(v));
      const surfaces=hits(pane,new T.Vector3(u,height,0),direction,8.8);
      assert.ok(surfaces.length,file+' retained side glazing');
      assert.ok(Math.abs(surfaces[0].distance-Math.abs(v))<1e-5,file+' exact retained connector boundary');
    }
    for(const v of [-3.9,-2,0,2,4.7]){
      const upper=hits(pane,new T.Vector3(10,3.75,-v),new T.Vector3(1,0,0),3);
      assert.equal(upper.length,2,file+' transom front/back retained without coincident seams');
      assert.ok(Math.abs(upper[0].distance-1.0725)<1e-5);
      const frame=sweepVisibleMeshTriangles([pane],new T.Vector3(10,3.75,-v),new T.Vector3(1,0,0),.27,3);
      assert.ok(frame.hit,file+' positive sphere contact control');
      assert.ok(Math.abs(frame.hit.distance-.8025)<1e-5);
      const far=hits(pane,new T.Vector3(20,1.58,-v),new T.Vector3(1,0,0),4);
      assert.equal(far.length,2,file+' exterior pane remains solid');
      assert.ok(Math.abs(far[0].distance-2.6725)<1e-5);
    }
  }
});
