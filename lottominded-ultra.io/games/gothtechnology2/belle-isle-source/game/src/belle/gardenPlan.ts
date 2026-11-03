import {inside,segment,ParkTerrain,type ParkMap} from './terrain.ts';
import {greenhouseLocal} from './conservatory.ts';
import {roadIndex} from './streetPlan.ts';

export type GardenPlant={x:number;z:number;y:number;height:number;spread:number;yaw:number;palette:number;bed:string};
export type GardenPlan={version:1;plants:GardenPlant[];notes:string};
// Kept offline: denser planting must not add polygon scans to the riding loop.
export function makeGardenPlan(map:ParkMap):GardenPlan{
 const terrain=new ParkTerrain(map),occupied=roadIndex(map.roads),plants:GardenPlant[]=[];
 let seed=111022;const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const rounded=(n:number)=>Math.round(n*1000)/1000;
 for(const bed of map.areas.filter(a=>a.kind==='garden')){
  const xs=bed.points.map(p=>p[0]),zs=bed.points.map(p=>p[1]);
  for(let x0=Math.min(...xs);x0<Math.max(...xs);x0+=1.05)for(let z0=Math.min(...zs);z0<Math.max(...zs);z0+=1.05){
   const x=x0+(rand()-.5)*.48,z=z0+(rand()-.5)*.48;
   if(!inside(x,z,bed.points)||(bed.holes||[]).some(h=>inside(x,z,h))||!terrain.land(x,z)||terrain.bridge(x,z).active)continue;
   if(occupied(x,z,'',.8)||terrain.obstructed(x,z,1.2))continue;
   if(bed.points.slice(1).some((p,i)=>segment(x,z,bed.points[i],p).d<.55))continue;
   if((map.monuments||[]).some(m=>Math.hypot(x-m.x,z-m.z)<m.radius+1.5))continue;
   // Preserve the formal garden's broad lawns and axial walks; enrich the
   // existing authored borders rather than filling every lawn with flowers.
   let band=0;
   if(bed.id==='107227702'&&map.conservatory){
    const p=greenhouseLocal(map.conservatory,x,z);
    if(p.u> -32||p.u< -140)continue;
    band=[-25,-16,16,25].reduce((a,b)=>Math.abs(p.v-a)<Math.abs(p.v-b)?a:b);
    if(Math.abs(p.v-band-.45*Math.sin(p.u*.15))>1.8)continue;
   }
   const drift=.5+.25*Math.sin(x*.43+Math.sin(z*.16)*1.8)+.25*Math.cos(z*.35-x*.11);
   if(rand()>(.57+drift*.4))continue;
   const palette=Math.abs(Math.floor(x/8+Math.sin(z*.09)*2)+Math.floor(z/7)+band)%5;
   plants.push({x:rounded(x),z:rounded(z),y:rounded(terrain.height(x,z)+.035),height:rounded(.33+drift*.30+rand()*.20),spread:rounded(.75+rand()*.4),yaw:rounded(rand()*Math.PI*2),palette,bed:bed.id});
  }
 }
 if(plants.length>5000)throw new Error('Garden detail exceeds the fixed geometry budget: '+plants.length);
 return{version:1,plants,notes:'Mapped garden beds; clustered seasonal colour is a reconstruction, not a planting survey. Paths, lawns, water and monument bases remain clear.'};
}
