import {inside,ParkTerrain,type ParkMap,type Point} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';
export type LakePlant={x:number;z:number;y:number;size:number;yaw:number;tint:number};
export type LakeLog={a:[number,number,number];b:[number,number,number];radius:number};
export type LakeHabitatPlan={version:1;lakeId:string;rocks:LakePlant[];reeds:LakePlant[];pads:LakePlant[];logs:LakeLog[];evidence:string};

/** Build-time only: preserve mapped water/islands and reserve road/bridge corridors. */
export function makeLakeHabitat(map:ParkMap,lakeId='420959'):LakeHabitatPlan{
 const plan:LakeHabitatPlan={version:1,lakeId,rocks:[],reeds:[],pads:[],logs:[],evidence:lakeId==='32613819'?'User-supplied Blue Heron Lagoon aerial and shoreline photographs; OSM lagoon and inlet trail. Habitat placements are artistic, not surveyed.':'FDR restoration page and aerial gallery; OSM Lake Okonoka shoreline. Individual habitat positions are artistic, not surveyed.'};
 const lake=map.waterSources?.find(w=>w.id===lakeId);if(!lake)return plan;
 const terrain=new ParkTerrain(map),occupied=roadIndex(map.roads);
 const heron=lakeId==='32613819',reedLimit=heron?650:900,padLimit=heron?950:1400,logLimit=heron?18:28;
 let seed=Number(lakeId);const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const wet=(x:number,z:number)=>inside(x,z,lake.points)&&!lake.holes.some(h=>inside(x,z,h));
 const round=(v:number)=>Math.round(v*1000)/1000;
 const plant=(x:number,z:number,y:number,size:number):LakePlant=>({x:round(x),z:round(z),y,size:round(size),yaw:round(random()*Math.PI*2),tint:round(.85+random()*.25)});
 const waterClear=(x:number,z:number,margin=3)=>wet(x,z)&&!occupied(x,z,'',margin)&&!terrain.obstructed(x,z,margin);
 for(const ring of [lake.points,...lake.holes])for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<1)continue;
  let nx=dz/len,nz=-dx/len;const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
  if(!wet(mx+nx*.2,mz+nz*.2)){nx=-nx;nz=-nz;}
  for(let d=3;d<len;d+=6+random()*7){
   const x=a[0]+dx*d/len,z=a[1]+dz*d/len;
   // Riprap clusters flank the eastern river opening without entering the trail.
   if(heron&&x>3820&&z< -110&&random()<.85)for(let k=0;k<5&&plan.rocks.length<240;k++){
    const along=(random()-.5)*7,offset=.25+random()*.7,rx=x+dx/len*along+nx*offset,rz=z+dz/len*along+nz*offset;
    if(wet(rx,rz)&&!occupied(rx,rz,'',1.5))plan.rocks.push(plant(rx,rz,1.35+random()*.22,.25+random()*.4));
   }
   // Clusters separated by open banks. Keep mapped viewing paths clear.
   if(random()<.72)for(let j=0;j<7;j++){
    const along=(random()-.5)*5,inland=.5+random()*3.5,rx=x+dx/len*along-nx*inland,rz=z+dz/len*along-nz*inland;
    if(terrain.land(rx,rz)&&!occupied(rx,rz,'',2)&&!terrain.obstructed(rx,rz,1)&&plan.reeds.length<reedLimit)
     plan.reeds.push(plant(rx,rz,terrain.height(rx,rz),.55+random()*.8));
   }
   if(random()<.65)for(let j=0;j<10;j++){
    const along=(random()-.5)*7,offset=1.8+random()*4,px=x+dx/len*along+nx*offset,pz=z+dz/len*along+nz*offset;
    if(waterClear(px,pz)&&plan.pads.length<padLimit)plan.pads.push(plant(px,pz,1.065,.15+random()*.25));
   }
   if(random()<.13&&plan.logs.length<logLimit){
    const length=3+random()*3.5,px=x+nx*2.4,pz=z+nz*2.4;
    const p:Point=[px-dx/len*length/2,pz-dz/len*length/2],q:Point=[px+dx/len*length/2,pz+dz/len*length/2];
    if([0,.25,.5,.75,1].every(t=>waterClear(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,4)))
     plan.logs.push({a:[round(p[0]),1.12,round(p[1])],b:[round(q[0]),1.25,round(q[1])],radius:round(.16+random()*.12)});
   }
  }
 }
 return plan;
}
