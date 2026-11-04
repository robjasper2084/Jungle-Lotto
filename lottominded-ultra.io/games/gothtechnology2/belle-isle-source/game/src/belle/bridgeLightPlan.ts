import type {ParkMap} from './terrain.ts';
import layout from './ambassadorLayout.json' with {type:'json'};

export type Lamp={p:number[];ground:number[]};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** One light per post, rather than three overlapping lights on each globe cluster. */
export function uniquePosts(lamps:Lamp[]){const seen=new Set<string>();return lamps.filter(l=>{const key=l.ground.map(n=>n.toFixed(2)).join(',');if(seen.has(key))return false;seen.add(key);return true;});}

/** Permanent illumination conforms to the actual sloping deck, including its sidewalks. */
export function bridgePoolData(map:ParkMap,mac:Lamp[]){
 const positions:number[]=[],uv:number[]=[];
 const add=(lamps:Lamp[],a:number[],dx:number,dz:number,min:number,max:number,width:number,height:(s:number)=>number)=>{
  const length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,radius=22,steps=12;
  for(const lamp of lamps){
   const along=(lamp.ground[0]-a[0])*ux+(lamp.ground[2]-a[1])*uz;
   const side=(lamp.ground[0]-a[0])*uz-(lamp.ground[2]-a[1])*ux;
   const s0=Math.max(min,along-radius),s1=Math.min(max,along+radius),x0=Math.max(-width,side-radius),x1=Math.min(width,side+radius);
   const vertex=(i:number,j:number)=>{const s=s0+(s1-s0)*i/steps,x=x0+(x1-x0)*j/steps;positions.push(a[0]+ux*s+uz*x,height(s),a[1]+uz*s-ux*x);uv.push(.5+(s-along)/(radius*2),.5+(x-side)/(radius*2));};
   for(let i=0;i<steps;i++)for(let j=0;j<steps;j++)for(const [u,v]of[[i,j],[i+1,j],[i+1,j+1],[i,j],[i+1,j+1],[i,j+1]])vertex(u,v);
  }
 };
 const b=map.bridge;
 add(uniquePosts(mac),b.a,b.b[0]-b.a[0],b.b[1]-b.a[1],0,b.length,13,s=>6+4*Math.sin(Math.PI*s/b.length)+.085);
 const dx=layout.b[0]-layout.a[0],dz=layout.b[2]-layout.a[2],len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
 const stations=layout.roadway.filter((_,i)=>i%2===0).map(l=>({s:(l.ground[0]-layout.a[0])*ux+(l.ground[2]-layout.a[2])*uz,y:l.ground[1]})).sort((a,b)=>a.s-b.s);
 const deck=(s:number)=>{const i=Math.max(1,stations.findIndex(p=>p.s>=s)),a=stations[i-1],b=stations[i];return a.y+(b.y-a.y)*clamp((s-a.s)/(b.s-a.s),0,1)+.045;};
 add(layout.roadway,[layout.a[0],layout.a[2]],dx,dz,stations[0].s,stations.at(-1)!.s,8.8,deck);
 return {positions,uv};
}

/** A light changes fixture only after fading out. Rank changes cannot teleport a lit source. */
export class BridgeLightSlots {
 readonly slots=Array.from({length:4},()=>({index:-1,level:0}));
 update(lamps:Lamp[],x:number,z:number,dt:number){
  const nearest=lamps.map((l,index)=>({index,d:Math.hypot(l.p[0]-x,l.p[2]-z)})).filter(p=>p.d<65).sort((a,b)=>a.d-b.d).slice(0,this.slots.length);
  const desired=new Map(nearest.map(p=>[p.index,1-clamp((p.d-30)/35,0,1)]));
  const step=Math.min(Math.max(dt,0),.1)*2;
  for(const slot of this.slots){const target=desired.get(slot.index)??0;slot.level+=clamp(target-slot.level,-step,step);}
  for(const slot of this.slots)if(slot.level<.001&&!desired.has(slot.index)){
   slot.level=0;const candidate=nearest.find(p=>!this.slots.some(s=>s.index===p.index));slot.index=candidate?.index??-1;
  }
  return this.slots;
 }
}
