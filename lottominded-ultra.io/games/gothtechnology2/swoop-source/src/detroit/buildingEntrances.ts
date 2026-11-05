import * as T from 'three';

type Building={id:string;points:number[][]};
type Road={points:number[][];kind:string;bridge?:boolean;width:number};
type Segment={a:number[];b:number[];half:number};
export type BuildingEntrance={x:number;z:number;y:number;nx:number;nz:number;yaw:number;width:number;height:number};
const cell=128,key=(x:number,z:number)=>Math.floor(x/cell)+','+Math.floor(z/cell);
function inside(points:number[][],x:number,z:number){let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function insert<T>(map:Map<string,T[]>,item:T,points:number[][],margin=0){
 const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
 for(let x=Math.floor((Math.min(...xs)-margin)/cell);x<=Math.floor((Math.max(...xs)+margin)/cell);x++)for(let z=Math.floor((Math.min(...zs)-margin)/cell);z<=Math.floor((Math.max(...zs)+margin)/cell);z++){
  const k=x+','+z,list=map.get(k)??[];list.push(item);map.set(k,list);
 }
}
/** Build once during city construction, never scan all roads per frame/door.
 * Only street-level, outward-facing entrances; party walls stay unadorned. */
export class BuildingEntranceIndex {
 private streets=new Map<string,Segment[]>();private buildings=new Map<string,Building[]>();
 constructor(roads:Road[],buildings:Building[]){
  for(const r of roads){if(r.bridge||!['primary','secondary','tertiary','residential','unclassified','living_street','service'].includes(r.kind))continue;
   for(let i=1;i<r.points.length;i++){const s={a:r.points[i-1],b:r.points[i],half:r.width/2};insert(this.streets,s,[s.a,s.b],96);}
  }
  for(const b of buildings)insert(this.buildings,b,b.points);
 }
 entrance(b:Building,top:number,ground:(x:number,z:number)=>number):BuildingEntrance|undefined{
  const points=b.points,area=points.reduce((sum,a,i)=>{const c=points[(i+1)%points.length];return sum+a[0]*c[1]-c[0]*a[1];},0);
  if(Math.abs(area)<.01)return;
  let best:{entry:BuildingEntrance;score:number}|undefined;
  for(let i=0;i<points.length;i++){
   const a=points[i],c=points[(i+1)%points.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);if(length<3.2)continue;
   const nx=dz/length*Math.sign(area),nz=-dx/length*Math.sign(area);
   for(const t of length>16?[.5,.3,.7]:[.5]){
    const x=a[0]+dx*t,z=a[1]+dz*t;
    // Check the full threshold width, not just its middle, against attached neighbours.
    if([-.95,0,.95].some(u=>[.25,1.5].some(v=>{const px=x+dx/length*u+nx*v,pz=z+dz/length*u+nz*v;return (this.buildings.get(key(px,pz))??[]).some(other=>other.id!==b.id&&inside(other.points,px,pz));})))continue;
    const grades=[-1.15,0,1.15].map(u=>ground(x+dx/length*u+nx*.3,z+dz/length*u+nz*.3));
    if(grades.some(y=>!Number.isFinite(y))||Math.max(...grades)-Math.min(...grades)>.35)continue;
    const y=Math.max(...grades)+.04,height=Math.min(2.95,top-y-.2);if(height<2.35)continue;
    let distance=Infinity;
    for(const s of this.streets.get(key(x,z))??[]){
     const rx=s.b[0]-s.a[0],rz=s.b[1]-s.a[1],l2=rx*rx+rz*rz;if(l2<.01)continue;
     const f=T.MathUtils.clamp(((x-s.a[0])*rx+(z-s.a[1])*rz)/l2,0,1),qx=s.a[0]+rx*f-x,qz=s.a[1]+rz*f-z,d=Math.hypot(qx,qz);
     if(d<.1||(qx*nx+qz*nz)/d<.5)continue;
     distance=Math.min(distance,Math.max(0,d-s.half));
    }
    // Prefer an actual street frontage. A clear longest wall is the fallback
    // for deep-set buildings with no mapped road within the 96 m index radius.
    const score=(Number.isFinite(distance)?distance:200)-Math.min(length,40)*.05+Math.abs(t-.5);
    if(!best||score<best.score)best={score,entry:{x,z,y,nx,nz,yaw:Math.atan2(nx,nz),width:2.4,height}};
   }
  }
  return best?.entry;
 }
}

const box=new T.BoxGeometry(1,1,1);
const door=new T.PlaneGeometry(1,1);
// Reuse the existing street-door artwork, without its awning or pavement.
// This is a single ground-floor door crop, not a vertically repeated facade.
const doorUV=door.getAttribute('uv');for(let i=0;i<doorUV.count;i++)doorUV.setXY(i,(213+doorUV.getX(i)*83)/1344,1-(491-doorUV.getY(i)*240)/576);
export function createBuildingEntrance(entry:BuildingEntrance,materials:{stone:T.Material;door:T.Material;metal:T.Material},id:string){
 const root=new T.Group();root.name='Street entrance '+id;root.position.set(entry.x,entry.y,entry.z);root.rotation.y=entry.yaw;
 root.userData={osmId:id,kind:'closed-building-entrance',ground:entry.y};
 const w=entry.width,h=entry.height;
 function part(x:number,y:number,z:number,width:number,height:number,depth:number,material:T.Material){const mesh=new T.Mesh(box,material);mesh.position.set(x,y,z);mesh.scale.set(width,height,depth);mesh.receiveShadow=true;root.add(mesh);}
 // Solid backing conceals the old lowest window bay; raised jambs give depth.
 part(0,h/2,.028,w,h,.05,materials.metal);
 for(const sign of [-1,1]){
  part(sign*(w/2-.1),h/2,.13,.2,h,.24,materials.stone);
  const leaf=new T.Mesh(door,materials.door);leaf.position.set(sign*.51,(h-.22)/2,.065);leaf.scale.set(.99,h-.22,1);leaf.receiveShadow=true;root.add(leaf);
  part(sign*.12,h*.43,.13,.035,.38,.05,materials.stone);
 }
 part(0,h-.11,.13,w,.22,.24,materials.stone);
 part(0,.035,.16,w,.07,.32,materials.stone);
 part(0,(h-.22)/2,.08,.045,h-.22,.035,materials.metal);
 return root;
}
