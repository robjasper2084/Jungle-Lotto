import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {lagoonBridges,bridgeRailSegments} from './lagoonBridge.ts';
import type {ParkMap} from './terrain.ts';
/** Retains the mapped 2.6 m crossing and existing deck/collision height. */
export function addLagoonBridge(scene:T.Scene,map:ParkMap){const group=new T.Group();group.name='Blue Heron Lagoon inlet footbridge';const metal:T.BufferGeometry[]=[],concrete:T.BufferGeometry[]=[],deck:T.BufferGeometry[]=[];
 const box=(list:T.BufferGeometry[],x:number,y:number,z:number,w:number,h:number,l:number,yaw:number)=>{const g=new T.BoxGeometry(w,h,l);g.rotateY(yaw);g.translate(x,y,z);list.push(g);};
 for(const b of lagoonBridges(map)){const dx=b.b[0]-b.a[0],dz=b.b[1]-b.a[1],len=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),nx=dz/len,nz=-dx/len,cx=(b.a[0]+b.b[0])/2,cz=(b.a[1]+b.b[1])/2;
  // The road mesh remains the tread. Only the structural slab sits beneath it.
  box(deck,cx,b.floor-.15,cz,b.width,.28,len,yaw);
  for(const r of bridgeRailSegments(b)){const x=(r.a[0]+r.b[0])/2,z=(r.a[1]+r.b[1])/2;for(const h of [.22,.58,b.railHeight])box(metal,x,b.floor+h,z,.055,.055,len,yaw);
   const count=Math.ceil(len/2.2);for(let i=0;i<=count;i++){const t=i/count;box(metal,r.a[0]+dx*t,b.floor+b.railHeight/2,r.a[1]+dz*t,.065,b.railHeight,.065,yaw);}
  }
  for(const p of [b.a,b.b]){box(concrete,p[0],1.48,p[1],b.width+.35,1.06,.55,yaw);for(const side of [-1,1])box(concrete,p[0]+nx*side*(b.width/2+.18),1.48,p[1]+nz*side*(b.width/2+.18),.35,1.06,2.6,yaw);}
 }
 for(const [geos,color,name]of [[metal,0x545a53,'Weathered metal guardrails'],[deck,0x9b9b8c,'Narrow concrete footbridge deck'],[concrete,0xaaa99a,'Stone-colored bridge abutments']] as [T.BufferGeometry[],number,string][]){if(!geos.length)continue;const geometry=mergeGeometries(geos)!;geos.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.83,metalness:geos===metal?.25:0}));mesh.name=name;mesh.receiveShadow=true;group.add(mesh);}
 scene.add(group);return group;
}
