import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {inside,segment,type ParkMap,ParkTerrain,type Point} from './terrain.ts';

export const riverBankHeight=(offset:number)=>2-2.1*Math.min(1,Math.max(0,offset/4));

/** Shoreline surfaces share the controller's mapped bank and ramp heights. */
export function addShoreDetails(scene:T.Scene,data:ParkMap,terrain:ParkTerrain,grass:T.Material,concrete:T.Material){
 const bridge=data.bridge,ux=(bridge.b[0]-bridge.a[0])/bridge.length,uz=(bridge.b[1]-bridge.a[1])/bridge.length;
 const world=(s:number,w:number)=>[bridge.a[0]+ux*s+uz*w,bridge.a[1]+uz*s-ux*w] as Point;
 for(const [start,end]of[[-180,0],[bridge.length,bridge.length+110]]){
  const vertices:number[]=[],uv:number[]=[],indices:number[]=[];const rows=40,cols=32;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const [x,z]=world(start+(end-start)*j/rows,-38+76*i/cols);vertices.push(x,terrain.height(x,z)+.006,z);uv.push(x/8,z/8);
   if(j&&i){const k=j*(cols+1)+i;indices.push(k,k-cols-2,k-1,k,k-cols-1,k-cols-2);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const mesh=new T.Mesh(g,grass);mesh.name='Graded bridge approach';mesh.receiveShadow=true;scene.add(mesh);
 }
 const walls:T.BufferGeometry[]=[];const stones:{x:number;z:number;y:number;size:number;angle:number}[]=[];let seed=174;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 const beaches=data.areas.filter(a=>a.kind==='beach');
 const sandy=(x:number,z:number)=>beaches.some(a=>inside(x,z,a.points)||a.points.slice(1).some((p,i)=>segment(x,z,a.points[i],p).d<9));
 for(const [points,closed]of[[data.shoreline,false],[data.island,true]] as [Point[],boolean][]){
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.1)continue;
   const nx=(b[1]-a[1])/length,nz=-(b[0]-a[0])/length,n=Math.ceil(length/7);
   for(let j=0;j<n;j++){
    const t=(j+.5)/n,x=T.MathUtils.lerp(a[0],b[0],t),z=T.MathUtils.lerp(a[1],b[1],t),bp=terrain.bridge(x,z);
    if(Math.abs(bp.side)<15&&bp.t>-.03&&bp.t<1.03)continue;
    if(!closed){const g=new T.BoxGeometry(.48,2.2,length/n+.06);g.rotateY(Math.atan2(b[0]-a[0],b[1]-a[1]));g.translate(x,.9,z);walls.push(g);}
    const outward=inside(x+nx,z+nz,closed?data.island:data.mainland)?-1:1;
    if(sandy(x,z))continue;
    // Irregular groups with gaps; beach access stays sandy. The former y=0
    // placement buried the island rocks beneath its 2 m high sloped bank.
    const count=random()<.18?0:2+Math.floor(random()*4);
    for(let k=0;k<count;k++){
     const offset=.65+random()*3.15,along=(random()-.5)*4.5,size=.28+random()*.62;
     const rx=x+nx*offset*outward+(b[0]-a[0])/length*along,rz=z+nz*offset*outward+(b[1]-a[1])/length*along;
     stones.push({x:rx,z:rz,y:(closed?riverBankHeight(offset):-.22)-size*.12,size,angle:random()*6.28});
    }
   }
  }
 }
 if(walls.length){const g=mergeGeometries(walls)!;walls.forEach(g=>g.dispose());const m=new T.Mesh(g,concrete);m.name='Mapped Detroit seawall';m.receiveShadow=true;scene.add(m);}
 const rock=new T.IcosahedronGeometry(1,1),material=new T.MeshStandardMaterial({color:0xb7b7a8,roughness:.97});
 const vertices=rock.attributes.position;for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),r=.91+.09*Math.sin(x*8.1+y*4.7+z*6.3);vertices.setXYZ(i,x*r,y*r,z*r);}rock.computeVertexNormals();
 const groups=new Map<string,typeof stones>(),tiles:{mesh:T.InstancedMesh;x:number;z:number}[]=[],dummy=new T.Object3D();
 for(const r of stones){const key=Math.floor(r.x/128)+','+Math.floor(r.z/128);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(r);}
 for(const [key,group]of groups){
  const rocks=new T.InstancedMesh(rock,material,group.length);rocks.name='Shoreline riprap '+key;rocks.receiveShadow=true;
  group.forEach((r,i)=>{dummy.position.set(r.x,r.y,r.z);dummy.rotation.set(0,r.angle,0);dummy.scale.set(r.size*(1.2+random()*.45),r.size*.65,r.size);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);rocks.setColorAt(i,new T.Color().setHSL(.09+random()*.04,.04+random()*.08,(r.y<.3?.28:.39)+random()*.15));});rocks.computeBoundingSphere();scene.add(rocks);
  const [x,z]=key.split(',').map(Number);tiles.push({mesh:rocks,x:x*128+64,z:z*128+64});
 }
 return{rocks:stones.length,tiles:tiles.length,update(x:number,z:number){for(const tile of tiles)tile.mesh.visible=Math.hypot(tile.x-x,tile.z-z)<500;}};
}
