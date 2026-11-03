import * as T from 'three';
import type {GardenPlan,GardenPlant} from './gardenPlan.ts';

/** Small opaque meshes, shared by every plant; no alpha overdraw, animation,
 * individual scene objects or new image downloads. Tile culling bounds cost. */
export async function addGardens(scene:T.Scene){
 const response=await fetch('./belle/nature/gardens.json');if(!response.ok)throw new Error('Garden planting '+response.status);
 const plan:GardenPlan=await response.json(),leaves:number[]=[],petals:number[]=[];
 const tri=(p:number[],a:number[],b:number[],c:number[])=>p.push(...a,...b,...c);
 // Low basal foliage joins neighbouring clumps into a planted border rather
 // than leaving long isolated stems standing directly in the lawn.
 for(let i=0;i<10;i++){
  const a=i*2.399,r=.32+(i%3)*.055,dx=Math.cos(a)*r,dz=Math.sin(a)*r,h=.14+(i%4)*.055;
  const base=[0,.02,0],tip=[dx,h*.65,dz],left=[dx*.5-dz*.22,h,dz*.5+dx*.22],right=[dx*.5+dz*.22,h,dz*.5-dx*.22];
  tri(leaves,base,left,tip);tri(leaves,base,tip,right);
 }
 for(let stalk=0;stalk<3;stalk++){
  const angle=stalk*2.399,x=Math.cos(angle)*.18,z=Math.sin(angle)*.18,h=.70+stalk*.15;
  tri(leaves,[x-.012,0,z],[x+.012,0,z],[x+.025,h,z+.025]);
  for(let side=0;side<2;side++){
   const a=angle+side*Math.PI,dx=Math.cos(a)*.24,dz=Math.sin(a)*.24,y=.22+side*.18;
   const base=[x,y,z],tip=[x+dx,y+.17,z+dz],mid=[x+dx*.48,y+.15,z+dz*.48];
   tri(leaves,base,[mid[0]-dz*.30,mid[1],mid[2]+dx*.30],tip);
   tri(leaves,base,tip,[mid[0]+dz*.30,mid[1],mid[2]-dx*.30]);
  }
  for(let p=0;p<6;p++){
   const a=p*Math.PI/3,co=Math.cos(a),si=Math.sin(a),cx=x+.025,cz=z+.025;
   const base=[cx,h-.025,cz],tip=[cx+co*.14,h+.028,cz+si*.14];
   tri(petals,base,[cx+co*.08-si*.052,h+.065,cz+si*.08+co*.052],tip);
   tri(petals,base,tip,[cx+co*.08+si*.052,h+.065,cz+si*.08-co*.052]);
  }
 }
 function geometry(vertices:number[]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;}
 const leafG=geometry(leaves),petalG=geometry(petals),leafMat=new T.MeshStandardMaterial({color:0xffffff,roughness:1,side:T.DoubleSide}),petalMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.91,side:T.DoubleSide});
 const groups=new Map<string,GardenPlant[]>(),tiles:{mesh:T.InstancedMesh;x:number;z:number}[]=[],dummy=new T.Object3D();
 for(const p of plan.plants){const key=Math.floor(p.x/48)+','+Math.floor(p.z/48);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(p);}
 const palette=[0xc8b2d4,0xe0cc95,0xb56b7e,0xdde0d2,0x8d83b3];
 for(const [key,plants] of groups){
  const [tx,tz]=key.split(',').map(Number);
  for(const [g,mat,flower] of [[leafG,leafMat,false],[petalG,petalMat,true]] as const){
   const mesh=new T.InstancedMesh(g,mat,plants.length);mesh.name=(flower?'Seasonal flowers ':'Garden foliage ')+key;mesh.receiveShadow=true;
   plants.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.y=p.yaw;dummy.scale.set(p.spread,p.height,p.spread);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);const color=flower?new T.Color(palette[p.palette]):new T.Color().setHSL(.22+(i%4)*.012,.30,.22+(i%5)*.017);mesh.setColorAt(i,color);});
   mesh.computeBoundingSphere();scene.add(mesh);tiles.push({mesh,x:tx*48+24,z:tz*48+24});
  }
 }
 let radius=220;
 return{stats:{clumps:plan.plants.length,flowers:plan.plants.length*3,triangles:plan.plants.length*(leaves.length+petals.length)/9,batches:tiles.length},setQuality(q:string){radius=q==='smooth'?145:q==='high'?280:220;},update(x:number,z:number){for(const tile of tiles)tile.mesh.visible=Math.hypot(tile.x-x,tile.z-z)<radius;}};
}
