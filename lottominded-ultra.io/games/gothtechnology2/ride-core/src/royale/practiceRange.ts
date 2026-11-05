import type {BattleTerrain} from './battleTerrain.ts';import type {Vec3} from '../terrain.ts';import type {Projectile} from './rules.ts';
export type RangeTarget={distance:number;center:Vec3;hits:number};
export function rangeLayout(terrain:BattleTerrain){
 const candidates=[...terrain.spawns,...(terrain.spawnNodes??[])];
 for(const spawn of candidates)for(let i=0;i<16;i++){
  const heading=spawn.headingY+i*Math.PI/8,p=spawn.position,forward={x:Math.sin(heading),z:Math.cos(heading)},right={x:-Math.cos(heading),z:Math.sin(heading)};
  const targets=[10,25,50,100].map((distance,j)=>{const x=p.x+forward.x*distance+right.x*(j-1.5)*3,z=p.z+forward.z*distance+right.z*(j-1.5)*3;return{distance,center:{x,y:terrain.ground(x,z,p.y).height+1.3,z},hits:0};});
  if(!terrain.clear(p.x,p.z,1,p.y)||!targets.every(t=>terrain.clear(t.center.x,t.center.z,1,t.center.y-1.3)&&Math.abs(t.center.y-1.3-p.y)<.4&&terrain.line({x:p.x,y:p.y+1.3,z:p.z},t.center,.7)))continue;
  // Local training only. No room option can select this terrain or these rules.
  const training=Object.create(terrain) as BattleTerrain;
  Object.defineProperties(training,{spawns:{value:[{position:{...p},headingY:heading}]},spawnNodes:{value:undefined},zones:{value:Array.from({length:5},()=>({x:p.x,z:p.z}))},fieldRadii:{value:[2000,1900,1800,1700,1600,0]},supplies:{value:Array.from({length:14},(_,j)=>{const x=p.x+right.x*(j%7-3)*2-forward.x*(4+Math.floor(j/7)*3),z=p.z+right.z*(j%7-3)*2-forward.z*(4+Math.floor(j/7)*3);return{x,y:terrain.ground(x,z,p.y).height,z};})},optics:{value:['scope2','scope4','scope8'].map((kind,j)=>{const x=p.x-right.x*(5+j*2)-forward.x*2,z=p.z-right.z*(5+j*2)-forward.z*2;return{kind,p:{x,y:terrain.ground(x,z,p.y).height,z}};})}});
  return{terrain:training,origin:{...p},heading,targets};
 }throw Error('No clear 100 metre practice lane is available in this map.');
}
/** Targets register only segments traveled by actual authoritative projectiles. */
export class RangeScoring {
 private previous=new Map<string,Vec3>();private hits=new Set<string>();
 constructor(readonly targets:RangeTarget[],readonly heading:number){}
 observe(shots:readonly Projectile[],owner:string,origin:(p:Projectile)=>Vec3){
  const impacts:{target:RangeTarget;point:Vec3}[]=[],active=new Set(shots.map(p=>p.id)),nx=Math.sin(this.heading),nz=Math.cos(this.heading);
  for(const shot of shots){if(shot.owner!==owner)continue;const a=this.previous.get(shot.id)??origin(shot),b=shot.p;this.previous.set(shot.id,{...b});
   for(const target of this.targets){const key=shot.id+':'+target.distance;if(this.hits.has(key))continue;
    const from=(a.x-target.center.x)*nx+(a.z-target.center.z)*nz,to=(b.x-target.center.x)*nx+(b.z-target.center.z)*nz;if(from>0||to<0||to-from<1e-8)continue;
    const t=-from/(to-from),point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},side=(point.x-target.center.x)*nz-(point.z-target.center.z)*nx;
    if(Math.abs(side)<=.65&&Math.abs(point.y-target.center.y)<=.85){target.hits++;this.hits.add(key);impacts.push({target,point});}
   }
  }
  for(const id of this.previous.keys())if(!active.has(id)){this.previous.delete(id);for(const t of this.targets)this.hits.delete(id+':'+t.distance);}
  return impacts;
 }
}
