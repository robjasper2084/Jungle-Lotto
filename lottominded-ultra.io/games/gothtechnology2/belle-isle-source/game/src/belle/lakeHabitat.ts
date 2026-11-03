import * as T from 'three';
import type {LakeHabitatPlan,LakePlant} from './lakeHabitatPlan.ts';

/** Shared low-poly habitat, tiled for culling; no animation or extra lights. */
export async function addLakeHabitat(scene:T.Scene){
 const plans:LakeHabitatPlan[]=await Promise.all(['okonoka','heron'].map(async name=>{const r=await fetch('./belle/nature/'+name+'.json');if(!r.ok)throw Error('Lake habitat '+r.status);return r.json();}));
 const plan={reeds:plans.flatMap(p=>p.reeds),pads:plans.flatMap(p=>p.pads),logs:plans.flatMap(p=>p.logs),rocks:plans.flatMap(p=>p.rocks||[])},tiles:{root:T.Group;x:number;z:number}[]=[],groups=new Map<string,T.Group>();
 const getTile=(x:number,z:number)=>{const key=Math.floor(x/96)+','+Math.floor(z/96);if(!groups.has(key)){const group=new T.Group();group.name='Lake and lagoon habitat '+key;scene.add(group);groups.set(key,group);tiles.push({root:group,x:Math.floor(x/96)*96+48,z:Math.floor(z/96)*96+48});}return groups.get(key)!;};
 const dummy=new T.Object3D(),tint=new T.Color();
 function scatter(items:LakePlant[],geometry:T.BufferGeometry,material:T.Material,name:string){
  const batches=new Map<T.Group,LakePlant[]>();for(const p of items){const group=getTile(p.x,p.z);if(!batches.has(group))batches.set(group,[]);batches.get(group)!.push(p);}
  for(const [group,plants]of batches){const mesh=new T.InstancedMesh(geometry,material,plants.length);mesh.name=name;mesh.receiveShadow=true;
   plants.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,tint.setScalar(p.tint));});mesh.computeBoundingSphere();group.add(mesh);
  }
 }
 const verts:number[]=[];for(let i=0;i<10;i++){const a=i*2.399,r=.12+(i%3)*.06,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.58+(i%4)*.14;verts.push(x-.025,0,z,x+.025,0,z,x*1.6,h*.6,z*1.6,x+.025,0,z,x*2.1,h,z*2.1,x*1.6,h*.6,z*1.6);}
 const sedge=new T.BufferGeometry();sedge.setAttribute('position',new T.Float32BufferAttribute(verts,3));sedge.computeVertexNormals();
 scatter(plan.reeds,sedge,new T.MeshStandardMaterial({color:0x747950,roughness:.98,side:T.DoubleSide}),'Irregular wet-meadow sedges');
 // Small notched floating leaves sit just above water, never across channels.
 const leaf=new T.Shape();leaf.moveTo(0,0);for(let i=0;i<=10;i++){const a=.24+(Math.PI*2-.48)*i/10;leaf.lineTo(Math.cos(a),Math.sin(a)*.8);}leaf.closePath();
 const leafGeo=new T.ShapeGeometry(leaf);leafGeo.rotateX(-Math.PI/2);
 scatter(plan.pads,leafGeo,new T.MeshStandardMaterial({color:0x65774b,roughness:.74,side:T.DoubleSide}),'Floating shoreline vegetation');
 const rock=new T.IcosahedronGeometry(1,1);rock.scale(1.3,.72,1);const rv=rock.attributes.position;for(let i=0;i<rv.count;i++){const v=1+.08*Math.sin(rv.getX(i)*7+rv.getZ(i)*13);rv.setXYZ(i,rv.getX(i)*v,rv.getY(i)*v,rv.getZ(i)*v);}rock.computeVertexNormals();
 scatter(plan.rocks,rock,new T.MeshStandardMaterial({color:0xb5afa0,roughness:.96}),'Blue Heron inlet riprap');
 const bark=new T.MeshStandardMaterial({color:0x655b49,roughness:1}),cut=new T.MeshStandardMaterial({color:0x9b8b65,roughness:1});
 // Reuse one cylinder; branch roots make the fallen timber read as habitat logs.
 const cylinder=new T.CylinderGeometry(1,1,1,7),axis=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3();
 const logBatches=new Map<T.Group,T.Matrix4[]>();
 function logPart(start:T.Vector3,end:T.Vector3,r:number){const center=start.clone().add(end).multiplyScalar(.5),group=getTile(center.x,center.z);if(!logBatches.has(group))logBatches.set(group,[]);dummy.position.copy(center);dummy.quaternion.setFromUnitVectors(axis,end.clone().sub(start).normalize());dummy.scale.set(r,start.distanceTo(end),r);dummy.updateMatrix();logBatches.get(group)!.push(dummy.matrix.clone());}
 for(const log of plan.logs){a.fromArray(log.a);b.fromArray(log.b);logPart(a,b,log.radius);const center=a.clone().lerp(b,.25),dir=b.clone().sub(a).normalize();for(const side of [-1,1])logPart(center,center.clone().add(new T.Vector3(dir.z*side*.55,.3,-dir.x*side*.55)),log.radius*.38);}
 for(const [group,matrices]of logBatches){const mesh=new T.InstancedMesh(cylinder,[bark,cut,cut],matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.name='Fallen basking timber';mesh.computeBoundingSphere();group.add(mesh);}
 return{stats:{rocks:plan.rocks.length,reeds:plan.reeds.length,pads:plan.pads.length,logs:plan.logs.length,tiles:tiles.length},update(x:number,z:number){for(const tile of tiles)tile.root.visible=Math.hypot(tile.x-x,tile.z-z)<400;}};
}
