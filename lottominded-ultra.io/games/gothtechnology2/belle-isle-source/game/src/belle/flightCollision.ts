import type {ParkMap} from './terrain.ts';
export type Vec={x:number;y:number;z:number};
export type Solid={x:number;z:number;bottom:number;top:number;radius:number;kind:'tree'|'lamp'|'sign'|'rock'};
/** Static scenery broad phase: one local cell query instead of every tree per physics step. */
export class FlightSolids {
 private cells=new Map<string,Solid[]>();
 add(s:Solid){const k=Math.floor(s.x/32)+','+Math.floor(s.z/32);const a=this.cells.get(k)||[];a.push(s);this.cells.set(k,a);}
 ray(o:Vec,d:Vec,max:number,half:number){let hit=max+1;
  const end={x:o.x+d.x*max,z:o.z+d.z*max};
  for(let x=Math.floor((Math.min(o.x,end.x)-half-3)/32);x<=Math.floor((Math.max(o.x,end.x)+half+3)/32);x++)for(let z=Math.floor((Math.min(o.z,end.z)-half-3)/32);z<=Math.floor((Math.max(o.z,end.z)+half+3)/32);z++)for(const s of this.cells.get(x+','+z)||[]){
   const r=s.radius+half,ox=o.x-s.x,oz=o.z-s.z,a=d.x*d.x+d.z*d.z,b=2*(ox*d.x+oz*d.z),c=ox*ox+oz*oz-r*r;
   let lo=0,hi=max;if(a<1e-10){if(c>0)continue;}else{const disc=b*b-4*a*c;if(disc<0)continue;lo=Math.max(0,(-b-Math.sqrt(disc))/(2*a));hi=Math.min(max,(-b+Math.sqrt(disc))/(2*a));}
   if(Math.abs(d.y)<1e-8){if(o.y<s.bottom||o.y>s.top)continue;}else{const a=(s.bottom-o.y)/d.y,b=(s.top-o.y)/d.y;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
   if(lo<=hi)hit=Math.min(hit,lo);
  }return hit<=max?hit:null;
 }
}
export function bridgeDeck(map:ParkMap,x:number,z:number){const b=map.bridge,dx=b.b[0]-b.a[0],dz=b.b[1]-b.a[1],length=Math.hypot(dx,dz),s=((x-b.a[0])*dx+(z-b.a[1])*dz)/length,side=((x-b.a[0])*dz-(z-b.a[1])*dx)/length;return{s,side,length,height:6+4*Math.sin(Math.PI*Math.max(0,Math.min(1,s/length)))};}
/** Separate deck, piers, arch ribs and railings; water below the arch is not a collider. Matches bridge_geometry.py. */
export function bridgeSolid(map:ParkMap,p:Vec,radius=0){const b=bridgeDeck(map,p.x,p.z);if(b.s < -radius||b.s>b.length+radius||Math.abs(b.side)>13+radius)return false;
 const deck=b.height;if(p.y>=deck-.35&&p.y<=deck+.08)return true;
 if(Math.abs(b.side)>11.8-radius&&p.y>=deck&&p.y<=deck+1.6)return true;
 const span=b.length/19,q=((b.s%span)+span)%span,near=Math.min(q,span-q);
 if(near<.75+radius&&Math.abs(b.side)<12.2+radius&&p.y<=deck&&p.y>=-.5)return true;
 if(near<2.1+radius&&p.y<1&&p.y>=-.5)return true;
 if(p.y>deck||p.y<.3)return false;
 const rib=[-11.7,-7,-2.35,2.35,7,11.7].some(v=>Math.abs(b.side-v)<.34+radius);
 // End of the swept footprint is lower on either side of each arch crown.
 const arch=(s:number)=>1.25+(deck-2.05)*Math.sin(Math.PI*Math.max(0,Math.min(1,s/span)))-.65;
 return rib&&p.y>=Math.min(arch(q-radius),arch(q+radius));
}
export function bridgeRay(map:ParkMap,o:Vec,d:Vec,max:number,radius:number){
 // Tight broad phase keeps distant bridge checks out of tree/urban flight.
 const a=bridgeDeck(map,o.x,o.z);if(Math.abs(a.side)>13+radius+max||a.s < -max-radius||a.s>a.length+max+radius)return null;
 const steps=Math.max(1,Math.ceil(max/.18));for(let i=0;i<=steps;i++){const t=max*i/steps;if(bridgeSolid(map,{x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t},radius))return t;}return null;
}
