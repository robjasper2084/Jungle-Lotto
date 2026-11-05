import {inside,ParkTerrain,type ParkMap,type Point} from './terrain.ts';
export type FishingSpot={id:string;name:string;stand:Point;cast:Point;level:number};
/** Shoreline candidates must be dry, unobstructed and face open water all the way to the float. */
export function fishingSpots(map:ParkMap){const terrain=new ParkTerrain(map),result:FishingSpot[]=[];
 for(const [id,name] of [['51476983','Lake Muskoday'],['420959','Lake Okonoka'],['4894381950','Sunset Point']] as const){const lm=map.landmarks.find(l=>l.id===id);if(!lm)continue;const river=id==='4894381950';const outlines=river?[map.island]:map.water.filter(w=>inside(lm.x,lm.z,w.points)||w.points.some(p=>Math.hypot(p[0]-lm.x,p[1]-lm.z)<220)).map(w=>w.points);let best:{spot:FishingSpot;score:number}|undefined;
  for(const outline of outlines)for(let i=1;i<outline.length;i++){const a=outline[i-1],b=outline[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.5)continue;for(let t=.2;t<1;t+=Math.min(.5,8/length)){const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,nx=(b[1]-a[1])/length,nz=-(b[0]-a[0])/length;
   for(const sign of [-1,1]){const stand:Point=[x+nx*sign*3,z+nz*sign*3],cast:Point=[x-nx*sign*9,z-nz*sign*9];if(!terrain.land(...stand)||terrain.obstructed(...stand,1.4)||terrain.land(...cast)||terrain.height(...stand)<1.3)continue;if([.45,.6,.8,1].some(u=>terrain.land(stand[0]+(cast[0]-stand[0])*u,stand[1]+(cast[1]-stand[1])*u)))continue;
    const score=Math.hypot(stand[0]-lm.x,stand[1]-lm.z);if(!best||score<best.score)best={spot:{id:'fish-'+id,name,stand,cast,level:river?0:1.05},score};}
  }}if(best)result.push(best.spot);
 }return result;}
export type FishingPhase='ready'|'casting'|'waiting'|'bite'|'reeling'|'caught'|'lost';
export class FishingSession{
 phase:FishingPhase='ready';age=0;elapsed=0;tension=.25;progress=0;wait=4;reason='';catchIndex=0;
 cast(random=Math.random()){if(!['ready','caught','lost'].includes(this.phase))return;this.phase='casting';this.age=0;this.elapsed=0;this.tension=.25;this.progress=0;this.wait=3+Math.max(0,Math.min(1,random))*4;this.catchIndex=Math.floor(Math.max(0,Math.min(.99999,random))*4);this.reason='';}
 hook(){if(this.phase==='bite'){this.phase='reeling';this.age=0;return true;}return false;}
 tick(seconds:number,reel:boolean){const dt=Number.isFinite(seconds)?Math.max(0,Math.min(.05,seconds)):0;this.age+=dt;this.elapsed+=dt;
  if(this.phase==='casting'&&this.age>.9){this.phase='waiting';this.age=0;}
  else if(this.phase==='waiting'&&this.age>this.wait){this.phase='bite';this.age=0;}
  else if(this.phase==='bite'&&this.age>4.5){this.phase='lost';this.reason='The fish let go. Try another cast.';}
  else if(this.phase==='reeling'){const pull=.5+.5*Math.sin(this.age*1.8);this.tension=Math.max(.05,Math.min(1.01,this.tension+dt*(reel?.14+pull*.20:-.40)));this.progress=Math.max(0,this.progress+dt*(reel?.105:-.012));if(this.tension>=1){this.phase='lost';this.reason='Too much tension—the fish got away.';}else if(this.progress>=1){this.phase='caught';this.progress=1;}}
 }
}
export const FISH=[{name:'Yellow perch',cm:24,color:0x9ba04d},{name:'Smallmouth bass',cm:36,color:0x657443},{name:'Bluegill',cm:18,color:0x718e76},{name:'Largemouth bass',cm:41,color:0x687852}] as const;
